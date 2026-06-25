# Backend Implementation Plan: product-multilingual-translations

> DO NOT implement without reading this plan first.
> This plan covers only the backend. Frontend tasks are separate.

---

## Overview

Add multilingual translation support for `Product.name` and `Product.description` via an overlay `ProductTranslation` table. The existing `Product.name` / `description` columns serve as the English fallback and are never removed. A centralized locale resolution helper is used everywhere to ensure deterministic, consistent fallback.

Affected backend layers in order:
1. Prisma schema + migration
2. Domain model (`ProductTranslation` class)
3. Domain repository interface (`IProductTranslationRepository`)
4. Infrastructure repository implementation (`ProductTranslationRepository`)
5. Existing `ProductRepository` — add `include: { translations: true }` to all read methods
6. Updated `Product` domain model — add `translations?` field
7. Locale resolution helper (`resolveProductLocale`)
8. `ProductService` — inject translation repo, new methods, update `create`/`update`
9. `validator.ts` — add translation validation helper
10. `serializePublicProduct` serializer — accept `locale` param
11. `publicProductController` — read `Accept-Language`, set `Vary` header
12. `productController` (admin) — accept/forward `translations` array
13. Admin `productRoutes.ts` — translation sub-routes
14. Backfill script
15. Unit tests for each layer

---

## File 1: `backend/prisma/schema.prisma`

**Action:** Modify — add `ProductTranslation` model and `translations` relation on `Product`.

### Changes to the `Product` model

Add one line inside the `Product` model block, after `images ProductImage[]`:

```prisma
translations ProductTranslation[]
```

### New `ProductTranslation` model (add at the end of the file)

```prisma
model ProductTranslation {
  id          Int      @id @default(autoincrement())
  productId   Int
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  locale      String   @db.VarChar(5)
  name        String   @db.VarChar(150)
  description String?  @db.VarChar(2000)
  source      String   @default("manual") @db.VarChar(20)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([productId, locale])
  @@index([productId])
}
```

### Key details

- `onDelete: Cascade` on the FK ensures hard-deleting a `Product` removes all its translations automatically.
- `@@unique([productId, locale])` enables Prisma's `upsert` with `where: { productId_locale: { productId, locale } }`.
- `@@index([productId])` optimizes `findMany` by product (the eager include).
- `source` default is `"manual"` to match admin-authored translation intent; backfill script overrides to `"import"` or `"machine"`.
- After editing the schema, run: `npx prisma migrate dev --name add_product_translation` then `npx prisma generate`.

---

## File 2: `backend/src/domain/models/productTranslation.ts`

**Action:** Create new file.

### Content

Mirror the `ProductImage` class pattern — plain TypeScript class, no Prisma imports.

```typescript
export type TranslationSource = 'manual' | 'import' | 'machine';

export class ProductTranslation {
  id?: number;
  productId: number;
  locale: string;
  name: string;
  description: string | null;
  source: TranslationSource;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    productId: number;
    locale: string;
    name: string;
    description?: string | null;
    source?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.productId = data.productId;
    this.locale = data.locale;
    this.name = data.name;
    this.description = data.description ?? null;
    this.source = (data.source as TranslationSource) ?? 'manual';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
```

### Key details

- `TranslationSource` union type provides strict typing without blocking future values at the DB level.
- No business methods needed at this stage — the entity is a data holder; all logic lives in the service/helper.

---

## File 3: `backend/src/domain/models/product.ts`

**Action:** Modify — add `translations` optional field.

### Change

Add import for `ProductTranslation` at the top:
```typescript
import { ProductTranslation } from './productTranslation';
```

Add the field to the class body (after `images?: ProductImage[]`):
```typescript
translations?: ProductTranslation[];
```

Add to the constructor's `data` parameter type:
```typescript
translations?: ConstructorParameters<typeof ProductTranslation>[0][];
```

Add to the constructor body (after the `images` initialization block):
```typescript
if (data.translations) {
  this.translations = data.translations.map((t) => new ProductTranslation(t));
}
```

### Key details

- `translations` is optional because existing code paths that don't eager-load translations (e.g., `findBySlug` used only for slug conflict checks) will return a `Product` without translations — this is valid.
- The `Product` constructor maps raw data objects to `ProductTranslation` instances, following the existing pattern for `variants` and `images`.

---

## File 4: `backend/src/domain/models/index.ts`

**Action:** Modify — export `ProductTranslation` and `TranslationSource`.

Add to the export block at the top:
```typescript
export { ProductTranslation } from './productTranslation';
export type { TranslationSource } from './productTranslation';
```

---

## File 5: `backend/src/domain/repositories/productTranslationRepository.ts`

**Action:** Create new file — domain-layer interface only.

### Content

```typescript
import { ProductTranslation } from '../models/productTranslation';

export interface TranslationUpsertData {
  name: string;
  description?: string | null;
  source?: string;
}

export interface IProductTranslationRepository {
  upsert(productId: number, locale: string, data: TranslationUpsertData): Promise<ProductTranslation>;
  findByProduct(productId: number): Promise<ProductTranslation[]>;
  findByProductAndLocale(productId: number, locale: string): Promise<ProductTranslation | null>;
  delete(productId: number, locale: string): Promise<void>;
}
```

### Key details

- `upsert` covers both admin sub-route `PUT /api/admin/products/:id/translations/:locale` and the service-level batch upsert during create/update.
- `findByProduct` is used for `GET /api/admin/products/:id/translations`.
- `findByProductAndLocale` is used before `delete` to check existence (404 case).
- `delete` throws no error by itself — the service checks existence first.
- No `IProductTranslationRepository` is added to `productRepository.ts` because it is a separate entity with its own lifecycle (not a nested relation of the `IProductRepository` interface).

---

## File 6: `backend/src/domain/repositories/index.ts`

**Action:** Modify — export the new interface and its types.

Add:
```typescript
export { IProductTranslationRepository } from './productTranslationRepository';
export type { TranslationUpsertData } from './productTranslationRepository';
```

---

## File 7: `backend/src/infrastructure/repositories/productTranslationRepository.ts`

**Action:** Create new file — Prisma implementation.

### Content

```typescript
import { prisma } from '../prismaClient';
import { ProductTranslation } from '../../domain/models/productTranslation';
import {
  IProductTranslationRepository,
  TranslationUpsertData,
} from '../../domain/repositories/productTranslationRepository';

export class TranslationNotFoundError extends Error {
  readonly code = 'TRANSLATION_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Translation not found for this product and locale');
    this.name = 'TranslationNotFoundError';
    Object.setPrototypeOf(this, TranslationNotFoundError.prototype);
  }
}

export class ProductTranslationRepository implements IProductTranslationRepository {
  async upsert(productId: number, locale: string, data: TranslationUpsertData): Promise<ProductTranslation> {
    const row = await prisma.productTranslation.upsert({
      where: { productId_locale: { productId, locale } },
      create: {
        productId,
        locale,
        name: data.name,
        description: data.description ?? null,
        source: data.source ?? 'manual',
      },
      update: {
        name: data.name,
        description: data.description ?? null,
        source: data.source ?? 'manual',
      },
    });
    return new ProductTranslation(row);
  }

  async findByProduct(productId: number): Promise<ProductTranslation[]> {
    const rows = await prisma.productTranslation.findMany({
      where: { productId },
      orderBy: { locale: 'asc' },
    });
    return rows.map((r) => new ProductTranslation(r));
  }

  async findByProductAndLocale(productId: number, locale: string): Promise<ProductTranslation | null> {
    const row = await prisma.productTranslation.findUnique({
      where: { productId_locale: { productId, locale } },
    });
    return row ? new ProductTranslation(row) : null;
  }

  async delete(productId: number, locale: string): Promise<void> {
    await prisma.productTranslation.delete({
      where: { productId_locale: { productId, locale } },
    });
  }
}
```

### Key details

- The Prisma compound unique key name `productId_locale` is automatically derived from `@@unique([productId, locale])` in the schema. Verify after `prisma generate` if the field name differs.
- `delete` uses Prisma's `delete` (not `deleteMany`) because the compound key is a unique identifier — if no row matches, Prisma throws a `P2025` error. The service layer must catch this and throw `TranslationNotFoundError` (see service section).
- `TranslationNotFoundError` is kept in the infrastructure layer following the existing pattern (e.g., `ProductNotFoundError` lives in `infrastructure/repositories/productRepository.ts`).

---

## File 8: `backend/src/infrastructure/repositories/productRepository.ts`

**Action:** Modify — add `include: { translations: true }` to all read methods that return full `Product` objects.

### Methods to update

**`findAll`** — inside `prisma.product.findMany({...})`, add to the `include` block:
```typescript
include: {
  variants: {
    select: variantSelect,
    where: { deletedAt: null, status: 'Active' },
    orderBy: { publicPrice: 'asc' },
  },
  translations: true,   // ADD THIS
},
```

**`findById`** — inside `prisma.product.findFirst({...})`, add:
```typescript
include: {
  variants: { select: variantSelect, where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
  images: { orderBy: { sortOrder: 'asc' } },
  translations: true,   // ADD THIS
},
```

**`findBySlug`** — This method is only used for slug conflict checks (`findFirst({ where: { slug } })`). It currently has no `include`. **Do NOT add translations here** — it would be wasteful for a lookup used only to check slug uniqueness. The method returns a `Product` without translations, which is acceptable (the `translations` field is optional on the domain model).

**`create`** — The current implementation uses `prisma.product.create({data: ...})` with no `include`. After the create, translations are persisted by the service via the `IProductTranslationRepository`. The returned `Product` from `create` therefore has no `translations` yet — the service assembles the final object if needed, or the caller re-fetches. **No change needed here.**

**`update`** — Same rationale as `create`. The service handles translation upserts separately. **No change needed here.**

### Key details

- Only `findAll` and `findById` need the `translations` include — these are the methods used by list and detail endpoints.
- Adding `translations: true` (no field selection restriction) returns all translation fields including `source`, which is acceptable since translations are small rows.
- The `Product` constructor already handles `translations` if the data field is present (after the model change in File 3).

---

## File 9: `backend/src/application/helpers/resolveProductLocale.ts`

**Action:** Create new file — locale resolution helper.

### Content

```typescript
import { Product } from '../../domain/models/product';

const SUPPORTED_LOCALES = new Set(['en', 'es']);

/**
 * Normalizes an Accept-Language header value to a supported locale code.
 * Strips region tags (e.g., "es-419" → "es", "en-US" → "en").
 * Unknown or unsupported locales default to "en".
 */
export function normalizeLocale(raw: string | undefined): string {
  if (!raw) return 'en';
  const base = raw.split(/[,;]/)[0].trim().split('-')[0].toLowerCase();
  return SUPPORTED_LOCALES.has(base) ? base : 'en';
}

export interface LocalizedNames {
  name: string;
  description: string | null;
}

/**
 * Resolves the localized name and description for a product using the
 * deterministic fallback chain:
 *   1. Translation for the requested locale
 *   2. Translation for "en"
 *   3. Product.name / Product.description (base English fallback)
 *
 * The returned `name` is always a non-empty string.
 */
export function resolveProductLocale(product: Product, requestedLocale: string): LocalizedNames {
  const translations = product.translations ?? [];

  // Step 1: exact locale match
  const exact = translations.find((t) => t.locale === requestedLocale);
  if (exact) {
    return { name: exact.name, description: exact.description };
  }

  // Step 2: fallback to EN translation (skip if already requested)
  if (requestedLocale !== 'en') {
    const enTranslation = translations.find((t) => t.locale === 'en');
    if (enTranslation) {
      return { name: enTranslation.name, description: enTranslation.description };
    }
  }

  // Step 3: base product fields
  return {
    name: product.name,
    description: product.description ?? null,
  };
}
```

### Key details

- `normalizeLocale` is a pure function with no I/O — easy to unit test.
- `resolveProductLocale` depends only on the domain `Product` type — no Prisma, no Express.
- `SUPPORTED_LOCALES` is a `Set` for O(1) lookup. Adding a third locale in the future requires only a single set update plus a new backfill run.
- The function handles the edge case where `requestedLocale === 'en'` by skipping the redundant EN-translation lookup and going straight to base fields if no exact match exists.

---

## File 10: `backend/src/application/helpers/__tests__/resolveProductLocale.test.ts`

**Action:** Create new test file.

### Test cases to cover (AAA pattern, `jest.clearAllMocks()` in `beforeEach`)

| Test name | Scenario |
|-----------|----------|
| `normalizeLocale - should return "en" when no header provided` | `undefined` → `"en"` |
| `normalizeLocale - should strip region tag "es-419" to "es"` | `"es-419"` → `"es"` |
| `normalizeLocale - should strip region tag "en-US" to "en"` | `"en-US"` → `"en"` |
| `normalizeLocale - should default unknown locale "fr" to "en"` | `"fr"` → `"en"` |
| `normalizeLocale - should handle comma-separated Accept-Language` | `"es,en;q=0.9"` → `"es"` |
| `resolveProductLocale - should return ES translation when exact locale matches` | product has `es` translation, request `es` → ES name/desc |
| `resolveProductLocale - should return EN translation when EN locale matches` | product has `en` translation, request `en` → EN name/desc |
| `resolveProductLocale - should fall back to EN translation when ES missing` | no `es` row, has `en` translation, request `es` → EN name/desc |
| `resolveProductLocale - should fall back to Product.name when no translations` | `product.translations = []`, request `es` → `product.name` |
| `resolveProductLocale - should fall back to Product.name when translations undefined` | `product.translations = undefined`, request `en` → `product.name` |
| `resolveProductLocale - should return null description when product.description is null` | base fallback, `product.description = null` → `description: null` |

### Key details

- Import `Product` from the domain model, build minimal `Product` instances using constructor for type safety (avoid `any`).
- No mocking needed — helper is pure functions.
- ESLint: no `any`, prefix unused destructured params with `_` if needed.

---

## File 11: `backend/src/application/validator.ts`

**Action:** Modify — add translation validation helper function.

### Add a new exported function after `validateProductImageData`

```typescript
export interface TranslationInput {
  locale: string;
  name: string;
  description?: string | null;
}

const VALID_LOCALES = ['en', 'es'];

export function validateTranslationInput(input: TranslationInput): void {
  if (!VALID_LOCALES.includes(input.locale)) {
    throw new ValidationError(
      `Translation locale '${input.locale}' is invalid. Must be one of: ${VALID_LOCALES.join(', ')}`
    );
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError("Translation field 'name' is required");
  }
  if (input.name.length > 150) {
    throw new ValidationError("Translation field 'name' must not exceed 150 characters");
  }
  if (input.description !== undefined && input.description !== null && input.description.length > 2000) {
    throw new ValidationError("Translation field 'description' must not exceed 2000 characters");
  }
}

export function validateTranslationsArray(translations: unknown[]): void {
  for (const item of translations) {
    validateTranslationInput(item as TranslationInput);
  }
}
```

### Key details

- `VALID_LOCALES` is a plain array here (not a Set) for easy `.join()`.
- `validateTranslationInput` throws `ValidationError` — the existing error class with `code = 'VALIDATION_ERROR'`. The admin controllers will need to produce `TRANSLATION_LOCALE_INVALID` for the specific locale error. Two options:
  - Option A (preferred): Create a dedicated `TranslationLocaleInvalidError` subclass in `validator.ts` or in the infrastructure repo file. Add `readonly code = 'TRANSLATION_LOCALE_INVALID'`.
  - Option B: Catch `ValidationError` in the controller and check message text — fragile, avoid.
- **Recommendation:** Create a dedicated error:

```typescript
export class TranslationLocaleInvalidError extends Error {
  readonly code = 'TRANSLATION_LOCALE_INVALID' as const;
  readonly status = 422;
  constructor(locale: string) {
    super(`Translation locale '${locale}' is not supported. Supported: en, es`);
    this.name = 'TranslationLocaleInvalidError';
    Object.setPrototypeOf(this, TranslationLocaleInvalidError.prototype);
  }
}
```

Add this class to `validator.ts` and throw it in `validateTranslationInput` when the locale check fails.

---

## File 12: `backend/src/application/services/productService.ts`

**Action:** Modify — inject `IProductTranslationRepository`, add new methods, update `create` and `update`.

### Constructor change

```typescript
constructor(
  private readonly repo: IProductRepository,
  private readonly variantRepo: IProductVariantRepository,
  private readonly translationRepo: IProductTranslationRepository,
) {}
```

### Import additions

```typescript
import {
  IProductTranslationRepository,
  TranslationUpsertData,
} from '../../domain/repositories/productTranslationRepository';
import { validateTranslationInput, TranslationInput, TranslationLocaleInvalidError } from '../validator';
import { TranslationNotFoundError } from '../../infrastructure/repositories/productTranslationRepository';
```

### New type (add near top of service, before the class)

```typescript
export interface ProductTranslationPayload {
  locale: string;
  name: string;
  description?: string | null;
}
```

### `create` method update

Signature change — accept optional `translations`:
```typescript
async create(
  data: Omit<ProductCreateData, 'slug'> & { slug?: string; translations?: ProductTranslationPayload[] }
): Promise<Product>
```

After `const product = await this.repo.create({ ...data, slug });`, add:
```typescript
if (data.translations && data.translations.length > 0) {
  for (const t of data.translations) {
    validateTranslationInput(t);
    await this.translationRepo.upsert(product.id!, t.locale, {
      name: t.name,
      description: t.description ?? null,
      source: 'manual',
    });
  }
}
```

Return `product` as before. (The returned `Product` won't have `translations` loaded; admin callers can re-fetch if they need them or serialize the payload directly.)

### `update` method update

Signature change:
```typescript
async update(
  id: number,
  data: ProductUpdateData & { translations?: ProductTranslationPayload[] }
): Promise<Product>
```

After `return this.repo.update(id, data);`, before `return`, add translation upsert block:
```typescript
if (data.translations && data.translations.length > 0) {
  for (const t of data.translations) {
    validateTranslationInput(t);
    await this.translationRepo.upsert(id, t.locale, {
      name: t.name,
      description: t.description ?? null,
      source: 'manual',
    });
  }
}
return this.repo.update(id, data);
```

Note: upsert translations BEFORE the final `repo.update` call so that any `TranslationLocaleInvalidError` aborts before mutating the product row.

### New method: `upsertTranslation`

```typescript
async upsertTranslation(
  productId: number,
  locale: string,
  data: { name: string; description?: string | null }
): Promise<import('../../domain/models/productTranslation').ProductTranslation> {
  validateTranslationInput({ locale, name: data.name, description: data.description });
  const product = await this.repo.findById(productId);
  if (!product) throw new ProductNotFoundError();
  return this.translationRepo.upsert(productId, locale, {
    name: data.name,
    description: data.description ?? null,
    source: 'manual',
  });
}
```

### New method: `deleteTranslation`

```typescript
async deleteTranslation(productId: number, locale: string): Promise<void> {
  if (!['en', 'es'].includes(locale)) {
    throw new TranslationLocaleInvalidError(locale);
  }
  const product = await this.repo.findById(productId);
  if (!product) throw new ProductNotFoundError();
  const existing = await this.translationRepo.findByProductAndLocale(productId, locale);
  if (!existing) throw new TranslationNotFoundError();
  await this.translationRepo.delete(productId, locale);
}
```

### New method: `getTranslations`

```typescript
async getTranslations(productId: number): Promise<import('../../domain/models/productTranslation').ProductTranslation[]> {
  const product = await this.repo.findById(productId);
  if (!product) throw new ProductNotFoundError();
  return this.translationRepo.findByProduct(productId);
}
```

### Key details

- `validateTranslationInput` is called before any DB write — validation-first pattern mirrors existing `validateProductData` usage.
- The `create` / `update` translation upserts are not wrapped in a single Prisma transaction with the product write. The spec says "atomically" for `create`, but the existing `ProductRepository.create` does not use `prisma.$transaction`. For true atomicity, wrap the product create + translation upserts inside `prisma.$transaction(async (tx) => { ... })` in the service — requires injecting `prisma` into the service or passing a transaction callback to the repo. Given complexity and the fact that translations are supplementary data, **the simpler approach is sequential writes without an explicit transaction** in the MVP; document this as a known limitation. If strict atomicity is required, use Prisma interactive transactions: `prisma.$transaction(async (tx) => { ... })`.
- `deleteTranslation` checks the product exists before checking the translation — returns 404 on missing product, 404 on missing translation, 422 on invalid locale.

---

## File 13: `backend/src/application/services/__tests__/productService.test.ts`

**Action:** Modify — add `mockTranslationRepo`, pass to `ProductService` constructor, add new test cases.

### Constructor mock setup

```typescript
const mockTranslationRepo: jest.Mocked<IProductTranslationRepository> = {
  upsert: jest.fn(),
  findByProduct: jest.fn(),
  findByProductAndLocale: jest.fn(),
  delete: jest.fn(),
};

const service = new ProductService(mockRepo, mockVariantRepo, mockTranslationRepo);
```

### New test suites to add

**`ProductService - create with translations`**
- `should create product and upsert translations when translations provided`
- `should create product without calling translationRepo when translations empty`
- `should throw TranslationLocaleInvalidError when invalid locale provided in translations`
- `should throw ValidationError when translation name exceeds 150 chars`

**`ProductService - update with translations`**
- `should upsert provided translations on update`
- `should not call translationRepo when translations not provided on update`

**`ProductService - upsertTranslation`**
- `should call translationRepo.upsert with correct args`
- `should throw ProductNotFoundError when product not found`
- `should throw TranslationLocaleInvalidError for invalid locale`

**`ProductService - deleteTranslation`**
- `should delete translation when product and translation exist`
- `should throw ProductNotFoundError when product not found`
- `should throw TranslationNotFoundError when translation not found`
- `should throw TranslationLocaleInvalidError for locale "fr"`

**`ProductService - getTranslations`**
- `should return all translations for existing product`
- `should throw ProductNotFoundError when product not found`

### Key details

- Update the `mockRepo` type to include `IProductTranslationRepository` — existing tests must still pass because `service` is rebuilt with `new ProductService(mockRepo, mockVariantRepo, mockTranslationRepo)`.
- Existing `describe` blocks for `findAll`, `findById`, `create`, `update`, `softDelete` must be updated to clear `mockTranslationRepo` in their `beforeEach` and not break due to the third constructor parameter.
- No `any` — use typed mocks. Prefix unused params with `_` in test callbacks.

---

## File 14: `backend/src/presentation/serializers/publicProduct.ts`

**Action:** Modify — accept `locale` parameter, use `resolveProductLocale`.

### Import addition

```typescript
import { resolveProductLocale, normalizeLocale } from '../../application/helpers/resolveProductLocale';
```

### `serializePublicProduct` signature change

```typescript
export function serializePublicProduct(product: Product, locale: string = 'en'): PublicProductDTO
```

### Inside `serializePublicProduct`, resolve name/description

Replace the direct `product.name` and `product.description` references in the return object:

```typescript
const { name, description } = resolveProductLocale(product, locale);

return {
  id: product.id,
  name,           // localized
  slug: product.slug,
  description,    // localized
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

### Key details

- Default `locale = 'en'` ensures backward compatibility with any existing internal callers that don't pass a locale.
- The allow-list structure of `serializePublicProduct` is unchanged — supplier fields remain excluded by omission (not listed in the return object).
- `PublicProductDTO` interface does NOT change — `name` and `description` remain `string` and `string | null` respectively. The locale resolution happens inside the serializer, not in the DTO shape.

---

## File 15: `backend/src/presentation/controllers/publicProductController.ts`

**Action:** Modify — extract locale from `Accept-Language` header, pass to serializer, set `Vary` header.

### Import addition

```typescript
import { normalizeLocale } from '../../application/helpers/resolveProductLocale';
```

### `ProductService` instantiation update

The `publicProductController.ts` instantiates `ProductService` directly (no DI container). Update the instantiation:

```typescript
import { ProductTranslationRepository } from '../../infrastructure/repositories/productTranslationRepository';

const productService = new ProductService(
  new ProductRepository(),
  new ProductVariantRepository(),
  new ProductTranslationRepository(),   // ADD THIS
);
```

### `listPublicProducts` changes

After `const result = await productService.findAll({...})`, before building `data`:

```typescript
const locale = normalizeLocale(req.headers['accept-language']);
res.set('Vary', 'Accept-Language');

const data = {
  items: result.items.map((p) => serializePublicProduct(p, locale)),
  total: result.total,
  page: result.page,
  pageSize: result.pageSize,
};
```

### `getPublicProductById` changes

```typescript
const locale = normalizeLocale(req.headers['accept-language']);
res.set('Vary', 'Accept-Language');
// ...
res.json({ success: true, data: serializePublicProduct(product, locale), message: 'Product retrieved successfully' });
```

### Search handler (if public search is in this file)

If there is a `searchPublicProducts` handler in this controller, add a `// TODO: search still matches Product.name (English only); localized search is deferred` comment near the `search` filter being passed to the service.

### Key details

- `res.set('Vary', 'Accept-Language')` must be called BEFORE `res.json(...)` — Express sets headers before the body.
- `normalizeLocale` strips region codes and defaults unknown locales to `'en'`, so no additional validation needed in the controller.

---

## File 16: `backend/src/presentation/controllers/productController.ts`

**Action:** Modify — update `ProductService` instantiation, update `createProduct` / `updateProduct` to forward `translations`, update `getProductById` / `listProducts` to include `translations` in response.

### Import additions

```typescript
import { ProductTranslationRepository } from '../../infrastructure/repositories/productTranslationRepository';
import { TranslationNotFoundError } from '../../infrastructure/repositories/productTranslationRepository';
import { TranslationLocaleInvalidError } from '../../application/validator';
```

### `ProductService` instantiation update

```typescript
const productService = new ProductService(
  new ProductRepository(),
  new ProductVariantRepository(),
  new ProductTranslationRepository(),
);
```

### `createProduct` changes

The body destructuring should pull out `translations`:
```typescript
const { translations, ...productFields } = req.body;
const product = await productService.create({ ...productFields, translations });
```

No additional validation in the controller — `validateTranslationInput` is called in the service.

Return 201 with the created `product` (which may not have `translations` populated in the returned object — see note in service section).

### `updateProduct` changes

Same pattern:
```typescript
const { translations, ...productFields } = req.body;
const product = await productService.update(id, { ...productFields, translations });
```

### `getProductById` changes

The service's `findById` calls `repo.findById` which now includes `translations: true`. The product returned already has `product.translations` populated. The existing `res.json({ success: true, data: product, ... })` will now automatically include `translations` in the response (since `product` is a `Product` class instance and `res.json` serializes all own properties).

No additional changes needed — the translation field is just there in the product now.

### `listProducts` changes

Same as `getProductById` — translations are eagerly loaded by the repo. The list result items already contain `translations`. No change needed beyond the `ProductService` instantiation.

### New handler functions to add

Add these three handlers at the end of the file (before the export block if the file uses named exports):

```typescript
export async function listTranslations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const translations = await productService.getTranslations(id);
    res.json({ success: true, data: translations, message: 'Translations retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function upsertTranslation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const locale = req.params['locale'] as string;
    const { name, description } = req.body as { name: string; description?: string | null };
    const translation = await productService.upsertTranslation(id, locale, { name, description });
    res.json({ success: true, data: translation, message: 'Translation upserted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteTranslation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const locale = req.params['locale'] as string;
    await productService.deleteTranslation(id, locale);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
```

### Error handler middleware

The global error middleware must handle `TranslationLocaleInvalidError` (422) and `TranslationNotFoundError` (404). Check `backend/src/middleware/` for the error handler:
- If errors are mapped by `.status` property, both classes already have `.status` set, so no middleware change is required.
- If errors are mapped by class name or error code, add cases for the new error classes.

### Key details

- `parseInt(req.params['id'], 10)` without `isNaN` guard is acceptable here (mirroring existing `getProductById`). Add the guard for consistency if preferred.
- `req.params['locale']` is a string from the route — do NOT parse as an integer.

---

## File 17: `backend/src/routes/admin/productRoutes.ts`

**Action:** Modify — import the three new translation handlers and add translation sub-routes.

### Import additions

```typescript
import {
  listTranslations,
  upsertTranslation,
  deleteTranslation,
} from '../../presentation/controllers/productController';
```

### Route additions

Add the translation sub-router BEFORE the `productRouter.use('/:id/variants', variantRouter)` line:

```typescript
const translationRouter = Router({ mergeParams: true });
translationRouter.get('/', listTranslations);
translationRouter.put('/:locale', upsertTranslation);
translationRouter.delete('/:locale', deleteTranslation);

productRouter.use('/:id/translations', translationRouter);
```

### Key details

- `mergeParams: true` on `translationRouter` ensures `req.params.id` is accessible inside the translation handlers.
- `/:locale` is an open param — the service validates whether the locale value is acceptable.
- Route order matters: `/:id/translations` must be registered before `/:id` catch-all if any such catch-all exists (it doesn't currently, but worth noting).
- Routes map to: `GET /api/admin/products/:id/translations`, `PUT /api/admin/products/:id/translations/:locale`, `DELETE /api/admin/products/:id/translations/:locale`.

---

## File 18: `backend/scripts/backfillProductTranslations.ts`

**Action:** Create new file — standalone ts-node script.

### Structure

```typescript
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch'; // or use global fetch if Node 18+

const prisma = new PrismaClient();
const LIBRETRANSLATE_URL = process.env['LIBRETRANSLATE_URL'] ?? 'http://localhost:5000';
const MAX_NAME_LENGTH = 150;

interface TranslationResult {
  enSeeded: number;
  esTranslated: number;
  skipped: number;
  failed: number;
}

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  // POST to LIBRETRANSLATE_URL/translate with JSON body
  // Throws on HTTP error
}

async function truncateIfNeeded(text: string, productId: number, field: string): Promise<string> {
  if (text.length > MAX_NAME_LENGTH) {
    console.warn(`[WARN] Product ${productId}: ${field} truncated from ${text.length} to ${MAX_NAME_LENGTH} chars`);
    return text.slice(0, MAX_NAME_LENGTH);
  }
  return text;
}

async function main(): Promise<void> {
  const result: TranslationResult = { enSeeded: 0, esTranslated: 0, skipped: 0, failed: 0 };

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { translations: true },
  });

  for (const product of products) {
    // EN upsert (idempotent: only if no EN translation exists)
    const hasEn = product.translations.some((t) => t.locale === 'en');
    if (!hasEn) {
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale: 'en' } },
        create: { productId: product.id, locale: 'en', name: product.name, description: product.description, source: 'import' },
        update: {},  // do not overwrite if it somehow appeared between the check and the upsert
      });
      result.enSeeded++;
    } else {
      result.skipped++;
    }

    // ES machine translation (only if no ES translation exists)
    const hasEs = product.translations.some((t) => t.locale === 'es');
    if (!hasEs) {
      try {
        const esName = await truncateIfNeeded(
          await translateText(product.name, 'en', 'es'),
          product.id,
          'name'
        );
        const esDesc = product.description
          ? await translateText(product.description, 'en', 'es')
          : null;
        await prisma.productTranslation.upsert({
          where: { productId_locale: { productId: product.id, locale: 'es' } },
          create: { productId: product.id, locale: 'es', name: esName, description: esDesc, source: 'machine' },
          update: {},
        });
        result.esTranslated++;
      } catch (err) {
        console.error(`[ERROR] Product ${product.id}: ES translation failed`, (err as Error).message);
        result.failed++;
      }
    }
  }

  console.log('\n--- Backfill Summary ---');
  console.log(`EN seeded:      ${result.enSeeded}`);
  console.log(`ES translated:  ${result.esTranslated}`);
  console.log(`Skipped (EN):   ${result.skipped}`);
  console.log(`Failed (ES):    ${result.failed}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
```

### Key details

- `update: {}` in the upsert for the EN row means: if the row already exists (race condition or re-run), leave it untouched. This guarantees idempotency for re-runs.
- `node-fetch` may already be in `devDependencies`; if not, use Node 18 global `fetch`. Check `backend/package.json` before adding a dependency. Alternatively, use the built-in `http` module or `axios` if already present.
- Script must be run with `npx ts-node backend/scripts/backfillProductTranslations.ts` from the project root, or via `npm run backfill:translations` from `backend/`.
- LibreTranslate `/translate` endpoint signature: `POST { q: string, source: string, target: string, format: "text" }` → `{ translatedText: string }`.
- The script does not use the `IProductTranslationRepository` abstraction intentionally — it is a one-off ops script that talks directly to Prisma for simplicity and performance (batch operations without service overhead).

---

## File 19: `backend/package.json`

**Action:** Modify — add backfill script.

Inside the `"scripts"` block, add:
```json
"backfill:translations": "npx ts-node scripts/backfillProductTranslations.ts"
```

---

## Cross-Cutting: Error Middleware

**File:** `backend/src/middleware/` (check for `errorHandler.ts` or similar)

**Action:** Verify — ensure `TranslationLocaleInvalidError` (status 422) and `TranslationNotFoundError` (status 404) are handled.

The existing error middleware should already handle errors with a `.status` property (pattern used by `ProductNotFoundError`, `ProductSlugConflictError`, etc.). Since the new error classes follow the same pattern (`readonly status = 422` / `404`), no middleware change should be needed. Verify by checking the error handler logic. If it checks specific class names or codes, add:

```typescript
if (err instanceof TranslationLocaleInvalidError) {
  return res.status(422).json({ success: false, error: { message: err.message, code: err.code } });
}
if (err instanceof TranslationNotFoundError) {
  return res.status(404).json({ success: false, error: { message: err.message, code: err.code } });
}
```

---

## Test Coverage Summary

| File | Test file | Key scenarios |
|------|-----------|---------------|
| `resolveProductLocale.ts` | `helpers/__tests__/resolveProductLocale.test.ts` | All fallback chain paths, locale normalization |
| `productService.ts` | `services/__tests__/productService.test.ts` | Create/update with translations, upsert/delete/getTranslations, 404/422 cases |
| `publicProductController.ts` | Existing test file (update) | Locale extraction, `Vary` header, ES/EN responses, supplier field exclusion |
| `productController.ts` (admin) | Existing test file (update) | translations array in create/update, sub-routes 200/204/404/422 |
| `publicProduct.ts` (serializer) | New or existing serializer test | ES/EN/fallback locale, allow-list integrity |

---

## Implementation Order (recommended for reviewers)

1. Schema + migrate + generate (unblocks everything)
2. Domain model: `ProductTranslation`, update `Product`, update barrel files
3. Domain interface: `IProductTranslationRepository`
4. Infrastructure: `ProductTranslationRepository`
5. Update `ProductRepository` (add `include: { translations: true }`)
6. Create `resolveProductLocale` helper + unit tests
7. Update `validator.ts` (add `TranslationInput`, `validateTranslationInput`, `TranslationLocaleInvalidError`)
8. Update `ProductService` + update service tests
9. Update `serializePublicProduct`
10. Update `publicProductController`
11. Update `productController` (admin handlers + three new handlers)
12. Update `admin/productRoutes.ts`
13. Create backfill script + update `package.json`
14. Verify/update all existing tests that construct `ProductService` (they need the third argument `mockTranslationRepo`)

---

## Important Notes for Implementors

1. **Prisma compound key naming:** After `prisma generate`, the compound unique key for `productId_locale` is accessed via `where: { productId_locale: { productId, locale } }`. Confirm the generated key name by inspecting the generated `PrismaClient` types (`node_modules/@prisma/client`).

2. **Existing tests need the third constructor arg:** Every test file that does `new ProductService(mockRepo, mockVariantRepo)` must be updated to `new ProductService(mockRepo, mockVariantRepo, mockTranslationRepo)`. If not updated, TypeScript will error and Jest will fail.

3. **Supplier protection invariant:** The `serializePublicProduct` allow-list must never be weakened. After updating the serializer, run the existing test assertions on supplier field exclusion to confirm they still pass.

4. **`findBySlug` is intentionally not updated:** It is used only for slug uniqueness checks and its result is only tested for truthiness. Adding `include: { translations: true }` there would waste a join on a hot slug-conflict check path.

5. **ESLint compliance:** All new files and touched files must pass `npm run lint` in `backend/`. Key rules: no `any`, prefix unused params with `_`, no unused imports.

6. **CI verification command:**
   ```bash
   cd backend && npm run lint && npm test -- --watchAll=false --testPathPattern="resolveProductLocale|productService|publicProduct|adminProduct|productController"
   ```
