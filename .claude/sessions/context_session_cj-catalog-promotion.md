# Context Session: cj-catalog-promotion

## Change location
- `openspec/changes/cj-catalog-promotion/proposal.md`
- `openspec/changes/cj-catalog-promotion/design.md`
- `openspec/changes/cj-catalog-promotion/specs/cj-catalog-promotion/spec.md` (new capability)
- `openspec/changes/cj-catalog-promotion/specs/cj-catalog-sync/spec.md` (renamed from spocket-catalog-sync, adds promotionState)
- `openspec/changes/cj-catalog-promotion/specs/cj-connection-management/spec.md` (renamed from spocket-connection-management, no behavior change)
- `openspec/changes/cj-catalog-promotion/specs/spocket-catalog-sync/spec.md` and `specs/spocket-connection-management/spec.md` (REMOVED-only deltas for the rename)
- `openspec/changes/cj-catalog-promotion/tasks.md` (70 tasks, source of truth for implementation order)

## One-line summary
The public catalog (`Product`/`ProductVariant`) was intentionally emptied (local + prod) to be repopulated exclusively from the real, already-working CJ Dropshipping integration (`CjCatalogItem` staging, synced via `POST /api/admin/suppliers/:supplierId/cj/sync`). This change adds the missing "promotion" step: an admin panel view of the full synced CJ catalog, bulk/individual promotion into real `Product`/`ProductVariant` records, and activate/deactivate toggles for storefront visibility — all while preserving a permanent link back to the source `CjCatalogItem`.

## Key design decisions (see design.md for full rationale)
1. New `ProductVariant.cjCatalogItemId Int? @unique` FK — the persistent origin link. Internal-only, never exposed via any API (add to `variantSelect` omission list next to `supplierCost`/`supplierReference`).
2. Promotion groups `CjCatalogItem` rows by CJ `pid` (product id) into one `Product` with one `ProductVariant` per `vid` (variant id / `externalRef`). Reuses `ProductService`'s slug generation, does not duplicate it.
3. Pricing: explicit `publicPrice` per item, else `supplierCost * CJ_DEFAULT_MARKUP_MULTIPLIER` (new env var, e.g. `2.5`). Never publish at cost (422 `CJ_PROMOTION_PRICE_REQUIRED` if unresolvable).
4. SKU is always deterministic: `CJ-<externalRef>` — never trust CJ's own `sku` field for uniqueness.
5. Activate/deactivate is a `status` transition only (`Active`/`Inactive`) — never touches `deletedAt`, never clears `cjCatalogItemId`. Reuses the existing `PRODUCT_REQUIRES_ACTIVE_VARIANT` guard already in `ProductRepository`.
6. `promotionState` (`NotPromoted`/`Active`/`Inactive`) is **derived** at read time via a join on `ProductVariant.cjCatalogItemId`, never stored on `CjCatalogItem`.
7. Promotion is transactional (single Prisma `$transaction`) and idempotent (re-promoting an already-linked item resolves to the existing variant, returns `200`, does not duplicate).
8. Explicitly NOT touched: `SupplierOrder`, `SupplierOrderItem`, freight-quote, order-push to CJ.

## Existing code to reuse/extend (do not reinvent)
- `backend/src/infrastructure/repositories/cjCatalogItemRepository.ts` — `findBySupplierIntegrationId` needs the promotionState join; `findByExternalRef` already exists.
- `backend/src/domain/repositories/cjCatalogItemRepository.ts` — interface to extend.
- `backend/src/routes/admin/cjRoutes.ts` — existing router (`/connection`, `/connection/verify`, `/sync`, `/catalog`), mounted at `/api/admin/suppliers/:supplierId/cj`. Add `/catalog/promote`, `/catalog/:cjCatalogItemId/activate`, `/catalog/:cjCatalogItemId/deactivate` here. `cjVerifyLimiter` in the same file is the rate-limiter pattern to mirror for `promote`.
- `backend/src/presentation/controllers/cjCatalogSyncController.ts` — `listCatalog` handler to extend with `promotionState` filter/field.
- `backend/src/presentation/serializers/cjCatalogItemSerializer.ts` — allow-list to extend with `promotionState`/`productId`/`productVariantId`; keep existing omissions (`supplierIntegrationId`, `pid`, `vid`, `categoryId`, `sellPrice`, `warehouseInventoryNum`, `rawPayload`).
- `backend/src/application/services/productService.ts` — has slug auto-generation + default `status: 'Draft'` logic on create; the promotion service should call into this rather than reimplement.
- `backend/src/infrastructure/repositories/productRepository.ts` — already enforces `PRODUCT_REQUIRES_ACTIVE_VARIANT` (line ~34) on activation; reuse this guard, don't build a parallel one.
- `backend/src/infrastructure/repositories/productVariantRepository.ts` — has the internal-field `variantSelect` omission pattern already for `supplierCost`/`supplierReference`; add `cjCatalogItemId` there.
- `backend/src/application/validator.ts` — existing `Cj*Error` classes around line 1063-1110 (`CjConnectionNotReadyError`, `CjApiUnavailableError`, `CjItemNotMappedError`, `CjOrderAlreadyPushedError`, `CjOrderNotPushedError`) — follow this exact pattern for the new error classes.
- `backend/src/middleware/errorHandler.ts` — needs new error-code mappings.
- `backend/src/routes/admin/__tests__/cjIsolation.test.ts` — extend with the 3 new routes + assert `cjCatalogItemId` never leaks publicly.
- Frontend: `frontend/src/services/supplierService.ts` is the pattern to mirror for `cjCatalogService.ts`. `frontend/src/pages/admin/SuppliersPage.tsx` is where the entry point/link to the new `CjCatalogPage` should be added.
- `frontend/src/components/admin/` — existing admin component patterns (e.g. `ProductFormModal`, `StatusBadge`) to reuse/mirror for `CjPromoteModal.tsx` and the promotion state badges.

## Docs already read (do not re-read unless needed)
- `docs/base-standards.md`, `docs/backend-standards.md`, `docs/frontend-standards.md`, `docs/openspec-tasks-mandatory-steps.md` — all read in full this session.

## Your job (planning agent)
Read `tasks.md` in full (source of truth for exact task numbering/order) plus `design.md` and the relevant spec file(s) above. Produce a **per-file implementation plan** — not the actual code — listing for each file: whether it's new or modified, the exact functions/methods/exports to add or change, and key signatures. The parent session will implement from your plan. Do not implement anything yourself.
