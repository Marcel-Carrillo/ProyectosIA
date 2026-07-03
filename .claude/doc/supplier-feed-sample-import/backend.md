# Backend Implementation Plan — supplier-feed-sample-import

Scope: OpenSpec change `openspec/changes/supplier-feed-sample-import/`, `tasks.md` groups **1–4 only** (fixture/types, mapper, importer/clean-step, script entry point + package.json). Groups 5–10 (test review, running tests, manual/E2E verification, docs, commit/PR) are handled by the parent agent after implementation.

Precedent mirrored throughout: `backend/src/infrastructure/external/escuelaJsTypes.ts`, `backend/src/infrastructure/import/mapEscuelaJsProduct.ts`, `backend/src/infrastructure/import/escuelaJsProductImporter.ts`, `backend/prisma/importEscuelaJs.ts`, `backend/src/infrastructure/import/__tests__/mapEscuelaJsProduct.test.ts`.

## Read first

- `openspec/changes/supplier-feed-sample-import/design.md`, `specs/supplier-feed-sample-import/spec.md`, `tasks.md`, `proposal.md`
- `backend/prisma/schema.prisma` — models `Category`, `Supplier`, `Product`, `ProductVariant`, `ProductImage`
- `backend/src/infrastructure/repositories/productRepository.ts` and `productVariantRepository.ts` — `variantSelect` constant (supplier fields already excluded; do not touch)

## Critical gotcha found during research: `Supplier.name` has NO unique constraint

`design.md` / `spec.md` both describe suppliers as "upserted by name," and it's tempting to write `prisma.supplier.upsert({ where: { name } })` to mirror `Category`. **This will not compile** — in `schema.prisma`, `Supplier.name` is a plain `@db.VarChar(150)` with no `@unique`/`@@unique`, unlike `Category.name String @unique`. `design.md`'s Migration Plan explicitly forbids schema changes ("no new entities or relationships needed... all target fields already exist"), so do not add a unique constraint. Implement `upsertSupplier` manually via `findFirst` + `create`/`update` (see §3 below). This is the single biggest deviation from "mirror the EscuelaJS importer exactly" — call it out in the PR description.

## Critical ordering requirement: fixture must be read & validated BEFORE the clean step runs

`spec.md` scenario "Fixture is malformed" requires the DB to be **left unchanged** when the fixture is missing/invalid. But `design.md` decision 4 says the clean step runs "before loading the fixture." Reconciling both: the **script** (`prisma/importSupplierFeed.ts`) must call `readSupplierFeedFixture()` (parse + validate, no DB access) and let it throw *before* calling `cleanLocalCatalog(prisma)`. Order in `main()`:

1. `assertDevOnlyEnvironment()` — throws before any `PrismaClient` is even constructed.
2. `readSupplierFeedFixture()` — throws before any DB call if the file is missing/malformed.
3. `new PrismaClient()` → `cleanLocalCatalog(prisma)` → `importSupplierFeedProducts(prisma, products)`.

Do not fold fixture-reading into `importSupplierFeedProducts` — keep it a separate exported function so the script can sequence it correctly.

---

## 1. Fixture and types

### 1.1 `backend/prisma/fixtures/supplier-feed.sample.json` (new)

Array (not wrapped in an object — matches `EscuelaJsProduct[]` being the root shape too) of **at least 2** products shaped like a supplier catalog API response:

```json
[
  {
    "supplier": { "name": "Atelier Nord", "reference": "SUP-AN-001" },
    "externalRef": "AN-DRESS-001",
    "title": "Belted Midi Wrap Dress",
    "description": "A wrap dress with a self-tie belt, cut from a soft crepe.",
    "brand": "Atelier Nord",
    "category": "Dresses",
    "supplierCost": 18.50,
    "images": [],
    "variants": [
      { "sku": "AN-DRESS-001-S", "size": "S", "publicPrice": 49.99 },
      { "sku": "AN-DRESS-001-M", "size": "M", "publicPrice": 49.99 }
    ]
  },
  {
    "supplier": { "name": "Lumen Textiles", "reference": "SUP-LT-014" },
    "externalRef": "LT-COAT-014",
    "title": "Oversized Wool Blend Coat",
    "description": "Structured shoulders, oversized silhouette.",
    "brand": "Lumen",
    "category": "Outerwear",
    "supplierCost": 42.00,
    "images": [],
    "variants": [
      { "sku": "LT-COAT-014-BLK-M", "size": "M", "color": "Black", "publicPrice": 129.00 }
    ]
  }
]
```

Notes:
- `images: []` is present but **must be ignored** by the mapper/importer (see §2, §3).
- Keep titles unique across fixture entries — the mapper's slug generation is pure title-derived (no id/ref prefix, see §2), so duplicate titles would collide on the `Product.slug` unique constraint.
- Respect column limits from `schema.prisma`: `Product.name`/`Supplier.name` ≤150 chars, `Product.slug` ≤200, `ProductVariant.sku`/`supplierReference` ≤150/100, `Product.description` ≤2000.
- Include one product whose `category` value does not yet exist locally and one that reuses an existing category name if you want to exercise both category branches manually in step 7 — not required for the unit tests, which construct their own in-memory fixtures.

### 1.2 `backend/src/infrastructure/external/supplierFeedTypes.ts` (new)

Mirrors `escuelaJsTypes.ts`. No nested category object (unlike EscuelaJS) — the fixture's `category` is a plain string.

```ts
import * as path from 'path';

export interface SupplierFeedSupplierRef {
  name: string;
  reference: string;
}

export interface SupplierFeedVariant {
  sku: string;
  size?: string;
  color?: string;
  publicPrice: number;
}

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

// Mirrors ESCUELAJS_PRODUCTS_URL: a source constant, but a local file path instead of
// an HTTP URL, since this importer reads an offline fixture (design.md decision 2).
export const SupplierFeedSource = path.join(
  __dirname,
  '../../../prisma/fixtures/supplier-feed.sample.json',
);
```

Path-depth note: from `backend/src/infrastructure/external/`, `../../../` resolves to `backend/`, then `prisma/fixtures/supplier-feed.sample.json`. This resolves correctly both under `ts-node` (source-relative `__dirname`) and under a `tsc` build to `dist/` (same relative depth: `dist/infrastructure/external/../../../` → `backend/`). Verify this file is **not** excluded from `tsconfig` `include` (it lives under `src/`, so it will be — no action needed, just don't add it to any dist-exclude list).

`SupplierFeedSupplierRef.reference` (from fixture `supplier.reference`) is intentionally **not persisted anywhere** — `Supplier` has no generic "reference" column in `schema.prisma` (only `contactName/contactEmail/contactPhone/website/notes`). It exists in the fixture only to make the sample realistically supplier-response-shaped per `tasks.md` 1.1; the mapper reads `product.supplier.name` only. Document this as a deliberate no-op in a code comment so a future reader doesn't assume it's a bug.

---

## 2. Mapper (`mapSupplierFeedProduct.ts`)

### 2.1 `backend/src/infrastructure/import/mapSupplierFeedProduct.ts` (new)

```ts
import { SupplierFeedProduct } from '../external/supplierFeedTypes';

export interface MappedSupplierFeedVariant {
  sku: string;
  size: string | null;
  color: string | null;
  publicPrice: number;
  stockPolicy: 'SupplierManaged';
  status: 'Active';
  supplierReference: string | null;
  supplierCost: number | null;
}

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

function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 200);
}

export function mapSupplierFeedProduct(product: SupplierFeedProduct): MappedSupplierFeedProduct {
  return {
    name: product.title.trim(),
    slug: generateSlug(product.title),
    description: product.description?.trim() || null,
    brand: product.brand?.trim() || null,
    status: 'Draft',
    mainImageUrl: null,
    categoryName: product.category.trim(),
    supplierName: product.supplier.name.trim(),
    variants: product.variants.map((v) => ({
      sku: v.sku.trim(),
      size: v.size?.trim() || null,
      color: v.color?.trim() || null,
      publicPrice: v.publicPrice,
      stockPolicy: 'SupplierManaged',
      status: 'Active',
      supplierReference: product.externalRef?.trim() || null,
      supplierCost: product.supplierCost ?? null,
    })),
  };
}
```

Key deviations from `mapEscuelaJsProduct.ts` — both intentional, both explicitly required by `spec.md`/`tasks.md`:

- **No `isImportableSupplierFeedProduct` guard.** `tasks.md` 2.1 explicitly forbids an images-required gate ("Do NOT include an `isImportableSupplierFeedProduct`-style guard that requires images"). Do not port `isImportableEscuelaJsProduct`'s image-length check. If you want basic hygiene (empty title, etc.), that belongs in the **fixture-level validator** in the importer (§3), not the mapper, since `spec.md`'s "malformed fixture" scenario is about the fixture file, not per-product filtering.
- **`product.images` is read nowhere.** The fixture always carries `images: []`, and the mapper's return type has no `images` field at all (unlike `MappedProductImport.images`) — this is what makes "zero `ProductImage` rows, ever" structurally true rather than merely tested.
- **`supplierReference`/`supplierCost` are duplicated onto every variant** of a product, because the fixture carries them at product level (`externalRef`, `supplierCost`) but the schema stores them per `ProductVariant` row. `supplierId` is deliberately **not** set here — the mapper is a pure function with no DB access; the importer resolves `supplierName` → `supplierId` via `upsertSupplier` and injects it before writing (§3).
- **Slug is pure-title-derived**, no id/ref prefix (unlike `importDummyJson.ts`'s `djson-${id}-${slug}` pattern). This matches `tasks.md` 2.2's literal wording ("slug is generated correctly from title") and keeps the mapper pure/stateless. Trade-off: fixture titles must stay unique (documented in §1.1).

### 2.2 `backend/src/infrastructure/import/__tests__/mapSupplierFeedProduct.test.ts` (new)

Follow `mapEscuelaJsProduct.test.ts`'s structure exactly (base fixture object + `describe`/`it` blocks). Cases to cover (per `tasks.md` 2.2 plus branch-coverage needs for the 90% threshold):

1. Empty-images product maps successfully: `status === 'Draft'`, `mainImageUrl === null`, no `images` key on the result at all.
2. `supplierCost`/`supplierReference` land on every mapped variant's internal-only fields, sourced from `supplierCost`/`externalRef` respectively (not from `supplier.reference`).
3. Slug is generated correctly from title (e.g. `'Belted Midi Wrap Dress'` → `'belted-midi-wrap-dress'`).
4. Multiple variants (2) all map with `stockPolicy: 'SupplierManaged'`, `status: 'Active'`.
5. Optional `size`/`color` absent on a variant → mapped as `null`, not `undefined` (matters for the Prisma `create` payload later).
6. `description`/`brand` fall back to `null` when empty/whitespace-only strings (mirrors `product.description?.trim() || null` branch in EscuelaJS's mapper — needed for branch coverage).

---

## 3. Importer and clean step (`supplierFeedImporter.ts`)

### 3.1 `backend/src/infrastructure/import/supplierFeedImporter.ts` (new)

```ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { SupplierFeedProduct, SupplierFeedSource } from '../external/supplierFeedTypes';
import { mapSupplierFeedProduct, MappedSupplierFeedProduct } from './mapSupplierFeedProduct';

export interface ImportSupplierFeedResult {
  suppliersUpserted: number;
  categoriesUpserted: number;
  productsCreated: number;
  variantsCreated: number;
  imagesCreated: 0;
}

// --- Fixture read + validation (runs BEFORE any Prisma call; see design note above) ---

function assertIsSupplierFeedProduct(raw: unknown, index: number): asserts raw is SupplierFeedProduct {
  const p = raw as Partial<SupplierFeedProduct> | null;
  if (!p || typeof p !== 'object') {
    throw new Error(`Supplier feed fixture: entry at index ${index} is not an object`);
  }
  if (!p.title?.trim()) throw new Error(`Supplier feed fixture: entry at index ${index} is missing "title"`);
  if (!p.category?.trim()) throw new Error(`Supplier feed fixture: entry at index ${index} is missing "category"`);
  if (!p.supplier?.name?.trim()) throw new Error(`Supplier feed fixture: entry at index ${index} is missing "supplier.name"`);
  if (!Array.isArray(p.variants) || p.variants.length === 0) {
    throw new Error(`Supplier feed fixture: entry at index ${index} must have at least one variant`);
  }
  for (const [vi, v] of p.variants.entries()) {
    if (!v.sku?.trim()) throw new Error(`Supplier feed fixture: entry ${index}, variant ${vi} is missing "sku"`);
    if (!Number.isFinite(v.publicPrice) || v.publicPrice <= 0) {
      throw new Error(`Supplier feed fixture: entry ${index}, variant ${vi} has an invalid "publicPrice"`);
    }
  }
}

export function readSupplierFeedFixture(sourcePath: string = SupplierFeedSource): SupplierFeedProduct[] {
  let raw: string;
  try {
    raw = fs.readFileSync(sourcePath, 'utf-8');
  } catch {
    throw new Error(`Supplier feed fixture not found at ${sourcePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Supplier feed fixture at ${sourcePath} is not valid JSON`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Supplier feed fixture at ${sourcePath} must be a JSON array`);
  }

  parsed.forEach((entry, i) => assertIsSupplierFeedProduct(entry, i));
  return parsed as SupplierFeedProduct[];
}

// --- Clean step ---

export async function cleanLocalCatalog(prisma: PrismaClient): Promise<void> {
  // FK-safe order: ProductImage -> ProductVariant -> Product.
  // Category, Supplier, AdminUser, and coupon tables are untouched (design.md decision 5).
  await prisma.productImage.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
}

// --- Upserts ---

async function upsertSupplier(prisma: PrismaClient, name: string): Promise<{ id: number; isNew: boolean }> {
  // NOTE: Supplier.name has no unique constraint in schema.prisma (unlike Category.name),
  // so a native `prisma.supplier.upsert({ where: { name } })` is not possible here.
  const existing = await prisma.supplier.findFirst({ where: { name } });
  if (existing) {
    if (existing.status !== 'Active') {
      await prisma.supplier.update({ where: { id: existing.id }, data: { status: 'Active' } });
    }
    return { id: existing.id, isNew: false };
  }
  const created = await prisma.supplier.create({ data: { name, status: 'Active' } });
  return { id: created.id, isNew: true };
}

async function upsertCategory(prisma: PrismaClient, name: string): Promise<{ id: number; isNew: boolean }> {
  const existing = await prisma.category.findUnique({ where: { name } });
  const category = await prisma.category.upsert({
    where: { name },
    update: { status: 'Active' },
    create: { name, status: 'Active' },
  });
  return { id: category.id, isNew: !existing };
}

async function upsertImportedProduct(
  prisma: PrismaClient,
  mapped: MappedSupplierFeedProduct,
  categoryId: number,
  supplierId: number,
): Promise<{ created: boolean; variantsCreated: number }> {
  const variantsData = mapped.variants.map((v) => ({ ...v, supplierId }));

  const existing = await prisma.product.findUnique({ where: { slug: mapped.slug }, select: { id: true } });

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
    await prisma.productVariant.deleteMany({ where: { productId: existing.id } });
    await prisma.productVariant.createMany({
      data: variantsData.map((v) => ({ productId: existing.id, ...v })),
    });
    return { created: false, variantsCreated: variantsData.length };
  }

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
  return { created: true, variantsCreated: variantsData.length };
}

export async function importSupplierFeedProducts(
  prisma: PrismaClient,
  products: SupplierFeedProduct[],
): Promise<ImportSupplierFeedResult> {
  const suppliersSeen = new Set<string>();
  const categoriesSeen = new Set<string>();
  let productsCreated = 0;
  let variantsCreated = 0;

  for (const product of products) {
    const mapped = mapSupplierFeedProduct(product);

    const supplier = await upsertSupplier(prisma, mapped.supplierName);
    suppliersSeen.add(mapped.supplierName);

    const category = await upsertCategory(prisma, mapped.categoryName);
    categoriesSeen.add(mapped.categoryName);

    const result = await upsertImportedProduct(prisma, mapped, category.id, supplier.id);
    if (result.created) productsCreated += 1;
    variantsCreated += result.variantsCreated;
  }

  return {
    suppliersUpserted: suppliersSeen.size,
    categoriesUpserted: categoriesSeen.size,
    productsCreated,
    variantsCreated,
    imagesCreated: 0,
  };
}
```

Notes / decisions to flag in the PR:

- **`ProductImage` is never touched** inside `upsertImportedProduct`, even on the update branch (EscuelaJS's version calls `prisma.productImage.deleteMany` there). This is deliberate: this importer must guarantee zero `ProductImage` writes ever, and `cleanLocalCatalog` already clears the table before every real script run. The only edge case is calling `importSupplierFeedProducts` twice directly without `cleanLocalCatalog` in between (the idempotency unit test, §3.2) against a product that already has images from some other path — not a realistic scenario for this fixture/tests, but note it as an accepted limitation.
- **Result-field semantics** (needed because `tasks.md`/`spec.md` don't spell out counting rules): `suppliersUpserted`/`categoriesUpserted` = count of **distinct** names touched in the run (create or update both count); `productsCreated` = count of products where a **new** `Product` row was inserted (re-imports that hit the update branch do not increment it); `variantsCreated` = total variant rows written this run (update branch counts too, since variants are always delete-then-recreate, mirroring `escuelaJsProductImporter.ts`'s replace-variants approach). Document this in a code comment above `ImportSupplierFeedResult` so the numbers aren't ambiguous to a future reader.
- `upsertCategory` does an extra `findUnique` before the `upsert` purely to know `isNew` for the (currently unused by the summary, but returned for symmetry/tests) return value — cheap, and keeps `upsertCategory`/`upsertSupplier` return shapes consistent. If you'd rather avoid the extra query, drop `isNew` from `upsertCategory`'s return and rely only on `categoriesSeen.size`; the plan above uses the `Set` for the summary regardless, so `isNew` is optional scaffolding, not load-bearing.

### 3.2 `backend/src/infrastructure/import/__tests__/supplierFeedImporter.test.ts` (new)

**No existing importer-level test exists in this codebase** (`escuelaJsProductImporter.ts` has none — only its mapper is tested) — this is new ground. Do not build a real-DB integration test; follow the DI-mock style already used elsewhere (`backend/src/infrastructure/repositories/categoryRepository.test.ts`), but simpler: since `importSupplierFeedProducts`/`cleanLocalCatalog` take `prisma: PrismaClient` as an explicit parameter (not the shared singleton from `../../prismaClient`), build a plain mock object and cast it — no `jest.mock('../../prismaClient', ...)` module mock needed:

```ts
const mockPrisma = {
  product: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  productVariant: { deleteMany: jest.fn(), createMany: jest.fn() },
  productImage: { deleteMany: jest.fn() },
  category: { findUnique: jest.fn(), upsert: jest.fn() },
  supplier: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
} as unknown as PrismaClient;
```

Cases (`beforeEach(() => jest.clearAllMocks())` per file, mirroring `categoryRepository.test.ts`):

1. **`cleanLocalCatalog`** calls `productImage.deleteMany`, `productVariant.deleteMany`, `product.deleteMany` in that exact order (assert via `mockPrisma.productImage.deleteMany.mock.invocationCallOrder[0] < ...` or by checking call order with a shared `jest.fn()` order array) and touches no `category`/`supplier` methods.
2. **New product + new supplier + new category**: `supplier.findFirst` → `null`, `category.findUnique` → `null`, `product.findUnique` → `null` ⇒ `supplier.create`, `category.upsert`, `product.create` (with nested `variants.create`) are each called once; result has `productsCreated: 1`, `variantsCreated` equal to the fixture product's variant count, `imagesCreated: 0`.
3. **Existing supplier/category (update branch)**: `supplier.findFirst` → existing row with `status: 'Active'` ⇒ `supplier.update` is **not** called (only called when `status !== 'Active'` — add a sub-case for an `Inactive` existing supplier to prove `update` fires and re-activates it).
4. **Existing product (update branch)**: `product.findUnique` → existing `{ id }` ⇒ `product.update`, `productVariant.deleteMany({ where: { productId } })`, `productVariant.createMany` are called; `productImage.deleteMany`/`productImage.create*` are **never** called; `productsCreated: 0` for that product.
5. **Idempotency** (`tasks.md` 3.3): call `importSupplierFeedProducts(mockPrisma, sameFixtureTwice)` — i.e. call the function twice in sequence in one test, with the mock's `product.findUnique` returning `null` on the first call's lookup and an existing row on the second call's lookup (`mockResolvedValueOnce` chaining) — assert `productVariant.createMany` is called both times but `product.create` only once, i.e. no duplicate `Product` creation on the second pass.
6. **Zero images guarantee**: across every case above, assert `mockPrisma.productImage.deleteMany` is called **only** from `cleanLocalCatalog`'s test, and no `productImage.create`/`createMany` mock exists at all on the mock object (a call to an undefined method throws, which itself proves the importer never touches `productImage` in the write path — a nice enforced-by-construction check).
7. **`readSupplierFeedFixture`**: point `sourcePath` at a temp file (write one with `fs.writeFileSync` into the OS temp dir in `beforeAll`/`afterAll`, or use `jest.mock('fs')` — prefer a real temp file under `os.tmpdir()` for simplicity, cleaned up in `afterAll`) covering: (a) valid array parses successfully; (b) missing file throws; (c) invalid JSON throws; (d) valid JSON but not an array throws; (e) array with a product missing `title`/`category`/`supplier.name`/`variants` throws a descriptive error for each.

This test file, combined with `mapSupplierFeedProduct.test.ts`, needs to hit the 90% branches/functions/lines/statements threshold for the two new `src/infrastructure/{import,external}` files (`supplierFeedTypes.ts` has no branches to speak of). Case list above intentionally exercises every `if`/ternary in `supplierFeedImporter.ts`.

---

## 4. Script entry point and dev-only guard

### 4.1 `backend/prisma/importSupplierFeed.ts` (new)

```ts
import { PrismaClient } from '@prisma/client';
import {
  cleanLocalCatalog,
  importSupplierFeedProducts,
  readSupplierFeedFixture,
} from '../src/infrastructure/import/supplierFeedImporter';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', 'db']); // 'db' = docker-compose.yml service name

function assertDevOnlyEnvironment(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run import:supplier-feed: NODE_ENV=production.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Refusing to run import:supplier-feed: DATABASE_URL is not set.');
  }

  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error('Refusing to run import:supplier-feed: DATABASE_URL is not a valid connection string.');
  }

  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run import:supplier-feed: DATABASE_URL host "${host}" is not a recognized local/dev host ` +
        `(expected one of: ${[...LOCAL_DATABASE_HOSTS].join(', ')}).`,
    );
  }
}

async function main() {
  // 1. Guard first — no PrismaClient constructed, no DB call possible, if this throws.
  assertDevOnlyEnvironment();

  // 2. Read + validate the fixture before any DB mutation, so a malformed fixture
  //    leaves the database untouched (spec.md "Fixture is malformed" scenario).
  const products = readSupplierFeedFixture();

  const prisma = new PrismaClient();
  try {
    await cleanLocalCatalog(prisma);
    const result = await importSupplierFeedProducts(prisma, products);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

Why `new URL(databaseUrl).hostname` works for a `postgresql://` connection string: Node's WHATWG `URL` parser extracts the authority/hostname generically for any scheme with a `//` authority section, it's not restricted to `http(s)`. Confirmed against this project's actual `.env.example` values: `postgresql://ecommerceUser:ecommercePassword@localhost:5432/ecommerceDb` → hostname `localhost`; the commented Docker alternative `@db:5432/...` → hostname `db` (matches `docker-compose.yml`'s `services.db`).

This file lives under `backend/prisma/`, which is **outside** `jest.config.js`'s `roots: ['<rootDir>/src']` — like `importEscuelaJs.ts`, it is intentionally not unit-tested by Jest. `tasks.md` 4.3 covers its guard with a **manual** verification step (temporarily set `NODE_ENV=production`, confirm non-zero exit and no DB call) rather than an automated test — do not add a Jest test for this file; it wouldn't be picked up by the `roots` config anyway without a bigger config change that's out of scope here.

### 4.2 `backend/package.json` — add script

In the `"scripts"` block, immediately after `"import:products"` (line 16 currently), add:

```json
"import:supplier-feed": "npx ts-node prisma/importSupplierFeed.ts",
```

Matches the existing `import:products` entry's exact style (`npx ts-node prisma/<file>.ts`, run from `backend/`).

### 4.3 Manual guard verification (not part of this plan's file changes — flag for the parent agent)

`tasks.md` 4.3 is a manual step for whoever runs the tasks (parent agent / developer), not something this plan needs to produce a file for: temporarily set `NODE_ENV=production npm run import:supplier-feed` (or point `DATABASE_URL` at a non-local host) and confirm the process exits non-zero via the guard, with zero DB rows changed, then revert the env var. No code changes needed to support this — the guard as designed above already satisfies it.

---

## File summary

| File | Action |
|---|---|
| `backend/prisma/fixtures/supplier-feed.sample.json` | new |
| `backend/src/infrastructure/external/supplierFeedTypes.ts` | new |
| `backend/src/infrastructure/import/mapSupplierFeedProduct.ts` | new |
| `backend/src/infrastructure/import/__tests__/mapSupplierFeedProduct.test.ts` | new |
| `backend/src/infrastructure/import/supplierFeedImporter.ts` | new |
| `backend/src/infrastructure/import/__tests__/supplierFeedImporter.test.ts` | new |
| `backend/prisma/importSupplierFeed.ts` | new |
| `backend/package.json` | edit (`scripts` block) |

## Verification commands (for the parent agent, after implementation)

```bash
cd backend
npm run lint
npm test -- --watchAll=false --testPathPattern=supplierFeed
npm test -- --watchAll=false --testPathPattern=supplierIsolation
npm test -- --watchAll=false   # full suite, per tasks.md 6.3
```

Per this project's ESLint config (`backend/.eslintrc*`): `@typescript-eslint/no-unused-vars` requires unused params prefixed with `_` (e.g. an unused `_index` in a `.map()` callback), and `@typescript-eslint/no-explicit-any` is a warn — avoid `any` in the new files entirely (`unknown` + type guards are used above in `assertIsSupplierFeedProduct`/the mock casts).
