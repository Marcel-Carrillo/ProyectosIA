# Step 12: Manual Endpoint Testing with curl

## Environment

- Backend run locally via `npm run dev` (port 3000) against the dockerized Postgres (`ecommerce-db`, started this session).
- Admin auth: `POST /api/admin/auth/login` with `admin@example.com` / the configured `ADMIN_PASSWORD` → JWT used as `Authorization: Bearer <token>` on all subsequent calls.
- Supplier used: id **71** (`SupplierIntegration` id 22, provider `CJDropshipping`, status `Connected`) — an existing connected CJ integration already present in this dev DB.

### Confirmed: no live CJ sandbox access in this dev environment

Before testing, called `cjClient.fetchCategories()` directly (throwaway script) using the real `CJDROPSHIPPING_API_KEY` configured in `.env`:

```
FAILED: CJ Dropshipping API request failed (200): authentication rejected
```

This confirms the same limitation documented in task 1 / `reports/2026-07-14-step-15-e2e-testing.md` from a prior change — this dev environment has no working CJ sandbox credentials. Per the plan's recommended substitution (option (a) in `.claude/doc/cj-category-mapping/backend.md`, task 12): scenarios that require CJ resolution to *succeed* and mint a new `Category`/`SupplierCategoryMapping` are exercised via the `CJ_DEFAULT_CATEGORY_ID` fallback path instead, and documented as such below. The "creates a new Category from a real CJ category name" path remains covered by unit tests only (`cjCategoryResolution.test.ts`, `cjCatalogPromotionService.test.ts`'s `should_auto_resolve_and_create_a_new_category_from_cj_taxonomy`), not curl.

## Test data seeded

Two `CjCatalogItem` rows inserted directly via `psql` (no real sync possible without CJ credentials), both under `supplierIntegrationId = 22`, `syncStatus = 'Synced'`:
- id `4008` — externalRef `curltest-vid-1`, pid `curltest-pid-1`, `categoryId = 'CJ-TEST-EXT-1'`
- id `4009` — externalRef `curltest-vid-2`, pid `curltest-pid-2`, `categoryId = 'CJ-TEST-EXT-1'`

## 12.2 — Promote without `categoryId`

**a) No fallback configured** (`CJ_DEFAULT_CATEGORY_ID` unset):

```
POST /api/admin/suppliers/71/cj/catalog/promote
{"items":[{"cjCatalogItemId":4008,"publicPrice":39.99}]}
```
→ `422 CJ_PROMOTION_CATEGORY_REQUIRED` — CJ resolution fails (no working credentials) and no fallback is configured. Matches the cj-catalog-promotion spec's "Promotion fails when no category can be resolved by any means" scenario.

**b) Fallback configured** (restarted the server with `CJ_DEFAULT_CATEGORY_ID=2`, an existing `Category` "Women"):

```
POST /api/admin/suppliers/71/cj/catalog/promote
{"items":[{"cjCatalogItemId":4008,"publicPrice":39.99}]}
```
→ `201`, `Product` id 144 created. Verified via `psql`: `Product.categoryId = 2` (the fallback), and `SupplierCategoryMapping` count stayed at 0 (no mapping created — this is the fallback path, not the CJ-taxonomy-resolved-and-mapped path, which is unit-test-only coverage per the note above).

## 12.3 — Re-promoting an already-linked item

```
POST /api/admin/suppliers/71/cj/catalog/promote
{"items":[{"cjCatalogItemId":4008,"publicPrice":39.99}]}
```
→ `200`, `wasAlreadyPromoted: true`, `createdAny: false`. `psql` count of `Product` rows named `CurlTest Dress` stayed at 1 — no duplicate created. (This exercises the pre-existing idempotency path, not "reuses an already-mapped CJ category" specifically — see the substitution note above for why that exact scenario isn't curl-testable here.)

## 12.4 — Explicit `categoryId` overrides resolution

```
POST /api/admin/suppliers/71/cj/catalog/promote
{"items":[{"cjCatalogItemId":4009,"publicPrice":49.99}],"categoryId":3}
```
→ `201`, `Product` id 145 created. Verified via `psql`: `Product.categoryId = 3` (the explicit override — "Accessories"), not `2` (the configured fallback) — confirms an explicit `categoryId` short-circuits both CJ resolution and the fallback.

## 12.5 — Backfill / recategorize endpoint

**a) No fallback configured** (`CJ_DEFAULT_CATEGORY_ID` unset, server restarted):

```
POST /api/admin/suppliers/71/cj/recategorize
```
→ `422 CJ_PROMOTION_CATEGORY_REQUIRED` — nothing configured to backfill against.

**b) Fallback configured** (`CJ_DEFAULT_CATEGORY_ID=2`), run against the seeded product 144 (sitting at category 2 from 12.2b):

```
POST /api/admin/suppliers/71/cj/recategorize
```
→ `200`:
```json
{
  "fromCategoryId": 2,
  "reassigned": [],
  "skipped": [
    {"productId":109,"reason":"NO_CJ_CATEGORY_MAPPING"},
    {"productId":110,"reason":"NO_CJ_CATEGORY_MAPPING"},
    {"productId":111,"reason":"NO_CJ_CATEGORY_MAPPING"},
    {"productId":112,"reason":"NO_CJ_CATEGORY_MAPPING"},
    {"productId":113,"reason":"NO_CJ_CATEGORY_MAPPING"},
    {"productId":144,"reason":"CJ_CATEGORY_RESOLUTION_FAILED"}
  ]
}
```
- Products 109-113 are pre-existing category-2 products from earlier (unrelated) dev-DB seed data with no linked `CjCatalogItem` — correctly reported `NO_CJ_CATEGORY_MAPPING` and left untouched.
- Product 144 correctly reported `CJ_CATEGORY_RESOLUTION_FAILED` (real CJ API unreachable, so its externally-mapped `CJ-TEST-EXT-1` category id can't be resolved to a name) — the honest, expected outcome without live CJ sandbox access. `reassigned: []` is real here — the "reassigns an eligible product" path is unit-test-only coverage for the same credentials reason (`cjCategoryBackfillService.test.ts`'s `should_reassign_an_eligible_product_with_a_single_resolvable_cj_category`).

**Idempotency** — called again immediately:
```
POST /api/admin/suppliers/71/cj/recategorize
```
→ Identical `200` response byte-for-byte. Confirms re-running produces no further changes.

**Never touches a manually-recategorized product** — product 145 (explicit `categoryId: 3` from 12.4) was never a candidate in either recategorize call (`fromCategoryId` was 2, not 3) and `psql` confirmed `Product.categoryId` for id 145 stayed `3` throughout.

## Cleanup

```sql
DELETE FROM "ProductVariant" WHERE id IN (2138, 2139);
DELETE FROM "Product" WHERE id IN (144, 145);
DELETE FROM "CjCatalogItem" WHERE id IN (4008, 4009);
```

Post-cleanup DB state verified identical to the step-11 baseline: `Category`=29, `SupplierCategoryMapping`=0, non-deleted `Product` count=13.
