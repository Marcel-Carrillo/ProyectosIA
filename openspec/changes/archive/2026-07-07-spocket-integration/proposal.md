## Why

The store's fulfillment model is currently 100% manual: admins maintain `Supplier` master records and `ProductVariant.supplierReference`/`supplierCost` by hand, and `supplier-feed-sample-import` only loads a local JSON fixture — there is no real external supplier integration anywhere in the codebase. Spocket is a real dropshipping platform with a REST API for catalog/inventory data. Connecting to it removes the most error-prone manual step (keeping supplier cost and stock data current) while keeping order placement and fulfillment tracking manual, consistent with `docs/base-standards.md` section 4 ("prioritize manual control over premature automation", "prepared for future supplier automation").

## What Changes

- Add a per-`Supplier` Spocket connection configuration (API credentials sourced from environment/SSM, never persisted in a returnable column).
- Add a typed Spocket API client adapter in `backend/src/infrastructure/external`, mirroring the existing `infrastructure/stripe` pattern (singleton client, timeouts, bounded retry on 429/5xx, normalized errors, no secrets in logs).
- Add an admin-triggered connection verification ("test connection") endpoint that authenticates against Spocket and reports health without echoing secrets.
- Add an admin-triggered read-only catalog and inventory pull that upserts Spocket product/variant/cost/stock data into a new internal staging surface, keyed by external reference. This increment does **not** auto-publish staged data to the live `Product`/`ProductVariant` catalog.
- Add new admin-only endpoints under `/api/admin/suppliers/:supplierId/spocket/*` for connection config, verification, sync trigger, and staged-catalog listing.

**Explicitly out of scope for this change** (future increments): pushing `SupplierOrder` data to Spocket (order placement automation), an inbound webhook receiver for Spocket fulfillment/tracking status, auto-publishing staged data to the live catalog, and scheduled/cron-driven sync. This change only affects internal fulfillment tooling — no customer-facing behavior, API, or schema changes.

## Capabilities

### New Capabilities
- `spocket-connection-management`: Admin CRUD-style configuration of a Spocket connection per `Supplier` (credentials reference, status), plus an admin-triggered connection verification (test connection) that reports health without exposing secrets.
- `spocket-catalog-sync`: Admin-triggered read-only pull of Spocket product/variant/cost/stock data into an internal staging surface, with per-item sync status and admin review listing. No auto-publish to the public catalog.

### Modified Capabilities
- None. This change is purely additive; `supplier-management`, `supplier-order-management`, and `supplier-feed-sample-import` requirements are unchanged.

## Impact

- **Database**: two new Prisma models (`SupplierIntegration`/Spocket connection record, `SpocketCatalogItem` staging record), each `@@index`ed on their supplier/external-reference lookups; new migration.
- **Backend code**: new domain models, repository interfaces + Prisma implementations, application services, controllers, and routes under the existing layered architecture; new `infrastructure/external/spocketTypes.ts` and `infrastructure/external/spocketClient.ts` (or equivalent) following the `infrastructure/stripe` precedent.
- **Configuration**: new environment variables `SPOCKET_API_KEY` and `SPOCKET_API_BASE_URL` (local `.env.docker`, production SSM `/ecommerce/prod/*`), added to `.env.example` and `docs/development_guide.md`.
- **Documentation**: `docs/data-model.md` (new entities) and `docs/api-spec.yml` (new admin endpoints) updated.
- **No impact** on customer-facing `/api/public/*` routes, response shapes, or the existing manual `SupplierOrder` lifecycle.
