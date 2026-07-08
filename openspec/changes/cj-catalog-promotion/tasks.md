## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide workspace isolation: check current branch, `git status`, and `git worktree list`. If the workspace is clean and no unrelated work is present, use a normal feature branch in the current checkout (no worktree needed); otherwise ask the user before creating a worktree.
- [x] 0.2 Ensure current branch is `develop` and up to date (`git fetch origin && git checkout develop && git pull`) if not already there.
- [x] 0.3 Create and switch to feature branch `feature/cj-catalog-promotion` from `develop`.
- [x] 0.4 Verify branch creation with `git branch --show-current` and report clean starting state.

## 1. Prisma Schema: Link ProductVariant to CjCatalogItem

- [x] 1.1 Add `cjCatalogItemId Int? @unique` to `ProductVariant` in `backend/prisma/schema.prisma`, with a relation to `CjCatalogItem` and the inverse `promotedVariant ProductVariant?` field on `CjCatalogItem`.
- [x] 1.2 Generate and apply the migration (`prisma migrate dev` if an interactive TTY is available locally; otherwise `migrate diff` + manual migration file + `migrate deploy`, confirming the column is nullable+unique and additive-only, no backfill needed since both databases were cleared of products). Verify with `prisma migrate status`.
- [x] 1.3 Run `npx prisma generate` and verify `prisma.productVariant.cjCatalogItemId` and `prisma.cjCatalogItem.promotedVariant` are queryable via a quick ad-hoc script or `npx ts-node` snippet.

## 2. Domain Layer: ProductVariant Model

- [x] 2.1 Add `cjCatalogItemId: number | null` to `backend/src/domain/models/productVariant.ts`.
- [x] 2.2 Add new domain error classes in `backend/src/application/validator.ts`: `CjCatalogItemNotPromotedError` (422, `CJ_CATALOG_ITEM_NOT_PROMOTED`), `CjPromotionPriceRequiredError` (422, `CJ_PROMOTION_PRICE_REQUIRED`), `CjPromotionCategoryRequiredError` (422, `CJ_PROMOTION_CATEGORY_REQUIRED`), `CjCatalogItemSyncFailedCannotPromoteError` (422, `CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE`). Reuse the existing `CjItemNotMappedError`-style pattern already in the file. Note: `CJ_CATALOG_ITEM_ALREADY_PROMOTED` from the proposal is handled as an idempotent 200 (see task 5.2), not an error class. Also added `CjCatalogItemNotFoundError` (422, `CJ_CATALOG_ITEM_NOT_FOUND`) and the aggregate `CjPromotionValidationError` (422, `CJ_PROMOTION_VALIDATION_FAILED`, carries `itemErrors[]`) plus `validateCjPromotionData` — both real gaps identified by the backend planning pass (spec.md requires a per-item error list and an "unknown id" error code that tasks.md's original four-error list didn't name).
- [x] 2.3 Add `CJ_DEFAULT_MARKUP_MULTIPLIER` to `backend/.env.example`, `backend/.env.docker`, and `backend/.env` with a documented default (`2.5`), read via `process.env` in the promotion service (task 5).

## 3. Domain Repositories: Promotion State and Linking

- [x] 3.1 Extend `backend/src/domain/repositories/cjCatalogItemRepository.ts` (`ICjCatalogItemRepository`): add `promotionState`, `promotionState` filter to `CjCatalogItemListFilters`, add `productId`/`productVariantId` to the list result item. Also added `findById`/`findManyByIds` (real gap flagged by planning — the promote endpoint addresses items by PK, no method existed for that) and changed `CjCatalogItemListResult.items` to `CjCatalogItemListItem[]` (a breaking shape change propagated to the serializer/controller in group 6).
- [x] 3.2 Extend `IProductVariantRepository` (actually in `backend/src/domain/repositories/productRepository.ts`, not a separate `productVariantRepository.ts` file) with `findByCjCatalogItemId(cjCatalogItemId: number)`. Added `cjCatalogItemId?: number | null` to `ProductVariantCreateData` (real gap — it did not exist); deliberately NOT added to `ProductVariantUpdateData` per design decision 4 (the link is never modified after creation).

## 4. Infrastructure: Repository Implementations

- [x] 4.1 Update `backend/src/infrastructure/repositories/cjCatalogItemRepository.ts`'s `findBySupplierIntegrationId` to left-join `ProductVariant` on `cjCatalogItemId` and derive `promotionState` (`NotPromoted` | `Active` | `Inactive`) plus `productId`/`productVariantId` per item; support the new `promotionState` filter. Implemented via a Prisma relation `where` clause (`promotedVariant: null | { is: { status: ... } }`) applied identically to both `findMany` and `count`, so `total` stays correct under the filter (not a post-query JS filter, which would have broken pagination). Verified: `npx tsc --noEmit` passes.
- [x] 4.2 Update `backend/src/infrastructure/repositories/productVariantRepository.ts`: `cjCatalogItemId` deliberately NOT added to the internal-only `variantSelect` omission list (that omission is the point — documented with a comment); implemented `findByCjCatalogItemId`; `create` accepts and persists `cjCatalogItemId`.
- [x] 4.3 Extended `backend/src/infrastructure/repositories/__tests__/cjCatalogItemRepository.test.ts` (+11 cases: promotionState derivation ×3, where-clause filter ×3, findById ×2, findManyByIds ×2, plus fixing 2 pre-existing assertions for the new `{item, promotionState, ...}` shape) and `backend/src/infrastructure/repositories/__tests__/productVariantRepository.test.ts` (+4 cases: findByCjCatalogItemId found/not-found, create persists link, create defaults to null). Verified: `npx jest src/infrastructure/repositories/__tests__/cjCatalogItemRepository.test.ts src/infrastructure/repositories/__tests__/productVariantRepository.test.ts --watchAll=false` → 15/15 and 8/8 passed.

## 5. Application: CJ Catalog Promotion Service

- [x] 5.1 Add `backend/src/application/services/cjCatalogPromotionService.ts` implementing `promote`/`activate`/`deactivate` per design.md. Real-code gaps resolved during implementation (see backend planning doc): `ProductService.resolveUniqueSlug` made `public`; `activate()` updates the variant to `Active` before calling `ProductService.update()` so the `PRODUCT_REQUIRES_ACTIVE_VARIANT` guard (actually enforced in `ProductService.update()`, not `ProductRepository`) passes; the transaction bypasses repositories and uses raw `tx.product.create`/`tx.productVariant.create` (mirroring `checkoutService.createOrder`'s only precedent for multi-entity atomic writes, since repositories use the non-tx `prisma` singleton). Mixed pid-groups (some items already promoted, some new) join the existing product rather than forking a new one. Verified: `npx tsc --noEmit` passes.
- [x] 5.2 Re-promotion of an already-linked item resolves to the existing variant (`wasAlreadyPromoted: true`, no DB write) and `PromoteResult.createdAny` distinguishes all-idempotent (`200`) from at-least-one-created (`201`) — implemented in `promote()` and the controller (task 6.3).
- [x] 5.3 Added `backend/src/application/services/__tests__/cjCatalogPromotionService.test.ts` (14 cases, all listed scenarios plus the mixed-group edge case from §5.1). Verified: `npx jest src/application/services/__tests__/cjCatalogPromotionService.test.ts --watchAll=false` → 14/14 passed.

## 6. Presentation: Extend Catalog Listing, Add Promotion Endpoints

- [x] 6.1 Extend `backend/src/presentation/serializers/cjCatalogItemSerializer.ts` to include `promotionState`, `productId`, `productVariantId` in the allow-list, keeping the existing omissions. Signature changed from `(item: CjCatalogItem)` to `(entry: CjCatalogItemListItem)` to match the repository's new return shape (group 3/4).
- [x] 6.2 Update `backend/src/presentation/controllers/cjCatalogSyncController.ts`'s `listCatalog` handler to accept, validate, and pass through the new `promotionState` query filter.
- [x] 6.3 Add `backend/src/presentation/controllers/cjCatalogPromotionController.ts` with `promote`, `activate`, `deactivate` handlers wired to `CjCatalogPromotionService`, using `validateCjPromotionData` from `backend/src/application/validator.ts`.
- [x] 6.4 Add routes in `backend/src/routes/admin/cjRoutes.ts`: `POST /catalog/promote`, `POST /catalog/:cjCatalogItemId/activate`, `POST /catalog/:cjCatalogItemId/deactivate`, with a `cjPromoteLimiter` mirroring `cjVerifyLimiter`.
- [x] 6.5 Update `backend/src/middleware/errorHandler.ts` with mappings for all 6 new error codes (the 4 from task 2.2 plus `CJ_CATALOG_ITEM_NOT_FOUND` and `CJ_PROMOTION_VALIDATION_FAILED`, the latter special-cased to include `itemErrors` in the response body).
- [x] 6.6 Extended `cjCatalogSyncController.test.ts` (+3 cases, 9/9 pass), added `cjCatalogPromotionController.test.ts` (9 cases, 9/9 pass), extended `backend/src/routes/public/__tests__/cjIsolation.test.ts` (+6 cases including a real public-product-detail response check confirming `cjCatalogItemId` never leaks even though it's now a real field on the domain `ProductVariant` model — 17/17 pass). Confirmed the leak protection is the public serializer's explicit allow-list (`serializePublicProduct`/`serializeVariant` in `presentation/serializers/publicProduct.ts`), independent of the admin-side `variantSelect` DB-select omission.

## 7. Frontend: CJ Catalog Admin Page

- [x] 7.1 Add `frontend/src/types/cjCatalog.ts` with DTOs matching the extended `GET .../cj/catalog` response (`promotionState`, `productId`, `productVariantId`) and the promote request/response shapes.
- [x] 7.2 Add `frontend/src/services/cjCatalogService.ts` following the `supplierService.ts` pattern: `listCatalog(supplierId, filters)`, `promote(supplierId, payload)`, `activate(supplierId, cjCatalogItemId)`, `deactivate(supplierId, cjCatalogItemId)`, with error-code mapping for the new `CJ_*` codes.
- [x] 7.3 Add `frontend/src/pages/CjCatalogPage.tsx` (placed alongside `SuppliersPage.tsx`/`ProductsPage.tsx` etc. under `pages/` directly, not `pages/admin/` — matches the actual precedent of every other admin list page; only `AdminLoginPage.tsx` lives in `pages/admin/`): paginated table of the full CJ catalog with a `promotionState` badge, `syncStatus` badge (disabling selection for `Failed` items), row and page-level multi-select checkboxes, per-row activate/deactivate action, and a "Promote selected" bulk action.
- [x] 7.4 Add `frontend/src/components/admin/CjPromoteModal.tsx`: category selector (categories passed down from `CjCatalogPage`, mirroring how `ProductsPage` passes `categories` into `ProductFormModal` rather than each modal fetching its own), optional per-item `publicPrice`/`compareAtPrice` override, submit calling `cjCatalogService.promote`. Deliberately does not use `useTranslation` (unlike `ProductFormModal.tsx`, which the plan flagged as a pre-existing violation of `docs/frontend-standards.md`'s "admin components must never call `useTranslation`" rule — not replicated here).
- [x] 7.5 Wired the route in `frontend/src/App.tsx` (`suppliers/:supplierId/cj-catalog`, inside the existing `RequireAdminAuth` parent route) and added a "CJ Catalog" entry point per supplier row in `SuppliersPage.tsx` (desktop table + mobile card).
- [x] 7.6 Added `frontend/src/services/__tests__/cjCatalogService.test.ts` (20 cases) and `frontend/src/pages/__tests__/CjCatalogPage.test.tsx` (15 cases, scoping the dual mobile-card/desktop-table render with `within()` per the existing `ProductsPage.test.tsx` convention). Verified: `CI=true npx react-scripts test src/services/__tests__/cjCatalogService.test.ts src/pages/__tests__/CjCatalogPage.test.tsx --watchAll=false` → 20/20 and 15/15 passed; `npx eslint ... --ext .ts,.tsx` clean on all new/changed frontend files.

## 8. Review and Update Existing Unit Tests (MANDATORY)

- [x] 8.1 Reviewed and fixed real breakages from the interface changes (found by running the full suite, not assumed): `productService.test.ts` and `productVariantService.test.ts` needed `findByCjCatalogItemId: jest.fn()` added to their `jest.Mocked<IProductVariantRepository>` fixtures (TS compile errors otherwise — `productRepository.test.ts` as named in the task doesn't exist as a standalone file; `productController.test.ts` required no changes).
- [x] 8.2 `cjCatalogSyncService.test.ts` needed `findById`/`findManyByIds` added to its `jest.Mocked<ICjCatalogItemRepository>` fixture. Also found and fixed two more real regressions the task list didn't name: `cjOrderPushService.test.ts` (same missing mock methods) and `cjCatalogItemSerializer.test.ts` (call sites needed updating to the new `{ item, promotionState, productId, productVariantId }` argument shape — added a third case for the promoted path). `cjConnectionService.test.ts` reviewed, no changes needed.
- [x] 8.3 No shared test builders exist for `ProductVariant`/`CjCatalogItem` in this codebase (each test file constructs its own fixtures inline) — updated the inline fixtures above instead. Verified by running the full suite: `npx jest --watchAll=false` → 79/79 suites, 748/748 tests passed; `npm run lint` clean.

## 9. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 9.1 Captured pre-test database baseline: `Product: 12, ProductVariant: 24, CjCatalogItem: 0, Category: 28` (local dev DB).
- [x] 9.2 Ran targeted unit tests (CJ-related, backend + frontend): 72 backend + 35 frontend cases, all passed.
- [x] 9.3 Ran the full backend suite: `npx jest --watchAll=false` → 79/79 suites, 748/748 tests passed; `npm run lint` clean.
- [x] 9.4 Ran the full frontend suite: `CI=true npx react-scripts test --watchAll=false` → 50/50 suites, 268/268 tests passed; `npx eslint src --ext .ts,.tsx` clean; `npx tsc --noEmit` clean on both.
- [x] 9.5 Verified post-test database state matches the baseline exactly (all mocked, no real DB/HTTP calls in unit tests) — no restoration needed.
- [x] 9.6 Created report `openspec/changes/cj-catalog-promotion/reports/2026-07-08-step-9-unit-test-and-db-verification.md`.
- [x] 9.7 All tests pass and the report exists.

## 10. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Ran against the real CJ Dropshipping API (dedicated test supplier id 45, connection verified `healthy: true`). Found and fixed a real, pre-existing blocking bug in `cjCatalogSyncService.ts`: `product.sellPrice.toFixed(2)` assumed a `number`, but the live API returns it as a numeric string on some entries — caused 100% item failure. Fixed with a `Number()` coercion + `Number.isFinite` guard (regression test added). See the full report for details.
- [x] 10.2 Verified `200` with every item `promotionState: "NotPromoted"`, `productId: null`, `productVariantId: null` before promotion.
- [x] 10.3 Verified `201` for a single-item promote with explicit `publicPrice`; correct `productId`/`productVariantId`. Also found and fixed a real design gap: `promotionState` was derived from variant status alone, misreporting Draft-product promotions as `"Active"` — fixed to require both variant AND parent `Product` to be `Active` (spec + implementation + tests updated).
- [x] 10.4 Verified: 4 real items sharing the same CJ `pid` promoted into a single `Product` with 4 linked `ProductVariant`s.
- [x] 10.5 Verified: re-promoting an already-linked item returns `200`, `createdAny: false`, `wasAlreadyPromoted: true`, no duplicate rows.
- [x] 10.6 Verified activate → public product visible (`status: Active`, variant `Active`, no supplier/CJ fields leaked); deactivate → product stays `Active` but `variants: []` publicly (existing `ProductRepository` behavior, confirmed live); reactivate reuses the same linked variant.
- [x] 10.7 Verified: missing `categoryId` → 422 `CJ_PROMOTION_CATEGORY_REQUIRED`; unknown `cjCatalogItemId` → 422 `CJ_PROMOTION_VALIDATION_FAILED` with `itemErrors`; activate on non-promoted item → 422 `CJ_CATALOG_ITEM_NOT_PROMOTED`. `CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE` not exercised live (no real `Failed` rows remained after the sellPrice fix — a positive side effect); covered instead by `cjCatalogPromotionService.test.ts`.
- [x] 10.8 Confirmed via live `GET /api/public/products/:id` on a promoted product: no `cjCatalogItemId`, `supplierCost`, `supplierId`, or `supplierReference` in the response.
- [x] 10.9 Restored database state: deleted all test-created `Product`/`ProductVariant`/`CjCatalogItem`/`SupplierIntegration`/`Supplier` rows in one transaction; verified counts match the task 9.1 baseline exactly (`Product: 12, ProductVariant: 24, CjCatalogItem: 0, Supplier: 16`). Reverted the temporary `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE` env overrides used for cheap re-testing.
- [x] 10.10 Created report `openspec/changes/cj-catalog-promotion/reports/2026-07-08-step-10-curl-endpoint-testing.md`.

## 11. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 11.1 Started backend+frontend via Docker Compose. Found and fixed a real blocking issue: the `frontend` service has no `src` bind mount (unlike `backend`), so the running image predated this change's new files and 404'd — rebuilt (`docker compose build frontend` + `up -d --force-recreate`). Set up a dedicated test supplier with a real synced CJ catalog (19 items).
- [x] 11.2 Navigated to `/suppliers/:id/cj-catalog` via Playwright MCP; confirmed via the app's own "CJ Catalog" link on `/suppliers` (correct `href` per row); snapshot confirmed all 19 real items listed with `NotPromoted` badges.
- [x] 11.3 Selected 2 of 3 items sharing the same CJ product; promote modal showed only those 2; chose category + "Activate immediately"; submitted — both rows updated to `Active` with a working `/products/124` link; the un-selected third sibling stayed `NotPromoted`.
- [x] 11.4 Deactivated one of the two promoted rows — badge updated to `Inactive`; verified via an in-browser `fetch()` to `GET /api/public/products/124` that the product stays `200`/`Active` but the deactivated variant is excluded from the public `variants` array (only 1 of 2 remained).
- [x] 11.5 Reactivated the same item — badge returned to `Active`, reusing the same linked `productId`/`productVariantId` (no duplicate).
- [x] 11.6 Submitted the promote modal without selecting a category — modal stayed open, showed "Select a category before promoting." (client-side, no API call).
- [x] 11.7 Restored test environment: deleted the test `Product`/`ProductVariant`/`CjCatalogItem`/`SupplierIntegration`/`Supplier`; reverted the temporary sync-page-size env overrides; verified DB state matches the pre-test baseline exactly.
- [x] 11.8 Created report `openspec/changes/cj-catalog-promotion/reports/2026-07-08-step-11-e2e-testing.md` plus a screenshot (`cj-catalog-page-final-state.png`) in the same reports folder.

## 12. Update Technical Documentation (MANDATORY)

- [x] 12.1 Updated `docs/data-model.md`: added `ProductVariant.cjCatalogItemId` (internal-only, nullable+unique FK, `ON DELETE SET NULL`), documented the derived `promotionState` concept (including the product+variant dual-check correctness note), updated the ERD (mermaid diagram + `promoted_to` relationship), and noted the public catalog is now expected to be populated exclusively via CJ promotion.
- [x] 12.2 Updated `docs/api-spec.yml`: extended `CjCatalogItem`/`GET .../cj/catalog` with `promotionState`/`productId`/`productVariantId` and the `promotionState` query param; added the three new endpoints (`promote`, `activate`, `deactivate`) with full request/response/error schemas including `CjPromotionValidationErrorResponse`'s per-item `itemErrors`. Verified valid YAML (`js-yaml` parse, 78 paths / 123 schemas). Note: `backend/src/api-spec.yml` (the Swagger-UI-served runtime copy) was intentionally left untouched, matching the established precedent from the prior `cj-dropshipping-integration` change, which also only updated `docs/api-spec.yml`.
- [x] 12.3 Updated `docs/development_guide.md`: added `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE`/`CJ_DEFAULT_MARKUP_MULTIPLIER` to the env table, a promote→activate/deactivate workflow note, and a note about the `frontend` Docker service's missing `src` bind mount (a real gap discovered during Step 11 E2E testing).
- [x] 12.4 Added a short "Derived State via Relation Join" pattern section to `docs/backend-standards.md`, generalizing the two real correctness lessons from this change (same `where` for count+findMany; derive from every dependent field, not just the nearest hop). No `docs/frontend-standards.md` changes needed — no new reusable frontend pattern introduced beyond what mirrors existing admin page/modal conventions.
- [x] 12.5 Documented in this response (see summary).

## 13. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 13.1 Loaded and applied `ai-specs/skills/commit/SKILL.md` before executing any Git commands.
- [x] 13.2 Verified all tasks above (1–12) are `[x]`; all 3 reports exist under `openspec/changes/cj-catalog-promotion/reports/` (steps 9, 10, 11) plus the E2E screenshot.
- [x] 13.3 Staged all relevant files; confirmed no `.env`/`.env.docker` staged (both correctly gitignored).
- [x] 13.4 Created commit `46ab753` with Conventional Commit message, OpenSpec change name, and test verification status.
- [x] 13.5 Pushed branch to remote: `git push -u origin feature/cj-catalog-promotion`.
- [x] 13.6 Created Pull Request #81 (`gh pr create --base develop`) with summary, OpenSpec change name, verification status, and known limitations.
- [x] 13.7 Reported the PR URL in chat: https://github.com/Marcel-Carrillo/ProyectosIA/pull/81
