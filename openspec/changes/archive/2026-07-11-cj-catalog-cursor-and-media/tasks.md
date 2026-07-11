## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Applied `ai-specs/skills/using-git-worktrees/SKILL.md`: prior checkout was on `feature/cj-catalog-auto-provisioning` (already merged multiple times), workspace otherwise clean except this change's own untracked planning artifacts. Used a normal feature branch, no worktree needed.
- [x] 0.2 Ran `git fetch origin && git checkout develop && git pull origin develop` — fast-forwarded 7 commits (includes the `cj-catalog-auto-provisioning` production-incident fixes already merged).
- [x] 0.3 Created and switched to feature branch `feature/cj-catalog-cursor-and-media` from `develop`.
- [x] 0.4 Verified with `git branch --show-current` → `feature/cj-catalog-cursor-and-media`; `git status --porcelain` shows only the untracked OpenSpec planning folder.

## 1. Prisma Schema: Sync Cursor Fields

- [x] 1.1 Added `catalogSyncCursorPage Int @default(0)`, `catalogSyncTotalPages Int?`, `catalogSyncWrappedAt DateTime?` to `SupplierIntegration` in `backend/prisma/schema.prisma`.
- [x] 1.2 Generated and applied migration `20260709122018_add_cj_catalog_sync_cursor` (`ALTER TABLE ... ADD COLUMN`, additive-only, no backfill needed).
- [x] 1.3 Ran `npx prisma generate` — Prisma Client regenerated successfully with the new fields.

## 2. Domain/Infrastructure: Cursor Repository Method

- [x] 2.1 Added `updateCatalogSyncCursor(id, { cursorPage, totalPages, wrappedAt? })` to `ISupplierIntegrationRepository`.
- [x] 2.2 Implemented in `SupplierIntegrationRepository`, using the same conditional-spread pattern as `ProductImageRepository.update` for the optional `wrappedAt`.
- [x] 2.3 Extended `SupplierIntegration` domain model with `catalogSyncCursorPage`/`catalogSyncTotalPages`/`catalogSyncWrappedAt` (cursor defaults to `0` even at the domain-model level, so existing tests constructing integrations without a cursor override keep working unchanged).
- [x] 2.4 Added 3 unit tests to `supplierIntegrationRepository.test.ts` for `updateCatalogSyncCursor`. Verified: `npx jest --watchAll=false --testPathPattern=supplierIntegrationRepository` → 10/10 passed.

## 3. Application: Windowed, Wrap-Around Sync Cursor Logic

- [x] 3.1 Rewrote `syncCatalog`'s pagination loop to start at `cursorPage + 1`, per design.md D1. Also moved `MAX_SYNC_PAGES`/`CATALOG_PAGE_SIZE` env reads from module-level constants into constructor-read instance fields (`maxSyncPages`/`catalogPageSize`) — required for the wrap-around tests to be able to vary the window size per test without `jest.resetModules()` gymnastics; behavior-neutral in production (env vars don't change after Lambda cold start). **Post-adversarial-review fix**: added `parsePositiveIntEnv()` validation (mirrors `getDefaultMarkupMultiplier`'s existing pattern) so a misconfigured `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE` SSM value can't silently freeze the sync loop forever (`endPage < startPage`) — falls back to the safe default and logs a warning instead.
- [x] 3.2 Implemented wrap-around: `wrapped = lastPageProcessed >= totalPages` resets cursor to 0 and sets `catalogSyncWrappedAt`; otherwise persists `lastPageProcessed`. **Real bug found and fixed during implementation**: an early draft checked `page > totalPages` only *after* fetching, which — combined with the loop's own bound being just the window (`endPage`) — could fetch one page past the known end of the catalog unnecessarily on every window that ends exactly at `totalPages`. Fixed by making the loop condition itself `page <= endPage && (totalPages === null || page <= totalPages)`, so once `totalPages` is known from the first fetch, no further page beyond it is ever requested (mirrors the original do-while's bound, now combined with the new window bound).
- [x] 3.3 `catalogSyncTotalPages` and `lastSyncedAt` are persisted via two sequential calls in the same method body (see design.md D1/implementation note — `updateCatalogSyncCursor`'s signature per task 2.1 has no `lastSyncedAt` param, so this is "same step," not one atomic SQL statement).
- [x] 3.4 Updated `cjCatalogSyncService.test.ts`: added `updateCatalogSyncCursor: jest.fn()` to the mocked repo fixture and a `catalogSyncCursorPage` param to the `makeIntegration()` helper; added 4 new cases (non-zero-cursor start, wrap-around exactly at totalPages, wrap-around when window overshoots totalPages, cursor persistence without wrapping when totalPages is larger) plus a 4-value parametrized post-review case for invalid `CJ_SYNC_MAX_PAGES`. All 9 pre-existing tests pass unchanged. Verified: `npx jest --watchAll=false --testPathPattern=cjCatalogSyncService` → 19/19 passed.

## 4. Infrastructure: CJ Type Extensions for Images

- [x] 4.1 Added `bigImage?: string` to `CjProductDto` and `variantImage?: string` to `CjVariantDto`. Additive only.
- [x] 4.2 Confirmed no changes needed: `cjClient.ts`'s `requestWithRetry<T>` returns `body.data` as-is with no field allow-listing, so the raw JSON already flowed through unchanged before this DTO extension — it only makes these fields visible to TypeScript. Verified: `npx jest --watchAll=false --testPathPattern=cjClient` → 11/11 passed.

## 5. Application: Shared Image Extraction Helper

- [x] 5.1 Added `backend/src/application/services/cjImageExtraction.ts` exporting `extractCjImages(rawPayload: unknown): ExtractedCjImages` — defensively typed (isRecord/isNonEmptyString guards, try/catch belt-and-suspenders), never throws.
- [x] 5.2 Added `cjImageExtraction.test.ts` (16 cases: both/one/neither image present, non-object rawPayload ×5, missing keys, non-string image ×3, empty/whitespace image ×2, non-object product/variant, never-throws on deeply malformed input) plus 6 more cases post-review for the new `planProductImages` helper (product-image-as-main, variant-fallback-as-main, product-image-priority-over-earlier-variant, deduplication, no-image, empty-input). Verified: `npx jest --watchAll=false --testPathPattern=cjImageExtraction` → 22/22 passed.

## 6. Application: Image Capture in `promote()`

- [x] 6.1 Added `backend/src/application/services/cjProductImageSync.ts` (`setProductMainImage`/`createProductImageRecord`, shared with the backfill script) and wired it into `promote()`'s existing `prisma.$transaction`: on new-product creation, images are derived and written for the whole pid group at once. **Post-adversarial-review refactor**: added `planProductImages()` to `cjImageExtraction.ts` (product image preferred as main; falls back to the first variant image if no product image exists, so a product with only variant photos no longer ends up with a permanently-null `mainImageUrl`) — this also simplified `promote()` by removing per-variant image-tracking state from the variant-creation loop entirely.
- [x] 6.2 Only brand-new products get image capture — variants joining an already-existing product (`group.existingProductId !== null`) do not. **Scope decision (flagged by the planning agent, confirmed as the right call, later also confirmed correct by the adversarial review)**: matches design.md D4's literal "on Product creation" framing and avoids two extra `tx.*` calls (`product.findUnique`/`productImage.count`) needed to do it safely for that rarer shape. Explicit test proves this is deliberate, not an oversight; the capability spec was updated post-review to state this carve-out explicitly (it was previously only in design.md/tasks.md, not the spec itself).
- [x] 6.3 Confirmed: no image data → both `extractCjImages` results are `{}` → zero `ProductImage` rows, promotion still succeeds normally.
- [x] 6.4 Confirmed: the `alreadyLinked`/re-promotion loop runs entirely outside `prisma.$transaction` and never calls the image-creation code — structurally impossible to create a duplicate image on re-promotion.
- [x] 6.5 Confirmed via explicit test: neither `setProductMainImage` nor `createProductImageRecord`'s call arguments can ever contain `supplierCost` (enforced by the helper functions' type signatures, not just care at the call site).
- [x] 6.6 Extended `cjCatalogPromotionService.test.ts`'s shared `tx` mock with `product.update`/`productImage.create`; added 6 new test cases (5 original + 1 post-review regression test for the variant-only-image fallback) plus extended the 2 existing idempotency-related tests with image-specific assertions. Verified: `npx jest --watchAll=false --testPathPattern=cjCatalogPromotionService` → 20/20 passed, no regressions.

## 7. Infrastructure: Production Sync Size Defaults

- [x] 7.1 Updated `backend/serverless.yml`'s `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE` SSM-backed defaults from `5`/`20` to `3`/`100` (design.md D2), still SSM-overridable without a redeploy. Updated the adjacent comment to document the `calls = pages * (1 + pageSize)` cost model.
- [x] 7.2 Updated `backend/.env.example`'s comment to reflect the per-product cost model (was stale, referenced only "cap catalog sync pages"). `backend/.env.docker`'s comment ("default to 500/100 when unset") is still factually accurate — the local/unset code default is unchanged, only production's SSM fallback changed — left as-is.

## 8. Scripts: One-Off Image Backfill

- [x] 8.1 Added `backend/src/application/services/cjProductImageBackfill.ts` (`groupVariantsByProduct` pure function + `backfillProductImages`, reusing `extractCjImages`/`cjProductImageSync`'s helpers — same logic as `promote()`) and the thin entry-point script `backend/scripts/backfillCjProductImages.ts` (query + summary logging, zero CJ API calls). **Structural note**: `backend/scripts/` is outside both Jest's `roots: ['<rootDir>/src']` and `tsconfig.json`'s `include: ["src/**/*"]` — the real logic was placed under `src/application/services/` specifically so it's both testable and type-checked; the script itself is a thin, deliberately-untested wrapper (manually type-checked once via an explicit `tsc` invocation against its own compiler options, confirmed clean).
- [x] 8.2 Added `cjProductImageBackfill.test.ts` (9 cases: grouping ×3, backfill logic ×6 covering image-available/distinct-variant/duplicate-avoidance/no-image-data/empty-variants/variant-only-image-fallback). "Already-imaged products skipped" is enforced by the script's query (`product: { mainImageUrl: null, images: { none: {} } }`) — this query is now provably exhaustive post-review-fix, since a product can no longer end up with images but a null `mainImageUrl`. Verified at the manual-testing stage (task 11), not unit-testable without a real DB. Verified: `npx jest --watchAll=false --testPathPattern=cjProductImageBackfill` → 9/9 passed.

## 9. Review and Update Existing Unit Tests (MANDATORY)

- [x] 9.1 Ran the full backend suite after groups 1–8: found and fixed real breakage — `cjConnectionService.test.ts` and `cjOrderPushService.test.ts` both mock `ISupplierIntegrationRepository` fixtures missing the new `updateCatalogSyncCursor` method (TS2322 compile errors, not caught by targeted per-module test runs during earlier groups). Added `updateCatalogSyncCursor: jest.fn()` to both fixtures.
- [x] 9.2 Confirmed: those were the only 2 additional files needing changes (grepped all 4 files referencing `ISupplierIntegrationRepository` in tests — the other 2, `cjCatalogSyncService.test.ts`/`cjCatalogPromotionService.test.ts`, were already updated in groups 3/6).

## 10. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 10.1 Captured pre-test baseline: `SupplierIntegration:0, CjCatalogItem:0, Product:12, ProductVariant:24, ProductImage:25`.
- [x] 10.2 Ran targeted unit tests for all new/changed modules — all passed (see report for exact counts per module).
- [x] 10.3 Ran the full backend suite: 84/84 suites, 819/819 tests passed (~7s).
- [x] 10.4 Verified post-test DB state identical to baseline (all mocked, no real DB/HTTP calls).
- [x] 10.5 Created report `openspec/changes/cj-catalog-cursor-and-media/reports/2026-07-09-step-10-unit-test-and-db-verification.md`.
- [x] 10.6 All tests pass and the report exists.

## 11. Manual Endpoint & Job Testing Against Local/Dev, Then Production (MANDATORY - AGENT MUST EXECUTE)

No new HTTP endpoint is introduced — this exercises the existing `POST .../cj/sync`, `POST .../cj/catalog/promote` admin endpoints (curl) plus the `supplierAutoProvision` job (direct invocation, no `serverless-offline` support for `schedule` events, per `cj-catalog-auto-provisioning`'s established pattern).

- [x] 11.1 Started local backend (`CJ_SYNC_MAX_PAGES=1 CJ_CATALOG_PAGE_SIZE=5 npm run dev`), created test supplier 60 + CJ connection via admin API, ran two consecutive `POST .../cj/sync` calls against the real CJ API. Confirmed via DB: cursor advanced `0→1→2` (`catalogSyncTotalPages: 1200`), and distinct `pid` count grew from 5 to 10 between the two syncs — the second run fetched genuinely different products, not a repeat of the first.
- [x] 11.2 Promoted `CjCatalogItem` id 3778 (real item with `rawPayload.product.bigImage`) via `POST .../cj/catalog/promote`. Verified via curl: `GET /api/public/products/130` → 404 (Draft correctly not public); `GET /api/admin/products/130` → `mainImageUrl` set, 2 `ProductImage` rows (product image `sortOrder:0` + a distinct variant image `sortOrder:1`). Re-promoted the same item: `wasAlreadyPromoted:true`, `ProductImage` count for the product unchanged at 2 (no duplicate).
- [x] 11.3 Forced wrap-around: set `catalogSyncCursorPage=1199` directly (1 page short of `totalPages:1200`), ran one more sync. Confirmed via DB: `catalogSyncCursorPage` reset to `0`, `catalogSyncWrappedAt` set to the sync timestamp.
- [x] 11.4 Restored local/dev DB state: deleted the 2 `ProductImage`, 1 `ProductVariant`, 1 `Product`, 80 `CjCatalogItem`, 1 `SupplierIntegration`, 1 `Supplier` test rows. Verified counts match the pre-test baseline exactly (`SupplierIntegration:0, CjCatalogItem:0, Product:12, ProductVariant:24, ProductImage:25`). Stopped the local dev server.
- [x] 11.5 Deployed to production (develop → master). Confirmed via `aws lambda get-function-configuration`: `CJ_SYNC_MAX_PAGES=3`, `CJ_CATALOG_PAGE_SIZE=100` live on the deployed Lambda.
- [x] 11.6 Ran the backfill script against production: `processed=100 imaged=100 noImageAvailable=0`. Verified via DB query: 285 `ProductImage` rows created, all 100 products' `mainImageUrl` populated.
- [x] 11.7 Manually invoked `supplierAutoProvision` in production. **Found and fixed 2 additional real production bugs along the way** (same root-cause class as `cj-catalog-auto-provisioning`'s incidents — Prisma's 5000ms default transaction timeout, hit by `promote()` then by `upsertMany()` once batch sizes grew): fixed in `3ba183a`/PR #94-95 and `07872d3`/PR #96-97, both deployed. Final successful run: `itemsUpserted:3154, itemsFailed:0, variantsCreated:3154`; cursor advanced `3→12` (of 60); 0 of 1295 CJ-promoted products missing `mainImageUrl`; duration ~422s (47% of the 900s Lambda budget, under the ~540s design.md D2 target).
- [x] 11.8 Created report `openspec/changes/cj-catalog-cursor-and-media/reports/2026-07-09-step-11-manual-endpoint-and-job-testing.md`.

## 12. Update Technical Documentation (MANDATORY)

- [x] 12.1 Updated `docs/data-model.md`: documented the 3 new `SupplierIntegration` cursor fields and their wrap-around semantics; added an "Image capture on promotion" note to the `CjCatalogItem` section.
- [x] 12.2 Updated `docs/development_guide.md`: revised the `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE` table row (window-based, new prod defaults `3`/`100`), added a "Catalog sync cursor" note, a "Backfilling images" note with the exact invocation command, and the dev/prod shared-CJ-account rate-limit caveat.
- [x] 12.3 Updated `docs/aws-infrastructure.md`: reflected the new production defaults (`3`/`100`) and the window/cursor rationale.
- [x] 12.4 No `docs/backend-standards.md` change made — the image-extraction-from-rawPayload pattern is scoped specifically to this CJ integration (not a cross-cutting architectural pattern like the existing "Derived State via Relation Join" entry), so no generalization was warranted.
- [x] 12.5 **Correction to the original assumption**: `docs/api-spec.yml` DID need a change — it explicitly documents `SupplierIntegration`'s full response schema (confirmed live: the 3 new cursor fields already appear in real API responses per task 11.2's curl output). Added `catalogSyncCursorPage`/`catalogSyncTotalPages`/`catalogSyncWrappedAt` to the `SupplierIntegration` schema. Verified valid YAML.

## 13. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 13.1 Applied `ai-specs/skills/commit/SKILL.md` for each commit in this change.
- [x] 13.2 Verified all tasks above (0-12) are `[x]` and both reports (steps 10 and 11) exist under `openspec/changes/cj-catalog-cursor-and-media/reports/`.
- [x] 13.3 Staged only relevant files (code, tests, docs, OpenSpec artifacts) across all commits; no `.env`, `node_modules`, `dist`, or `coverage` staged.
- [x] 13.4 Created commits with Conventional Commit messages, referencing the change and verification status: `6962e46` (feat: cursor + media capture), `3ba183a` (fix: promote() transaction timeout, found during production verification), `07872d3` (fix: upsertMany() transaction timeout, found during production verification).
- [x] 13.5 Pushed `feature/cj-catalog-cursor-and-media` to remote across all 3 commits.
- [x] 13.6 Created 3 PRs to `develop` as issues were found iteratively during production verification: PR #92 (feat), PR #94 (promote() fix), PR #96 (upsertMany() fix) — all merged. Each followed by a release PR to `master`: PR #93, #95, #97 — all merged and deployed.
- [x] 13.7 PR URLs: https://github.com/Marcel-Carrillo/ProyectosIA/pull/92, /94, /96 (feature → develop) and /93, /95, /97 (develop → master release).
