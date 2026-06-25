## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Read `ai-specs/skills/using-git-worktrees/SKILL.md` to determine workspace isolation strategy (worktree vs. current checkout)
- [x] 0.2 Create feature branch `feature/product-multilingual-translations` from the `develop` branch (or master, per worktree skill guidance)
- [x] 0.3 Verify branch creation and confirm current working branch

## 1. Backend: Prisma Schema and Migration

- [ ] 1.1 Add `ProductTranslation` model to `backend/prisma/schema.prisma` with fields: `id`, `productId` (FK → Product, onDelete Cascade), `locale` (VarChar 5), `name` (VarChar 150), `description` (VarChar 2000, optional), `source` (VarChar 20, default `"manual"`), `createdAt`, `updatedAt`; add `@@unique([productId, locale])` and `@@index([productId])`
- [ ] 1.2 Add `translations ProductTranslation[]` relation to the `Product` model in the schema
- [ ] 1.3 Run `npx prisma migrate dev --name add_product_translation` to generate the migration file in `backend/prisma/migrations/`
- [ ] 1.4 Run `npx prisma generate` to regenerate the Prisma client
- [ ] 1.5 Verify the migration SQL contains `CREATE TABLE "ProductTranslation"`, the unique index on `(productId, locale)`, and the FK with `ON DELETE CASCADE`

## 2. Backend: Domain Layer

- [ ] 2.1 Create `backend/src/domain/models/productTranslation.ts` mirroring the `Product` model pattern (interface or class for `ProductTranslation`)
- [ ] 2.2 Create `backend/src/domain/repositories/IProductTranslationRepository.ts` defining `upsert(productId, locale, name, description, source)`, `findByProduct(productId)`, `findByProductAndLocale(productId, locale)`, `delete(productId, locale)` methods
- [ ] 2.3 Export the new model and repository interface from the appropriate barrel files (`domain/models/index.ts`, `domain/repositories/index.ts`)

## 3. Backend: Infrastructure Layer

- [ ] 3.1 Create `backend/src/infrastructure/repositories/productTranslationRepository.ts` implementing `IProductTranslationRepository` using Prisma Client; use `upsert` for the upsert method with `where: { productId_locale }` and `create`/`update` accordingly
- [ ] 3.2 Register the repository in the DI wiring (wherever `ProductRepository` and other repos are instantiated/exported — typically `src/infrastructure/repositories/index.ts` or the composition root)
- [ ] 3.3 Update all existing Prisma product repository methods (`findAll`, `findById`, `findBySlug`, `findByCategory`, `search`) to add `include: { translations: true }` in a single query (no separate queries per product)

## 4. Backend: Locale Resolution Helper

- [ ] 4.1 Create `backend/src/application/helpers/resolveProductLocale.ts` implementing the full fallback chain: requested locale → `en` translation → `Product.name`/`Product.description`. Support locale normalization (strip region: `es-ES` → `es`) and default unknown locales to `en`
- [ ] 4.2 Write unit tests in `backend/src/application/helpers/__tests__/resolveProductLocale.test.ts` covering: exact ES match, exact EN match, region-stripped match (`es-419`), missing ES falls back to EN translation, missing ES and EN falls back to `Product.name`, unknown locale (`fr`) defaults to EN

## 5. Backend: Product Service

- [ ] 5.1 Inject `IProductTranslationRepository` into `ProductService` (constructor injection, following existing service patterns)
- [ ] 5.2 Update `ProductService.createProduct` to accept an optional `translations` array, validate each entry (`locale` ∈ {`en`,`es`}, `name` ≤ 150 chars, `description` ≤ 2000 chars), and persist them via the repository atomically after the product is created
- [ ] 5.3 Update `ProductService.updateProduct` to accept an optional `translations` array and upsert each provided translation (omitted locales remain unchanged); apply same validation
- [ ] 5.4 Add `ProductService.upsertTranslation(productId, locale, name, description)` method for the dedicated sub-route
- [ ] 5.5 Add `ProductService.deleteTranslation(productId, locale)` method; return a 404 `NotFoundError` if no row exists for that locale
- [ ] 5.6 Add `ProductService.getTranslations(productId)` method returning all translation rows for the product
- [ ] 5.7 Update service tests in `backend/src/application/services/__tests__/productService.test.ts` for the new create/update translation paths, upsert, delete (including 404 case), and getTranslations

## 6. Backend: Public Serializer

- [ ] 6.1 Update `serializePublicProduct` (in `backend/src/presentation/serializers/`) to accept a `locale: string` argument and use `resolveProductLocale` to set `name` and `description` in the output DTO
- [ ] 6.2 Verify the allow-list in `serializePublicProduct` still excludes all supplier fields (`supplierId`, `supplierReference`, `supplierCost`) and internal fields — supplier protection invariant must remain intact
- [ ] 6.3 Update serializer unit tests to cover ES response, EN response, and fallback scenarios, and re-assert no supplier field leakage

## 7. Backend: Public Product Controller and Routes

- [ ] 7.1 Update the public product list controller (handler for `GET /api/public/products`) to read `req.headers['accept-language']`, pass the normalized locale to `serializePublicProduct`, and add `res.set('Vary', 'Accept-Language')` before the response
- [ ] 7.2 Update the public product detail controller (handler for `GET /api/public/products/:id`) with the same locale resolution and `Vary` header
- [ ] 7.3 Add a TODO comment in the public search handler noting that search still matches `Product.name` (English only) and localized search is deferred
- [ ] 7.4 Update public product controller tests to assert: ES locale returns translated name, EN/default returns English, `Vary: Accept-Language` header is present on both endpoints, supplier fields are absent

## 8. Backend: Admin Controller and Translation Sub-Routes

- [ ] 8.1 Update the admin product create controller to accept and forward the optional `translations` array from `req.body` to `ProductService.createProduct`; validate locale values and field lengths, returning HTTP 422 with `TRANSLATION_LOCALE_INVALID` for invalid locales
- [ ] 8.2 Update the admin product update controller to accept and forward the optional `translations` array to `ProductService.updateProduct` with the same validation
- [ ] 8.3 Update admin product read responses (list and detail) to include the `translations` array from the service result
- [ ] 8.4 Add admin translation sub-routes to `backend/src/routes/admin/productRoutes.ts`:
  - `GET /api/admin/products/:id/translations` → `ProductService.getTranslations`
  - `PUT /api/admin/products/:id/translations/:locale` → `ProductService.upsertTranslation` (validate locale ∈ {`en`,`es`})
  - `DELETE /api/admin/products/:id/translations/:locale` → `ProductService.deleteTranslation` (404 if not found)
- [ ] 8.5 Update admin product controller tests for create/update with translations, admin read including translations array, and the three translation sub-routes (success, validation error, 404 cases)

## 9. Backend: Backfill Script

- [ ] 9.1 Create `backend/scripts/backfillProductTranslations.ts` as a standalone ts-node script that: (1) upserts `en` translations from `Product.name`/`description` with `source = "import"` for every active product (idempotent — skips if already exists); (2) for each product lacking an `es` translation, calls LibreTranslate (`LIBRETRANSLATE_URL` env var, defaults to `http://localhost:5000`) to translate `name` and `description`; (3) enforces 150-char limit on translated name (truncates + logs warning); (4) skips-and-logs on per-product translation failures without aborting; (5) emits a structured summary (EN seeded, ES translated, skipped, failed)
- [ ] 9.2 Add `"backfill:translations": "npx ts-node scripts/backfillProductTranslations.ts"` to `backend/package.json` scripts
- [ ] 9.3 Verify the script runs against the local dev database without errors (at least the EN seed path; ES path is best-effort depending on LibreTranslate availability)

## 10. Frontend: TypeScript Types

- [ ] 10.1 Add `ProductTranslation` interface to `frontend/src/types/product.ts` with fields `locale`, `name`, `description`, `source`
- [ ] 10.2 Add optional `translations?: ProductTranslation[]` to the product response type in `frontend/src/types/product.ts`
- [ ] 10.3 Add optional `translations?: Array<{ locale: string; name: string; description?: string }>` to `CreateProductInput` and `UpdateProductInput` in `frontend/src/types/product.ts`

## 11. Frontend: Accept-Language Interceptor

- [ ] 11.1 Add an Axios request interceptor to the public product Axios instance (or `productService.ts`) that injects `Accept-Language: i18n.language` on every request, reading the language from the i18next instance (storage key: `mavile.lang`, supported: `en`/`es`)
- [ ] 11.2 Verify the interceptor does not affect admin service requests or non-product endpoints (scope it to the public product service only)
- [ ] 11.3 Update or add unit tests in `frontend/src/services/__tests__/productService.test.ts` to assert the `Accept-Language` header is injected based on the current `i18n.language`

## 12. Frontend: Re-fetch on Language Change

- [ ] 12.1 Add `i18n.language` as a dependency to the product-fetching `useEffect` in `frontend/src/pages/storefront/ProductsPage.tsx` (catalog list) so it re-fetches when language changes
- [ ] 12.2 Add `i18n.language` as a dependency to the product-fetching `useEffect` in `frontend/src/pages/storefront/ProductDetailPage.tsx` (product detail) with the same pattern
- [ ] 12.3 Verify that no other product-consuming component or hook caches product data in a way that would prevent the re-fetch from surfacing updated translated content (check `ProductCard`, `ProductGrid`, etc.)
- [ ] 12.4 Update component tests for `ProductsPage` and `ProductDetailPage` to assert that a language change triggers a new API call

## 13. Frontend: Admin ProductFormModal Translation Fields

- [ ] 13.1 Update `frontend/src/components/admin/ProductFormModal.tsx` to include per-locale `name` and `description` fields (EN and ES), organized as tabs or labeled groups
- [ ] 13.2 On form submit, build the `translations` array from the filled locale fields (omit a locale if its `name` is empty) and include it in the `CreateProductInput` / `UpdateProductInput` payload
- [ ] 13.3 On edit, pre-populate the ES and EN `name`/`description` inputs from the `translations` array in the product data returned by the admin API
- [ ] 13.4 Add i18n label keys for the translation tab/section labels to the appropriate `frontend/src/i18n/locales/*/` namespace files
- [ ] 13.5 Update `adminProductService.ts` to include `translations` in the create and update request bodies, and map `translations` from the product response
- [ ] 13.6 Update `frontend/src/services/__tests__/adminProductService.test.ts` and `ProductFormModal.test.tsx` for the new translation fields and payload construction

## 14. Review and Update Existing Unit Tests (MANDATORY)

- [ ] 14.1 Review existing `productService.test.ts` (backend) and verify no tests break due to the `include: { translations: true }` addition to repository mocks
- [ ] 14.2 Review and update `publicProductController.test.ts` for the new `locale` parameter and `Vary` header
- [ ] 14.3 Review and update `ProductCard.test.tsx`, `ProductGrid.test.tsx` for any prop or display changes related to translated names
- [ ] 14.4 Review `ProductFormModal.test.tsx` and update for the translation tab/fields and payload
- [ ] 14.5 Confirm all pre-existing test assertions on supplier field exclusion still pass (regression check on the allow-list)

## 15. Run Unit Tests and Verify Database State (MANDATORY)

- [ ] 15.1 Capture pre-test database baseline: count of `Product` rows and `ProductTranslation` rows (expected: 0 before migration on a fresh test DB)
- [ ] 15.2 Run targeted backend unit tests: `cd backend && npm test -- --testPathPattern="resolveProductLocale|productService|publicProduct|adminProduct"` and confirm all pass
- [ ] 15.3 Run full backend unit test suite: `cd backend && npm test` and confirm no regressions
- [ ] 15.4 Run frontend unit tests: `cd frontend && npm test -- --watchAll=false` (apply `--testMatch` override from project memory if running from a worktree on Windows) and confirm all pass
- [ ] 15.5 Verify post-test database state: `ProductTranslation` row count unchanged from baseline (tests must not leave data)
- [ ] 15.6 Create report `openspec/changes/product-multilingual-translations/reports/YYYY-MM-DD-step-15-unit-test-and-db-verification.md`

## 16. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [ ] 16.1 Ensure local backend is running (`npm run dev` in `backend/`)
- [ ] 16.2 Test `GET /api/public/products` with `Accept-Language: es` — verify ES name is returned and `Vary: Accept-Language` header is present
- [ ] 16.3 Test `GET /api/public/products` with `Accept-Language: en` — verify EN name is returned
- [ ] 16.4 Test `GET /api/public/products/:id` with `Accept-Language: es` — verify ES translation in response
- [ ] 16.5 Test `GET /api/public/products/:id` with `Accept-Language: fr` — verify EN fallback is returned without error
- [ ] 16.6 Test `GET /api/admin/products/:id` (with admin auth token) — verify `translations` array is present in response
- [ ] 16.7 Test `GET /api/admin/products/:id/translations` — verify all locale rows returned
- [ ] 16.8 Test `PUT /api/admin/products/:id/translations/es` with valid body — verify 200 and upserted row; then restore DB state by deleting the created ES row if it was new
- [ ] 16.9 Test `PUT /api/admin/products/:id/translations/fr` (invalid locale) — verify HTTP 422 with `TRANSLATION_LOCALE_INVALID`
- [ ] 16.10 Test `DELETE /api/admin/products/:id/translations/es` — verify 204; then restore the deleted row
- [ ] 16.11 Test `DELETE /api/admin/products/:id/translations/xx` (non-existent) — verify HTTP 404
- [ ] 16.12 Test `POST /api/admin/products` with `translations` in body — verify 201 and product+translations created; restore by deleting the test product
- [ ] 16.13 Verify no supplier fields appear in any public response (assert absence of `supplierId`, `supplierCost`, `supplierReference`)
- [ ] 16.14 Create report `openspec/changes/product-multilingual-translations/reports/YYYY-MM-DD-step-16-curl-endpoint-testing.md`

## 17. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [ ] 17.1 Ensure frontend and backend servers are running; verify database is in known state
- [ ] 17.2 Navigate to the storefront catalog (`https://d1p5rkpgizqh62.cloudfront.net` or local `http://localhost:3000`) using Playwright MCP `browser_navigate`
- [ ] 17.3 Switch language to ES via the language toggle; take a snapshot and assert product names changed to Spanish (or English fallback if no ES translation yet)
- [ ] 17.4 Switch language back to EN; assert product names revert to English
- [ ] 17.5 Navigate to a product detail page; switch language to ES; verify name and description update without full page reload
- [ ] 17.6 Navigate to admin panel product form; open a product for editing; verify ES and EN translation fields are pre-populated
- [ ] 17.7 Edit the ES name field and save; verify the updated ES name appears in the storefront when language is ES; restore the original ES name after verification
- [ ] 17.8 Create E2E test report `openspec/changes/product-multilingual-translations/reports/YYYY-MM-DD-step-17-e2e-testing.md`

## 18. Update Technical Documentation (MANDATORY)

- [ ] 18.1 Update `docs/data-model.md`: add `ProductTranslation` entity section with fields, validation rules, uniqueness constraint, relationship to `Product`, and ERD note
- [ ] 18.2 Update `docs/api-spec.yml`: add `Accept-Language` parameter to `GET /api/public/products` and `GET /api/public/products/:id`; add `Vary: Accept-Language` to response headers; add `translations` array to admin create/update request bodies and admin read responses; document the three translation sub-routes; add `TRANSLATION_LOCALE_INVALID` error code; document localized-search limitation
- [ ] 18.3 Update `docs/development_guide.md`: document the backfill script usage (`npm run backfill:translations`), required `LIBRETRANSLATE_URL` env var, idempotency guarantee, and CloudFront `Accept-Language` forwarding note
- [ ] 18.4 Update `docs/frontend-standards.md`: document the `Accept-Language` Axios interceptor pattern as the standard for locale-aware product API calls, and the `i18n.language` useEffect dependency pattern for re-fetch on language change

## 19. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 19.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 19.2 Verify all tasks above are marked `[x]` and all required reports exist under `openspec/changes/product-multilingual-translations/reports/`
- [ ] 19.3 Stage all relevant files: Prisma schema, migration, domain model, repository, helpers, service, serializer, controllers, routes, backfill script, frontend types, services, components, i18n locale files, docs, and OpenSpec artifacts; exclude `.env`, `node_modules/`, `dist/`, `coverage/`
- [ ] 19.4 Create commit with Conventional Commit message:
  ```
  feat(product): add multilingual translation support for product name and description

  - Add ProductTranslation Prisma model with (productId, locale) unique constraint
  - Implement deterministic locale resolution helper with total EN fallback
  - Public product list/detail endpoints resolve locale via Accept-Language + Vary header
  - Admin endpoints accept translations array on create/update; translation sub-routes added
  - Frontend Accept-Language interceptor and re-fetch-on-language-change wiring
  - Admin ProductFormModal gains per-locale name/description fields
  - Idempotent backfill script seeds EN and machine-translates ES via LibreTranslate
  - OpenSpec change: product-multilingual-translations
  - Tests: unit (backend + frontend), curl (all new endpoints), E2E (storefront + admin)
  ```
- [ ] 19.5 Push branch to remote origin: `git push -u origin feature/product-multilingual-translations`
- [ ] 19.6 Create Pull Request with `gh pr create` targeting `develop`; report PR URL in chat
