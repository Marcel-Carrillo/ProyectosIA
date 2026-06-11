## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/product-category-management` from master branch
- [x] 0.2 Verify branch creation and confirm current branch is `feature/product-category-management`

## 1. Database: Prisma Schema and Migration

- [x] 1.1 Add `Category` model to `backend/prisma/schema.prisma` with fields: `id`, `name` (@unique), `description`, `imageUrl`, `status` (default "Active"), `parentId` (self-referencing FK), `createdAt`, `updatedAt`
- [x] 1.2 Add self-referencing relation fields `parent` and `children` to the `Category` model
- [x] 1.3 Ensure Docker Compose PostgreSQL container is running
- [x] 1.4 Run `npx prisma migrate dev --name create_category_catalog` from `backend/` directory
- [x] 1.5 Run `npm run prisma:generate` to regenerate Prisma client
- [x] 1.6 Verify migration file exists under `backend/prisma/migrations/`

## 2. Domain Layer: Category Entity and Repository Interface

- [x] 2.1 Add `Category` class to `backend/src/domain/models/index.ts` with all fields and `activate()` / `deactivate()` lifecycle methods
- [x] 2.2 Add `ICategoryRepository` interface to `backend/src/domain/repositories/index.ts` with methods: `findAll(includeInactive?: boolean)`, `findById(id: number)`, `findByName(name: string)`, `create(data)`, `update(id, data)`, `softDelete(id)`

## 3. Infrastructure Layer: Prisma Repository Implementation

- [x] 3.1 Create `backend/src/infrastructure/repositories/` directory
- [x] 3.2 Create `backend/src/infrastructure/repositories/categoryRepository.ts` implementing `ICategoryRepository` using the Prisma client singleton
- [x] 3.3 Ensure `findAll` defaults to filtering `status = Active` unless `includeInactive = true`
- [x] 3.4 Ensure `create` and `update` check for duplicate `name` before persisting and throw a typed error if duplicate is found
- [x] 3.5 Ensure `update` rejects `parentId` equal to the category's own `id`
- [x] 3.6 Ensure `softDelete` sets `status = Inactive` rather than deleting the row

## 4. Application Layer: Validator and CategoryService

- [x] 4.1 Add `validateCategoryData(data: Record<string, unknown>): void` to `backend/src/application/validator.ts` — validates `name` (required), `status` (must be `Active` or `Inactive` if provided), `parentId` (must be positive integer if provided)
- [x] 4.2 Create `backend/src/application/services/categoryService.ts` with methods: `findAll(includeInactive?)`, `findById(id)`, `create(data)`, `update(id, data)`, `softDelete(id)` — each method calls `validateCategoryData` where applicable and delegates to `ICategoryRepository`
- [x] 4.3 Export `CategoryService` from `backend/src/application/services/index.ts`

## 5. Presentation Layer: CategoryController

- [x] 5.1 Create `backend/src/presentation/controllers/categoryController.ts` with handlers: `listCategories`, `getCategoryById`, `createCategory`, `updateCategory`, `deleteCategory`
- [x] 5.2 Ensure all handlers follow the standard response envelope `{ success, data, message }` / `{ success, error: { message, code } }`
- [x] 5.3 Ensure all handlers call `next(error)` for unhandled errors so the global error handler processes them
- [x] 5.4 Add logger calls (`logger.info(...)`) for all CRUD operations
- [x] 5.5 Export `CategoryController` handlers from `backend/src/presentation/controllers/index.ts`

## 6. Routes: Register Category Routes

- [x] 6.1 Create `backend/src/routes/categoryRoutes.ts` defining the 5 REST endpoints: `GET /categories`, `GET /categories/:id`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id`
- [x] 6.2 Register `categoryRoutes` in `backend/src/routes/index.ts`

## 7. Unit Tests

- [x] 7.1 Create `backend/src/application/services/categoryService.test.ts` — test `findAll`, `findById`, `create`, `update`, `softDelete` including happy path, 404 cases, name-uniqueness conflicts, and self-reference rejection; mock `ICategoryRepository`
- [x] 7.2 Create `backend/src/presentation/controllers/categoryController.test.ts` — test all 5 handlers for success and error cases; mock `CategoryService`; verify HTTP status codes and response envelope format
- [x] 7.3 Add `validateCategoryData` test cases to `backend/src/application/validator.test.ts` — test valid input, missing `name`, invalid `status`, invalid `parentId`
- [x] 7.4 Verify all new test files use the project test naming and structure conventions (AAA pattern, `describe`/`it` blocks, `beforeEach(() => jest.clearAllMocks())`)

## 8. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 8.1 Run the full unit test suite (`npm test`) and confirm no pre-existing tests are broken by the new code
- [x] 8.2 Fix any broken existing tests caused by changes in `validator.ts`, `models/index.ts`, `repositories/index.ts`, `services/index.ts`, or `controllers/index.ts`
- [x] 8.3 Confirm total test coverage remains at or above 90% for branches, functions, lines, and statements

## 9. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 9.1 Capture pre-test database baseline: record count of rows in `categories` table (expected: 0 for a fresh migration)
- [x] 9.2 Run targeted unit tests for category modules: `npx jest --testPathPattern=category`
- [x] 9.3 Run full project test suite: `npm test` from `backend/`
- [x] 9.4 Verify post-test database state: confirm `categories` table row count is unchanged (unit tests use mocks, no DB mutations expected)
- [x] 9.5 Create report `openspec/changes/product-category-management/reports/YYYY-MM-DD-step-9-unit-test-and-db-verification.md`
- [x] 9.6 Mark step complete only after all tests pass and the report file exists

## 10. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Ensure Docker Compose PostgreSQL is running and backend server is started (`npm run dev` from `backend/`)
- [x] 10.2 Test `GET /categories` — verify 200 response with empty array (no categories yet)
- [x] 10.3 Test `POST /categories` with valid body `{"name":"Dresses"}` — verify 201 with created category; capture `id`
- [x] 10.4 Test `GET /categories/:id` with the created category ID — verify 200 with category data
- [x] 10.5 Test `GET /categories/:id` with a non-existent ID (e.g., 99999) — verify 404 with `code: "CATEGORY_NOT_FOUND"`
- [x] 10.6 Test `PUT /categories/:id` with `{"name":"Updated Dresses"}` — verify 200 with updated name; then restore to original name
- [x] 10.7 Test `DELETE /categories/:id` — verify 200 and `status = Inactive`; then restore by calling `PUT` to set `status = Active`
- [x] 10.8 Test `POST /categories` with duplicate `name` — verify 409 with `code: "CATEGORY_NAME_ALREADY_EXISTS"`
- [x] 10.9 Test `POST /categories` with missing `name` — verify 400 with `code: "VALIDATION_ERROR"`
- [x] 10.10 Test `GET /categories?includeInactive=true` — verify response includes the soft-deleted (Inactive) category
- [x] 10.11 Restore database state: delete or deactivate any test records created during testing
- [x] 10.12 Create report `openspec/changes/product-category-management/reports/YYYY-MM-DD-step-10-curl-endpoint-testing.md`

## 11. Update Technical Documentation (MANDATORY)

- [x] 11.1 Update `docs/data-model.md` — add `Category` entity with all fields, relations to `Product` (planned), and hierarchy self-reference
- [x] 11.2 Update `docs/api-spec.yml` — add the 5 category endpoints with request/response schemas and error codes (`CATEGORY_NOT_FOUND`, `CATEGORY_NAME_ALREADY_EXISTS`, `VALIDATION_ERROR`)
- [x] 11.3 Review `docs/backend-standards.md` — confirm `Category` is listed as a domain entity and update the main Prisma models list if needed
- [x] 11.4 Confirm no supplier cost or internal fulfillment data is present in any category API response

## 12. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 12.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 12.2 Verify all tasks above are marked `[x]` and required test reports exist under `openspec/changes/product-category-management/reports/`
- [ ] 12.3 Stage all relevant files: backend source, tests, prisma schema, migration, routes, docs updates, and OpenSpec artifacts (exclude `.env`, `node_modules/`, `dist/`, `coverage/`)
- [ ] 12.4 Create commit with Conventional Commit message: `feat(categories): implement product category management CRUD`
- [ ] 12.5 Push branch `feature/product-category-management` to remote origin
- [ ] 12.6 Create Pull Request with `gh pr create` and report the PR URL in chat
