## Why

The public catalog (`Product`/`ProductVariant`) was intentionally emptied to start fresh from the real CJ Dropshipping catalog. The CJ integration already syncs the supplier's real catalog into `CjCatalogItem` staging records (`POST /api/admin/suppliers/:supplierId/cj/sync`), but staging is deliberately isolated from the public catalog — there is currently no UI or endpoint for an administrator to promote staged items into real, sellable products. Without this capability, the store has no path to a populated catalog other than manual, one-by-one product creation, which contradicts the goal of sourcing the storefront exclusively from what the admin curates out of the CJ feed.

## What Changes

- Extend `GET /api/admin/suppliers/:supplierId/cj/catalog` to report a derived `promotionState` (`NotPromoted` | `Active` | `Inactive`) plus `productId`/`productVariantId` per staged item, and accept a `promotionState` filter.
- Add `POST /api/admin/suppliers/:supplierId/cj/catalog/promote`: promotes one or many `CjCatalogItem` records (individually or in bulk) into real `Product`/`ProductVariant` records, grouping items that share the same CJ `pid` into a single `Product` with one `ProductVariant` per `vid`. Requires an explicit `Category` and either an explicit `publicPrice` per item or falls back to a configurable default markup over `supplierCost`. Transactional and idempotent.
- Add `POST /api/admin/suppliers/:supplierId/cj/catalog/:cjCatalogItemId/activate` and `.../deactivate`: toggle storefront visibility of the linked product/variant (`status` transitions only — never `deletedAt`, never a hard delete), always preserving the link back to the originating `CjCatalogItem`.
- **BREAKING (schema, internal only)**: add `ProductVariant.cjCatalogItemId` (nullable, unique) as the persistent link between a promoted variant and its CJ staging record. Internal-only field, never returned by any API, including admin serializers' current allow-lists — added to the existing omission list.
- Add a new admin panel page listing the full synced CJ catalog (not just promoted items), with multi-select bulk promotion, a promotion modal (category + price/markup), and per-item activate/deactivate toggles.
- Add new domain error codes: `CJ_CATALOG_ITEM_NOT_PROMOTED`, `CJ_CATALOG_ITEM_ALREADY_PROMOTED`, `CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE`, `CJ_PROMOTION_PRICE_REQUIRED`, `CJ_PROMOTION_CATEGORY_REQUIRED`.

## Capabilities

### New Capabilities
- `cj-catalog-promotion`: promoting staged `CjCatalogItem` records to real `Product`/`ProductVariant` records, and activating/deactivating their storefront visibility while preserving the link to the CJ staging record.
- `cj-catalog-sync`: renamed from the stale `spocket-catalog-sync` capability (the code was renamed to CJ Dropshipping in `cj-dropshipping-integration`/PR #79, but the OpenSpec planning artifact was never synced). Carries forward all existing sync requirements under CJ naming and adds the `promotionState`/`productId`/`productVariantId` reporting this change introduces on `GET .../cj/catalog`.
- `cj-connection-management`: renamed from the stale `spocket-connection-management` capability, for the same reason. No requirement behavior changes — pure terminology sync to match the code (`CJDROPSHIPPING_API_KEY`, `/cj/connection`, `CJ_CONNECTION_NOT_FOUND`, etc.).

### Modified Capabilities
(none — the sync/connection capabilities are handled as a full rename via REMOVED + ADDED, not a partial modification, so the old `Spocket*` naming is fully retired rather than extended.)

## Impact

- **Backend**: `backend/prisma/schema.prisma` (new FK + migration), `backend/src/domain/models/productVariant.ts`, `backend/src/domain/repositories/cjCatalogItemRepository.ts` + infrastructure implementation, `backend/src/infrastructure/repositories/productVariantRepository.ts` (extend the internal-field omission list), new `backend/src/application/services/cjCatalogPromotionService.ts`, new `backend/src/presentation/controllers/cjCatalogPromotionController.ts`, `backend/src/routes/admin/cjRoutes.ts`, `backend/src/presentation/serializers/cjCatalogItemSerializer.ts`, `backend/src/application/validator.ts`, `backend/src/middleware/errorHandler.ts`.
- **Frontend**: new `frontend/src/services/cjCatalogService.ts`, `frontend/src/pages/admin/CjCatalogPage.tsx`, `frontend/src/components/admin/CjPromoteModal.tsx`, route wiring in `frontend/src/App.tsx`.
- **Data model**: new nullable+unique FK `ProductVariant.cjCatalogItemId`, internal-only, never exposed on `/api/public/*` or in admin serializer allow-lists.
- **Customer-facing behavior**: none directly — the public catalog contract (`/api/public/products`) is unchanged; it simply starts serving whatever the admin promotes and activates. The existing supplier-data isolation guarantee (verified by `cjIsolation.test.ts`) must continue to hold and is extended to cover the new fields/routes.
- **Explicitly not touched**: `SupplierOrder`, `SupplierOrderItem`, freight-quote, and the order-push flow to CJ (`/api/admin/supplier-orders/:id/cj/*`).
- **Documentation**: `docs/data-model.md`, `docs/api-spec.yml`, `docs/development_guide.md` (new `CJ_DEFAULT_MARKUP_MULTIPLIER` env var).
- **OpenSpec planning artifacts**: `openspec/specs/spocket-catalog-sync/` and `openspec/specs/spocket-connection-management/` are retired at sync/archive time in favor of `openspec/specs/cj-catalog-sync/` and `openspec/specs/cj-connection-management/`, removing the last references to "Spocket" from the repository (code already had none since PR #79).
