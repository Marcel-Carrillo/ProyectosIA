# Backend Implementation Plan — `cj-catalog-promotion`

Source of truth for task numbering: `openspec/changes/cj-catalog-promotion/tasks.md` (sections 1-6, 8-10, 12-13 covered here). This plan only covers backend files. Frontend (section 7) is out of scope for this document.

All code below was planned against the **actual current files**, read in full before writing this plan (not assumed). Key real-code facts that shape the plan, none of which are stated in `design.md`, are called out inline and summarized in **Risks / Ambiguities Found In Real Code** at the end — read that section before implementing.

---

## 1. Prisma Schema (task 1.1–1.3)

### 1.1 `backend/prisma/schema.prisma` — MODIFIED

Add to `ProductVariant`:
```prisma
model ProductVariant {
  ...
  cjCatalogItemId Int?           @unique
  cjCatalogItem   CjCatalogItem? @relation(fields: [cjCatalogItemId], references: [id])
  ...
}
```
Add to `CjCatalogItem` (inverse side, required for Prisma to generate the 1:1 relation and for `include: { promotedVariant: true }` to work):
```prisma
model CjCatalogItem {
  ...
  promotedVariant ProductVariant?
  ...
}
```
No `@@index` needed beyond the implicit unique index Prisma creates for `@unique`.

### 1.2 Migration (task 1.2) — no interactive TTY available

Follow the exact precedent from `20260707175653_rename_spocket_to_cj_and_add_order_push_fields` (hand-written `migration.sql`, applied via `migrate deploy`, not `migrate dev`):

1. Create directory `backend/prisma/migrations/<UTC-timestamp>_add_cj_catalog_item_link/` (timestamp format `YYYYMMDDHHMMSS`, matching existing folder names — use current date, e.g. `20260708HHMMSS_add_cj_catalog_item_link`).
2. Attempt `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` from inside the backend container (`docker compose exec backend ...`) to get Prisma-generated SQL; if the shadow-database step fails in this environment (no `SHADOW_DATABASE_URL` configured — none exists in `.env.example`/`.env.docker` today), hand-write `migration.sql` instead — it is a small, fully deterministic additive change:
   ```sql
   -- AlterTable
   ALTER TABLE "ProductVariant" ADD COLUMN "cjCatalogItemId" INTEGER;

   -- CreateIndex
   CREATE UNIQUE INDEX "ProductVariant_cjCatalogItemId_key" ON "ProductVariant"("cjCatalogItemId");

   -- AddForeignKey
   ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_cjCatalogItemId_fkey" FOREIGN KEY ("cjCatalogItemId") REFERENCES "CjCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   ```
   Use `ON DELETE SET NULL` (not `RESTRICT`, unlike the `CjCatalogItem.supplierIntegrationId` FK) because `CjCatalogItem` staging rows are disposable/re-syncable per its own spec — a promoted `Product`/`ProductVariant` must survive even if its source staging row is ever deleted; it just loses its origin link. Flag this FK-behavior choice explicitly in the PR description since `design.md` doesn't specify `ON DELETE` behavior.
3. Purely additive, nullable column — no backfill needed (both DBs are empty of products per `design.md` Migration Plan step 1).
4. Apply: `docker compose exec backend npx prisma migrate deploy` (mirrors `docs/development_guide.md`'s documented `migrate deploy` usage). Verify with `docker compose exec backend npx prisma migrate status` — expect "Database schema is up to date!".
5. Down migration for rollback note in PR description: `ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_cjCatalogItemId_fkey"; DROP INDEX "ProductVariant_cjCatalogItemId_key"; ALTER TABLE "ProductVariant" DROP COLUMN "cjCatalogItemId";` (not a file to create — Prisma has no down-migration files in this repo's convention; just documented in the PR per `design.md`'s Migration Plan step 4).

### 1.3 `npx prisma generate` (task 1.3)

Run inside the container after the migration applies. Verify via a throwaway `npx ts-node` snippet (not committed) that `prisma.productVariant.findFirst({ select: { cjCatalogItemId: true } })` and `prisma.cjCatalogItem.findFirst({ include: { promotedVariant: true } })` type-check and execute without error.

---

## 2. Domain Layer (task 2.1–2.3)

### 2.1 `backend/src/domain/models/productVariant.ts` — MODIFIED

Add `cjCatalogItemId?: number | null` to both the class fields and the constructor `data` param type, defaulted like `size`/`color`:
```ts
this.cjCatalogItemId = data.cjCatalogItemId ?? null;
```
**Important**: unlike `size`/`color`, this field must behave exactly like the *already-omitted* `supplierId`/`supplierReference`/`supplierCost` fields that the real `ProductVariant` model **does not currently have at all** (verified by reading the file — the domain class has no `supplierCost` field even though the Prisma model does). Since task 2.1 explicitly asks to add `cjCatalogItemId` to the domain model (unlike those three, which were never added), the isolation guarantee here comes entirely from the `variantSelect` omission in the two repositories (§4.2), not from the model shape. Confirm `backend/src/infrastructure/repositories/__tests__/productVariantRepository.test.ts`'s existing `describe('ProductVariant domain model - supplier field exclusion', ...)` block's JSON-serialization assertions are extended to also assert `cjCatalogItemId` is absent from default-path JSON (see §8.3).

### 2.2 `backend/src/application/validator.ts` — MODIFIED

Append after the existing CJ error classes (after `CjOrderNotPushedError`, ~line 1117), following the exact same pattern (`readonly code`, `readonly status`, `Object.setPrototypeOf`):

```ts
export class CjCatalogItemNotPromotedError extends Error {
  readonly code = 'CJ_CATALOG_ITEM_NOT_PROMOTED' as const;
  readonly status = 422;
  constructor(message = 'CJ catalog item has not been promoted to a product variant') { ... }
}

export class CjPromotionPriceRequiredError extends Error {
  readonly code = 'CJ_PROMOTION_PRICE_REQUIRED' as const;
  readonly status = 422;
  constructor(message = 'publicPrice is required: no explicit price given and CJ_DEFAULT_MARKUP_MULTIPLIER is not configured') { ... }
}

export class CjPromotionCategoryRequiredError extends Error {
  readonly code = 'CJ_PROMOTION_CATEGORY_REQUIRED' as const;
  readonly status = 422;
  constructor(message = 'A valid categoryId is required to promote CJ catalog items') { ... }
}

export class CjCatalogItemSyncFailedCannotPromoteError extends Error {
  readonly code = 'CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE' as const;
  readonly status = 422;
  constructor(message = 'CJ catalog item failed to sync and cannot be promoted') { ... }
}
```

Also add a new validator function `validateCjPromotionData` (referenced by task 6.3), placed in the same CJ section:
```ts
export interface CjPromotionItemInput {
  cjCatalogItemId: number;
  publicPrice?: number;
  compareAtPrice?: number;
}
export interface CjPromotionRequestInput {
  items: CjPromotionItemInput[];
  categoryId: number;
  activate?: boolean;
}
export function validateCjPromotionData(data: Record<string, unknown>): CjPromotionRequestInput
```
Validates: `items` is a non-empty array; each item has an integer `cjCatalogItemId` and, if present, a positive numeric `publicPrice`/`compareAtPrice` with `compareAtPrice > publicPrice` when both given (reuse the same rule `VariantComparePriceInvalidError` encodes, but as a `ValidationError` at this layer — the promotion service should not need to re-derive that comparison); `categoryId` is a required integer (throws generic `ValidationError`, **not** `CjPromotionCategoryRequiredError` — that error is reserved for "categoryId doesn't reference an existing Category", a service-layer check per the spec's wording: "a missing or invalid `categoryId`" covers both, but keep the two failure modes distinct: malformed input → `ValidationError`/400 at the validator layer like every other endpoint in this codebase, non-existent category → `CjPromotionCategoryRequiredError`/422 at the service layer after a DB lookup); `activate` is optional boolean.

**Flag**: the spec text says a missing/invalid `categoryId` returns 422 `CJ_PROMOTION_CATEGORY_REQUIRED` — that implies even a completely absent `categoryId` field returns 422 with that specific code, not a generic 400 `ValidationError`. Confirm this before implementing: the plan above deliberately makes `validateCjPromotionData` throw `ValidationError` (400) only for non-integer garbage, and routes both "missing" and "references nothing" through `CjPromotionCategoryRequiredError` (422) at the service layer, to match the spec's literal wording exactly (scenario "Promotion fails when category is missing" expects 422 `CJ_PROMOTION_CATEGORY_REQUIRED`, not 400). So `validateCjPromotionData` should NOT throw on a missing `categoryId` at all — just pass it through as `undefined`/non-number, and let `cjCatalogPromotionService.promote()` be the single place that throws `CjPromotionCategoryRequiredError` for both "absent" and "not found in DB".

Note per task 2.2: `CJ_CATALOG_ITEM_ALREADY_PROMOTED` from `proposal.md` is **not** implemented as an error class — re-promotion is a 200 idempotent success path (§5.2).

### 2.3 `backend/.env.example` and `backend/.env.docker` — MODIFIED

Add next to the existing `# ── CJ Dropshipping integration ──` block, after `CJ_CATALOG_PAGE_SIZE`:
```
# Default markup multiplier applied to CjCatalogItem.supplierCost when an admin
# promotes an item without an explicit publicPrice. Never publish at raw cost.
CJ_DEFAULT_MARKUP_MULTIPLIER=2.5
```
Read via `Number(process.env.CJ_DEFAULT_MARKUP_MULTIPLIER)` in `cjCatalogPromotionService.ts`, mirroring the `Number(process.env.CJ_SYNC_MAX_PAGES ?? 500)` pattern already used in `cjCatalogSyncService.ts`. Unlike that file's module-level `const`, read it **inside** `promote()` (or via a `getDefaultMarkupMultiplier()` helper called per-request) so unit tests can `jest.resetModules()`/mock `process.env` per test case without needing a fresh module import — matches how `cjCatalogSyncService.test.ts` is structured (module-level constants there are never varied across tests, only default behavior is tested).

---

## 3. Domain Repositories (task 3.1–3.2)

### 3.1 `backend/src/domain/repositories/cjCatalogItemRepository.ts` — MODIFIED

Current file only has `upsertMany`, `findBySupplierIntegrationId`, `findByExternalRef`. Add:

```ts
export type CjPromotionState = 'NotPromoted' | 'Active' | 'Inactive';

export interface CjCatalogItemListFilters {
  page?: number;
  pageSize?: number;
  syncStatus?: string;
  promotionState?: CjPromotionState;   // NEW
}

export interface CjCatalogItemListItem {           // NEW — replaces bare CjCatalogItem in the list result
  item: CjCatalogItem;
  promotionState: CjPromotionState;
  productId: number | null;
  productVariantId: number | null;
}

export interface CjCatalogItemListResult {
  items: CjCatalogItemListItem[];     // CHANGED from CjCatalogItem[]
  total: number;
  page: number;
  pageSize: number;
}
```

**Flag (gap not in tasks.md)**: the promote endpoint's request body references items by `cjCatalogItemId` (the numeric PK), but the interface has no lookup-by-id method — only `findByExternalRef` (keyed by `supplierIntegrationId` + CJ's own `vid`). Add:
```ts
findById(id: number): Promise<CjCatalogItem | null>;
findManyByIds(ids: number[]): Promise<CjCatalogItem[]>;   // for bulk promote pre-validation, one query instead of N
```
`findManyByIds` is the one the promotion service should actually use (avoids N+1 queries during bulk pre-validation); `findById` is useful for `activate`/`deactivate` if those resolve by `cjCatalogItemId` directly rather than through the list join (they do — see §5.1).

**Shape change note**: changing `CjCatalogItemListResult.items` from `CjCatalogItem[]` to `CjCatalogItemListItem[]` is a breaking change to the interface — `cjCatalogSyncController.listCatalog` (§6.2) and its serializer call site must be updated together with this change, and `cjCatalogSyncService.test.ts`'s existing assertions on `listStagedCatalog`'s return shape must be updated (§8.2).

### 3.2 `IProductVariantRepository` (in `backend/src/domain/repositories/productRepository.ts`) — MODIFIED

**Flag**: task 3.2 says "confirm the existing `create`/`update` signatures can accept `cjCatalogItemId`" — this is not just confirmation, it's a real gap. `ProductVariantCreateData` currently has no `cjCatalogItemId` field at all. Add it:
```ts
export interface ProductVariantCreateData {
  ...
  cjCatalogItemId?: number | null;   // NEW
}
```
Do **not** add it to `ProductVariantUpdateData` — design decision 4 says activate/deactivate never touch this field, and there's no "unlink" action in scope, so there's no code path that should ever update it after creation.

Add to `IProductVariantRepository`:
```ts
findByCjCatalogItemId(cjCatalogItemId: number): Promise<ProductVariant | null>;
```

---

## 4. Infrastructure: Repository Implementations (task 4.1–4.3)

### 4.1 `backend/src/infrastructure/repositories/cjCatalogItemRepository.ts` — MODIFIED

`findBySupplierIntegrationId`: add a left-join via `include: { promotedVariant: { select: { id: true, productId: true, status: true } } }` (this is a different, one-off select — not the shared `variantSelect` from `productVariantRepository.ts` — because here we only need 3 fields off the linked variant, and `cjCatalogItemId` is never part of it since it's implicit from the join).

Derive per-row:
```ts
function derivePromotionState(promotedVariant: { status: string } | null): CjPromotionState {
  if (!promotedVariant) return 'NotPromoted';
  return promotedVariant.status === 'Active' ? 'Active' : 'Inactive';
}
```
Map each row to `{ item: new CjCatalogItem(r), promotionState, productId: r.promotedVariant?.productId ?? null, productVariantId: r.promotedVariant?.id ?? null }`.

**`promotionState` filter — the risk flagged in task 4.1 itself ("verify `total` still matches filtered results")**: Prisma cannot filter directly on a computed value. Two options:
- **Recommended**: translate `promotionState` into a `where` clause on the relation before querying, so `count()` and `findMany()` stay consistent:
  - `NotPromoted` → `where: { promotedVariant: null }` (actually `where: { promotedVariant: { is: null } }` for the optional 1:1 back-relation)
  - `Active` → `where: { promotedVariant: { status: 'Active' } }`
  - `Inactive` → `where: { promotedVariant: { is: not: null }, AND: [{ NOT: { promotedVariant: { status: 'Active' } } }] }` — Prisma syntax for "linked but not Active": `where: { promotedVariant: { isNot: null, status: { not: 'Active' } } }` (Prisma's relation filters support combining `isNot: null` and field conditions in one `promotedVariant: {...}` object since it's a to-one relation).
  - This keeps `prisma.cjCatalogItem.count({ where })` and `findMany({ where })` using the identical `where`, so `total` is correct — avoids the "post-query filter breaks pagination count" trap the task explicitly warns about.
- Rejected alternative: fetch all + filter in JS — breaks `skip`/`take` pagination correctness for anything beyond page 1, explicitly what the task tells you to avoid.

Keep `findByExternalRef` unchanged. Add `findById`/`findManyByIds` (§3.1) as plain `prisma.cjCatalogItem.findUnique`/`findMany({ where: { id: { in: ids } } })` calls, mapped through `new CjCatalogItem(...)` like the existing methods.

### 4.2 `backend/src/infrastructure/repositories/productVariantRepository.ts` — MODIFIED

- Do **not** add `cjCatalogItemId` to the shared `variantSelect` constant (lines 42-55) — this is the omission itself; add a one-line comment next to it explicitly naming `cjCatalogItemId` alongside a note that it mirrors the pre-existing (already-correct) omission of `supplierId`/`supplierReference`/`supplierCost`.
- `create()`: pass `cjCatalogItemId: data.cjCatalogItemId ?? null` into `prisma.productVariant.create({ data: {...} })`. Still returns via `variantSelect`, so the returned domain object's `cjCatalogItemId` will be `null` regardless of what was just persisted — that's fine, the caller (promotion service) already has the id it just used and doesn't need it echoed back.
- Add:
  ```ts
  async findByCjCatalogItemId(cjCatalogItemId: number): Promise<ProductVariant | null> {
    const row = await prisma.productVariant.findFirst({
      where: { cjCatalogItemId, deletedAt: null },
      select: variantSelect,
    });
    return row ? new ProductVariant(row) : null;
  }
  ```
  (`findFirst` not `findUnique` here despite the DB-level `@unique` — keeps parity with `findBySku`'s style of using `findFirst` with a `deletedAt: null` guard rather than a raw `findUnique`, and Prisma's generated `findUnique` on a nullable unique column still requires an explicit non-null value type in some client versions; `findFirst` sidesteps that friction.)

### 4.3 Test files (task 4.3)

**`backend/src/infrastructure/repositories/__tests__/cjCatalogItemRepository.test.ts`** — EXTEND (file exists, read in full above). Add to the existing `describe('findBySupplierIntegrationId', ...)` block:
- `should_derive_NotPromoted_when_no_linked_variant` — mock `mockFindMany` to resolve a row with `promotedVariant: null`; assert `items[0].promotionState === 'NotPromoted'` and `productId`/`productVariantId` are `null`.
- `should_derive_Active_when_linked_variant_status_is_Active` — `promotedVariant: { id: 9, productId: 4, status: 'Active' }`; assert `Active` + correct ids.
- `should_derive_Inactive_when_linked_variant_status_is_not_Active` — `promotedVariant: { id: 9, productId: 4, status: 'Inactive' }` (also test `OutOfStock`/`Archived` map to `Inactive`, not just literal `'Inactive'`).
- `should_apply_promotionState_where_clause_for_NotPromoted_filter` — assert `mockFindMany` called with `where` containing `promotedVariant: { is: null }` (or whatever the final Prisma syntax resolves to) and that the same `where` is passed to `mockCount`/the transaction array.
- `should_apply_promotionState_where_clause_for_Active_and_Inactive_filters` — two cases.
- New `describe('findById', ...)` and `describe('findManyByIds', ...)`: found/not-found cases, mapping to `CjCatalogItem` instances.

**`backend/src/infrastructure/repositories/__tests__/productVariantRepository.test.ts`** — EXTEND (file exists, read in full above; note its current content is two `describe` blocks purely about the *domain model* and the *repository not having supplier fields as instance properties* — it doesn't yet mock Prisma at all). Add:
- A new `describe('findByCjCatalogItemId', ...)` with a `jest.mock('../../prismaClient', ...)` block (following the pattern from `cjCatalogItemRepository.test.ts`) mocking `prisma.productVariant.findFirst`; test found + not-found.
- Extend the existing `'ProductVariant domain model - supplier field exclusion'` describe block with a case asserting `cjCatalogItemId` is also `undefined`/absent from default JSON serialization (constructor call without passing `cjCatalogItemId` → `variant.cjCatalogItemId` is `null` per §2.1's `?? null` default, so the correct assertion is `toBeNull()`, not `toBeUndefined()` — verify this matches how `size`/`color` behave today, since those already default to `null` via the same pattern, not `undefined`).
- A new case verifying `ProductVariantRepository.create()` passes `cjCatalogItemId` through to `prisma.productVariant.create`'s `data` when provided (mock `prisma.productVariant.create`, assert `expect.objectContaining({ cjCatalogItemId: 42 })`).

---

## 5. Application: `cjCatalogPromotionService.ts` (task 5.1–5.3)

### 5.1 `backend/src/application/services/cjCatalogPromotionService.ts` — NEW

```ts
export interface PromoteItemInput {
  cjCatalogItemId: number;
  publicPrice?: number;
  compareAtPrice?: number;
}
export interface PromoteRequestInput {
  items: PromoteItemInput[];
  categoryId: number;
  activate?: boolean;
}
export interface PromotedVariantResult {
  cjCatalogItemId: number;
  productId: number;
  productVariantId: number;
  sku: string;
  wasAlreadyPromoted: boolean;   // true => this is the idempotent-reuse path
}
export interface PromoteResult {
  products: { productId: number; variantIds: number[] }[];
  variants: PromotedVariantResult[];
  createdAny: boolean;   // false when 100% of items were already-promoted (all idempotent) — controller uses this to pick 200 vs 201
}

export class CjCatalogPromotionService {
  constructor(
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly productService: ProductService,     // for slug generation — see flag below
    private readonly integrationRepo: ISupplierIntegrationRepository,
  ) {}

  async promote(supplierId: number, input: PromoteRequestInput): Promise<PromoteResult> { ... }
  async activate(supplierId: number, cjCatalogItemId: number): Promise<{ productId: number; productVariantId: number }> { ... }
  async deactivate(supplierId: number, cjCatalogItemId: number): Promise<{ productId: number; productVariantId: number }> { ... }
}
```

**`promote()` algorithm** (pre-validate everything, then one transaction, matching design decision 6 and the risk-mitigation in `design.md`'s Risks section):

1. Resolve `integration = integrationRepo.findBySupplierId(supplierId)`; throw `SupplierIntegrationNotFoundError` if missing (reused from `cjCatalogSyncService`, same 404 semantics — no new error needed).
2. Resolve `category = categoryRepo.findById(input.categoryId)`; if `input.categoryId` is missing/not-a-number/not found → throw `CjPromotionCategoryRequiredError` (see the flag in §2.2 — this is the single place that error is thrown, covering both "absent" and "invalid").
3. `const catalogItems = await catalogRepo.findManyByIds(input.items.map(i => i.cjCatalogItemId))`. Build a per-item error list:
   - id not found in the returned set → per-item error `CJ_CATALOG_ITEM_NOT_FOUND` (not in task 2.2's list — **flag**: neither `design.md` nor `tasks.md` names an error code for "unknown `cjCatalogItemId`" even though spec.md's scenario "A partially invalid bulk request persists nothing" explicitly requires this exact case to produce a per-item error. Recommend adding `CJ_CATALOG_ITEM_NOT_FOUND` (422) as an additional error class in `validator.ts` alongside the four in task 2.2, and wiring it in `errorHandler.ts` — this is a real gap, not an implementation choice.)
   - found but `item.supplierIntegrationId !== integration.id` → same `CJ_CATALOG_ITEM_NOT_FOUND` treatment (isolation: an admin scoped to supplier A must not be able to promote supplier B's staged rows through this endpoint even by guessing ids).
   - `item.syncStatus === 'Failed'` → `CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE`.
   - price resolution: `resolvedPrice = requestItem.publicPrice ?? (item.supplierCost && markup ? Number(item.supplierCost) * markup : undefined)`; if `undefined` → `CJ_PROMOTION_PRICE_REQUIRED`.
   - If **any** item has an error, throw a single aggregate error carrying the full per-item list (new type — see flag below) and persist nothing. **Do not open the transaction.**
4. Check existing links: `existingLinks = await Promise.all(catalogItems.map(ci => productVariantRepo.findByCjCatalogItemId(ci.id)))`. Build `alreadyLinked: Map<cjCatalogItemId, ProductVariant>`.
5. Group the **not-yet-linked** items by `pid`. **Flag (real ambiguity, not covered by spec.md or design.md — see Risks section)**: if some items in a `pid` group are already linked and others aren't, the new ones must join the **existing** `Product` (resolved from the already-linked variant's `productId`), not create a new one — otherwise a partial re-promotion of a product's remaining color/size variants would incorrectly fork into a second `Product` with the same name. If two different already-linked items in the same `pid` group point to two different `productId`s (should be structurally impossible given the grouping invariant, but not enforced by any DB constraint), treat it as a data-integrity fault — throw a 500-class internal error (log loudly), do not silently pick one.
6. For each `pid` group needing a **new** `Product`: resolve `slug` via `productService.resolveUniqueSlug(items[0].title)`. **Flag**: `resolveUniqueSlug` and `generateSlug` are currently `private` methods on `ProductService` (verified by reading `productService.ts`). Task 5.1/design.md decision 2 explicitly says "reusing `ProductService`'s slug-generation logic" — this requires making `resolveUniqueSlug` `public` (rename nothing, just drop `private`) so `cjCatalogPromotionService` can call `productService.resolveUniqueSlug(name)` directly. This is a one-line visibility change to `productService.ts`, not mentioned in `tasks.md`, and must be called out in the PR.
7. Open `prisma.$transaction(async (tx) => { ... })` — **use raw `tx.*` calls, not the repository classes**, matching the established pattern in `checkoutService.createOrder()` (the only other multi-entity-create transaction in this codebase — repositories all use the shared `prisma` singleton directly, not a tx-aware client, so calling `productRepo.create()`/`productVariantRepo.create()` inside the callback would silently run **outside** the transaction and break atomicity). Inside:
   - For each new-product group: `tx.product.create({ data: { name, slug, status: 'Draft', categoryId: input.categoryId } })`.
   - For each item needing a new variant (new group or joining an existing product): `tx.productVariant.create({ data: { productId, sku: `CJ-${item.externalRef}`, size: item.size, color: item.color, publicPrice: resolvedPrice, compareAtPrice: requestItem.compareAtPrice ?? null, stockPolicy: 'SupplierManaged', status: 'Active', cjCatalogItemId: item.id } })`. **Flag**: spec.md's first scenario says the created product is `status = Draft` *unless* `activate: true` — but a brand-new `Product` with `status: 'Draft'` created in the same statement as its first `ProductVariant` cannot use `ProductService.update()`'s existing `PRODUCT_REQUIRES_ACTIVE_VARIANT` guard (that guard reads `countActiveByProduct`, which only makes sense once at least one variant row exists — here we're creating both in the same transaction, so the guard would need to run *after* the variant insert, not before). Recommended handling: if `input.activate === true`, create the `Product` directly with `status: 'Active'` (bypass `ProductService.create`'s own guard entirely, since a transaction with a variant being created atomically alongside it makes the guard's underlying invariant satisfied by construction) rather than calling `productService.create()`+`update()` — this is a deliberate divergence from "reuse `ProductService`" for the creation step itself (only slug generation is reused), which should be flagged in the PR as a judgment call.
   - Idempotent items (`alreadyLinked`): no DB write, just carry the existing `productId`/`productVariantId` through into the result.
8. Return `PromoteResult`.

**`activate(supplierId, cjCatalogItemId)`**:
1. Resolve integration (404 pattern as above, reused for isolation — confirm the `cjCatalogItemId` belongs to this `supplierId`'s integration the same way as in `promote`).
2. `variant = await variantRepo.findByCjCatalogItemId(cjCatalogItemId)`; if `null` → `CjCatalogItemNotPromotedError`.
3. `await variantRepo.update(variant.id, { status: 'Active' })`.
4. `await productService.update(variant.productId, { status: 'Active' })` — this reuses the **real** guard location. **Flag**: `design.md` says the guard is "already enforced by `ProductRepository`" — that's not accurate; reading `productService.ts` shows `PRODUCT_REQUIRES_ACTIVE_VARIANT` is thrown by `ProductService.update()` (via `this.variantRepo.countActiveByProduct(id)`), not by `ProductRepository` itself (the error *class* happens to be defined in the `productRepository.ts` infra file, but the enforcement call site is in the service). Since step 3 already set the variant to `Active` before step 4 runs, `countActiveByProduct` will correctly see it and the guard will pass — order of operations matters here and must not be swapped.
5. Return `{ productId: variant.productId, productVariantId: variant.id }`.

**`deactivate(supplierId, cjCatalogItemId)`**:
1. Same resolution as `activate` steps 1-2.
2. `await variantRepo.update(variant.id, { status: 'Inactive' })`. Do **not** call `productService.update()` at all — design decision 4 says only the variant transitions; the parent `Product`'s own status is left untouched by this action (a `Product` can have `status: 'Active'` with zero active variants after this — that's an existing, accepted state in this codebase already, since `ProductRepository.findAll`'s public-facing query already filters `variants: { where: { status: 'Active' } }`, so an active product with no active variants simply shows an empty variant list publicly, not a 4xx).
3. Return `{ productId: variant.productId, productVariantId: variant.id }`.

**Flag — aggregate per-item error type**: `tasks.md`/`spec.md` need a `422` response with "a per-item error list" (see scenario "A partially invalid bulk request persists nothing"). This requires a new error shape, e.g.:
```ts
export class CjPromotionValidationError extends Error {
  readonly code = 'CJ_PROMOTION_VALIDATION_FAILED' as const;
  readonly status = 422;
  constructor(public readonly itemErrors: Array<{ cjCatalogItemId: number; code: string; message: string }>) {
    super('One or more items failed promotion validation');
    ...
  }
}
```
Add this to `validator.ts` alongside the four from task 2.2 (it's a fifth error class the task list doesn't name, but the spec's own scenario requires it), and wire it into `errorHandler.ts` with a response body that includes `itemErrors` (the generic `globalErrorHandler` shape is `{ success: false, error: { message, code } }` — this needs a special case that also spreads `itemErrors` into the `error` object, since none of the other ~40 error branches in that file carry a payload beyond `message`/`code`).

### 5.2 Idempotency (task 5.2)

Already folded into the `promote()` algorithm above (step 4). Controller-level status code: `PromoteResult.createdAny` distinguishes "everything was already promoted" (all `200`) from "at least one new record created" (`201`) — task 10.3/10.5's curl plan expects `201` on first promote and `200` on the repeat call, so the controller (§6.3) must branch on this flag, not just always return `201`.

### 5.3 `backend/src/application/services/__tests__/cjCatalogPromotionService.test.ts` — NEW

Mock `ICjCatalogItemRepository`, `ICategoryRepository`, `ProductService` (jest-mock the class, matching the `jest.mock('../productService', ...)` style used elsewhere), `IProductVariantRepository`, `ISupplierIntegrationRepository`. Key cases (from task 5.3, made concrete against the real signatures above):

- `promote`: single item, explicit `publicPrice` → creates one `Product` + one `ProductVariant`, `sku === 'CJ-<externalRef>'`, `cjCatalogItemId` set in the `tx.productVariant.create` call args.
- `promote`: three items sharing `pid`, no existing links → one `tx.product.create` call, three `tx.productVariant.create` calls, all referencing the same `productId`.
- `promote`: price fallback — no `publicPrice` in request, `CJ_DEFAULT_MARKUP_MULTIPLIER` set via `process.env` in the test → assert `publicPrice === supplierCost * multiplier` in the create call args.
- `promote`: no `publicPrice`, no configured multiplier (`delete process.env.CJ_DEFAULT_MARKUP_MULTIPLIER` in the test) → rejects with `CjPromotionValidationError` (or whichever aggregate type is used) containing `CJ_PROMOTION_PRICE_REQUIRED` for that item; assert **no** `$transaction` call happened (`mockTransaction` not called) — this is the "validates before opening the transaction" guarantee.
- `promote`: missing/invalid `categoryId` → rejects with `CjPromotionCategoryRequiredError`; assert `catalogRepo.findManyByIds` was never called (fail fast before even touching catalog items) — a design choice worth locking in with a test since it affects perceived latency/DB load on bad requests.
- `promote`: one item `syncStatus: 'Failed'` → rejects with the aggregate error containing `CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE` for that item only.
- `promote`: 5 items, 1 with an unknown `cjCatalogItemId` → aggregate error lists exactly that one item; assert `$transaction` never called (nothing persisted) — directly covers the spec's "partially invalid bulk request persists nothing" scenario.
- `promote`: re-promoting an already-linked item (mock `findByCjCatalogItemId` to return an existing variant for it) → `wasAlreadyPromoted: true` in the result, no `tx.product.create`/`tx.productVariant.create` call for that item, `createdAny: false` when it's the only item in the request.
- `promote`: mixed group — 2 items share a `pid`, one already linked to `productId: 7`, the other new → assert the new variant is created with `productId: 7` (no new `Product` row), covering the ambiguity flagged in §5.1 step 5.
- `activate`: happy path on an `Inactive` linked variant → asserts `variantRepo.update(id, { status: 'Active' })` called **before** `productService.update(productId, { status: 'Active' })` (order-sensitive per the flag in §5.1 step 4 — use `mockFn.mock.invocationCallOrder` or a shared call-order array to assert ordering, not just that both were called).
- `activate`/`deactivate` on a `cjCatalogItemId` with no linked variant (mock `findByCjCatalogItemId` → `null`) → rejects `CjCatalogItemNotPromotedError` for both.
- `deactivate`: happy path → asserts `variantRepo.update` called with `{ status: 'Inactive' }` and asserts `productService.update` is **never** called (locks in the "deactivate never touches the parent Product" design decision — an easy regression to introduce later by copy-pasting `activate`'s body).

---

## 6. Presentation Layer (task 6.1–6.6)

### 6.1 `backend/src/presentation/serializers/cjCatalogItemSerializer.ts` — MODIFIED

`serializeCjCatalogItem` currently takes a bare `CjCatalogItem`. Since the repository now returns `CjCatalogItemListItem` (`{ item, promotionState, productId, productVariantId }` — §3.1/§4.1), change the function signature:
```ts
export interface CjCatalogItemResponseDTO {
  ...  // unchanged existing fields
  promotionState: 'NotPromoted' | 'Active' | 'Inactive';   // NEW
  productId: number | null;                                 // NEW
  productVariantId: number | null;                          // NEW
}

export function serializeCjCatalogItem(entry: CjCatalogItemListItem): CjCatalogItemResponseDTO {
  const { item, promotionState, productId, productVariantId } = entry;
  return { ...existingFields, promotionState, productId, productVariantId };
}
```
**Flag**: this is a breaking signature change (was `(item: CjCatalogItem)`, becomes `(entry: CjCatalogItemListItem)`) — every call site must move together: `cjCatalogSyncController.listCatalog` (§6.2) and the promotion controller's response mapping if it reuses this serializer for the promoted items (recommended, so promotion responses use the identical allow-list/omission guarantees). The existing `cjCatalogItemSerializer.test.ts` (read in full above) constructs a bare `CjCatalogItem` and calls `serializeCjCatalogItem(item)` directly — every existing test case there needs its call site updated to `serializeCjCatalogItem({ item, promotionState: 'NotPromoted', productId: null, productVariantId: null })`, plus new cases for `Active`/`Inactive` with non-null ids. Keep the existing "excludes `rawPayload`/`pid`/`vid`/etc." assertions unchanged — those still apply to the nested `item`.

### 6.2 `backend/src/presentation/controllers/cjCatalogSyncController.ts` — MODIFIED

`listCatalog`: add `promotionState` to the destructured `req.query`, validate it's one of `NotPromoted`/`Active`/`Inactive` if present (same `ValidationError` pattern as the existing `syncStatus` check, ~line 38), pass through to `listStagedCatalog`. The `data.items = result.items.map(serializeCjCatalogItem)` line now maps `CjCatalogItemListItem[]` (matches the new serializer signature from §6.1 automatically — no other change needed here).

Also update `cjCatalogSyncService.listStagedCatalog`'s param type in `cjCatalogSyncService.ts` to accept `promotionState?: string` and pass it through to `catalogRepo.findBySupplierIntegrationId`.

### 6.3 `backend/src/presentation/controllers/cjCatalogPromotionController.ts` — NEW

```ts
const cjCatalogPromotionService = new CjCatalogPromotionService(
  new CjCatalogItemRepository(),
  new CategoryRepository(),
  new ProductService(new ProductRepository(), new ProductVariantRepository(), new ProductTranslationRepository()),
  new SupplierIntegrationRepository(),
);

export async function promote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const input = validateCjPromotionData(req.body as Record<string, unknown>);
    const result = await cjCatalogPromotionService.promote(supplierId, input);
    const statusCode = result.createdAny ? 201 : 200;
    res.status(statusCode).json({ success: true, data: result, message: 'CJ catalog items promoted successfully' });
  } catch (err) { next(err); }
}

export async function activate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const cjCatalogItemId = parseInt(req.params['cjCatalogItemId'] as string, 10);
    if (isNaN(cjCatalogItemId)) throw new ValidationError("Parameter 'cjCatalogItemId' must be a valid integer");
    const result = await cjCatalogPromotionService.activate(supplierId, cjCatalogItemId);
    res.json({ success: true, data: result, message: 'CJ catalog item activated' });
  } catch (err) { next(err); }
}

export async function deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  // mirrors activate
}
```
`parseSupplierIdParam` should be extracted to a small shared helper (currently duplicated verbatim in `cjCatalogSyncController.ts`) or just re-duplicated here to match the existing codebase's apparent tolerance for that duplication (verified: `cjConnectionController.ts` likely has its own copy too — grep before deciding; if a shared helper doesn't already exist anywhere, duplicating here matches the established convention rather than introducing a new shared-utils file this feature doesn't otherwise need).

### 6.4 `backend/src/routes/admin/cjRoutes.ts` — MODIFIED

```ts
import { promote, activate, deactivate } from '../../presentation/controllers/cjCatalogPromotionController';

const cjPromoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

cjRouter.post('/catalog/promote', cjPromoteLimiter, promote);
cjRouter.post('/catalog/:cjCatalogItemId/activate', activate);
cjRouter.post('/catalog/:cjCatalogItemId/deactivate', deactivate);
```
Mirrors `cjVerifyLimiter` exactly per the context-session's explicit instruction. Route order: since Express matches `/catalog` (GET, existing) and `/catalog/promote` (POST, new) as distinct path+method combinations, no conflict with the existing `cjRouter.get('/catalog', listCatalog)`. `mergeParams: true` (already set) makes `:supplierId` available; the new `:cjCatalogItemId` param is scoped to this router only.

### 6.5 `backend/src/middleware/errorHandler.ts` — MODIFIED

Import the 4 (or 5, if `CjPromotionValidationError`/`CJ_CATALOG_ITEM_NOT_FOUND` are added per the §5.1 flag) new error classes from `validator.ts`, add `else if` branches following the exact existing style (`statusCode = err.status; code = err.code; message = err.message;`). For `CjPromotionValidationError` specifically, special-case the response body to include `itemErrors`:
```ts
} else if (err instanceof CjPromotionValidationError) {
  res.status(err.status).json({ success: false, error: { message: err.message, code: err.code, itemErrors: err.itemErrors } });
  return;
}
```
placed as an early return before the generic `res.status(statusCode).json(...)` at the bottom, since it's the only error type in this file needing an extra payload field.

### 6.6 Controller/isolation tests (task 6.6)

**`backend/src/presentation/controllers/__tests__/cjCatalogSyncController.test.ts`** — EXTEND (read in full above, existing `jest.mock` scaffolding reused). Add to `listCatalog`:
- `should_accept_and_pass_through_promotionState_filter` — assert `mockListStagedCatalog` called with `expect.objectContaining({ promotionState: 'NotPromoted' })`.
- `should_reject_invalid_promotionState_value` — mirrors the existing `syncStatus` "Bogus" test.
- `should_include_promotionState_productId_productVariantId_in_serialized_output` — mock a `CjCatalogItemListItem`-shaped resolved value (update the existing `'should_never_leak...'` test's mock shape to the new `{ items: [{ item, promotionState, productId, productVariantId }], ... }` structure — it currently constructs a bare `CjCatalogItem` and will break once §6.1/§6.2 land, so this file needs updating in lockstep, not just extending).

**`backend/src/presentation/controllers/__tests__/cjCatalogPromotionController.test.ts`** — NEW. Mirror the `jest.mock('../../../application/services/cjCatalogPromotionService', ...)` pattern from the sync controller test. Cases: `promote` 201 on new creation, `promote` 200 on all-idempotent, `promote` propagates `CjPromotionValidationError` to `next` (assert `itemErrors` survives on the error object passed to `next`), `activate`/`deactivate` 200 happy path, `activate`/`deactivate` propagate `CjCatalogItemNotPromotedError`, invalid `cjCatalogItemId` param → `ValidationError` without calling the service.

**`backend/src/routes/public/__tests__/cjIsolation.test.ts`** — EXTEND (real file location — **flag**: the context-session doc says this file lives at `backend/src/routes/admin/__tests__/cjIsolation.test.ts`; it does not — confirmed by grep, it's at `backend/src/routes/public/__tests__/cjIsolation.test.ts`). Add three new entries to the `candidatePaths` array:
```
'/api/public/suppliers/1/cj/catalog/promote',
'/api/public/suppliers/1/cj/catalog/1/activate',
'/api/public/suppliers/1/cj/catalog/1/deactivate',
```
Plus a new test asserting the serialized-item JSON payload (reusing the existing pattern at the bottom of the file that stringifies `res.json`'s mock call args and regex-checks for leaked field names) never contains `cjCatalogItemId` — this test needs to go through the **product** public routes (`GET /api/public/products/:id`) with a mocked `ProductService.findById` resolving a `Product` whose variant was constructed with a non-null `cjCatalogItemId` (per §2.1, the domain model now carries this field), proving the *public* product serializer (not just the CJ admin serializer) never leaks it. **Flag**: check whether `backend/src/presentation/serializers/` has a dedicated public product/variant serializer, or whether `productPublicRoutes`/`productController`-equivalent public controller returns the raw domain object — if the latter, this is exactly the kind of accidental-leak risk `design.md`'s Decision 1 warns about ("added to `variantSelect` omission list ... covered by the existing `cjIsolation.test.ts` pattern"), and confirming there's an actual allow-list serializer on the public product path (not just the omission-from-`variantSelect` at the DB-select level) is worth an explicit read-and-confirm step before writing this test, since `variantSelect` omission alone is sufficient defense only if literally every public code path fetches through a repository method that uses `variantSelect` — verify no public path does a raw `prisma.productVariant.findMany()` without it.

---

## 7-11. Out of scope for this document

Frontend (§7), unit-test-run/DB-verification (§9), curl testing (§10), and Playwright E2E (§11) are execution steps for the parent session to run after implementing this plan — not additional backend code to design.

## 12. Documentation (task 12.1–12.5)

- `docs/data-model.md`: document `ProductVariant.cjCatalogItemId` (nullable, unique, internal-only FK), the derived `promotionState` concept (`NotPromoted`/`Active`/`Inactive`, computed not stored), and the chosen `ON DELETE SET NULL` FK behavior (§1.2) with rationale (staging rows are disposable, promoted products must survive their deletion).
- `docs/api-spec.yml`: extend `GET .../cj/catalog` response schema (`promotionState`, `productId`, `productVariantId`, new `promotionState` query param) and add the three new endpoints with request/response/`422` error schemas — including the `itemErrors` array shape on the bulk-promote `422` response (§5.1/§6.5 flag), which needs its own schema component since no other endpoint in `api-spec.yml` currently has a per-item error list shape (confirm this by grep — if one already exists for a different bulk endpoint, reuse its schema pattern instead of inventing a new one).
- `docs/development_guide.md`: document `CJ_DEFAULT_MARKUP_MULTIPLIER` and the promote → activate/deactivate workflow.
- `docs/backend-standards.md`: the "derived state via join" pattern (§4.1) is arguably reusable enough to document as a named pattern (task 12.4 gives explicit permission to skip if not — this plan recommends documenting it briefly, one paragraph, since it's a non-obvious Prisma relation-filter technique with a real pagination-correctness pitfall that a future feature will likely hit again).

---

## Risks / Ambiguities Found In Real Code (read before implementing)

1. **Slug generation is `private`.** `ProductService.resolveUniqueSlug`/`generateSlug` (both `private`) must have `resolveUniqueSlug` made `public` for the promotion service to reuse it, per design.md's explicit "reuses `ProductService`'s slug-generation logic, does not duplicate it." One-line visibility change, not called out anywhere in `tasks.md`.

2. **`PRODUCT_REQUIRES_ACTIVE_VARIANT` guard location is misdescribed in `design.md`.** It's enforced in `ProductService.update()` (via `variantRepo.countActiveByProduct`), not in `ProductRepository` as design.md's Decision 4 states. This matters for the `activate()` implementation: variant status must be updated **before** calling `productService.update(productId, { status: 'Active' })`, or the guard will incorrectly reject.

3. **No `findById`/`findManyByIds` on `ICjCatalogItemRepository`.** The promote endpoint's request body addresses items by numeric `cjCatalogItemId` (PK), but the current interface only supports `findByExternalRef` (CJ's own `vid`) and paginated listing. This must be added — not mentioned in task 3.1.

4. **`ProductVariantCreateData` has no `cjCatalogItemId` field.** Task 3.2 phrases this as "confirm the existing signatures can accept it" — they cannot without this addition.

5. **Mixed-promotion-state `pid` groups are unhandled by the spec.** If a bulk promote request includes some already-linked items and some new items sharing the same `pid`, the spec/design never say whether the new ones join the existing `Product` or fork a new one. This plan recommends "join the existing product" (§5.1 step 5) as the only choice consistent with the domain model ("`pid` groups are one product's variants"), but this is this plan's interpretation, not a documented decision — flag prominently to the user/reviewer.

6. **No error code exists for "unknown `cjCatalogItemId` in a promote request."** `spec.md`'s own scenario requires this exact case to surface as a per-item `422` error, but neither `design.md`'s Decisions section nor task 2.2's four-error list name one. This plan proposes `CJ_CATALOG_ITEM_NOT_FOUND` (422) as a fifth error class.

7. **No aggregate "per-item error list" error type exists anywhere in this codebase.** Every existing `Cj*Error`/domain error in `validator.ts` carries a single `message`/`code`. The bulk-promote `422` response needs a list of `{ cjCatalogItemId, code, message }`. This plan proposes `CjPromotionValidationError` with an `itemErrors` array and a special-cased branch in `errorHandler.ts` (the only branch in that file needing extra response payload beyond `message`/`code`).

8. **Transaction pattern**: repositories in this codebase (`ProductRepository`, `ProductVariantRepository`, `CjCatalogItemRepository`) all use the shared `prisma` singleton directly — none accept an injected/tx-scoped client. The only precedent for a true multi-entity atomic transaction (`checkoutService.createOrder`) bypasses repositories entirely and calls `tx.model.create(...)` directly inside `prisma.$transaction(async (tx) => {...})`. `cjCatalogPromotionService.promote()` must follow this same bypass pattern for its `Product`+`ProductVariant` creates — calling `productRepo.create()`/`productVariantRepo.create()` inside the transaction callback would silently execute outside the transaction (no atomicity), a subtle bug this codebase's existing structure makes easy to introduce.

9. **`docs/data-model.md`/`tasks.md` reference `productRepository.test.ts` and mention extending `cjIsolation.test.ts` at `routes/admin/__tests__/`** — neither exists at those paths. The real files are: no standalone `productRepository.test.ts` exists at all (only `productVariantRepository.test.ts`, `productService.test.ts`, `productController.test.ts`, `productVariantController.test.ts`, `productImageController.test.ts`, `productVariantService.test.ts` — task 8.1's mention of `productRepository.test.ts` should be read as "review the product-adjacent test files that do exist," not a literal missing file to create), and `cjIsolation.test.ts` is at `backend/src/routes/public/__tests__/cjIsolation.test.ts`.

10. **Existing `jest.Mocked<...>` mocks will fail to compile once the interfaces grow.** `productService.test.ts`'s `mockVariantRepo: jest.Mocked<IProductVariantRepository>` and `cjCatalogSyncService.test.ts`'s `catalogRepo: jest.Mocked<ICjCatalogItemRepository>` both fully implement their interfaces today; adding `findByCjCatalogItemId`/`findById`/`findManyByIds` (§3.1/§3.2) will break TypeScript compilation on both files until `jest.fn()` stubs for the new methods are added — this is exactly what task 8.1/8.2 ask to verify, called out here so it's not missed as "just run the tests and see."

11. **`ON DELETE` behavior for the new FK is not specified anywhere.** This plan recommends `SET NULL` (§1.2) with explicit rationale; flag in the PR since it's a judgment call with real data-integrity consequences (the alternative, `RESTRICT`, would make `CjCatalogItem` staging rows permanently undeletable once promoted, which contradicts the staging table's "disposable" nature per its own spec).

12. **Public-path leak verification needs one more read before writing the isolation test** (§6.6 item 3): confirm whether the public product route actually goes through a `variantSelect`-scoped repository call on every path, or whether some public serializer/controller does a raw Prisma call that could accidentally include `cjCatalogItemId` if a future refactor adds it to `select`. Not verified in this planning pass — flagged for the implementing session to check first.

---

## Verification commands (per `docs/backend-standards.md` § ESLint / CI requirements)

```
cd backend && npm run lint && npm test -- --watchAll=false --testPathPattern=cj
cd backend && npm run lint && npm test -- --watchAll=false --testPathPattern=product
cd backend && npm test -- --watchAll=false   # full suite, confirm no regressions
```
New test files must prefix unused params with `_`, avoid `any`, and mirror the existing `jest.mock()` patterns shown throughout this plan (all lifted from real files read in this session, not invented).
