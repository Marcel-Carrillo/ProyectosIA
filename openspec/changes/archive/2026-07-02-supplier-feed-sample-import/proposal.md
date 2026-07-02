## Why

There is no controlled, offline, image-free way to exercise the admin panel's product intake flow. Existing seeders (`seedFashionCatalog`, `importEscuelaJs`, `importDummyJson`) either hardcode demo data or hit a live external API, and all of them require images to be present. Since the store's core business model is supplier-fulfilled (suppliers, not the store, ship product and hold stock), the admin panel must support the case where a supplier feed arrives with catalog data but no product photography yet, and an operator completes the record before publishing. This change adds a local, dev-only fixture shaped like a supplier API response — without images — plus a clean-and-load script, so this flow can be validated end to end before any real supplier integration exists.

## What Changes

- Add a local JSON fixture (`backend/prisma/fixtures/supplier-feed.sample.json`) shaped like a supplier catalog API response: products with supplier metadata, catalog fields, variants, and an empty `images` array.
- Add a mapper and importer that turn the fixture into `Supplier`, `Category`, `Product`, and `ProductVariant` records, explicitly without creating any `ProductImage` rows, leaving each `Product` in `Draft` status.
- Add a dev-guarded clean step that hard-deletes existing catalog and order-history rows (`StripeWebhookEvent`, `CouponRedemption`, `Refund`, `ReturnRequest`, `Shipment`, `SupplierOrderItem`, `SupplierOrder`, `CustomerOrderItem`, `CustomerOrder`, `WishlistItem`, `ProductImage`, `ProductVariant`, `Product`, in FK-safe order) before loading the fixture, so runs start from a known baseline. Categories, suppliers (both re-upserted by the importer), admin users, customer accounts, and coupon definitions are preserved, not wiped — see `design.md` decision 4 for why the clean step's scope grew beyond "just the catalog" during implementation.
- Add an `npm run import:supplier-feed` script (backend) that runs clean + load in one step, following the existing `import:products` script pattern.
- Guard the script so it refuses to run unless `NODE_ENV !== 'production'` and `DATABASE_URL` points at a local/dev database.
- Update `docs/development_guide.md` with the new command and its dev-only constraint.

**Non-goals**
- No real HTTP integration with an actual supplier API — the fixture is a static local file.
- No image ingestion — imported products intentionally have zero images; images are added afterward through the existing admin `ImageManager`.
- No use in staging or production — this is a local development tool only.
- No new admin-panel UI (e.g. an "import" button) — the fixture is loaded via an npm script, not through the UI.

## Capabilities

### New Capabilities
- `supplier-feed-sample-import`: dev-only command that cleans the local product catalog and loads a supplier-feed-shaped sample JSON (no images) into the domain model, so the admin panel's product completion/activation flow can be exercised locally.

### Modified Capabilities
(none — this does not change requirements of any existing capability, including `escuelajs-product-import`, `product-catalog`, or `admin-product-panel`; it adds a new, separate import path)

## Impact

- **Affected domain concepts**: `Product`, `ProductVariant`, `Category`, `Supplier`. No changes to `CustomerOrder`, `SupplierOrder`, `Shipment`, `ReturnRequest`, or `Refund`.
- **Affected code**: new files only under `backend/prisma/fixtures/`, `backend/src/infrastructure/external/`, `backend/src/infrastructure/import/`, and `backend/prisma/importSupplierFeed.ts`; one new script entry in `backend/package.json`.
- **Customer-facing behavior**: none. Imported products are created in `Draft` status and are never auto-published or exposed through `/api/public/*`.
- **Supplier data exposure**: `supplierCost` and `supplierReference` from the fixture are persisted only on internal-only `ProductVariant` fields, matching the existing supplier-isolation rule; no public API changes.
- **Order lifecycle / fulfillment / payment / returns / refunds**: **local development only** — the clean step deletes all local `CustomerOrder`, `SupplierOrder`, `Shipment`, `ReturnRequest`, `Refund`, and `WishlistItem` rows on every run (added during implementation after a real FK conflict; see `design.md` decision 4). No change to production behavior, code paths, or the order lifecycle model itself.
- **Environment scope**: local development only, hard-blocked outside of it.
