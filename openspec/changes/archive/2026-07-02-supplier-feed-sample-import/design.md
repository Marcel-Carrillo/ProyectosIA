## Context

The admin panel and public catalog already support the full product lifecycle (`Draft → Active → Inactive/Archived`), and two import scripts exist as precedent: `backend/prisma/importEscuelaJs.ts` (live external API, requires images) and `backend/prisma/importDummyJson.ts`/`seedFashionCatalog.ts` (hardcoded demo data). None of them exercise the "supplier sends catalog data, images arrive later" path, which is the actual expected onboarding flow for this store's supplier-fulfilled model. This design adds a fourth, narrowly-scoped script that mirrors the EscuelaJS importer's structure but sources from a local static fixture instead of a live API, and intentionally produces image-less `Draft` products.

This is backend-only, dev-tooling work: no new API endpoints, no frontend changes, no Prisma schema changes (all target fields already exist).

## Goals / Non-Goals

**Goals:**
- Provide a single command that resets the local catalog to a known baseline and loads a supplier-feed-shaped fixture.
- Make the importer structurally consistent with `escuelaJsProductImporter.ts` (same upsert-by-natural-key style, same file layout under `infrastructure/import` and `infrastructure/external`) so it stays maintainable and is a plausible base for a future real supplier feed integration.
- Guarantee supplier-only fields never leak, reusing the existing `variantSelect` protection already enforced at the repository layer — this design adds no new read path, so no new leak surface is introduced.
- Make destructive behavior (the clean step) impossible to run outside local development.

**Non-Goals:**
- No real supplier HTTP integration — out of scope until an actual supplier partnership defines a contract.
- No image handling of any kind, including fixture-declared image URLs — this iteration is deliberately images-optional to validate the admin's "complete the draft" workflow.
- No admin-panel UI trigger — this is a CLI/npm-script tool for developers, consistent with the existing `import:products` script.
- No changes to the `Product`/`ProductVariant`/`Supplier`/`Category` Prisma schema — all required fields already exist.

## Decisions

**1. Mirror the EscuelaJS importer's file layout and upsert strategy, not the `seedFashionCatalog` hardcoded-array style.**
`escuelaJsProductImporter.ts` already implements the exact shape needed (fetch/read → map → upsert Category by name → upsert Product by slug → replace variants) and is unit-tested (`mapEscuelaJsProduct.test.ts`). Reusing this pattern (`backend/src/infrastructure/external/supplierFeedTypes.ts`, `backend/src/infrastructure/import/mapSupplierFeedProduct.ts`, `backend/src/infrastructure/import/supplierFeedImporter.ts`) keeps the codebase consistent and gives the new capability a natural test story. Alternative considered: extend `escuelaJsProductImporter.ts` with a `source` flag — rejected because the image-optional and Draft-status semantics are fundamentally different from the EscuelaJS "always Active, always has images" contract, and branching one importer for two contracts would hurt readability more than a second small importer costs.

**2. Source is a static local JSON file, not a mocked HTTP server.**
The fixture is read from disk (`backend/prisma/fixtures/supplier-feed.sample.json`) rather than served over an HTTP mock, because the goal is testing the *admin panel's* handling of image-less supplier data, not testing an HTTP client. This also keeps the script fully offline and fast. Alternative considered: reuse `importDummyJson.ts`'s approach of fetching `dummyjson.com` — rejected because that is a live external dependency and (per the user's request) this must be a local, offline sample.

**3. Products land in `Draft`, not `Active`.**
Per `data-model.md`, a `Product` requires ≥1 active variant to become `Active`, but nothing stops a `Draft` product from having an active variant already attached — `Draft` is the correct default because a product without any photography is not ready to sell. This makes the import result visibly "needs completion" in the admin list, which is the whole point of the exercise. Alternative considered: `Active` with `mainImageUrl=null` — rejected because it would make an incomplete product appear live/orderable, contradicting the store's supplier-fulfilled draft→publish workflow.

**4. Clean step is a direct Prisma hard-delete in FK order, not `prisma migrate reset`.**
`ProductImage → ProductVariant → Product` deletion, mirroring the `deleteMany` pattern already used in `seedFashionCatalog.ts` and `importDummyJson.ts`, is fast, keeps migrations/admin/coupons intact, and is idempotent. `prisma migrate reset --force` was considered and rejected: it wipes the entire database (including the admin user and any manually-created auth data), is slower, and is a much larger blast radius than "clean the product catalog" — which is what was actually requested.

**Revised during implementation (2026-07-02):** the first real run against this project's local database failed with a Postgres FK violation on `CustomerOrderItem_productVariantId_fkey` — the local DB already had 179 `CustomerOrder` rows referencing existing `ProductVariant` rows, a scenario this decision did not originally account for. The user was asked how to resolve it and chose a full local reset ("quiero la BD limpia sin nada"). `cleanLocalCatalog` now cascades through every table that transitively references `ProductVariant`/`CustomerOrder`/`SupplierOrder`, in FK-safe order: `StripeWebhookEvent` → `CouponRedemption` → `Refund` → `ReturnRequest` → `Shipment` → `SupplierOrderItem` → `SupplierOrder` → `CustomerOrderItem` → `CustomerOrder` → `WishlistItem` → `ProductImage` → `ProductVariant` → `Product`. This means the command's impact is broader than originally scoped: it now also clears all local customer order, supplier order, shipment, return, refund, and wishlist history — not just the product catalog. `AdminUser`, `Customer`/`CustomerAccount`, `Coupon` definitions, `Category`, and `Supplier` are still preserved (the latter two re-upserted fresh by the importer), so admin/customer login and coupon codes keep working locally.

**5. Categories and Suppliers are upserted, never deleted, by the clean step.**
Deleting categories/suppliers on every run would break referential stability across repeated runs and is unnecessary — the importer already upserts them by natural key (`name`), so re-running the command is safe and idempotent for those tables without needing to clean them first.

**6. Safety guard checks both `NODE_ENV` and the `DATABASE_URL` host, evaluated before any query runs.**
Two independent conditions (`NODE_ENV !== 'production'` and a local-looking `DATABASE_URL` host) are both required, so a misconfigured `NODE_ENV` alone can't cause a production run — and vice versa. The host check accepts `localhost`, `127.0.0.1`, and the Docker Compose service name (`db`, matching `docker-compose.yml`) since those are this project's only supported local setups; anything else fails closed. This is new — no existing script currently guards `NODE_ENV`/`DATABASE_URL` — so it is scoped to this command only, not retrofitted onto other scripts.

**7. Clean + load runs inside a single `prisma.$transaction` (added after adversarial review).**
An independent adversarial review flagged that `cleanLocalCatalog`'s 13 sequential `deleteMany` calls and `importSupplierFeedProducts`'s per-product loop ran as plain sequential `await`s, unlike the codebase's established pattern for multi-step mutations (`prisma.$transaction(async (tx) => ...)`, used in `checkoutService.ts`, `refundService.ts`, `shipmentService.ts`, etc.). Because decision 4 expanded this script's blast radius from "just catalog rows" to real local order/shipment/return/refund/wishlist history, a crash partway through (dropped DB connection, an unvalidated fixture edge case) would leave the database partially wiped with no way to recover by inspection. `cleanLocalCatalog` and `importSupplierFeedProducts` now take `Prisma.TransactionClient` instead of `PrismaClient`, and `prisma/importSupplierFeed.ts`'s `main()` wraps both calls in one `prisma.$transaction(async (tx) => {...}, { timeout: 30000 })`. Verified for real: a fixture entry with an oversized product name was used to force a genuine Postgres error mid-run (after the clean step and 3 of 4 products had already executed inside the transaction) — the database returned to its exact pre-run state, confirming true all-or-nothing behavior (see `reports/2026-07-02-step-4.3-dev-only-guard-verification.md`).

**8. Fixture-level SKU/slug uniqueness validation, and a schema-drift regression test (added after adversarial review).**
Two related gaps were found: (a) `assertIsSupplierFeedProduct` validated required fields but not intra-fixture uniqueness, so a duplicate SKU or title/slug would only surface as a raw Prisma unique-constraint error mid-transaction rather than a clear pre-flight message; (b) the existing unit test for `cleanLocalCatalog`'s delete order asserted against a second hand-written copy of the table list, so it would keep passing even if a future schema migration added a new model with a non-cascading FK to `Product`/`ProductVariant`/`CustomerOrder`/`SupplierOrder` without updating the real function — exactly the class of bug that already caused a real FK violation once (decision 4). Fixed by: adding `assertNoDuplicateSkusOrSlugs` to `readSupplierFeedFixture` (still runs before the transaction, so a duplicate is still caught pre-flight); and adding `cleanLocalCatalog.schemaGuard.test.ts`, which derives the "must be cleaned" model set directly from parsing `schema.prisma`'s `@relation`/`onDelete` annotations at test time (not from a second hardcoded list) and compares it against a spy on which Prisma delegates `cleanLocalCatalog` actually calls — verified to genuinely fail when `wishlistItem.deleteMany` was temporarily removed from the function during testing.

## Risks / Trade-offs

- **[Risk]** A developer runs the command against a shared/staging database by mistake → **[Mitigation]** hard guard on `NODE_ENV` and `DATABASE_URL` host, fail-closed with no partial writes if either check fails.
- **[Risk]** The expanded clean step (decision 4, revised) permanently deletes local `CustomerOrder`/`SupplierOrder`/`Shipment`/`ReturnRequest`/`Refund`/`WishlistItem` history every run, not just catalog data → **[Mitigation]** explicitly scoped to local development only (same dual guard as above); the user explicitly requested this broader reset when the narrower version hit a real FK conflict during implementation. `AdminUser`/`Customer`/`CustomerAccount`/`Coupon` definitions are preserved so login and coupon testing are unaffected.
- **[Risk]** Fixture drifts from what a real future supplier feed will look like, making the importer harder to adapt later → **[Mitigation]** fixture and types are modeled explicitly as "supplier API response shape" (see proposal), not as an ad hoc test object, and the importer/mapper pattern intentionally mirrors the EscuelaJS one so swapping the source later is a contained change.
- **[Risk]** Re-running the import after manually editing an imported product in the admin panel could overwrite the admin's edits → **[Mitigation]** documented as expected/dev-only behavior in `docs/development_guide.md`: the command is a reset tool, not an incremental sync; this matches how `import:products` already behaves (update-in-place by slug).
- **[Trade-off]** No images at all, even placeholder ones → accepted deliberately, since the entire point is exercising the "admin adds the first image" step of the flow.

## Migration Plan

No data migration. This is an additive, dev-only script:
1. Add fixture, types, mapper, importer files (no runtime code path is touched).
2. Add the `import:supplier-feed` npm script to `backend/package.json`.
3. Update `docs/development_guide.md`.

No rollback concerns beyond `git revert`, since nothing in production or the request-time code path changes.

## Open Questions

None outstanding — the three open questions raised during enrichment (clean scope, category handling, script naming) were resolved in the proposal: scoped hard-delete of catalog tables only, categories upserted/preserved, and `import:supplier-feed` as the script name.
