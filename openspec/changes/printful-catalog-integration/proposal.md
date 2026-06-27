## Why

The store currently runs on demo catalog data from EscuelaJS — a public test API with no real products, no supplier costs, no operable SKUs, and no ability to fulfill actual orders. Integrating Printful as the first real supplier replaces all demo data with a live print-on-demand catalog and enables end-to-end supplier-fulfilled order flows using Printful's free API tier.

## What Changes

- **New**: `printfulClient.ts` — authenticated HTTP client (Bearer token) for Printful's REST API, with pagination and rate-limit handling.
- **New**: `printfulTypes.ts` — TypeScript types for Printful sync products, sync variants, and API responses.
- **New**: `mapPrintfulProduct.ts` — maps Printful sync products/variants to internal `Product`/`ProductVariant` models, applying a configurable price markup over `supplierCost`.
- **New**: `printfulProductImporter.ts` — idempotent upsert of `Supplier` (Printful), `Category`, `Product`, `ProductVariant`, and `ProductImage` records from Printful's sync product catalog.
- **New**: `clearDemoCatalog.ts` — safe purge script that hard-deletes demo products with no order/wishlist references and soft-deletes those that do (preserving snapshot integrity).
- **New**: `importPrintful.ts` — CLI entry-point script (mirrors `importEscuelaJs.ts`).
- **Modified**: `prisma/seed.ts` — replace EscuelaJS import gate with Printful import gate.
- **Modified**: `backend/src/index.ts` — add `PRINTFUL_API_KEY` env var validation at startup.
- **Modified**: `backend/package.json` — add `db:import:printful` and `db:clear-demo` scripts.
- **Modified**: `docs/development_guide.md`, `docs/backend-standards.md` — document new env vars, scripts, and supplier integration pattern.
- **Deprecated**: active use of `escuelaJsProductImporter.ts`, `mapEscuelaJsProduct.ts`, `escuelaJsTypes.ts`, `importEscuelaJs.ts` (retained as historical reference, no longer executed).

**Non-goals (Fase 2 — separate story, requires explicit approval per §13):**
- Automatic Printful order creation when a `SupplierOrder` is emitted.
- Shipping rate retrieval from Printful at checkout.
- Printful webhook ingestion for shipment status updates.

## Capabilities

### New Capabilities

- `printful-catalog-import`: Fetch, map, and upsert Printful sync products/variants into the internal catalog with price markup, linked to the Printful `Supplier` record.
- `demo-catalog-purge`: Safely remove EscuelaJS/seed demo products from the database, hard-deleting unreferenced records and soft-deleting those with FK dependencies.

### Modified Capabilities

- None. No existing spec-level requirements change. The supplier-fulfilled model, `CustomerOrder → SupplierOrder` flow, and all data isolation rules remain unchanged.

## Impact

**Backend code:**
- New modules in `backend/src/infrastructure/external/` and `backend/src/infrastructure/import/`.
- New CLI scripts in `backend/prisma/`.
- Startup validation in `backend/src/index.ts`.

**Database:**
- No schema migration required for Fase 1. Existing fields (`supplierId`, `supplierReference`, `supplierCost`, `supplierCost`, `stockPolicy`, `deletedAt`) are sufficient.
- Demo `Product`, `ProductVariant`, `ProductImage`, `ProductTranslation`, and `Category` records will be removed or soft-deleted.

**Environment variables:**
- `PRINTFUL_API_KEY` (required in non-test environments).
- `PRINTFUL_STORE_ID` (optional, depending on account type).
- `PRINTFUL_PRICE_MARKUP` (optional, default configurable — e.g. `1.6` for 60% margin).
- `PRINTFUL_IMPORT` / `PRINTFUL_IMPORT_LIMIT` — import gating flags (mirrors existing `ESCUELAJS_IMPORT*`).

**External API:**
- Printful REST API (`GET /sync/products`, `GET /sync/products/{id}`) — free tier, ~120 req/min rate limit.

**APIs (internal):**
- No new public or admin API endpoints are required for Fase 1. Import is triggered via CLI script. An optional `POST /api/admin/catalog/import/printful` endpoint may be added if needed during implementation.

**Affected domain concepts:**
- `Supplier`, `Product`, `ProductVariant`, `ProductImage`, `Category`.
- `CustomerOrderItem`, `SupplierOrderItem`, `WishlistItem` — read-only during purge (never deleted, used to determine safe purge strategy).

**Customer-facing behavior:** improved (real products, real images, real sizes/colors). No behavior regressions.
**Internal fulfillment:** unchanged for Fase 1. The `SupplierOrder` flow remains manual; Printful `supplierReference` is now populated and ready for Fase 2 automation.
**Supplier data exposure:** no change — `supplierCost`, `supplierReference`, and `supplierId` remain backend-only per existing rules.
