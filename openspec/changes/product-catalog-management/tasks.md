## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/product-catalog-management` from master branch
- [x] 0.2 Verify branch creation and confirm current branch is `feature/product-catalog-management`

## 1. Database: Prisma Schema and Migration

- [x] 1.1 Read `docs/backend-standards.md` and `docs/data-model.md` before writing schema
- [x] 1.2 Add `Product` model to `prisma/schema.prisma` matching `docs/data-model.md` exactly (id, name, slug, description, brand, status, mainImageUrl, categoryId, createdAt, updatedAt)
- [x] 1.3 Add `ProductVariant` model to `prisma/schema.prisma` matching `docs/data-model.md` (id, productId, sku, size, color, publicPrice, compareAtPrice, supplierId, supplierReference, supplierCost, stockPolicy, status, createdAt, updatedAt)
- [x] 1.4 Add `ProductImage` model to `prisma/schema.prisma` (id, productId, url, altText, sortOrder, createdAt)
- [x] 1.5 Add relations in `Category` model: `products Product[]`
- [x] 1.6 Add relations in `Supplier` model: `productVariants ProductVariant[]`
- [ ] 1.7 Run `npx prisma migrate dev --name add-product-catalog` and confirm migration succeeds
- [ ] 1.8 Run `npx prisma generate` to update the Prisma client
- [ ] 1.9 Verify tables exist in the database with `npx prisma studio` or `psql` inspection

## 2. Backend: Product Domain and Infrastructure

- [x] 2.1 Create `src/domain/product/Product.ts` entity class with all fields typed in TypeScript
- [x] 2.2 Create `src/domain/product/ProductStatus.ts` enum (`Draft`, `Active`, `Inactive`, `Archived`)
- [x] 2.3 Create `src/domain/product/IProductRepository.ts` interface with methods: `findById`, `findAll`, `findBySlug`, `create`, `update`, `delete`
- [x] 2.4 Create `src/infrastructure/repositories/PrismaProductRepository.ts` implementing `IProductRepository` using Prisma client
- [ ] 2.5 Write unit tests for `PrismaProductRepository` (mock Prisma client)

## 3. Backend: Product Application and Presentation Layers

- [ ] 3.1 Create `src/application/product/ProductService.ts` with methods: `create`, `list`, `getById`, `update`, `softDelete`
- [ ] 3.2 Implement slug auto-generation in `ProductService.create` (kebab-case from name, collision retry with numeric suffix up to 5 attempts)
- [ ] 3.3 Implement status lifecycle validation in `ProductService.update`: block `Active` transition if no active variant exists, block reactivation of `Archived` products
- [ ] 3.4 Write unit tests for `ProductService` (mock repository)
- [ ] 3.5 Create `src/presentation/controllers/ProductController.ts` with handlers: `create`, `list`, `getById`, `update`, `softDelete`
- [ ] 3.6 Create `src/presentation/routes/productRoutes.ts` registering routes under `/api/admin/products`
- [ ] 3.7 Register `productRoutes` in the main Express app
- [ ] 3.8 Write unit tests for `ProductController` (mock service)

## 4. Backend: ProductVariant Domain and Infrastructure

- [ ] 4.1 Create `src/domain/productVariant/ProductVariant.ts` entity class with all fields typed (exclude supplier fields from public DTO type)
- [ ] 4.2 Create `src/domain/productVariant/ProductVariantStatus.ts` enum (`Active`, `Inactive`, `OutOfStock`, `Archived`) and `StockPolicy.ts` enum (`SupplierManaged`, `InternalStock`, `Hybrid`)
- [ ] 4.3 Create `src/domain/productVariant/IProductVariantRepository.ts` interface
- [ ] 4.4 Create `src/infrastructure/repositories/PrismaProductVariantRepository.ts` implementing the interface; always exclude `supplierCost`, `supplierReference`, `supplierId` from select in read queries
- [ ] 4.5 Write unit tests for `PrismaProductVariantRepository` (mock Prisma client)

## 5. Backend: ProductVariant Application and Presentation Layers

- [ ] 5.1 Create `src/application/productVariant/ProductVariantService.ts` with methods: `create`, `listByProduct`, `getById`, `update`, `softDelete`
- [ ] 5.2 Implement SKU uniqueness check in `create` and `update` (return `VARIANT_SKU_ALREADY_EXISTS` on conflict)
- [ ] 5.3 Implement price validation: `publicPrice > 0`, `compareAtPrice >= publicPrice` if provided
- [ ] 5.4 Implement supplier data pass-through: accept supplier fields on write but strip from returned DTO
- [ ] 5.5 Write unit tests for `ProductVariantService` (mock repository)
- [ ] 5.6 Create `src/presentation/controllers/ProductVariantController.ts` with handlers: `create`, `list`, `getById`, `update`, `softDelete`
- [ ] 5.7 Create `src/presentation/routes/productVariantRoutes.ts` registering routes under `/api/admin/products/:productId/variants`
- [ ] 5.8 Mount variant routes inside the product router
- [ ] 5.9 Write unit tests for `ProductVariantController` (mock service)

## 6. Backend: ProductImage Domain and Infrastructure

- [ ] 6.1 Create `src/domain/productImage/ProductImage.ts` entity class
- [ ] 6.2 Create `src/domain/productImage/IProductImageRepository.ts` interface with methods: `findById`, `findByProduct`, `create`, `update`, `delete`
- [ ] 6.3 Create `src/infrastructure/repositories/PrismaProductImageRepository.ts` implementing the interface; `findByProduct` orders results by `sortOrder` ascending
- [ ] 6.4 Write unit tests for `PrismaProductImageRepository` (mock Prisma client)

## 7. Backend: ProductImage Application and Presentation Layers

- [ ] 7.1 Create `src/application/productImage/ProductImageService.ts` with methods: `add`, `listByProduct`, `getById`, `update`, `remove`
- [ ] 7.2 Validate product existence before creating an image (return `PRODUCT_NOT_FOUND` if missing)
- [ ] 7.3 Implement hard-delete in `remove` (images have no order history FK requirement)
- [ ] 7.4 Write unit tests for `ProductImageService` (mock repository)
- [ ] 7.5 Create `src/presentation/controllers/ProductImageController.ts` with handlers: `add`, `list`, `getById`, `update`, `remove`
- [ ] 7.6 Create `src/presentation/routes/productImageRoutes.ts` registering routes under `/api/admin/products/:productId/images`
- [ ] 7.7 Mount image routes inside the product router
- [ ] 7.8 Write unit tests for `ProductImageController` (mock service)

## 8. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [ ] 8.1 Run existing test suite and confirm no regressions introduced by schema or route changes
- [ ] 8.2 Update any existing tests that reference `Category` relations or the Prisma client mock if the new models affect them
- [ ] 8.3 Confirm all existing tests pass before proceeding

## 9. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [ ] 9.1 Capture pre-test database baseline: record counts for `Product`, `ProductVariant`, `ProductImage` tables
- [ ] 9.2 Run targeted unit tests for product, productVariant, and productImage modules
- [ ] 9.3 Run the full backend unit test suite (`npm test` or configured Jest command)
- [ ] 9.4 Verify post-test database state matches pre-test baseline (no unintended mutations)
- [ ] 9.5 Restore database state if any test left data behind
- [ ] 9.6 Create report `openspec/changes/product-catalog-management/reports/YYYY-MM-DD-step-9-unit-test-and-db-verification.md`
- [ ] 9.7 Mark step complete only after all tests pass and report exists

## 10. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [ ] 10.1 Ensure backend server is running (start it if needed)
- [ ] 10.2 Test `GET /api/admin/products` — verify empty list returns `{ success: true, data: [] }`
- [ ] 10.3 Test `POST /api/admin/products` with valid payload — verify HTTP 201, auto-generated slug, and correct fields in response; restore database state after test
- [ ] 10.4 Test `POST /api/admin/products` with missing `name` — verify HTTP 422
- [ ] 10.5 Test `POST /api/admin/products` with duplicate slug — verify HTTP 409 and `PRODUCT_SLUG_ALREADY_EXISTS`
- [ ] 10.6 Test `GET /api/admin/products/:id` with valid ID — verify HTTP 200
- [ ] 10.7 Test `GET /api/admin/products/:id` with invalid ID — verify HTTP 404 and `PRODUCT_NOT_FOUND`
- [ ] 10.8 Test `PUT /api/admin/products/:id` — activate a product without an active variant — verify HTTP 422 and `PRODUCT_REQUIRES_ACTIVE_VARIANT`; restore original status after test
- [ ] 10.9 Test `DELETE /api/admin/products/:id` — verify HTTP 200, status set to `Inactive`; restore original status after test
- [ ] 10.10 Test `POST /api/admin/products/:productId/variants` with valid payload — verify HTTP 201, supplier fields absent from response; restore database state
- [ ] 10.11 Test `POST /api/admin/products/:productId/variants` with duplicate SKU — verify HTTP 409 and `VARIANT_SKU_ALREADY_EXISTS`
- [ ] 10.12 Test `POST /api/admin/products/:productId/variants` with `compareAtPrice < publicPrice` — verify HTTP 422 and `VARIANT_COMPARE_PRICE_INVALID`
- [ ] 10.13 Test `GET /api/admin/products/:productId/variants` — verify list returned in correct format
- [ ] 10.14 Test `DELETE /api/admin/products/:productId/variants/:id` — verify soft-delete and restore; restore original status after test
- [ ] 10.15 Test `POST /api/admin/products/:productId/images` with valid payload — verify HTTP 201; restore database state
- [ ] 10.16 Test `GET /api/admin/products/:productId/images` — verify images returned ordered by `sortOrder` ascending
- [ ] 10.17 Test `DELETE /api/admin/products/:productId/images/:id` — verify permanent deletion and HTTP 200; restore database state
- [ ] 10.18 Verify database state matches pre-test baseline after all tests
- [ ] 10.19 Create report `openspec/changes/product-catalog-management/reports/YYYY-MM-DD-step-10-curl-endpoint-testing.md`

## 11. Update Technical Documentation (MANDATORY)

- [ ] 11.1 Update `docs/api-spec.yml` to add all new admin endpoints for products, variants, and images (request bodies, response bodies, status codes, error codes)
- [ ] 11.2 Confirm `docs/data-model.md` already reflects `Product`, `ProductVariant`, and `ProductImage` entities; update if any field name or validation rule diverged during implementation
- [ ] 11.3 Update `docs/backend-standards.md` if any new pattern was introduced (e.g., supplier field stripping at serialization layer)
- [ ] 11.4 Document the `PRODUCT_REQUIRES_ACTIVE_VARIANT`, `PRODUCT_ARCHIVED_CANNOT_REACTIVATE`, `PRODUCT_SLUG_ALREADY_EXISTS`, `VARIANT_SKU_ALREADY_EXISTS`, `VARIANT_COMPARE_PRICE_INVALID`, `IMAGE_NOT_FOUND` error codes in the API spec

## 12. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 12.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 12.2 Verify all tasks above are marked `[x]` and reports exist under `openspec/changes/product-catalog-management/reports/`
- [ ] 12.3 Stage all relevant files: source code, tests, Prisma schema, migration, OpenSpec artifacts, documentation updates (exclude `.env`, `node_modules`, `dist`, `coverage`)
- [ ] 12.4 Create commit with Conventional Commit message: `feat(product-catalog): add admin CRUD for products, variants, and images`
- [ ] 12.5 Push branch `feature/product-catalog-management` to remote origin
- [ ] 12.6 Create Pull Request with `gh pr create` and report the PR URL in chat
