# Step 8 Report - Manual Job Execution Testing

- Date: 2026-07-09
- Change: cj-catalog-auto-provisioning
- Agent: Claude Sonnet 5

## Why no curl testing

This capability intentionally has no HTTP endpoint (design.md D9 — the job must never be triggerable by unauthenticated HTTP). `serverless-offline` does not execute `schedule` events, so the job was exercised directly against a running local backend + local Postgres by invoking `handler()` from a temporary script (`backend/scratch-invoke-auto-provision.ts`, deleted after testing, never committed) run via `npx ts-node --transpile-only`, loading `backend/.env` exactly as `src/index.ts` does (`import 'dotenv/config'`).

All calls hit the **real** CJ Dropshipping API (same shared merchant account used in dev/prod, per the `effe34e` commit). `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE` were temporarily capped to limit quota usage, matching the precedent set by `cj-catalog-promotion`'s own live-API testing.

## Pre-test Setup

- Confirmed starting state: `SupplierIntegration` count = 0 (no leftover `CJDropshipping` row).
- Created a permanent "Uncategorized" `Category` row in the local dev DB (id `270`) — this is retained going forward (task 1.2), not test pollution.
- Set in `backend/.env` (git-ignored, not committed): `SUPPLIER_AUTO_PROVISION_ENABLED=true`, `CJ_DEFAULT_CATEGORY_ID=270`, `CJ_SYNC_MAX_PAGES=1`, `CJ_CATALOG_PAGE_SIZE=5` (temporary quota-conserving cap).

## Invocations

### 1. First invocation (auto-provision from zero)

Command: `npx ts-node --transpile-only scratch-invoke-auto-provision.ts`

Result:
```json
{
  "enabled": true,
  "providers": [{
    "provider": "CJDropshipping", "skipped": false, "provisioned": true,
    "verifyHealthy": true, "itemsUpserted": 28, "itemsFailed": 0,
    "variantsCreated": 28, "alreadyPromoted": 0
  }]
}
```

DB verification (`docker exec ecommerce-db psql ...`):
- `Supplier` id `54` "CJ Dropshipping", `status: Active` — auto-created.
- `SupplierIntegration` id `20`, `supplierId: 54`, `provider: CJDropshipping`, `status: Connected` — auto-created and verified against the real API.
- `CjCatalogItem`: 28 rows.
- 5 `Product` rows (ids 125–129), all `status: Draft`, totaling 28 linked `ProductVariant` rows (11+4+3+9+1).

**Confirms**: auto-create Supplier/SupplierIntegration, auto-verify, auto-sync, auto-promote into Draft — the full spec requirement set, against the real API.

### 2. Second invocation (idempotency)

Same command, no env changes.

Result:
```json
{
  "enabled": true,
  "providers": [{
    "provider": "CJDropshipping", "skipped": false, "provisioned": false,
    "verifyHealthy": true, "itemsUpserted": 28, "itemsFailed": 0,
    "variantsCreated": 0, "alreadyPromoted": 0,
    "promotionSkippedReason": "NO_PROMOTABLE_ITEMS"
  }]
}
```

DB verification: `Supplier` count 17 (16 baseline + 1, no duplicate), `SupplierIntegration` count 1 (no duplicate), `CjCatalogItem` still 28, `Product`/`ProductVariant` linked counts unchanged (5 / 28).

**Confirms**: `provisioned: false` (existing supplier reused, no duplicate `Supplier`/`SupplierIntegration` created); no duplicate `Product`/`ProductVariant` created for already-promoted items.

### 3. Kill-switch

Set `SUPPLIER_AUTO_PROVISION_ENABLED=false`, invoked again.

Result:
```json
{ "enabled": false, "providers": [] }
```
Log: `"Supplier auto-provisioning disabled via SUPPLIER_AUTO_PROVISION_ENABLED"`. No DB queries were issued for this run (confirmed by the absence of any DB-touching log lines).

**Confirms**: kill-switch short-circuits with zero DB writes.

### 4. Default category missing/invalid

Re-enabled the switch, set `CJ_DEFAULT_CATEGORY_ID=999999` (non-existent id) and `CJ_SYNC_MAX_PAGES=2` (to pull a second page of genuinely new, not-yet-promoted items — the first page's 28 items were already linked from invocation 1, so a repeat at `MAX_PAGES=1` would trivially report `NO_PROMOTABLE_ITEMS` without exercising the category-validation path).

Result:
```json
{
  "enabled": true,
  "providers": [{
    "provider": "CJDropshipping", "skipped": false, "provisioned": false,
    "verifyHealthy": true, "itemsUpserted": 69, "itemsFailed": 0,
    "variantsCreated": 0, "alreadyPromoted": 0,
    "promotionSkippedReason": "DEFAULT_CATEGORY_MISSING"
  }]
}
```
Log: `"CJ auto-promotion skipped: default category missing or invalid"`.

DB verification: `CjCatalogItem` count 69 (sync persisted the additional page), `ProductVariant` with `cjCatalogItemId` set still 28 (no new product/variant created — promotion correctly skipped).

**Confirms**: sync results persist even when promotion is skipped; no partial/invalid `Product`/`ProductVariant` is created when the default category is missing/invalid; failure is logged clearly.

## Cleanup / Database State Restoration

Deleted, in dependency order, everything created by this testing session:
```sql
DELETE FROM "ProductVariant" WHERE "productId" IN (125,126,127,128,129); -- 28 rows
DELETE FROM "Product" WHERE id IN (125,126,127,128,129);                 -- 5 rows
DELETE FROM "CjCatalogItem" WHERE "supplierIntegrationId" = 20;          -- 69 rows
DELETE FROM "SupplierIntegration" WHERE id = 20;                         -- 1 row
DELETE FROM "Supplier" WHERE id = 54;                                    -- 1 row
```

Post-cleanup counts verified to match the task 7.1 baseline exactly: `Supplier: 16, SupplierIntegration: 0, CjCatalogItem: 0, Product: 12, ProductVariant: 24`. The "Uncategorized" `Category` (id 270) was deliberately kept (task 1.2 — permanent local setup, not test data).

Restored `backend/.env` to its pre-testing values (removed the temporary `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE`/`CJ_DEFAULT_CATEGORY_ID` overrides and set `SUPPLIER_AUTO_PROVISION_ENABLED` back to unset/default). Deleted the temporary `backend/scratch-invoke-auto-provision.ts` script (never committed, not part of this change's diff).

## Outcome

- Step 8 status: PASS
- Blocking issues: none
- Note: all four scenarios from the capability spec (`specs/supplier-catalog-auto-provisioning/spec.md`) were exercised against the real CJ Dropshipping API, not just mocks — auto-provision-from-zero, idempotent re-run, kill-switch, and default-category-missing degradation all behaved exactly as designed.
