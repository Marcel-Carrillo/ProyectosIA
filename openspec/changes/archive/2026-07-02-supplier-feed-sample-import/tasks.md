## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` Step 0/Step 1: inspect current branch/remote/worktree state, confirm remote is `Marcel-Carrillo/ProyectosIA`, and decide branch vs worktree (default: feature branch, since the workspace is expected to be clean on `develop`).
- [x] 0.2 If not already on a suitable feature branch: `git fetch origin && git checkout develop && git pull`, then `git checkout -b feature/supplier-feed-sample-import`.
- [x] 0.3 Verify branch creation: `git branch --show-current` reports `feature/supplier-feed-sample-import`.

## 1. Backend: Supplier Feed Fixture and Types

- [x] 1.1 Create `backend/prisma/fixtures/supplier-feed.sample.json` — an array of at least 2 supplier-response-shaped products (per `design.md`), each with `supplier.name`, `supplier.reference`, `externalRef`, `title`, `description`, `brand`, `category`, `supplierCost`, an explicitly empty `images: []`, and 1-2 `variants` (`sku`, `size?`, `color?`, `publicPrice`).
- [x] 1.2 Create `backend/src/infrastructure/external/supplierFeedTypes.ts` mirroring `escuelaJsTypes.ts`: `SupplierFeedProduct`, `SupplierFeedVariant`, `SupplierFeedSource` (a constant path to the fixture, mirroring `ESCUELAJS_PRODUCTS_URL`).

## 2. Backend: Mapper (mapSupplierFeedProduct)

- [x] 2.1 Create `backend/src/infrastructure/import/mapSupplierFeedProduct.ts` mirroring `mapEscuelaJsProduct.ts`: maps a `SupplierFeedProduct` to `{ name, slug, description, brand, status: 'Draft', mainImageUrl: null, categoryName, supplierName, variants: [...] }`, where each mapped variant carries `sku`, `size`, `color`, `publicPrice`, `stockPolicy: 'SupplierManaged'`, `status: 'Active'`, and the internal-only `supplierReference` (from `externalRef`) and `supplierCost`. Do NOT include an `isImportableSupplierFeedProduct`-style guard that requires images — the mapper must accept products with zero images by design.
- [x] 2.2 Create `backend/src/infrastructure/import/__tests__/mapSupplierFeedProduct.test.ts` covering: (a) a product with empty images maps successfully with `status='Draft'` and `mainImageUrl=null`; (b) `supplierCost`/`supplierReference` land on the mapped variant's internal-only fields; (c) slug is generated correctly from title.

## 3. Backend: Importer and Clean Step

- [x] 3.1 Create `backend/src/infrastructure/import/supplierFeedImporter.ts` mirroring `escuelaJsProductImporter.ts`: `upsertSupplier` (by `name`, `status='Active'`), `upsertCategory` (by `name`), `upsertImportedProduct` (upsert `Product` by `slug`, replace variants), and a top-level `importSupplierFeedProducts(prisma, fixture)` that returns `{ suppliersUpserted, categoriesUpserted, productsCreated, variantsCreated, imagesCreated: 0 }`. Confirm zero `ProductImage` rows are created.
- [x] 3.2 Add a `cleanLocalCatalog(prisma)` function (co-located in `supplierFeedImporter.ts`) that deletes, in FK-safe order, `StripeWebhookEvent`, `CouponRedemption`, `Refund`, `ReturnRequest`, `Shipment`, `SupplierOrderItem`, `SupplierOrder`, `CustomerOrderItem`, `CustomerOrder`, `WishlistItem`, `ProductImage`, `ProductVariant`, and `Product` rows, and does NOT touch `Category`, `Supplier`, `AdminUser`, `Customer`/`CustomerAccount`, or `Coupon` definitions. **Revised during implementation** (see `design.md` decision 4 and the Step 7 report): the original narrower scope (just `ProductImage`→`ProductVariant`→`Product`) hit a real FK violation against this project's local database, which already had order history referencing existing variants; the user chose a full local reset over a narrower alternative.
- [x] 3.3 Create `backend/src/infrastructure/import/__tests__/supplierFeedImporter.test.ts` (or extend existing importer test conventions) asserting: fixture import creates the expected `Supplier`/`Category`/`Product`/`ProductVariant` rows with zero `ProductImage` rows, and re-running the import is idempotent (no duplicate rows).

## 4. Backend: Dev-Only Safety Guard and Script

- [x] 4.1 Create `backend/prisma/importSupplierFeed.ts` (script entry point, mirroring `importEscuelaJs.ts`): validates `NODE_ENV !== 'production'` and that the resolved `DATABASE_URL` host is `localhost`, `127.0.0.1`, or the Docker Compose service name; exits non-zero with a clear message and makes no DB calls if either check fails. On success, calls `cleanLocalCatalog(prisma)` then `importSupplierFeedProducts(prisma, fixture)` and prints the JSON summary.
- [x] 4.2 Add `"import:supplier-feed": "npx ts-node prisma/importSupplierFeed.ts"` to `backend/package.json` `scripts`, following the existing `import:products` pattern.
- [x] 4.3 Manually verify the guard: temporarily set `NODE_ENV=production` (or an out-of-scope `DATABASE_URL`) and confirm the script exits non-zero without touching the database; revert the env var afterward.

## 5. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 5.1 Review `backend/src/routes/public/__tests__/supplierIsolation.test.ts` and confirm it already covers any variant regardless of source (no changes expected, but verify it would still catch a leak from fixture-imported variants); update it only if it is scoped narrowly to EscuelaJS-imported data.
- [x] 5.2 Review `backend/src/infrastructure/import/__tests__/mapEscuelaJsProduct.test.ts` to confirm the new mapper/importer tests (Tasks 2.2, 3.3) follow the same structure and assertions style, for consistency.
- [x] 5.3 Confirm no existing test relies on the pre-change local database being empty/seeded in a way that `cleanLocalCatalog` would break (search for tests that assume specific product counts).

## 6. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 6.1 Capture pre-test database baseline: `docker compose up -d db` if not running, then record current row counts for `Product`, `ProductVariant`, `ProductImage`, `Category`, `Supplier` via a `prisma` query or `psql` count.
- [x] 6.2 Run targeted tests: `npm test -- mapSupplierFeedProduct supplierFeedImporter supplierIsolation` (from `backend/`).
- [x] 6.3 Run the full backend suite: `npm test` (from `backend/`).
- [x] 6.4 Verify post-test database state matches the pre-test baseline (Jest tests must not leave residual rows); if any test left mutations, restore state and document it.
- [x] 6.5 Create report `openspec/changes/supplier-feed-sample-import/reports/YYYY-MM-DD-step-6-unit-test-and-db-verification.md` using the template from `docs/openspec-tasks-mandatory-steps.md`.
- [x] 6.6 Mark this step complete only after all tests pass and the report exists.

## 7. Backend: Manual Verification of the Import Script (MANDATORY — AGENT MUST EXECUTE)

This change adds no new or modified HTTP endpoints (no `/api/admin/*` or `/api/public/*` routes are touched), so the standard "curl endpoint testing" step does not apply to new routes. Instead, the agent must manually execute the new command end to end, since that is the equivalent surface being verified.

- [x] 7.1 Ensure the local database is running (`docker compose up -d db`) and record current row counts (reuse or repeat 6.1).
- [x] 7.2 Run `npm run import:supplier-feed` (from `backend/`) and capture the console summary.
- [x] 7.3 Verify via `prisma` query or `psql` that the expected `Product` rows exist with `status='Draft'`, `mainImageUrl=null`, and zero associated `ProductImage` rows; verify `ProductVariant` rows have the expected `supplierId`/`supplierReference`/`supplierCost` populated.
- [x] 7.4 Verify via `curl http://localhost:<backend-port>/api/public/products` (or the relevant admin endpoint with an authenticated session) that the response for imported variants does NOT include `supplierId`, `supplierReference`, or `supplierCost` — confirming the existing `variantSelect` protection holds for fixture-imported data.
- [x] 7.5 Re-run `npm run import:supplier-feed` a second time and confirm row counts do not duplicate (idempotency), and that the clean step removed the previous run's products/variants/images first.
- [x] 7.6 Create report `openspec/changes/supplier-feed-sample-import/reports/YYYY-MM-DD-step-7-import-script-manual-verification.md` documenting commands run, console output, and query results.

## 8. Frontend: E2E Verification of the Admin Flow with Playwright MCP (MANDATORY — AGENT MUST EXECUTE)

- [x] 8.1 Ensure both backend and frontend dev servers are running (start them if needed), and confirm the fixture has been imported (Task 7.2).
- [x] 8.2 Use Playwright MCP `browser_navigate` to the admin product list page; log in as admin if required; take a snapshot confirming imported `Draft` products with no image appear in the list.
- [x] 8.3 Open one imported product's detail view; verify it shows no image and `Draft` status; use the existing `ImageManager` to add a placeholder image via the UI.
- [x] 8.4 Verify the added image persists (reload or re-navigate) and that the product can be activated once it has an active variant and at least one image, per existing admin activation flow.
- [x] 8.5 Take Playwright screenshots/snapshots at each key step (list view with drafts, detail before image, detail after image, activated product).
- [x] 8.6 Clean up: remove the manually-added test image and any status change made purely for this test, or re-run `npm run import:supplier-feed` afterward to reset to a clean baseline.
- [x] 8.7 Create report `openspec/changes/supplier-feed-sample-import/reports/YYYY-MM-DD-step-8-e2e-admin-flow-testing.md` including workflow steps, snapshots/screenshots, and cleanup actions.

## 9. Documentation: Update Technical Documentation (MANDATORY)

- [x] 9.1 Update `docs/development_guide.md` with the `npm run import:supplier-feed` command, what it does (cleans local catalog + loads the sample fixture), and the explicit dev-only warning (blocked outside local `NODE_ENV`/`DATABASE_URL`).
- [x] 9.2 Review `docs/data-model.md` and `docs/api-spec.yml` for whether any documented behavior changed — expected outcome: no changes needed, since no schema or API contract changed; note this explicitly in the report/PR rather than skipping the review.
- [x] 9.3 Review `docs/backend-standards.md` for whether the new importer pattern needs to be referenced as precedent (optional, only if the standards doc catalogs import scripts).

## 10. Commit and Create Pull Request (MANDATORY — LAST STEP)

- [x] 10.1 Load and apply `ai-specs/skills/commit/SKILL.md` before running any Git commands.
- [x] 10.2 Verify all tasks above are marked `[x]` and all required reports exist under `openspec/changes/supplier-feed-sample-import/reports/`.
- [x] 10.3 Stage all relevant files (fixture, types, mapper, importer, script, package.json, docs, OpenSpec artifacts); exclude `.env`, `node_modules/`, `dist/`, `coverage/`.
- [x] 10.4 Create commit with Conventional Commit message, e.g. `feat(catalog): add dev-only supplier-feed sample import and local catalog reset`.
- [x] 10.5 Push branch: `git push -u origin feature/supplier-feed-sample-import`.
- [x] 10.6 Create Pull Request targeting `develop` (never `master`): `gh pr create --base develop --title "feat(catalog): add dev-only supplier-feed sample import" --body "..."`, including summary, OpenSpec change name, and verification status (unit tests, manual script verification, E2E).
- [x] 10.7 Report the PR URL in chat.
