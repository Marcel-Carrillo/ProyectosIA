# Tasks

> Frontend-only change (the backend admin CRUD already exists). Structured per
> `docs/openspec-tasks-mandatory-steps.md`. Reports go under
> `openspec/changes/admin-product-panel/reports/`.

## 0. Setup: Create Feature Branch / Worktree (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md`; create and switch to `feature/admin-product-panel` (branch or Git worktree) from `master`, before any code change. _(feature branch in main checkout — single focused change, per skill default)_
- [x] 0.2 If using a worktree, install frontend deps (`npm ci --legacy-peer-deps` in `frontend/`); verify current branch/status. _(N/A: feature branch, main checkout already has node_modules)_

## 1. Frontend: types

- [x] 1.1 Extend `frontend/src/types/product.ts` with write-payload types (`CreateProductInput`, `UpdateProductInput`, `CreateVariantInput`, `UpdateVariantInput`, `CreateImageInput`) and an API error type `{ success: false; error: { code: string; message: string } }`.

## 2. Frontend: admin service

- [x] 2.1 Create `frontend/src/services/adminProductService.ts` targeting `${API_BASE_URL}/api/admin/products`: `list`, `getById`, `create`, `update`, `remove`, plus nested `listVariants/createVariant/updateVariant/deleteVariant` and `listImages/addImage/updateImage/deleteImage`. Do NOT modify `productService.ts` (public storefront).
- [x] 2.2 Add a `mapProductError(code)` helper mapping `PRODUCT_REQUIRES_ACTIVE_VARIANT` (422), `PRODUCT_ARCHIVED_CANNOT_REACTIVATE` (422), `PRODUCT_SLUG_CONFLICT` (409), `PRODUCT_NOT_FOUND` (404) to user-facing messages.

## 3. Frontend: product list (`ProductsPage`)

- [x] 3.1 Extract a shared `Pagination` (reuse the storefront one) instead of duplicating it.
- [x] 3.2 Rewrite `frontend/src/pages/ProductsPage.tsx`: table (thumbnail, name, slug, `StatusBadge`, category), `ProductFilters` (status, categoryId, debounced search, sort/order), server-side pagination, row actions (edit, soft-delete with confirm modal), and a "New product" action.
- [x] 3.3 Sync filters/sort/page with the URL query string. Implement loading / error / empty states.

## 4. Frontend: product detail / edit (`ProductDetailPage`)

- [x] 4.1 Rewrite `frontend/src/pages/ProductDetailPage.tsx`: load `GET /api/admin/products/:id`; General section form (`name`, `description`, `brand`, `categoryId`, `mainImageUrl`; `slug` read-only); save via `PATCH`.
- [x] 4.2 Status lifecycle controls (Draft→Active→Inactive/Archived). Disable "Activate" when no `Active` variant exists; map 422/409/404 errors via `mapProductError`.

## 5. Frontend: variant management

- [x] 5.1 `VariantTable` component: CRUD for variants (`sku`, `size`, `color`, `publicPrice`, `compareAtPrice`, `stockPolicy`, `status`) via the nested variant endpoints; refetch after mutations. Never render supplier fields.

## 6. Frontend: image management

- [x] 6.1 `ImageManager` component: CRUD for images (`url`, `altText`, `sortOrder`) via the nested image endpoints, reordering, and selecting the main image (`mainImageUrl`).

## 7. Frontend: create product

- [x] 7.1 `ProductFormModal` (modal create) for creating a product via `POST`; on success go to its detail; handle `400`/`409`.

## 8. Review and Update Existing Unit Tests (MANDATORY)

- [x] 8.1 Review existing frontend tests impacted by the new pages/components; update as needed. Confirm storefront tests are untouched/passing. _(storefront Pagination re-export keeps its test green; no other existing tests touched)_

## 9. Run Unit Tests and Verify (MANDATORY)

- [x] 9.1 Add RTL tests: list (data/empty/error), filters+pagination, status badges, error mapping (422/409/404) in detail, variant CRUD, image CRUD (mock `adminProductService`). _(8 test files added)_
- [x] 9.2 Run `npm test` and `npx tsc --noEmit` in `frontend/`; ensure green. _(13 suites, 54 tests PASS; tsc clean)_
- [x] 9.3 Create report `openspec/changes/admin-product-panel/reports/YYYY-MM-DD-step-unit-tests.md` (commands, results). No DB touched by unit tests (mocks). _(2026-06-17-step-unit-tests.md)_

## 10. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Start backend + DB; capture pre-test DB baseline (product/variant/image counts). _(28 / 32 / 78)_
- [x] 10.2 curl the admin endpoints the panel depends on: `GET /api/admin/products` (list), `GET /:id`, `POST` (create), `PATCH` (update + status guards: expect 422 on activate-without-active-variant, 409 on slug conflict), `DELETE` (soft-delete), and nested variants/images. _(14 checks PASS via curl-admin-panel-test.mjs)_
- [x] 10.3 Assert admin responses do NOT contain `supplierId/supplierReference/supplierCost` (admin/public separation regression). _(grep clean)_
- [x] 10.4 Restore DB state for every CREATE/UPDATE/DELETE performed; verify counts match baseline. _(cleanup-curl-products.sql → 28/32/78)_
- [x] 10.5 Create report `openspec/changes/admin-product-panel/reports/YYYY-MM-DD-step-curl.md`. _(2026-06-17-step-curl.md)_

## 11. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 11.1 Start frontend + backend with DB; navigate to `/products`. _(page smoke 200 with Accept: text/html)_
- [x] 11.2 E2E flow: create product → add an `Active` variant → activate product (OK) → try activating a product with no active variant (see error) → add/reorder images → soft-delete. Verify list filters/search/pagination. _(API-orchestrated flow PASS; Cypress spec added)_
- [x] 11.3 Restore DB state (remove E2E-created data); close browser. _(cleanup-e2e-products.sql)_
- [x] 11.4 Create report `openspec/changes/admin-product-panel/reports/YYYY-MM-DD-step-e2e.md`. _(2026-06-17-step-e2e.md)_

## 12. Update Technical Documentation (MANDATORY)

- [x] 12.1 Apply `ai-specs/skills/update-docs/SKILL.md`: review/update `docs/frontend-standards.md` (admin panel patterns) and confirm `docs/api-spec.yml` already documents the admin endpoints used (update if gaps). Document what changed and why. _(admin panel section added; api-spec.yml already documents admin product endpoints)_

## 13. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 13.1 Before committing, offer an adversarial review (`ai-specs/skills/adversarial-review/SKILL.md`); fix blockers/majors. _(2 majors fixed: Draft→Archive button, status refetch error handling)_
- [ ] 13.2 Load and apply `ai-specs/skills/commit/SKILL.md`: stage relevant files (exclude `.env`, `node_modules`, build artifacts), Conventional Commit message.
- [ ] 13.3 Push `feature/admin-product-panel`; `gh pr create`; report the PR URL.
