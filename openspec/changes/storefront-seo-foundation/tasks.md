## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide isolation strategy (current checkout vs Git worktree) for `storefront-seo-foundation`.
- [x] 0.2 Create and switch to `feature/storefront-seo-foundation` from the current branch (`develop`).
- [x] 0.3 Verify branch creation and current branch status (`git branch --show-current`).

## 1. Frontend: Seo Component Foundation

- [x] 1.1 Add `react-helmet-async` to `frontend/package.json` dependencies.
- [x] 1.2 Add `REACT_APP_SITE_URL` to frontend environment configuration, following the existing `REACT_APP_API_BASE_URL` convention.
- [x] 1.3 Wrap the app with `HelmetProvider` in `frontend/src/App.tsx`.
- [x] 1.4 Create `frontend/src/components/storefront/Seo.tsx` accepting `title`, `description`, `canonicalPath`, `image`, `noindex`, `jsonLd` props and rendering `<title>`, meta description, canonical link, Open Graph/Twitter tags, robots meta (when `noindex`), and JSON-LD script (when provided).
- [x] 1.5 Add unit tests for `Seo.tsx` covering: default render, `noindex` render, and `jsonLd` render.

## 2. Frontend: Public Page Metadata

- [x] 2.1 Wire `Seo` into `frontend/src/pages/storefront/CatalogPage.tsx` with category-aware title/description and canonical `/catalog`.
- [x] 2.2 Wire `Seo` into `frontend/src/pages/storefront/ProductPage.tsx` with product-derived title/description/image, canonical `/catalog/:id`, `Product` JSON-LD, and `BreadcrumbList` JSON-LD (Home → Category → Product).
- [x] 2.3 Wire `Seo` into `frontend/src/pages/storefront/ContentPage.tsx` with per-slug title/description and canonical `/pages/:slug`, reusing the existing `pages` i18n namespace content.
- [x] 2.4 Add a defensive fallback `Seo` in `frontend/src/components/storefront/StorefrontLayout.tsx` for any storefront page that does not set its own. **Superseded during E2E verification (see design.md Risks/Trade-offs):** `react-helmet-async`'s React 19 code path does not dedupe `<meta>`/`og:*` tags across independently-mounted `Helmet` instances, so a layout-level fallback `Seo` coexisting with each page's own `Seo` produced duplicate `og:title`/`twitter:title` in the rendered DOM. Removed the fallback from `StorefrontLayout.tsx` — every storefront route already renders its own complete `Seo` (verified, 100% coverage), so no gap remains. Also removed the static `meta[name="description"]` from `frontend/public/index.html` for the same reason (React 19 hoisting does not remove pre-existing static meta tags, only appends alongside them).

## 3. Frontend: Non-Public Route noindex Coverage

- [x] 3.1 Add `Seo noindex` to customer auth/checkout/account pages: `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `CartPage`, `CheckoutPage`, `OrderConfirmationPage`, `AccountPage`, `AccountProfilePage`, `AccountOrdersPage`, `AccountOrderDetailPage`, `AccountWishlistPage`, `TwoFactorSetupPage`. (Implemented via shared wrappers `StorefrontAuthPanel` and `AccountLayout` — see design.md decision on DRY noindex coverage — plus direct edits to `CartPage`/`CheckoutPage`/`OrderConfirmationPage`, which are not wrapped by a shared component.)
- [x] 3.2 Add `Seo noindex` to `AdminLoginPage` and to the admin `Layout` wrapper (or each admin page) covering `ProductsPage`, `ProductDetailPage`, `CategoriesPage`, `SuppliersPage`, `CustomersPage`, `CustomerOrdersPage`, `CustomerOrderDetailPage`, `SupplierOrdersPage`, `SupplierOrderDetailPage`, `ShipmentsPage`, `ShipmentDetailPage`, `ReturnRequestsPage`, `ReturnRequestDetailPage`, `RefundsPage`, `RefundDetailPage`. (Implemented via the shared admin `Layout.tsx` wrapper, which all 15 pages route through.)
- [x] 3.3 Add a unit test asserting that a representative admin page and a representative customer-account page render the `noindex, nofollow` robots meta tag.

## 4. Frontend: robots.txt and Base HTML

- [x] 4.1 Rewrite `frontend/public/robots.txt` with `Disallow` rules for every non-public route listed in Section 3 and a `Sitemap:` directive pointing to the sitemap endpoint.
- [x] 4.2 Fix the static `lang` attribute in `frontend/public/index.html` to match the app's default locale (`es`, per `fallbackLng: 'es'` in `frontend/src/i18n/index.ts`).

## 5. Frontend: Image alt Text Audit

- [x] 5.1 Audit `frontend/src/components/storefront/ProductGallery.tsx` and catalog product-card image rendering; ensure `alt={image.altText || product.name}` is applied wherever a product image renders. (`ProductGallery.tsx` was already correct; fixed a real bug in `ProductCard.tsx` where `mainImageUrl` presence bypassed `altText` entirely.)
- [x] 5.2 Add/update unit tests verifying the `alt` fallback behavior for both the gallery and the product card.

## 6. Backend: Public Sitemap Endpoint

- [x] 6.1 Add a new route `GET /api/public/sitemap.xml` under `backend/src/routes` following the existing `/api/public/...` routing pattern.
- [x] 6.2 Implement the controller/service to generate XML listing `/catalog`, one `<url>` per `Active`-status product (`/catalog/:id`), one per category, and one per static content-page slug, each with `<lastmod>` from `updatedAt`. Reuse the existing product-listing query pattern to avoid N+1 queries; select only fields already exposed by `/api/public/products` (no supplier fields).
- [x] 6.3 Set `Content-Type: application/xml` on the response.
- [x] 6.4 Add unit tests: valid XML structure, only `Active` products included, no supplier fields present in output.
- [x] 6.5 Add the new path to `docs/api-spec.yml` (`GET /api/public/sitemap.xml`, `application/xml` response, no auth required). (Also mirrored into `backend/src/api-spec.yml`, the copy actually served by Swagger UI at runtime — verified both YAML files remain valid, except a pre-existing unrelated parse issue already present in `docs/api-spec.yml` at HEAD before this change.)

## 7. Review and Update Existing Unit Tests (MANDATORY)

- [x] 7.1 Review existing tests in `frontend/src/pages/storefront/__tests__/` and `backend/src/routes/public/__tests__/` for any assertions that assume the old static title/robots.txt behavior, and update them. (None assumed the old behavior; fixed a new `categoryService` network-error console warning introduced in `ProductPage.test.tsx` by mocking it. No backend route-list snapshot test exists to update.)
- [x] 7.2 Confirm new tests added in Sections 1, 3, 5, and 6 are included in the relevant test suites.

## 8. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 8.1 Capture pre-test database baseline (product/category counts by status).
- [x] 8.2 Run targeted frontend tests for `Seo`, `CatalogPage`, `ProductPage`, `ContentPage`, `ProductGallery` (note: when working from a Git worktree on Windows, CRA's Jest may not discover tests by default — pass an explicit `--testMatch` override if the default run reports zero tests, per prior project experience). (Not needed — running from a normal feature branch checkout, not a worktree; default test discovery worked.)
- [x] 8.3 Run targeted backend tests for the new sitemap route/controller/service.
- [x] 8.4 Run the full required frontend and backend unit test suites.
- [x] 8.5 Verify post-test database state is unchanged (read-only feature — no mutation expected); restore if any test left residual data.
- [x] 8.6 Create report `openspec/changes/storefront-seo-foundation/reports/YYYY-MM-DD-step-8-unit-test-and-db-verification.md`.

## 9. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Ensure the backend server is running (start via the project's Docker/dev setup if needed).
- [x] 9.2 `curl -X GET http://localhost:3000/api/public/sitemap.xml` — verify `200`, `Content-Type: application/xml`, and that the body contains `/catalog`, at least one product URL, and at least one content-page URL.
- [x] 9.3 Verify the sitemap response does not contain `supplierId`, `supplierReference`, or `supplierCost`.
- [x] 9.4 Test an error/edge case (e.g., no active products) if feasible in the current seeded database state, or document that the seeded data always has active products. (Documented; seeded DB always has active products — covered instead by the `should_include_catalog_root_entry_always` unit test with mocked empty results.)
- [x] 9.5 Document all curl commands and responses.
- [x] 9.6 Create report `openspec/changes/storefront-seo-foundation/reports/YYYY-MM-DD-step-9-curl-endpoint-testing.md`.

## 10. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Ensure both frontend and backend servers are running.
- [x] 10.2 Navigate to `/catalog` and verify (via `browser_evaluate` or page source) the rendered `<title>`, meta description, and canonical link. (Discovered and fixed a real duplicate-meta-tag bug during this step — see report.)
- [x] 10.3 Navigate to a product detail page and verify title, Open Graph tags, and the presence of `Product` + `BreadcrumbList` JSON-LD script tags.
- [x] 10.4 Navigate to `/products` (admin, authenticate if required) and verify the `noindex, nofollow` robots meta tag is present.
- [x] 10.5 Navigate to `/checkout` and verify the `noindex, nofollow` robots meta tag is present without breaking the checkout flow. (Verified via `/cart`, its redirect target when empty, plus source-level confirmation of `CheckoutPage.tsx`'s identical pattern — see report for why a non-empty cart could not be produced live.)
- [x] 10.6 Fetch `/robots.txt` and confirm `Disallow` rules and `Sitemap:` directive are present.
- [x] 10.7 Document all workflows, assertions, and screenshots/snapshots.
- [x] 10.8 Create report `openspec/changes/storefront-seo-foundation/reports/YYYY-MM-DD-step-10-e2e-testing.md`.

## 11. Update Technical Documentation (MANDATORY)

- [x] 11.1 Update `docs/api-spec.yml` with the new `GET /api/public/sitemap.xml` path (already drafted in 6.5 — confirm it's committed).
- [x] 11.2 Update `docs/frontend-standards.md` with the `Seo` component convention (props, `noindex` usage, when each public page must supply metadata). (Added a new "SEO and Metadata" section, including the one-`Seo`-per-page rule discovered during E2E testing, and added `REACT_APP_SITE_URL` to the environment variable list; also added it to `docs/development_guide.md`'s frontend env snippet.)
- [x] 11.3 Document the Phase 2 follow-ups (SSR/prerendering, locale-URL/hreflang, slug-based PDP routing) as a short note in `docs/frontend-standards.md` or a follow-up OpenSpec change reference, so they are not silently lost. (Added under "Known Limitation — SSR/Prerendering (Phase 2)" in the new section.)

## 12. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 12.1 Load and apply `ai-specs/skills/commit/SKILL.md`.
- [ ] 12.2 Verify all tasks above are marked complete and all reports exist under `openspec/changes/storefront-seo-foundation/reports/`.
- [ ] 12.3 Stage all relevant files (exclude `.env`, `node_modules/`, `dist/`, `coverage/`).
- [ ] 12.4 Create commit with Conventional Commit message (`feat(seo): add technical SEO foundation for storefront`).
- [ ] 12.5 Push branch `feature/storefront-seo-foundation` to remote origin.
- [ ] 12.6 Create Pull Request with `gh pr create` and report the PR URL in chat.
