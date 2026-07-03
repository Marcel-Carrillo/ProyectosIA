# Backend Implementation Plan: product-gtin-identifier

Scope: `openspec/changes/product-gtin-identifier/tasks.md` sections **1–7** only (schema/migration, domain model, repository contracts, repository implementation, validator TDD, public serializer + allow-list test, supplier feed type + mapper TDD, supplier feed importer propagation). Frontend (sections 8–10) and mandatory verification/docs/PR steps (11–16) are out of scope for this file.

Reference implementation pattern: `brand` (String? on `Product`, end-to-end). All new code mirrors its exact position/style unless noted.

---

## IMPORTANT — pre-existing gap to flag to the parent session

`ProductService.update()` (`backend/src/application/services/productService.ts:83-120`) **never calls `validateProductData`** — only `ProductService.create()` does (line 40: `validateProductData(data as Record<string, unknown>);`). This is a pre-existing gap that affects every field (`name`, `status`, not just the new `gtin`), not something introduced by this change. `productController.updateProduct` (`backend/src/presentation/controllers/productController.ts:70-80`) also does not call any product-shape validator before `productService.update(...)`.

**Consequence for this task**: with the plan below, an invalid-format `gtin` will be rejected on `POST /api/admin/products` (create) but **NOT** on `PATCH /api/admin/products/:id` (update) — a bad value would be persisted as-is on update. `openspec/changes/product-gtin-identifier/tasks.md` §13 only requires curl-testing invalid `gtin` on the POST path (13.3), so this plan does not silently "fix" the update path (that would be a scope-creep architectural change requiring approval per `docs/base-standards.md` §17). **Flag this explicitly to the user/parent session** — if PATCH-path rejection of invalid `gtin` is actually required, `ProductService.update()` needs `validateProductData(data as Record<string, unknown>)` added at the top, which is a broader change (it would also start enforcing `name`/`status` rules on update for the first time) and should be called out as a separate decision, not bundled silently into this change.

---

## 1. `backend/prisma/schema.prisma` — schema + migration

Current `Product` model (lines 43–59):

```prisma
model Product {
  id           Int              @id @default(autoincrement())
  name         String           @db.VarChar(150)
  slug         String           @unique @db.VarChar(200)
  description  String?          @db.VarChar(2000)
  brand        String?          @db.VarChar(100)
  status       String           @default("Draft")
  mainImageUrl String?          @db.VarChar(500)
  categoryId   Int?
  category     Category?        @relation(fields: [categoryId], references: [id])
  deletedAt    DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  variants     ProductVariant[]
  images       ProductImage[]
  translations ProductTranslation[]
}
```

**Edit**: insert a `gtin` line immediately after `brand` (after line 48):

```prisma
  brand        String?          @db.VarChar(100)
  gtin         String?          @db.VarChar(14)
```

Full block becomes:

```prisma
model Product {
  id           Int              @id @default(autoincrement())
  name         String           @db.VarChar(150)
  slug         String           @unique @db.VarChar(200)
  description  String?          @db.VarChar(2000)
  brand        String?          @db.VarChar(100)
  gtin         String?          @db.VarChar(14)
  status       String           @default("Draft")
  mainImageUrl String?          @db.VarChar(500)
  categoryId   Int?
  category     Category?        @relation(fields: [categoryId], references: [id])
  deletedAt    DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  variants     ProductVariant[]
  images       ProductImage[]
  translations ProductTranslation[]
}
```

`String? @db.VarChar(14)` — nullable, never numeric (design.md decision: GTINs can have significant leading zeros and are never used arithmetically).

**Migration**: from `backend/`, run:

```bash
npx prisma migrate dev --name add_product_gtin
```

This generates an additive `ALTER TABLE "Product" ADD COLUMN "gtin" VARCHAR(14);` — nullable, no default, no backfill, no data loss to existing rows (verify the generated SQL in `backend/prisma/migrations/<timestamp>_add_product_gtin/migration.sql` contains exactly one `ADD COLUMN` statement and nothing else destructive).

---

## 2. Domain Model and Repository Contracts

### 2a. `backend/src/domain/models/product.ts`

Current file is 61 lines. Three edits, all mirroring the existing `brand` handling:

**Property list** (after line 12 `brand?: string | null;`):
```ts
  brand?: string | null;
  gtin?: string | null;
```

**Constructor parameter type** (after line 28 `brand?: string | null;` inside the `data: {...}` object type):
```ts
    brand?: string | null;
    gtin?: string | null;
```

**Constructor body assignment** (after line 43 `this.brand = data.brand ?? null;`):
```ts
    this.brand = data.brand ?? null;
    this.gtin = data.gtin ?? null;
```

Resulting class (only the changed region shown):
```ts
export class Product {
  id?: number;
  name: string;
  slug: string;
  description?: string | null;
  brand?: string | null;
  gtin?: string | null;
  status: ProductStatus;
  ...

  constructor(data: {
    id?: number;
    name: string;
    slug: string;
    description?: string | null;
    brand?: string | null;
    gtin?: string | null;
    status?: string;
    ...
  }) {
    ...
    this.description = data.description ?? null;
    this.brand = data.brand ?? null;
    this.gtin = data.gtin ?? null;
    this.status = (data.status as ProductStatus) ?? 'Draft';
    ...
  }
}
```

### 2b. `backend/src/domain/repositories/productRepository.ts`

Current `ProductCreateData` (lines 5–13) and `ProductUpdateData` (lines 15–23) both already list `brand?: string | null;`. Add `gtin?: string | null;` immediately after `brand` in **both** interfaces:

```ts
export interface ProductCreateData {
  name: string;
  slug: string;
  description?: string | null;
  brand?: string | null;
  gtin?: string | null;
  status?: string;
  mainImageUrl?: string | null;
  categoryId?: number | null;
}

export interface ProductUpdateData {
  name?: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
  gtin?: string | null;
  status?: string;
  mainImageUrl?: string | null;
  categoryId?: number | null;
}
```

No other interfaces in this file need changes (variant/image contracts are unrelated).

No dedicated test file exists for the domain model/interfaces (none currently exercises `Product`'s constructor field-by-field or the interface shapes directly) — coverage for these types comes transitively from the serializer test (§5) and the repository/mapper tests (§4, §6, §7). No new test file needs to be created for §2 itself.

---

## 3. `backend/src/infrastructure/repositories/productRepository.ts` — Prisma implementation

### 3a. `create()` (current lines 140–156)

Current:
```ts
  async create(data: ProductCreateData): Promise<Product> {
    const existing = await this.findBySlug(data.slug);
    if (existing) throw new ProductSlugConflictError();

    const row = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        brand: data.brand ?? null,
        status: data.status ?? 'Draft',
        mainImageUrl: data.mainImageUrl ?? null,
        categoryId: data.categoryId ?? null,
      },
    });
    return new Product(row);
  }
```

**Edit**: add `gtin: data.gtin ?? null,` immediately after `brand: data.brand ?? null,`:

```ts
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        brand: data.brand ?? null,
        gtin: data.gtin ?? null,
        status: data.status ?? 'Draft',
        mainImageUrl: data.mainImageUrl ?? null,
        categoryId: data.categoryId ?? null,
      },
```

### 3b. `update()` (current lines 158–180)

Current:
```ts
    const row = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.mainImageUrl !== undefined && { mainImageUrl: data.mainImageUrl }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      },
    });
```

**Edit**: add the conditional `gtin` spread immediately after the `brand` line:

```ts
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.gtin !== undefined && { gtin: data.gtin }),
```

No other methods in this file (`findAll`, `findById`, `findBySlug`, `softDelete`) need changes — they already `select`/return whole `Product` rows via `new Product(row)`, which will now naturally include `gtin` once the Prisma Client is regenerated after the schema change (§1).

There is no existing `backend/src/infrastructure/repositories/productRepository.test.ts` — this repository has no dedicated unit test file today (confirmed via glob: only `categoryRepository.test.ts` exists among infra repo tests). Per `tasks.md` §3 there is no instruction to create one now; coverage for `create`/`update` persistence of `gtin` is exercised indirectly through the (existing, unchanged) `productController.test.ts` mocking the service layer, and directly through the supplier feed importer tests (§7). **No new test file is required for §3.**

---

## 4. `backend/src/application/validator.ts` — GTIN validation (TDD)

### 4a. New shared helper (exported, reused by the supplier feed mapper in §6 to avoid duplicating the format rule)

Insert this **above** `validateProductData` (i.e., right after the `TranslationLocaleInvalidError` class, before line 32 `export function validateRequiredFields`, or immediately before `validateProductData` at line 44 — place it directly before `validateProductData` to keep it visually next to its only two call sites):

```ts
const GTIN_VALID_LENGTHS = [8, 12, 13, 14];

export function isValidGtinFormat(value: string): boolean {
  return /^\d+$/.test(value) && GTIN_VALID_LENGTHS.includes(value.length);
}
```

Precedent for infrastructure importing from `application/validator.ts`: `backend/src/infrastructure/repositories/categoryRepository.ts:8` already does `import { ValidationError } from '../../application/validator';` — so `mapSupplierFeedProduct.ts` (infrastructure layer) importing `isValidGtinFormat` from here is consistent with the existing codebase pattern, not a new layering violation.

### 4b. `validateProductData` (current lines 44–60)

Current:
```ts
export function validateProductData(data: Record<string, unknown>): void {
  const name = data['name'];
  if (name === undefined || name === null || name === '') {
    throw new ValidationError("Field 'name' is required");
  }
  if (typeof name === 'string' && name.length > 150) {
    throw new ValidationError("Field 'name' must not exceed 150 characters");
  }

  const status = data['status'];
  if (status !== undefined && status !== null && status !== '') {
    const validStatuses = ['Draft', 'Active', 'Inactive', 'Archived'];
    if (!validStatuses.includes(status as string)) {
      throw new ValidationError(`Field 'status' must be one of: ${validStatuses.join(', ')}`);
    }
  }
}
```

**Edit**: append a `gtin` block at the end of the function body, before the closing `}`:

```ts
export function validateProductData(data: Record<string, unknown>): void {
  const name = data['name'];
  if (name === undefined || name === null || name === '') {
    throw new ValidationError("Field 'name' is required");
  }
  if (typeof name === 'string' && name.length > 150) {
    throw new ValidationError("Field 'name' must not exceed 150 characters");
  }

  const status = data['status'];
  if (status !== undefined && status !== null && status !== '') {
    const validStatuses = ['Draft', 'Active', 'Inactive', 'Archived'];
    if (!validStatuses.includes(status as string)) {
      throw new ValidationError(`Field 'status' must be one of: ${validStatuses.join(', ')}`);
    }
  }

  const gtin = data['gtin'];
  if (gtin !== undefined && gtin !== null) {
    if (typeof gtin !== 'string') {
      throw new ValidationError("Field 'gtin' must be a string");
    }
    const trimmed = gtin.trim();
    if (trimmed === '') {
      data['gtin'] = null;
    } else if (!isValidGtinFormat(trimmed)) {
      throw new ValidationError(
        "Field 'gtin' must contain only digits and be 8, 12, 13, or 14 characters long"
      );
    } else {
      data['gtin'] = trimmed;
    }
  }
}
```

**Why mutate `data` in place instead of returning a value**: `validateProductData`'s signature is `(data: Record<string, unknown>): void` and every call site relies on this. `ProductService.create()` (`backend/src/application/services/productService.ts:40-47`) does:
```ts
validateProductData(data as Record<string, unknown>);
...
const { translations, ...productData } = data;
...
const product = await this.repo.create({ ...productData, slug });
```
`data as Record<string, unknown>` is a type-only cast — it is the **same object reference**, not a copy. Mutating `data['gtin']` inside `validateProductData` (empty string → `null`, or trimmed value) is therefore visible in `productData` after destructuring, and flows through to `repo.create(...)` correctly. This satisfies the spec scenario "Empty GTIN string normalizes to null" end-to-end without changing the function's `void` signature or any call site.

### 4c. `backend/src/application/validator.test.ts` — new tests (currently only has `describe('validateRequiredFields', ...)` and `describe('validateCategoryData', ...)`; there is **no** existing `describe('validateProductData', ...)` block — confirmed via grep, `validateProductData` has zero current test coverage)

Add the import and a new `describe` block. Current line 1:
```ts
import { validateRequiredFields, validateCategoryData, ValidationError } from './validator';
```
**Edit** to:
```ts
import {
  validateRequiredFields,
  validateCategoryData,
  validateProductData,
  isValidGtinFormat,
  ValidationError,
} from './validator';
```

Append a new `describe` block at the end of the file (after the closing `});` of `describe('validateCategoryData', ...)` at line 81):

```ts
describe('validateProductData', () => {
  it('passes when name is provided and gtin is omitted', () => {
    expect(() => validateProductData({ name: 'Summer Dress' })).not.toThrow();
  });

  it.each([8, 12, 13, 14])('accepts a valid %i-digit gtin', (length) => {
    const gtin = '1'.repeat(length);
    const data: Record<string, unknown> = { name: 'Summer Dress', gtin };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBe(gtin);
  });

  it('throws ValidationError when gtin contains non-digit characters', () => {
    expect(() =>
      validateProductData({ name: 'Summer Dress', gtin: '12345ABC9012' })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when gtin has an invalid length', () => {
    expect(() =>
      validateProductData({ name: 'Summer Dress', gtin: '123456789' }) // 9 digits
    ).toThrow(ValidationError);
    expect(() =>
      validateProductData({ name: 'Summer Dress', gtin: '1234567' }) // 7 digits
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when gtin is not a string', () => {
    expect(() =>
      validateProductData({ name: 'Summer Dress', gtin: 12345678 })
    ).toThrow(ValidationError);
  });

  it('normalizes an empty-string gtin to null instead of throwing', () => {
    const data: Record<string, unknown> = { name: 'Summer Dress', gtin: '' };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBeNull();
  });

  it('normalizes a whitespace-only gtin to null', () => {
    const data: Record<string, unknown> = { name: 'Summer Dress', gtin: '   ' };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBeNull();
  });

  it('leaves gtin untouched when omitted entirely', () => {
    const data: Record<string, unknown> = { name: 'Summer Dress' };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBeUndefined();
  });

  it('trims surrounding whitespace on a valid gtin', () => {
    const data: Record<string, unknown> = { name: 'Summer Dress', gtin: '  5901234123457  ' };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBe('5901234123457');
  });
});

describe('isValidGtinFormat', () => {
  it.each([8, 12, 13, 14])('returns true for a %i-digit numeric string', (length) => {
    expect(isValidGtinFormat('1'.repeat(length))).toBe(true);
  });

  it.each([1, 7, 9, 10, 11, 15])('returns false for a %i-digit numeric string', (length) => {
    expect(isValidGtinFormat('1'.repeat(length))).toBe(false);
  });

  it('returns false for non-digit characters', () => {
    expect(isValidGtinFormat('12345ABC9012')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidGtinFormat('')).toBe(false);
  });
});
```

Run: `cd backend && npx jest src/application/validator.test.ts` (TDD flow: write these tests first against the *current* `validateProductData` — they will fail on every `gtin`-related assertion — then apply the §4b edit and re-run until green).

---

## 5. `backend/src/presentation/serializers/publicProduct.ts` — public serializer + allow-list test

### 5a. `publicProduct.ts`

**`PublicProductDTO` interface** (current lines 32–45):
```ts
export interface PublicProductDTO {
  id?: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  status: string;
  mainImageUrl: string | null;
  categoryId: number | null;
  variants: PublicVariantDTO[];
  images: PublicProductImageDTO[];
  createdAt?: Date;
  updatedAt?: Date;
}
```
**Edit**: add `gtin: string | null;` immediately after `brand: string | null;`:
```ts
  brand: string | null;
  gtin: string | null;
```

**`serializePublicProduct` return object** (current lines 80–93):
```ts
  return {
    id: product.id,
    name: resolved.name,
    slug: product.slug,
    description: resolved.description,
    brand: product.brand ?? null,
    status: product.status,
    mainImageUrl: product.mainImageUrl ?? null,
    categoryId: product.categoryId ?? null,
    variants,
    images,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
```
**Edit**: add `gtin: product.gtin ?? null,` immediately after `brand: product.brand ?? null,`:
```ts
    brand: product.brand ?? null,
    gtin: product.gtin ?? null,
```

Design.md is explicit: "GTIN is public catalog data and is not subject to supplier-data exposure restrictions" — no special-casing needed, it's a plain pass-through like `brand`.

### 5b. `backend/src/presentation/serializers/__tests__/publicProduct.test.ts`

**`makeProduct()` factory** (current lines 5–24) — add `gtin` alongside `brand`:
```ts
const makeProduct = () =>
  new Product({
    id: 1,
    name: 'Summer Dress',
    slug: 'summer-dress',
    description: 'A light dress',
    brand: 'Acme',
    gtin: '5901234123457',
    status: 'Active',
    ...
```

**Allow-list assertion** (current lines 27–48) — add `'gtin'` to the sorted keys array, in its correct alphabetical slot (between `'description'` and `'id'`):
```ts
  it('exposes only the customer-safe allow-list of fields', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(Object.keys(dto).sort()).toEqual(
      [
        'brand',
        'categoryId',
        'createdAt',
        'description',
        'gtin',
        'id',
        'images',
        'mainImageUrl',
        'name',
        'slug',
        'status',
        'updatedAt',
        'variants',
      ].sort(),
    );
    expect(Object.keys(dto.variants[0]).sort()).toEqual(
      ['color', 'compareAtPrice', 'id', 'publicPrice', 'sku', 'size', 'status'].sort(),
    );
  });
```
(`.sort()` on the array makes exact insertion position cosmetic, but keeping it alphabetical matches the existing style.)

**New tests** — append after the existing `'returns EN translation...'`/`'never emits supplier...'` tests, e.g. right after the `'orders images by sortOrder'` test (current lines 56–59), two new `it` blocks:

```ts
  it('includes the gtin value when present', () => {
    const dto = serializePublicProduct(makeProduct());
    expect(dto.gtin).toBe('5901234123457');
  });

  it('includes gtin as null when the product has no gtin', () => {
    const product = new Product({ id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Active' });
    const dto = serializePublicProduct(product);
    expect(dto.gtin).toBeNull();
  });
```

Run: `cd backend && npx jest src/presentation/serializers/__tests__/publicProduct.test.ts`.

---

## 6. `backend/src/infrastructure/external/supplierFeedTypes.ts` + `backend/src/infrastructure/import/mapSupplierFeedProduct.ts` (TDD)

### 6a. `supplierFeedTypes.ts` — add source field

Current `SupplierFeedProduct` (lines 15–25):
```ts
export interface SupplierFeedProduct {
  supplier: SupplierFeedSupplierRef;
  externalRef: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  supplierCost: number;
  images: string[];
  variants: SupplierFeedVariant[];
}
```
**Edit**: add an optional `ean` field immediately after `brand`:
```ts
export interface SupplierFeedProduct {
  supplier: SupplierFeedSupplierRef;
  externalRef: string;
  title: string;
  description: string;
  brand: string;
  ean?: string;
  category: string;
  supplierCost: number;
  images: string[];
  variants: SupplierFeedVariant[];
}
```
Optional (`ean?:`) because design.md and spec.md both require the "absent EAN" case to succeed with `gtin: null`, and existing fixture data (`backend/prisma/fixtures/supplier-feed.sample.json`) has no such field today (confirmed — non-goal: "Backfilling real GTIN values into existing seed/fixture data"). No changes to that fixture file are in scope.

### 6b. `mapSupplierFeedProduct.ts` — mapping logic

Current `MappedSupplierFeedProduct` (lines 14–24):
```ts
export interface MappedSupplierFeedProduct {
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  status: 'Draft';
  mainImageUrl: null;
  categoryName: string;
  supplierName: string;
  variants: MappedSupplierFeedVariant[];
}
```
**Edit**: add `gtin: string | null;` immediately after `brand: string | null;`:
```ts
  brand: string | null;
  gtin: string | null;
```

**Import** — add `isValidGtinFormat` to the existing import (current line 1):
```ts
import { SupplierFeedProduct } from '../external/supplierFeedTypes';
```
becomes:
```ts
import { SupplierFeedProduct } from '../external/supplierFeedTypes';
import { isValidGtinFormat } from '../../application/validator';
```

**New local helper** — insert after `generateSlug` (current lines 26–33), before the comment block preceding `mapSupplierFeedProduct` (current line 35):
```ts
// Best-effort EAN → gtin normalization: trims the source value and validates it
// against the same format rule as validateProductData. Missing or invalid input
// maps to null rather than throwing, so a bad/absent barcode in a feed entry
// never blocks the import (design.md decision: "Supplier feed mapping is
// best-effort and additive").
function normalizeGtin(ean: string | undefined): string | null {
  if (!ean) return null;
  const trimmed = ean.trim();
  if (trimmed === '' || !isValidGtinFormat(trimmed)) return null;
  return trimmed;
}
```

**`mapSupplierFeedProduct` return object** (current lines 39–59) — add `gtin: normalizeGtin(product.ean),` immediately after `brand: product.brand?.trim() || null,`:
```ts
export function mapSupplierFeedProduct(product: SupplierFeedProduct): MappedSupplierFeedProduct {
  return {
    name: product.title.trim(),
    slug: generateSlug(product.title),
    description: product.description?.trim() || null,
    brand: product.brand?.trim() || null,
    gtin: normalizeGtin(product.ean),
    status: 'Draft',
    mainImageUrl: null,
    categoryName: product.category.trim(),
    supplierName: product.supplier.name.trim(),
    variants: product.variants.map((v) => ({
      ...
```

### 6c. `backend/src/infrastructure/import/__tests__/mapSupplierFeedProduct.test.ts` — new tests

`baseProduct` (current lines 4–17) has no `ean` field — leave it as-is (its absence is itself the "missing EAN" test case). Add new tests at the end of the `describe('mapSupplierFeedProduct', ...)` block, after the existing `'falls back to null when description or brand is empty or whitespace-only'` test (current lines 69–78, before the closing `});` at line 79):

```ts
  it('maps a valid 13-digit ean to gtin', () => {
    const mapped = mapSupplierFeedProduct({ ...baseProduct, ean: '5901234123457' });

    expect(mapped.gtin).toBe('5901234123457');
  });

  it.each([8, 12, 13, 14])('maps a valid %i-digit ean to gtin', (length) => {
    const ean = '1'.repeat(length);
    const mapped = mapSupplierFeedProduct({ ...baseProduct, ean });

    expect(mapped.gtin).toBe(ean);
  });

  it('maps a missing ean to null gtin without throwing', () => {
    const mapped = mapSupplierFeedProduct(baseProduct);

    expect(mapped.gtin).toBeNull();
  });

  it('maps an invalid-format ean to null gtin rather than fabricating or throwing', () => {
    const mapped = mapSupplierFeedProduct({ ...baseProduct, ean: '12345ABC9012' });

    expect(mapped.gtin).toBeNull();
  });

  it('maps an ean with an invalid length to null gtin', () => {
    const mapped = mapSupplierFeedProduct({ ...baseProduct, ean: '123456789' }); // 9 digits

    expect(mapped.gtin).toBeNull();
  });

  it('trims whitespace before validating ean', () => {
    const mapped = mapSupplierFeedProduct({ ...baseProduct, ean: '  5901234123457  ' });

    expect(mapped.gtin).toBe('5901234123457');
  });
```

Note: `{ ...baseProduct, ean: '...' }` type-checks because `ean?: string` was added as optional in §6a, and `baseProduct` is typed `SupplierFeedProduct`.

Run: `cd backend && npx jest src/infrastructure/import/__tests__/mapSupplierFeedProduct.test.ts`.

---

## 7. `backend/src/infrastructure/import/supplierFeedImporter.ts` — propagation

### 7a. `upsertImportedProduct` (current lines 154–200)

**Update branch** (current lines 165–176):
```ts
  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: mapped.name,
        description: mapped.description,
        brand: mapped.brand,
        status: mapped.status,
        mainImageUrl: mapped.mainImageUrl,
        categoryId,
        deletedAt: null,
      },
    });
```
**Edit**: add `gtin: mapped.gtin,` immediately after `brand: mapped.brand,`:
```ts
      data: {
        name: mapped.name,
        description: mapped.description,
        brand: mapped.brand,
        gtin: mapped.gtin,
        status: mapped.status,
        mainImageUrl: mapped.mainImageUrl,
        categoryId,
        deletedAt: null,
      },
```

**Create branch** (current lines 187–198):
```ts
  await prisma.product.create({
    data: {
      name: mapped.name,
      slug: mapped.slug,
      description: mapped.description,
      brand: mapped.brand,
      status: mapped.status,
      mainImageUrl: mapped.mainImageUrl,
      categoryId,
      variants: { create: variantsData },
    },
  });
```
**Edit**: add `gtin: mapped.gtin,` immediately after `brand: mapped.brand,`:
```ts
    data: {
      name: mapped.name,
      slug: mapped.slug,
      description: mapped.description,
      brand: mapped.brand,
      gtin: mapped.gtin,
      status: mapped.status,
      mainImageUrl: mapped.mainImageUrl,
      categoryId,
      variants: { create: variantsData },
    },
```

`importSupplierFeedProducts` itself (current lines 202–232) needs **no change** — it already calls `mapSupplierFeedProduct(product)` (line 212) and passes the full `mapped` object into `upsertImportedProduct`, so once `mapped.gtin` exists (§6b) and the two Prisma calls above read it, propagation is complete. No new/changed fields on `ImportSupplierFeedResult` are needed — `gtin` is not counted, only persisted.

### 7b. `backend/src/infrastructure/import/__tests__/supplierFeedImporter.test.ts` — new/updated assertions

**`baseFixtureProduct`** (current lines 32–45) — add `ean` so both the create and update paths have a real value to propagate:
```ts
const baseFixtureProduct: SupplierFeedProduct = {
  supplier: { name: 'Atelier Nord', reference: 'SUP-AN-001' },
  externalRef: 'AN-DRESS-001',
  title: 'Belted Midi Wrap Dress',
  description: 'A wrap dress with a self-tie belt.',
  brand: 'Atelier Nord',
  ean: '5901234123457',
  category: 'Dresses',
  supplierCost: 18.5,
  images: [],
  variants: [
    { sku: 'AN-DRESS-001-S', size: 'S', publicPrice: 49.99 },
    { sku: 'AN-DRESS-001-M', size: 'M', publicPrice: 49.99 },
  ],
};
```

**Create-path test** (current `'creates a new supplier, category, and product on first import'`, lines 87–113) — extend the existing assertions on `createCall`:
```ts
    const createCall = mockPrisma.product.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('Draft');
    expect(createCall.data.mainImageUrl).toBeNull();
    expect(createCall.data.gtin).toBe('5901234123457');
```

**Update-path test** (current `'updates an existing product and replaces its variants without touching ProductImage'`, lines 143–160) — add an assertion on the `product.update` call's `data.gtin`:
```ts
  it('updates an existing product and replaces its variants without touching ProductImage', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 5, status: 'Active' });
    mockPrisma.category.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.product.findUnique.mockResolvedValue({ id: 42 });

    const result = await importSupplierFeedProducts(mockPrisma as unknown as Prisma.TransactionClient, [
      baseFixtureProduct,
    ]);

    expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.create).not.toHaveBeenCalled();
    const updateCall = mockPrisma.product.update.mock.calls[0][0];
    expect(updateCall.data.gtin).toBe('5901234123457');
    expect(mockPrisma.productVariant.deleteMany).toHaveBeenCalledWith({ where: { productId: 42 } });
    expect(mockPrisma.productVariant.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.productImage.deleteMany).not.toHaveBeenCalled();
    expect(result.productsCreated).toBe(0);
    expect(result.imagesCreated).toBe(0);
  });
```

**New dedicated test** — append to the `describe('importSupplierFeedProducts', ...)` block (after the `'is idempotent...'` test, current lines 162–180, before its closing) to explicitly cover the "missing EAN → null gtin, import still succeeds" spec scenario at the importer level:
```ts
  it('propagates a null gtin on create when the feed entry has no ean', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.supplier.findFirst.mockResolvedValue(null);
    mockPrisma.supplier.create.mockResolvedValue({ id: 1 });
    mockPrisma.category.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 });

    const { ean: _ean, ...productWithoutEan } = baseFixtureProduct;

    await importSupplierFeedProducts(mockPrisma as unknown as Prisma.TransactionClient, [
      productWithoutEan as SupplierFeedProduct,
    ]);

    const createCall = mockPrisma.product.create.mock.calls[0][0];
    expect(createCall.data.gtin).toBeNull();
  });
```
(The `_ean` prefix follows `docs/backend-standards.md` ESLint convention — `@typescript-eslint/no-unused-vars` requires unused destructured params to be prefixed with `_`.)

`readSupplierFeedFixture`'s own tests (current lines 183–257) need **no changes** — they exercise fixture parsing/validation, not the `gtin` mapping path, and `ean` being optional doesn't affect any of `assertIsSupplierFeedProduct`'s required-field checks.

Run: `cd backend && npx jest src/infrastructure/import/__tests__/supplierFeedImporter.test.ts`.

---

## Verification commands (sections 1–7 only)

```bash
cd backend
npx prisma migrate dev --name add_product_gtin   # §1 — generates + applies migration, regenerates Prisma Client
npm run lint
npx jest src/application/validator.test.ts
npx jest src/presentation/serializers/__tests__/publicProduct.test.ts
npx jest src/infrastructure/import/__tests__/mapSupplierFeedProduct.test.ts
npx jest src/infrastructure/import/__tests__/supplierFeedImporter.test.ts
npm test -- --watchAll=false   # full suite, confirm no regressions elsewhere (e.g. productController.test.ts)
```

## Summary of touched files (sections 1–7)

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `gtin String? @db.VarChar(14)` to `Product` |
| `backend/prisma/migrations/<ts>_add_product_gtin/` | New migration (generated by `prisma migrate dev`) |
| `backend/src/domain/models/product.ts` | Add `gtin` property, constructor param, assignment |
| `backend/src/domain/repositories/productRepository.ts` | Add `gtin?: string \| null` to `ProductCreateData`, `ProductUpdateData` |
| `backend/src/infrastructure/repositories/productRepository.ts` | Persist `gtin` in `create()` and `update()` |
| `backend/src/application/validator.ts` | New `isValidGtinFormat` export; `gtin` block in `validateProductData` |
| `backend/src/application/validator.test.ts` | New `describe('validateProductData')` and `describe('isValidGtinFormat')` blocks + import update |
| `backend/src/presentation/serializers/publicProduct.ts` | Add `gtin` to `PublicProductDTO` + `serializePublicProduct` |
| `backend/src/presentation/serializers/__tests__/publicProduct.test.ts` | Add `gtin` to `makeProduct`, allow-list array, 2 new tests |
| `backend/src/infrastructure/external/supplierFeedTypes.ts` | Add `ean?: string` to `SupplierFeedProduct` |
| `backend/src/infrastructure/import/mapSupplierFeedProduct.ts` | Add `gtin` to `MappedSupplierFeedProduct`; `normalizeGtin` helper; import `isValidGtinFormat` |
| `backend/src/infrastructure/import/__tests__/mapSupplierFeedProduct.test.ts` | 6 new tests (valid lengths, missing, invalid format/length, whitespace trim) |
| `backend/src/infrastructure/import/supplierFeedImporter.ts` | Propagate `gtin: mapped.gtin` in create + update branches of `upsertImportedProduct` |
| `backend/src/infrastructure/import/__tests__/supplierFeedImporter.test.ts` | Add `ean` to fixture; extend create/update assertions; 1 new test for missing-ean → null |
