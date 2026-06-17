# Tasks

> Structured per `docs/openspec-tasks-mandatory-steps.md` and `openspec/config.yaml` (`rules.tasks`).
> Test reports live in `openspec/changes/storefront-real-products/reports/`.

## 0. Setup: Create Feature Branch / Worktree (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md`; isolate in Git worktree `.worktrees/feature/storefront-real-products` on branch `feature/storefront-real-products` (main checkout `chore/free-ci-quality-gates` left clean). `.worktrees/` ignored.
- [x] 0.2 Install dependencies in the worktree: `npm ci` (backend), `npm ci --legacy-peer-deps` (frontend — pre-existing react@19 vs react-beautiful-dnd peer conflict).

## 1. EscuelaJS product import (verify existing importer)

- [x] 1.1 Start PostgreSQL (`docker compose` container `ecommerce-db`) and confirm `DATABASE_URL`/`PORT`; `prisma migrate status` = up to date.
- [x] 1.2 Run `npm run import:products` → `{ fetched: 40, imported: 25, skipped: 15 }` (imported > 0).
- [x] 1.3 Verify imported data: 25 products `Active`, each with 1 `Active` variant (`sku=EJS-*`, `stockPolicy=SupplierManaged`) and ordered images; 3 categories upserted (Electronics, Furniture, Shoes).
- [x] 1.4 Re-run `npm run import:products`; idempotent (counts unchanged 29/33/6/78; upsert by `slug`/`name`).
- [x] 1.5 Confirm `ESCUELAJS_IMPORT_LIMIT` bounds imported products (default 40).

## 2. Backend: public catalog serializer

- [x] 2.1 Create `backend/src/presentation/serializers/publicProduct.ts` — allow-list customer-safe DTO.
- [x] 2.2 Filter variants to `Active` only; order images by `sortOrder`.
- [x] 2.3 Never emit `supplierId`, `supplierReference`, `supplierCost`, `deletedAt`, or internal notes.
- [x] 2.4 Unit test asserting no supplier/internal fields in serialized output.

## 3. Backend: public product endpoints

- [x] 3.1 Create `publicProductController.ts` reusing `ProductService`; force `status=Active`; clamp `pageSize` ≤ 100.
- [x] 3.2 `listPublicProducts` (categoryId, search, page, pageSize, sort, order) → standard envelope.
- [x] 3.3 `getPublicProductById` by numeric `id`; `404` for missing/non-active, `400` for non-numeric.
- [x] 3.4 Create `routes/public/productRoutes.ts` (`GET /`, `GET /:id`).
- [x] 3.5 Create `routes/public/categoryRoutes.ts` (`GET /`) reusing category controller.
- [x] 3.6 Register `/api/public/products` and `/api/public/categories` in `index.ts` and `routes/index.ts`; admin untouched.

## 4. Frontend: consume public API only

- [x] 4.1 `productService.ts`: `getAll` → `/api/public/products`, `getById` → `/api/public/products/:id`.
- [x] 4.2 `categoryService.ts`: `getAll` → `/api/public/categories`.
- [x] 4.3 No runtime references to `api.escuelajs.co` or `/api/admin/...` for storefront data.

## 5. Review and Update Existing Unit Tests (MANDATORY)

- [x] 5.1 Review existing backend/front tests for impact; add public serializer, controller, and public categories route tests. No existing tests broken.

## 6. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 6.1 Capture pre-test DB baseline (Product 4 / Variant 8 / Category 3 / Image 4).
- [x] 6.2 Run targeted tests for changed modules (14 passed).
- [x] 6.3 Run full suites: backend 143/143, frontend 19/19; tsc + lint clean.
- [x] 6.4 Verify post-import DB state and idempotency (29/33/6/78, no duplicates).
- [x] 6.5 Report: `reports/2026-06-17-step-N+1-unit-test-and-db-verification.md`.

## 7. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 7.1 Backend server running on :3000.
- [x] 7.2 GET list/detail/categories verified (200; envelope; only Active; images ordered).
- [x] 7.3 `status` ignored (forced Active); `pageSize` clamped to 100; search + sort + categoryId filter work.
- [x] 7.4 Error cases: 404 (PRODUCT_NOT_FOUND), 400 (VALIDATION_ERROR).
- [x] 7.5 Security: no `supplierId/supplierReference/supplierCost/deletedAt` in any public payload.
- [x] 7.6 Read-only endpoints — no DB mutation, no restoration needed.
- [x] 7.7 Report: `reports/2026-06-17-step-N+2-curl-endpoint-testing.md`.

## 8. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 8.1 Frontend (:3001) + backend (:3000) running with imported catalog.
- [x] 8.2 `/catalog` renders real products (images, names, EUR prices, pagination).
- [x] 8.3 Category filter (Electronics → 10 products) and product detail (`/catalog/5`) work.
- [x] 8.4 Network: only `/api/public/*`; zero `api.escuelajs.co` and zero `/api/admin/*`; 0 console errors.
- [x] 8.5 Browser session closed; no test data created (read-only browsing).
- [x] 8.6 Report: `reports/2026-06-17-step-N+3-e2e-testing.md`.

## 9. Update Technical Documentation (MANDATORY)

- [x] 9.1 Update `docs/api-spec.yml` with `/api/public/products`, `/api/public/products/{id}`, `/api/public/categories` + `PublicProduct*` schemas.
- [x] 9.2 No `docs/data-model.md` change (no schema change).

## 10. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 10.1 Load and apply `ai-specs/skills/commit/SKILL.md`.
- [x] 10.2 Verify all tasks complete and reports exist.
- [x] 10.3 Stage relevant files (`.env` ignored; no node_modules/dist/coverage).
- [x] 10.4 Create commit with Conventional Commit message (`c21c00f`).
- [x] 10.5 Push `feature/storefront-real-products` to origin.
- [x] 10.6 PR created: https://github.com/Marcel-Carrillo/ProyectosIA/pull/12
