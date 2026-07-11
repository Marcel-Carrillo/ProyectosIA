## Why

The `supplierAutoProvision` scheduled job (from `cj-catalog-auto-provisioning`, already in production) has a bug that defeats its own purpose: `CjCatalogSyncService.syncCatalog` always starts at page 1 on every call, with no persisted cursor. With the page/size bounds recently added for production safety, every run re-syncs the exact same ~100 products forever and never reaches the rest of CJ's catalog. Separately, the sync/promotion pipeline never captures product or variant images (or most other fields CJ's API returns) even though this data is already received and stored in `CjCatalogItem.rawPayload` — every auto-promoted or manually promoted product enters the catalog with no photo, which makes it effectively unsellable. Both gaps were discovered live in production immediately after the first real run and need fixing now, before the job's next scheduled invocation repeats the same 100 products again.

## What Changes

- Persist a sync cursor (`catalogSyncCursorPage`, `catalogSyncTotalPages`) on `SupplierIntegration` so each `syncCatalog` run continues from where the previous one left off, wrapping around to page 1 once the end of the catalog is reached (to periodically refresh stale items rather than syncing forever-forward only).
- Reinterpret `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE` as a per-run *window size* (pages to advance this run), not "pages 1..N from the start."
- Change the production defaults for `CJ_CATALOG_PAGE_SIZE`/`CJ_SYNC_MAX_PAGES` based on a documented throughput study (see design.md) so each run advances further per day while staying safely under the Lambda timeout.
- Extend `CjProductDto`/`CjVariantDto` (`cjTypes.ts`) to capture product/variant image URLs and other CJ-provided fields the data model already supports.
- Extend `CjCatalogPromotionService.promote()` to create `ProductImage` records (product image + variant image when it differs) and set `Product.mainImageUrl` when promoting a `CjCatalogItem` — applies to both the existing manual admin promote flow and the automated job's auto-promote, since both call the same function.
- Add a one-off, idempotent backfill for the ~100 products already auto-promoted in production before this fix, populating their images from already-stored `rawPayload` data — no new CJ API calls.

## Capabilities

### New Capabilities

- `cj-catalog-sync-cursor`: persisted, wrap-around pagination cursor for CJ catalog sync, replacing the always-restart-at-page-1 behavior, plus the documented throughput-optimal page/size defaults.
- `cj-catalog-media-capture`: capturing product/variant images (and other supported CJ fields) during sync, and materializing them as `ProductImage`/`Product.mainImageUrl` during promotion (manual and automatic), including a one-off backfill for already-promoted items.

### Modified Capabilities

(none — no archived specs exist yet for `supplier-catalog-auto-provisioning`/`cj-catalog-promotion` since `cj-catalog-auto-provisioning` and `cj-catalog-promotion` have not been archived; this change's new capabilities above supersede/extend their sync and promotion behavior directly in code)

## Impact

- **Affected code**: `backend/src/application/services/cjCatalogSyncService.ts` (cursor logic), `backend/src/domain/repositories/supplierIntegrationRepository.ts` + its Prisma implementation (new cursor-update method), `backend/src/infrastructure/external/cjTypes.ts` (new DTO fields), `backend/src/application/services/cjCatalogPromotionService.ts` (image creation), a new one-off backfill script, `backend/serverless.yml` (updated `CJ_CATALOG_PAGE_SIZE`/`CJ_SYNC_MAX_PAGES` defaults).
- **Affected data**: Prisma migration adding cursor fields to `SupplierIntegration`; no changes to `Product`/`ProductVariant`/`ProductImage` schemas (existing `mainImageUrl`/`ProductImage` fields already support this).
- **Customer-facing impact**: yes — products gain real photos, directly affecting perceived quality and conversion on the public storefront once activated. Only public-safe fields (image URL, name) are copied; `supplierCost` and other internal supplier data are never exposed, per existing rules.
- **Internal/fulfillment impact**: the scheduled job now makes genuine daily progress through CJ's catalog instead of being stuck; sync behavior for the existing manual "Sync catalog" admin action also changes (new page/size defaults, shared via `serverless.yml`'s environment).
- **No impact** on order lifecycle, payment status, fulfillment status, returns, or refunds.
