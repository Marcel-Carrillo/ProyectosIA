## 0. Setup: Workspace Isolation and Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to verify isolation strategy
- [x] 0.2 Verify currently on `feature/product-catalog-management` branch (branch already exists — confirm with `git branch --show-current`)
- [x] 0.3 Confirm working tree is clean before starting implementation (`git status`)

## 1. Database: Prisma Migration

- [x] 1.1 Ensure Docker / PostgreSQL is running locally
- [x] 1.2 Run migration from `backend/`: `npx prisma migrate dev --name add-product-catalog`
- [x] 1.3 Verify migration file created under `backend/prisma/migrations/`
- [x] 1.4 Run `npx prisma generate` to update the Prisma client

## 2. Backend: Verify and Finalize WIP Domain and Infrastructure Layers

- [x] 2.1 Read `backend/src/domain/models/product.ts`, `productVariant.ts`, `productImage.ts` — confirm all fields match `## Enhanced` spec fields; fix any gaps
- [x] 2.2 Read `backend/src/domain/repositories/productRepository.ts` — confirm `IProductRepository`, `IProductVariantRepository`, `IProductImageRepository` interfaces are complete including `countActiveByProduct`
- [x] 2.3 Read `backend/src/infrastructure/repositories/productRepository.ts` — confirm `generateSlug`, slug collision retry (5 attempts), all error classes exported (`ProductNotFoundError`, `ProductSlugConflictError`, `ProductRequiresActiveVariantError`, `ProductArchivedCannotReactivateError`)
- [x] 2.4 Read `backend/src/infrastructure/repositories/productVariantRepository.ts` — confirm `variantSelect` constant excludes `supplierId`, `supplierReference`, `supplierCost` on ALL read operations (findMany, findFirst, findUnique, update, create); fix any gaps
- [x] 2.5 Read `backend/src/infrastructure/repositories/productImageRepository.ts` — confirm hard-delete via `prisma.productImage.delete` and `ImageNotFoundError`
- [x] 2.6 Read `backend/src/application/services/productService.ts` — confirm status lifecycle validation (Archived cannot reactivate, Active requires countActiveByProduct > 0), slug generation wired
- [x] 2.7 Read `backend/src/application/services/productVariantService.ts` — confirm product ownership validation, `compareAtPrice > publicPrice` enforcement
- [x] 2.8 Read `backend/src/application/services/productImageService.ts` — confirm product existence check before all operations
- [x] 2.9 Ensure all WIP files compile with `npx tsc --noEmit` from `backend/`

## 3. Backend: Product Controller

- [x] 3.1 Create `backend/src/presentation/controllers/productController.ts`
- [x] 3.2 Implement `listProducts(req, res, next)` — extract query params (`status`, `categoryId`, `search`, `page`, `pageSize` default 20), call `productService.listProducts`, return `200` envelope
- [x] 3.3 Implement `getProductById(req, res, next)` — extract `:id`, call `productService.getProductById`, return `200` or pass error to `next`
- [x] 3.4 Implement `createProduct(req, res, next)` — extract body, call `productService.createProduct`, return `201` envelope
- [x] 3.5 Implement `updateProduct(req, res, next)` — extract `:id` + body, call `productService.updateProduct`, return `200` or pass error to `next`
- [x] 3.6 Implement `deleteProduct(req, res, next)` — extract `:id`, call `productService.deleteProduct`, return `204` or pass error to `next`
- [x] 3.7 Controllers must be thin: no business logic, all errors forwarded via `next(err)`, structured logging via `logger` on each action

## 4. Backend: ProductVariant Controller

- [x] 4.1 Create `backend/src/presentation/controllers/productVariantController.ts`
- [x] 4.2 Implement `listVariants(req, res, next)` — extract `:id` (productId) from params, call `variantService.listVariants(productId)`, return `200` envelope
- [x] 4.3 Implement `getVariantById(req, res, next)` — extract `:id` + `:variantId`, call `variantService.getVariantById`, return `200`
- [x] 4.4 Implement `createVariant(req, res, next)` — extract `:id` + body, call `variantService.createVariant`, return `201`
- [x] 4.5 Implement `updateVariant(req, res, next)` — extract `:id` + `:variantId` + body, call `variantService.updateVariant`, return `200`
- [x] 4.6 Implement `deleteVariant(req, res, next)` — extract `:id` + `:variantId`, call `variantService.deleteVariant`, return `204`

## 5. Backend: ProductImage Controller

- [x] 5.1 Create `backend/src/presentation/controllers/productImageController.ts`
- [x] 5.2 Implement `listImages(req, res, next)` — extract `:id` (productId), call `imageService.listImages(productId)`, return `200` envelope (ordered by `sortOrder`)
- [x] 5.3 Implement `addImage(req, res, next)` — extract `:id` + body, call `imageService.addImage`, return `201`
- [x] 5.4 Implement `updateImage(req, res, next)` — extract `:id` + `:imageId` + body, call `imageService.updateImage`, return `200`
- [x] 5.5 Implement `deleteImage(req, res, next)` — extract `:id` + `:imageId`, call `imageService.deleteImage`, return `204`

## 6. Backend: Admin Product Routes

- [x] 6.1 Create `backend/src/routes/admin/productRoutes.ts`
- [x] 6.2 Create main product router with `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`
- [x] 6.3 Create variant sub-router using `{ mergeParams: true }` mounted at `/:id/variants` with `GET /`, `POST /`, `GET /:variantId`, `PATCH /:variantId`, `DELETE /:variantId`
- [x] 6.4 Create image sub-router using `{ mergeParams: true }` mounted at `/:id/images` with `GET /`, `POST /`, `PATCH /:imageId`, `DELETE /:imageId`
- [x] 6.5 Wire controllers to routes (import from controllers)

## 7. Backend: Register Routes in routes/index.ts

- [x] 7.1 Read `backend/src/routes/index.ts` to locate the FUTURE placeholder comment for `/api/admin/products`
- [x] 7.2 Import `productRouter` from `./admin/productRoutes`
- [x] 7.3 Mount at `/api/admin/products` (replace placeholder)

## 8. Backend: Export New Controllers in controllers/index.ts

- [x] 8.1 Read `backend/src/presentation/controllers/index.ts`
- [x] 8.2 Export `productController`, `productVariantController`, `productImageController`

## 9. Backend: Map Domain Errors in Error Handler

- [x] 9.1 Read `backend/src/middleware/errorHandler.ts`
- [x] 9.2 Add `instanceof` checks for all new domain error classes with correct HTTP status and `code`:
  - `ProductNotFoundError` → 404 / `PRODUCT_NOT_FOUND`
  - `VariantNotFoundError` → 404 / `VARIANT_NOT_FOUND`
  - `ImageNotFoundError` → 404 / `IMAGE_NOT_FOUND`
  - `ProductRequiresActiveVariantError` → 422 / `PRODUCT_REQUIRES_ACTIVE_VARIANT`
  - `ProductArchivedCannotReactivateError` → 422 / `PRODUCT_ARCHIVED_CANNOT_REACTIVATE`
  - `ProductSlugConflictError` → 409 / `PRODUCT_SLUG_CONFLICT`
  - `VariantSkuConflictError` → 409 / `VARIANT_SKU_CONFLICT`
  - `VariantComparePriceInvalidError` → 422 / `VARIANT_COMPARE_PRICE_INVALID`
- [x] 9.3 Verify error response uses standard envelope `{ success: false, error: { message, code } }`

## 10. Backend: Unit Tests — Service and Repository Layer

- [x] 10.1 Create `backend/src/application/services/__tests__/productService.test.ts`
- [x] 10.2 Test `createProduct`: slug auto-generation, Draft default status, slug collision retry, ProductSlugConflictError on exhaustion
- [x] 10.3 Test `updateProduct` lifecycle: Draft → Active (success with active variant), Draft → Active (fail: no active variant), Archived → Active (fail: cannot reactivate)
- [x] 10.4 Test `deleteProduct`: soft-delete sets `deletedAt`
- [x] 10.5 Create `backend/src/application/services/__tests__/productVariantService.test.ts`
- [x] 10.6 Test `createVariant`: validates product ownership, SKU uniqueness, publicPrice required, compareAtPrice > publicPrice
- [x] 10.7 Create `backend/src/infrastructure/repositories/__tests__/productVariantRepository.test.ts`
- [x] 10.8 **SUPPLIER LEAK TEST (MANDATORY)**: Assert that no response from `findAll`, `findById`, `create`, or `update` variant operations contains `supplierId`, `supplierReference`, or `supplierCost` fields

## 11. Backend: Unit Tests — Controller Layer

- [x] 11.1 Create `backend/src/presentation/controllers/__tests__/productController.test.ts` (mirror `categoryController.test.ts` structure)
- [x] 11.2 Test `listProducts`: 200 with paginated results; 400 on invalid query params
- [x] 11.3 Test `getProductById`: 200 success; 404 not found (via error handler)
- [x] 11.4 Test `createProduct`: 201 created; 400 missing name; 409 slug conflict
- [x] 11.5 Test `updateProduct`: 200 updated; 422 requires active variant; 422 archived cannot reactivate; 404 not found
- [x] 11.6 Test `deleteProduct`: 204 success; 404 not found
- [x] 11.7 Create `backend/src/presentation/controllers/__tests__/productVariantController.test.ts`
- [x] 11.8 Test variant CRUD controllers: 200/201/204 happy paths; 404 not found; 409 SKU conflict; 422 price invalid
- [x] 11.9 Create `backend/src/presentation/controllers/__tests__/productImageController.test.ts`
- [x] 11.10 Test image CRUD controllers: 200/201/204 happy paths; 404 not found

## 12. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 12.1 Run `npm test` from `backend/` to verify pre-existing test suite still passes
- [x] 12.2 Review any tests that import or depend on Category, Supplier, or shared infrastructure that may be affected by the Prisma schema migration
- [x] 12.3 Fix any test failures caused by the migration or new error handler entries
- [x] 12.4 Ensure `categoryController.test.ts` and other existing tests remain green

## 13. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 13.1 Capture pre-test database baseline: count of products, product_variants, product_images tables (expect 0 rows post-migration)
- [x] 13.2 Run targeted unit tests for new modules: `npm test -- --testPathPattern="product"`
- [x] 13.3 Run full unit test suite: `npm test` from `backend/`
- [x] 13.4 Verify post-test database state is restored to pre-test baseline
- [x] 13.5 Create report `openspec/changes/product-catalog-management/reports/YYYY-MM-DD-step-13-unit-test-and-db-verification.md` (replace YYYY-MM-DD with actual date)
- [x] 13.6 Mark step complete only after all tests pass and report exists

## 14. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 14.1 Ensure backend server is running (start with `npm run dev` from `backend/` if needed)
- [x] 14.2 Test `GET /api/admin/products` — verify 200 with empty list
- [x] 14.3 Test `POST /api/admin/products` with valid body — verify 201 + slug auto-generated, then delete created record
- [x] 14.4 Test `POST /api/admin/products` without `name` — verify 400 validation error
- [x] 14.5 Test `GET /api/admin/products/:id` with created id — verify 200
- [x] 14.6 Test `GET /api/admin/products/:id` with non-existent id — verify 404 + `PRODUCT_NOT_FOUND` code
- [x] 14.7 Test `PATCH /api/admin/products/:id` with `{ "status": "Active" }` on Draft product with no variants — verify 422 + `PRODUCT_REQUIRES_ACTIVE_VARIANT`
- [x] 14.8 Test `POST /api/admin/products/:id/variants` with valid body — verify 201; restore database
- [x] 14.9 Test `POST /api/admin/products/:id/variants` with duplicate SKU — verify 409 + `VARIANT_SKU_CONFLICT`
- [x] 14.10 Test variant response — verify `supplierId`, `supplierReference`, `supplierCost` are NOT present in response body
- [x] 14.11 Test `PATCH /api/admin/products/:id` with `{ "status": "Active" }` after adding active variant — verify 200 + status `Active`
- [x] 14.12 Test `DELETE /api/admin/products/:id/variants/:variantId` — verify 204; restore database
- [x] 14.13 Test `POST /api/admin/products/:id/images` with valid body — verify 201; restore database
- [x] 14.14 Test `DELETE /api/admin/products/:id/images/:imageId` — verify 204 (hard-delete)
- [x] 14.15 Test `DELETE /api/admin/products/:id` — verify 204 (soft-delete); verify product no longer returned in GET list
- [x] 14.16 Restore database to pre-test state after all tests
- [x] 14.17 Create report `openspec/changes/product-catalog-management/reports/YYYY-MM-DD-step-14-curl-endpoint-testing.md`

## 15. Update Technical Documentation (MANDATORY)

- [x] 15.1 Read `docs/data-model.md` — add Product, ProductVariant, ProductImage entities with all fields, lifecycle rules, soft/hard-delete rules, and supplier field protection note
- [x] 15.2 Read `docs/api-spec.yml` — add all 13 new admin endpoints with request/response schemas, status codes, and error codes (follow existing Category pattern)
- [x] 15.3 Verify documentation reflects the supplier field exclusion rule explicitly

## 16. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 16.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 16.2 Verify all tasks complete (`[x]`) and reports exist under `openspec/changes/product-catalog-management/reports/`
- [ ] 16.3 Stage all relevant files — code, tests, OpenSpec artifacts, docs (exclude `.env`, `node_modules/`, `dist/`, `coverage/`)
- [ ] 16.4 Create commit: `feat(product-catalog): wire admin CRUD endpoints for products, variants, and images`
- [ ] 16.5 Push branch to remote origin: `git push -u origin feature/product-catalog-management`
- [ ] 16.6 Create Pull Request with `gh pr create` and report the PR URL in chat
