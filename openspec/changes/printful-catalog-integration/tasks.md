## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Read `ai-specs/skills/using-git-worktrees/SKILL.md` and decide whether to use a Git worktree or current checkout for isolation
- [x] 0.2 Create and switch to feature branch `feature/printful-catalog-integration` from `develop`
- [x] 0.3 Verify branch creation with `git status` and confirm working on the correct branch

## 1. Printful Infrastructure: Types and HTTP Client

- [x] 1.1 Create `backend/src/infrastructure/external/printfulTypes.ts` with TypeScript interfaces for Printful sync product list response (`SyncProductListItem`), sync product detail (`SyncProduct`), sync variant (`SyncVariant`), variant option (`VariantOption`), and the `PRINTFUL_API_BASE_URL` constant
- [x] 1.2 Create `backend/src/infrastructure/external/printfulClient.ts` with a typed fetch helper that sets `Authorization: Bearer <PRINTFUL_API_KEY>`, handles 429 rate-limit responses with exponential backoff, and exposes `fetchSyncProductList(offset, limit)` and `fetchSyncProductDetail(id)` functions
- [x] 1.3 Verify the client does NOT log the API key value at any level

## 2. Demo Catalog Purge Script

- [x] 2.1 Create `backend/prisma/clearDemoCatalog.ts` with a `clearDemoCatalog(prisma, options?: { dryRun?: boolean })` function that identifies demo products by `ProductVariant.sku LIKE 'EJS-%'`
- [x] 2.2 Implement FK reference check per variant: query `CustomerOrderItem`, `SupplierOrderItem`, and `WishlistItem` for each demo product's variant IDs
- [x] 2.3 Implement hard-delete path (inside a Prisma transaction): delete `ProductTranslation`, `ProductImage`, `ProductVariant`, then `Product` in that order for unreferenced products
- [x] 2.4 Implement soft-delete path: set `Product.deletedAt = now()`, `Product.status = "Archived"`, `ProductVariant.status = "Archived"` for referenced products
- [x] 2.5 Add `--dry-run` CLI argument support: when enabled, log `{ wouldHardDelete, wouldSoftDelete }` and skip all writes
- [x] 2.6 Return and log result object `{ hardDeleted: number, softDeleted: number, skipped: number }` at completion
- [x] 2.7 Wrap all write operations in a single Prisma transaction that rolls back entirely on any error

## 3. Printful Catalog Mapper

- [x] 3.1 Create `backend/src/infrastructure/import/mapPrintfulProduct.ts` with `isImportablePrintfulSyncProduct(product)` function that filters out products with no sync variants or all variants having zero/missing `retail_price`
- [x] 3.2 Implement `mapPrintfulProduct(syncProduct, supplierId, markup)` that maps each `SyncVariant` to a `ProductVariant` payload with: `sku = "PF-{sync_variant_id}"`, `supplierReference = String(sync_variant_id)`, `supplierCost = retail_price`, `publicPrice = retail_price × markup`, `size` and `color` derived from `options` array by type, `stockPolicy = "SupplierManaged"`, `status = "Active"`
- [x] 3.3 Add slug derivation logic: use Printful product name converted to URL-safe kebab-case prefixed with `pf-` (e.g., `pf-unisex-heavy-cotton-tee`) to avoid collisions with EJS slugs
- [x] 3.4 Export a `MappedPrintfulProductImport` interface that mirrors `MappedProductImport` from the EscuelaJS pattern

## 4. Printful Product Importer

- [x] 4.1 Create `backend/src/infrastructure/import/printfulProductImporter.ts` with `importPrintfulProducts(prisma, options?: { limit?: number })` following the EscuelaJS importer pattern
- [x] 4.2 Implement `upsertPrintfulSupplier(prisma)` that upserts `Supplier { name: "Printful", website: "https://www.printful.com", status: "Active" }` and returns the supplier id
- [x] 4.3 Implement paginated fetch loop: call `fetchSyncProductList` with offset pagination until all products are fetched or `limit` is reached; throttle between detail requests to stay within ~120 req/min
- [x] 4.4 Implement `upsertPrintfulProduct(prisma, mapped, categoryId, supplierId)` that follows the existing upsert pattern: if slug exists → update product + delete-recreate variants/images; if not → create product with variants and images
- [x] 4.5 Implement category upsert by product type name (same pattern as `upsertCategory` in EscuelaJS importer)
- [x] 4.6 Apply `PRINTFUL_PRICE_MARKUP` from env (parse as float, default to `1.6` if absent, log the assumption if using default)
- [x] 4.7 Return and log `{ fetched: number, imported: number, skipped: number }` result

## 5. CLI Script and npm Scripts

- [x] 5.1 Create `backend/prisma/importPrintful.ts` CLI entry-point that instantiates `PrismaClient`, calls `importPrintfulProducts`, logs the result, and disconnects (mirrors `importEscuelaJs.ts`)
- [x] 5.2 Add `"db:import:printful": "ts-node prisma/importPrintful.ts"` to `backend/package.json` scripts
- [x] 5.3 Add `"db:clear-demo": "ts-node prisma/clearDemoCatalog.ts"` to `backend/package.json` scripts
- [x] 5.4 Add `"db:clear-demo:dry-run": "ts-node prisma/clearDemoCatalog.ts --dry-run"` to `backend/package.json` scripts

## 6. Environment Variable Validation at Startup

- [x] 6.1 Add `PRINTFUL_API_KEY` to the required env var validation in `backend/src/index.ts` (alongside the existing Stripe vars), ensuring startup fails with a descriptive error if absent in non-test environments
- [x] 6.2 Add `PRINTFUL_API_KEY` to `.env.example` (if present) with a placeholder value and comment

## 7. Seed and EscuelaJS Gate Update

- [x] 7.1 Update `backend/prisma/seed.ts` to replace the `ESCUELAJS_IMPORT` gate with a `PRINTFUL_IMPORT` gate; remove the call to `importEscuelaJsProducts` and replace with a conditional call to `importPrintfulProducts`
- [x] 7.2 Keep EscuelaJS source files in place but add a comment marking them as deprecated and no longer invoked by the seed

## 8. Unit Tests

- [x] 8.1 Create `backend/src/infrastructure/import/__tests__/mapPrintfulProduct.test.ts` with tests covering: markup applied correctly, `size`/`color` extracted from options, missing color returns null, `sku` format is `PF-{id}`, `supplierReference` set, `isImportablePrintfulSyncProduct` filters zero-price and no-variant products
- [x] 8.2 Create `backend/src/infrastructure/import/__tests__/printfulProductImporter.test.ts` with mocked `fetch` tests covering: supplier upserted idempotently, products upserted on first run, products updated on re-run (idempotency), skipped products incremented correctly
- [x] 8.3 Create `backend/prisma/__tests__/clearDemoCatalog.test.ts` (or equivalent test location) with tests covering: dry-run makes no DB writes, hard-delete fires for unreferenced demo products, soft-delete fires for referenced demo products, result counters are accurate, re-run is idempotent

## 9. Review and Update Existing Unit Tests (MANDATORY)

- [x] 9.1 Run the existing test suite and identify any tests that reference EscuelaJS seed data, product slugs, or import behavior that may need updating after this change
- [x] 9.2 Update any failing or impacted existing tests so the full suite remains green

## 10. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 10.1 Capture pre-test baseline: record current counts of `Product`, `ProductVariant`, `ProductImage`, `Supplier`, `Category` in the dev database
- [x] 10.2 Run targeted unit tests for new modules: `mapPrintfulProduct.test.ts`, `printfulProductImporter.test.ts`, `clearDemoCatalog.test.ts`
- [x] 10.3 Run the full backend unit test suite (`npm test` in `backend/`) and confirm no regressions
- [x] 10.4 Verify post-test database state matches pre-test baseline (no unintended mutations from tests)
- [x] 10.5 Create report `openspec/changes/printful-catalog-integration/reports/YYYY-MM-DD-step-10-unit-test-and-db-verification.md`
- [x] 10.6 Mark step complete only after all tests pass and report file exists

## 11. Manual CLI and Endpoint Testing (MANDATORY - AGENT MUST EXECUTE)

- [x] 11.1 Ensure backend server and database are running
- [x] 11.2 Run `npm run db:clear-demo:dry-run` and verify it logs `{ wouldHardDelete, wouldSoftDelete }` with no DB writes
- [x] 11.3 Run `npm run db:clear-demo` and verify the result log shows expected counts; confirm demo products are gone or soft-deleted via Prisma Studio or a direct DB query
- [x] 11.4 Set `PRINTFUL_API_KEY` (test/sandbox key) and `PRINTFUL_PRICE_MARKUP=1.6` in env, then run `npm run db:import:printful` with `PRINTFUL_IMPORT_LIMIT=5`; verify result log shows `{ fetched, imported, skipped }`
- [x] 11.5 Curl `GET /api/public/products` and verify: real Printful products appear, `publicPrice` is set, `supplierCost` and `supplierReference` are NOT in the response body
- [x] 11.6 Curl a single product detail endpoint and verify no supplier internals are exposed
- [x] 11.7 Re-run `npm run db:import:printful` with the same limit and verify idempotency: same product count, no duplicates
- [x] 11.8 Restore database to a clean state (re-run purge or restore snapshot) after testing
- [x] 11.9 Create report `openspec/changes/printful-catalog-integration/reports/YYYY-MM-DD-step-11-cli-and-endpoint-testing.md`
- [x] 11.10 Mark step complete only after all tests pass, DB is restored, and report exists

## 12. Update Technical Documentation (MANDATORY)

- [x] 12.1 Update `docs/development_guide.md`: add `PRINTFUL_API_KEY`, `PRINTFUL_STORE_ID`, `PRINTFUL_PRICE_MARKUP`, `PRINTFUL_IMPORT`, `PRINTFUL_IMPORT_LIMIT` env vars; add `db:import:printful`, `db:clear-demo`, `db:clear-demo:dry-run` script descriptions; document the pre-purge DB snapshot recommendation
- [x] 12.2 Update `docs/backend-standards.md`: document the supplier integration pattern (types → mapper → importer), the price markup convention, and the purge strategy (hard vs soft delete)
- [x] 12.3 Review `docs/data-model.md` — confirm no schema changes occurred and that supplier isolation rules are still accurately documented; update if any nuance changed
- [x] 12.4 Review `docs/api-spec.yml` — confirm no new endpoints were added; if the optional `POST /api/admin/catalog/import/printful` endpoint was implemented, add it to the spec

## 13. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 13.1 Load and apply `ai-specs/skills/commit/SKILL.md` before running any git commands
- [ ] 13.2 Verify all tasks are marked `[x]` and reports exist under `openspec/changes/printful-catalog-integration/reports/`
- [ ] 13.3 Stage all relevant files: new infrastructure modules, CLI scripts, tests, updated seed, updated docs, OpenSpec artifacts; exclude `.env`, `node_modules`, `dist`, `coverage`
- [ ] 13.4 Create commit with message: `feat(catalog): integrate Printful as real supplier with catalog import and demo purge`
- [ ] 13.5 Push branch `feature/printful-catalog-integration` to remote origin
- [ ] 13.6 Create Pull Request with `gh pr create` targeting `develop`; report the PR URL in chat
