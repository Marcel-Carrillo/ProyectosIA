## Workspace Isolation Summary

**Mode**: Feature branch
**Branch**: `feature/product-gtin-identifier`
**Isolation decision**: Per `ai-specs/skills/using-git-worktrees/SKILL.md`, a plain feature branch off `develop` is sufficient — this is a small/medium, additive change with no unrelated in-progress work requiring a separate worktree.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to confirm isolation mode (feature branch, not worktree) and detect current branch/working-tree state. Detected unrelated uncommitted `ProductPage.tsx` quick-fix on `develop`; user chose to commit it separately first (commit `69d56c7`).
- [x] 0.2 On `develop`; ran `git pull` — already up to date.
- [x] 0.3 Created and switched to `feature/product-gtin-identifier` from `develop` (`git checkout -b feature/product-gtin-identifier`).
- [x] 0.4 Verified with `git branch --show-current` → `feature/product-gtin-identifier`; working tree clean except untracked `openspec/changes/*` planning artifacts.

## 1. Backend: Prisma Schema and Migration

- [x] 1.1 Added `gtin String? @db.VarChar(14)` to the `Product` model in `backend/prisma/schema.prisma`.
- [x] 1.2 Generated and applied migration `20260703085541_add_product_gtin` (run from `backend/`, targeting `localhost:5432` per `backend/.env` since `prisma/` is not bind-mounted into the `ecommerce-backend` container).
- [x] 1.3 Verified `prisma/migrations/20260703085541_add_product_gtin/migration.sql` contains only `ALTER TABLE "Product" ADD COLUMN "gtin" VARCHAR(14);` — additive, nullable, no data loss.

## 2. Backend: Domain Model and Repository Contracts

- [x] 2.1 Added `gtin?: string | null` to the `Product` domain model in `backend/src/domain/models/product.ts` (property, constructor parameter, and assignment).
- [x] 2.2 Added `gtin?: string | null` to `ProductCreateData` and `ProductUpdateData` in `backend/src/domain/repositories/productRepository.ts`.

## 3. Backend: Repository Implementation

- [x] 3.1 Updated `create` in `backend/src/infrastructure/repositories/productRepository.ts` to persist `gtin: data.gtin ?? null`.
- [x] 3.2 Updated `update` in the same file to conditionally persist `gtin` (`...(data.gtin !== undefined && { gtin: data.gtin })`).

## 4. Backend: Validator (TDD)

- [x] 4.1 Added unit tests in the validator test suite for: valid 8/12/13/14-digit `gtin`, non-digit characters rejected, invalid length rejected, empty string normalizes to `null`, `gtin` omitted entirely is valid, whitespace trimming.
- [x] 4.2 Implemented `gtin` validation in `validateProductData` (`backend/src/application/validator.ts`) via a shared `validateAndNormalizeGtinField` helper: digits-only, length in {8,12,13,14}, empty string → `null`, throw `ValidationError` on invalid format/length. Exported `isValidGtinFormat(value: string): boolean` for reuse by the supplier feed mapper (§6).
- [x] 4.3 Ran the validator test suite (`npx jest src/application/validator.test.ts`) — 36/36 passed.
- [x] 4.4 **Scope decision applied**: added a scoped call to `validateAndNormalizeGtinField(data as Record<string, unknown>)` in `ProductService.update()` (`backend/src/application/services/productService.ts`), before the `translations` destructuring — validates/normalizes only `gtin` on the update path without enabling full `validateProductData` (no change to `name`/`status` behavior on update).
- [x] 4.5 Added unit tests in `productService.test.ts` covering `update()` rejecting an invalid-format `gtin` (`ValidationError`, `repo.update` not called) and normalizing an empty-string `gtin` to `null` before persisting. `npx jest src/application/services/__tests__/productService.test.ts` — 32/32 passed.

## 5. Backend: Public Serializer

- [x] 5.1 Added `gtin: string | null` to `PublicProductDTO` and to `serializePublicProduct` in `backend/src/presentation/serializers/publicProduct.ts`.
- [x] 5.2 Updated `publicProduct.test.ts`: added `gtin` to the fixture, the expected allow-list keys array, and two new tests (present / null).
- [x] 5.3 Ran the serializer test suite — 11/11 passed.

## 6. Backend: Supplier Feed Type and Mapper

- [x] 6.1 Added optional `ean?: string` to `SupplierFeedProduct` in `backend/src/infrastructure/external/supplierFeedTypes.ts`.
- [x] 6.2 Added unit tests in `mapSupplierFeedProduct.test.ts` for: valid EAN (8/12/13/14-digit) maps to `gtin`, missing EAN maps to `null`, invalid-format/length EAN maps to `null`, whitespace trimming.
- [x] 6.3 Implemented `normalizeGtin` in `mapSupplierFeedProduct.ts`, reusing `isValidGtinFormat` from the validator; maps to `null` on missing/invalid input, never throws, never fabricates.
- [x] 6.4 Ran `mapSupplierFeedProduct.test.ts` — 16/16 passed.

## 7. Backend: Supplier Feed Importer Propagation

- [x] 7.1 Propagated `gtin: mapped.gtin` in the product-create path of `backend/src/infrastructure/import/supplierFeedImporter.ts`.
- [x] 7.2 Propagated `gtin` in the update/upsert path (`upsertImportedProduct`'s update branch).
- [x] 7.3 Ran `supplierFeedImporter.test.ts` — 14/14 passed (extended create/update assertions + new missing-ean test).

## 8. Frontend: Types

- [x] 8.1 Added `gtin: string | null` to the `Product` interface in `frontend/src/types/product.ts`.
- [x] 8.2 Added `gtin?: string | null` to `CreateProductInput` and `UpdateProductInput` in the same file.

## 9. Frontend: Admin Product Form

- [x] 9.1 Added `gtin` to `FormData` and `EMPTY` in `frontend/src/components/admin/ProductFormModal.tsx`, mirroring the existing `brand` field.
- [x] 9.2 Added `gtin: formData.gtin || null` to the submit payload.
- [x] 9.3 Added a `Form.Group`/`Form.Control` input for `gtin` (`data-testid="input-product-gtin"`), placed after the `brand` field.
- [x] 9.4 Extended `ProductFormModal.test.tsx` with 3 new tests covering entering, submitting, and clearing a `gtin` value.
- [x] 9.5 Ran the `ProductFormModal` test suite — 6/6 passed.
- [x] 9.6 **Scope addition applied**: added `gtin` to `ProductDetailPage.tsx`'s local form state, load-from-product mapping, submit payload, and a new `Form.Group`/`Form.Control` input (`data-testid="input-gtin"`) mirroring the existing `brand` input.
- [x] 9.7 Added 3 new tests to `ProductDetailPage.test.tsx` (view/edit/clear `gtin`); added `gtin: null` to the `Product`-typed fixtures in `ProductDetailPage.test.tsx`, `ProductsPage.test.tsx`, and (found during a repo-wide `tsc --noEmit` check) `ProductCard.test.tsx`.
- [x] 9.8 Ran `ProductDetailPage.test.tsx` (9/9), `ProductsPage.test.tsx`, and `ProductCard.test.tsx` — all passed (17/17 combined for the latter two plus ProductDetailPage's own 9).

## 10. Frontend: Storefront Structured Data

- [x] 10.1 Added conditional emission of `gtin13` (13-digit values) or generic `gtin` (8/12/14-digit values) at the root of `productJsonLd` in `ProductPage.tsx`, omitted when `product.gtin` is `null`.
- [x] 10.2 Added a focused `describe('ProductPage structured data - gtin', ...)` block in `ProductPage.test.tsx` covering all 3 spec scenarios.
- [x] 10.3 Ran the `ProductPage` test suite — 4/4 passed.

## 11. Review and Update Existing Unit Tests (MANDATORY)

- [x] 11.1 Reviewed and updated all touched suites' fixtures/allow-lists (validator, `publicProduct` allow-list, mapper, importer, `ProductFormModal`, `ProductDetailPage`, `ProductsPage`, `ProductCard`, `ProductPage`).
- [x] 11.2 Confirmed via `npx tsc --noEmit` (clean) that no other `Product`-typed literal in the frontend breaks with the new required `gtin` field; `npm test -- --watchAll=false` — 44/44 suites, 202/202 tests passed backend-wide equivalent already run in §12 below.

## 12. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 12.1 Captured pre-test baseline via `psql`: 15 `Product` rows, `gtin` column present (post-migration), 0 non-null `gtin` values.
- [x] 12.2 Ran targeted backend tests: validator (36/36), `productService` (32/32, includes update-path gtin validation), `publicProduct` serializer (11/11), `mapSupplierFeedProduct` (16/16), `supplierFeedImporter` (14/14).
- [x] 12.3 Ran targeted frontend tests: `ProductFormModal` (6/6), `ProductPage` (4/4), `ProductDetailPage` (9/9), `ProductsPage` + `ProductCard` (8/8).
- [x] 12.4 Ran full backend (`npm test`) — 58/58 suites, 504/504 tests passed. Ran full frontend (`CI=true npx react-scripts test --watchAll=false`) — 44/44 suites, 202/202 tests passed. `npm run lint` (backend) and `npx eslint`/`tsc --noEmit` (frontend) all clean.
- [x] 12.5 Verified post-test database state: still 15 `Product` rows, 0 non-null `gtin` (unit tests mock Prisma, never touch the real DB). No restoration needed.
- [x] 12.6 Created report `openspec/changes/product-gtin-identifier/reports/2026-07-03-step-12-unit-test-and-db-verification.md`.

## 13. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 13.1 Started the backend server: rebuilt the `ecommerce-backend` Docker image (schema.prisma is baked in, not bind-mounted) and recreated the `backend_node_modules` volume to pick up the `gtin`-aware Prisma Client; verified up via `GET /api/public/products`.
- [x] 13.2 `POST /api/admin/products` with a valid 13-digit `gtin` — `201`, response includes `gtin`.
- [x] 13.3 `POST /api/admin/products` with non-digit and bad-length `gtin` — both `400` with the expected validation message.
- [x] 13.4 `PATCH /api/admin/products/:id` — valid `gtin` update `200`; invalid `gtin` update correctly rejected `400` (confirms task 4.4's scoped update validation works over real HTTP).
- [x] 13.5 `GET /api/public/products/:id` — confirmed `gtin` present when set (tested on an existing Active product, reverted to `null` afterward).
- [x] 13.6 Deleted the test-created product (soft delete via `DELETE /api/admin/products/:id`); verified active product count back to the 15-row baseline.
- [x] 13.7 Created report `openspec/changes/product-gtin-identifier/reports/2026-07-03-step-13-curl-endpoint-testing.md`.

## 14. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 14.1 Started frontend and backend: rebuilt+recreated the `ecommerce-frontend` image (static build, no src bind-mount) so it included this change's frontend edits; backend already up from §13.
- [x] 14.2 Created product "E2E GTIN Test Product" via the admin form with `gtin: 4006381333931`; confirmed it persists and displays correctly on the admin **edit** page (`ProductDetailPage.tsx`) after navigation.
- [x] 14.3 Activated the product (added an Active variant) and inspected its storefront PDP JSON-LD via Playwright `browser_evaluate` — confirmed `gtin13: "4006381333931"` present at the root of the `Product` block.
- [x] 14.4 Verified an existing product with no `gtin` (id 106) omits both `gtin` and `gtin13` entirely from its PDP JSON-LD.
- [x] 14.5 Deleted the E2E test product (soft delete); verified active product count back to the 15-row baseline with 0 non-null `gtin` among active products.
- [x] 14.6 Created report `openspec/changes/product-gtin-identifier/reports/2026-07-03-step-14-e2e-testing.md`.

## 15. Update Technical Documentation (MANDATORY)

- [x] 15.1 Updated `docs/data-model.md`: added `gtin` to the `Product` entity field list, validation rules, and ER diagram, including the product-level (not variant-level) scope decision.
- [x] 15.2 Updated `docs/api-spec.yml` **and** `backend/src/api-spec.yml` (the copy actually served by Swagger UI at `/api-docs` per `docs/backend-standards.md`): added `gtin` (nullable string, pattern `^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$`) to the `Product`, `PublicProduct`, and `CreateProductRequest` schemas (`UpdateProductRequest` inherits via `allOf`). Verified with `js-yaml` that `backend/src/api-spec.yml` parses successfully post-edit. Found and noted (not fixed, out of scope) a pre-existing YAML indentation error in `docs/api-spec.yml` at line 1133 that predates this change (confirmed present in `git show HEAD:docs/api-spec.yml`) — `docs/api-spec.yml` is a documentation-only copy, not the file Swagger UI serves.
- [x] 15.3 Documented what was updated and why in the PR description (see commit/PR body).

## 16. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 16.1 Loaded and applied `ai-specs/skills/commit/SKILL.md` before running any Git commands.
- [x] 16.2 Verified all tasks above are `[x]` and all 3 required reports exist under `openspec/changes/product-gtin-identifier/reports/`.
- [x] 16.3 Staged all relevant files (code, tests, docs, OpenSpec artifacts, `.claude/doc`+session context per repo precedent); explicitly excluded the sibling `openspec/changes/product-customer-reviews/` (separate, unrelated change).
- [x] 16.4 Created commit `8415e3d` with a Conventional Commit message referencing the OpenSpec change and test status.
- [x] 16.5 Pushed branch: `git push -u origin feature/product-gtin-identifier`.
- [x] 16.6 Created PR #64 with `gh pr create --base develop`.
- [x] 16.7 Reported the PR URL in chat: https://github.com/Marcel-Carrillo/ProyectosIA/pull/64
