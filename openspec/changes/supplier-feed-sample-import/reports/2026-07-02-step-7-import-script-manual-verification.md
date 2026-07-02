# Step 7 Report - Manual Verification of `npm run import:supplier-feed`

- Date: 2026-07-02
- Change: supplier-feed-sample-import
- Agent: Claude (opsx:apply)

## Commands Executed

- `docker compose up -d db` (already running from Step 6)
- `npm run import:supplier-feed` (from `backend/`) — first run
- Ad hoc Prisma queries to inspect `Product`, `ProductVariant`, `ProductImage`, and cross-table counts
- `npm run dev` (backend server, backgrounded) + poll on `http://localhost:3000/api/public/products`
- `curl -X POST http://localhost:3000/api/admin/auth/login` to obtain an admin token
- `curl http://localhost:3000/api/admin/products?search=Belted` (authenticated)
- `npm run import:supplier-feed` — second run (idempotency check)

## Design issue found and resolved during this step

The first `npm run import:supplier-feed` run failed with a Postgres foreign-key
violation on `CustomerOrderItem_productVariantId_fkey`: the original
`cleanLocalCatalog` only deleted `ProductImage` → `ProductVariant` → `Product`,
but this local database already had 179 `CustomerOrder` rows (and related
`SupplierOrder`/`Shipment`/`ReturnRequest`/`Refund`/`WishlistItem` rows)
referencing existing `ProductVariant` rows — a scenario `design.md` did not
account for. Paused and asked the user how to resolve it; the user chose a full
local reset ("QUIERO LA BD LIMPIA SIN NADA"). `cleanLocalCatalog` was rewritten
to cascade-delete, in FK-safe order: `StripeWebhookEvent`, `CouponRedemption`,
`Refund`, `ReturnRequest`, `Shipment`, `SupplierOrderItem`, `SupplierOrder`,
`CustomerOrderItem`, `CustomerOrder`, `WishlistItem`, then the original
`ProductImage` → `ProductVariant` → `Product` order — while still preserving
`Category`, `Supplier` (both re-upserted by the importer), `AdminUser`, and
`Customer`/`CustomerAccount` (so admin/customer login keep working locally).
`design.md`, `proposal.md`, and `specs/supplier-feed-sample-import/spec.md`
were updated afterward to document this (see Step 9 documentation task).

## Results

### First run (console summary)

```json
{
  "suppliersUpserted": 2,
  "categoriesUpserted": 3,
  "productsCreated": 3,
  "variantsCreated": 5,
  "imagesCreated": 0
}
```

### Database state after first run

- 3 `Product` rows, all `status: "Draft"`, `mainImageUrl: null`
- 0 `ProductImage` rows
- 5 `ProductVariant` rows, each with `supplierId`, `supplierReference`, `supplierCost` populated (e.g. `AN-DRESS-001-S` → `supplierId: 9`, `supplierReference: "AN-DRESS-001"`, `supplierCost: "18.5"`)
- `CustomerOrder`, `SupplierOrder`, `Shipment`, `ReturnRequest`, `Refund`, `WishlistItem`: all 0
- `AdminUser`: 1 (preserved), `Customer`: 463 (preserved)
- `Category`: 28 (26 pre-existing + up to 3 new from the fixture, some reused), `Supplier`: 8 (6 pre-existing + 2 new: Atelier Nord, Lumen Textiles)

### Supplier field isolation (curl verification)

- `GET /api/public/products?search=Belted` → `{"items":[],"total":0,...}` — correctly hidden from the public catalog since imported products are `Draft` (public API only serves `Active` products).
- Logged in via `POST /api/admin/auth/login` with the seeded admin credentials, then `GET /api/admin/products?search=Belted` (authenticated) → returns the imported Draft product with its variants; the variant objects contain `id, productId, sku, size, color, publicPrice, compareAtPrice, stockPolicy, status, deletedAt, createdAt, updatedAt` — **no** `supplierId`, `supplierReference`, or `supplierCost` in the response, confirming the `variantSelect` protection holds for fixture-imported data on the admin route too.

### Idempotency (second run)

- Second `npm run import:supplier-feed` run: console summary identical (`suppliersUpserted: 2, categoriesUpserted: 3, productsCreated: 3, variantsCreated: 5, imagesCreated: 0`) — `productsCreated` shows 3 again (not 0) because the clean step wipes all products before every run, so each run is a fresh create, not an update; this is expected for a clean-then-load script.
- Post-second-run database counts: `products: 3, variants: 5, images: 0, suppliers: 8, categories: 28` — identical to the post-first-run state. Confirms the script converges to the same state on repeat runs and does not accumulate duplicate `Supplier`/`Category` rows across cycles.

## Outcome

- Step 7 status: PASS (after fixing the `cleanLocalCatalog` FK gap found during this step)
- Blocking issues: none remaining
