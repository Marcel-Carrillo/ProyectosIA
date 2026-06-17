## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to determine workspace isolation strategy (current checkout vs Git worktree)
- [x] 0.2 Create feature branch `feature/modern-frontend-ui` from `master`
- [x] 0.3 Verify branch creation with `git branch --show-current`

## 1. Design Tokens and Storefront CSS

- [x] 1.1 Create `frontend/src/styles/` directory
- [x] 1.2 Create `frontend/src/styles/tokens.css` with CSS custom properties: neutral color palette (`--color-white`, `--color-off-white`, `--color-light`, `--color-mid`, `--color-near-black`), editorial sans-serif type scale (`--font-family-body`, `--font-size-xs` through `--font-size-3xl`), font weights (`--font-weight-regular`, `--font-weight-medium`, `--font-weight-semibold`), whitespace scale (`--spacing-1` through `--spacing-16`), border radius (`--radius-sm`, `--radius-md`), and shadow tokens (`--shadow-card`)
- [x] 1.3 Create `frontend/src/styles/storefront.css` with component-level utility classes that apply the tokens (e.g. `.storefront-card`, `.storefront-price`, `.storefront-price--compare`, `.storefront-grid`, `.storefront-section`)
- [x] 1.4 Import `./styles/tokens.css` and `./styles/storefront.css` in `frontend/src/index.tsx` (after the Bootstrap import)
- [x] 1.5 Verify the app builds without errors after the import (`npm run build` in frontend/)

## 2. TypeScript Types

- [x] 2.1 Create or update `frontend/src/types/product.ts` with fully-typed interfaces: `ProductVariant` (id, sku, size, color, publicPrice, compareAtPrice, stockPolicy, status — never include supplier fields), `ProductImage` (id, url, altText, sortOrder), `Product` (id, name, slug, description, brand, status, mainImageUrl, categoryId, variants, images, createdAt), `ProductListResponse` (success, data: {items, total, page, pageSize, totalPages}), `ProductResponse` (success, data: Product)
- [x] 2.2 Create or update `frontend/src/types/category.ts` with `Category` interface (id, name, description, imageUrl, status, parentId)
- [x] 2.3 Create `frontend/src/types/index.ts` that re-exports all storefront types

## 3. Service Layer Implementation

- [x] 3.1 Read `docs/api-spec.yml` to confirm exact endpoint paths, query parameter names, and response shapes for `GET /products`, `GET /products/:id`, and `GET /categories`
- [x] 3.2 Implement `productService.getAll(params: ProductQueryParams): Promise<ProductListResponse>` in `frontend/src/services/productService.ts` — use `REACT_APP_API_BASE_URL`, pass `page`, `limit`, `search`, `categoryId`, `status`, `sort`, `order` as query params; always filter by `status=Active` for public storefront calls
- [x] 3.3 Implement `productService.getById(id: number): Promise<ProductResponse>` in `frontend/src/services/productService.ts`
- [x] 3.4 Implement `categoryService.getAll(): Promise<Category[]>` in `frontend/src/services/categoryService.ts`
- [x] 3.5 Verify TypeScript compiles without errors for the updated service files

## 4. Storefront Shell Components

- [x] 4.1 Create `frontend/src/components/storefront/` directory
- [x] 4.2 Create `frontend/src/components/storefront/StorefrontHeader.tsx` — sticky top header with brand wordmark, `CategoryNav` component, and search/cart icon placeholders (non-functional in MVP); apply design tokens; fully responsive
- [x] 4.3 Create `frontend/src/components/storefront/CategoryNav.tsx` — fetches categories from `categoryService.getAll()`, renders horizontal navigation links to `/catalog?categoryId=<id>`, highlights active category from current URL params, includes an "All" link to `/catalog`; handles loading and error states silently (no crash)
- [x] 4.4 Create `frontend/src/components/storefront/StorefrontFooter.tsx` — minimalist footer with brand wordmark and copyright line; apply design tokens
- [x] 4.5 Create `frontend/src/components/storefront/StorefrontLayout.tsx` — wrapper that renders `<StorefrontHeader>` + `<Outlet>` + `<StorefrontFooter>` using React Router's `<Outlet>` for nested routes
- [x] 4.6 Verify storefront layout renders correctly at 360px and 1280px viewport widths

## 5. Shared Product Display Components

- [x] 5.1 Create `frontend/src/components/storefront/PriceTag.tsx` — displays `publicPrice` and optionally `compareAtPrice` with strikethrough; accepts `publicPrice: number` and `compareAtPrice?: number` props; never accepts or displays supplier fields
- [x] 5.2 Create `frontend/src/components/storefront/ProductCard.tsx` — displays product card with image (`mainImageUrl` or first `images[]` item, fallback to neutral placeholder), name, brand, and `<PriceTag>` for the lowest-priced variant; entire card is a `<Link to="/products/:slug">`; applies `storefront-card` token classes
- [x] 5.3 Create `frontend/src/components/storefront/ProductGrid.tsx` — renders a responsive CSS grid of `<ProductCard>` components; accepts `products: Product[]` and `isLoading: boolean` and `isEmpty: boolean` props; renders loading skeletons when loading, empty-state message when no results
- [x] 5.4 Create `frontend/src/components/storefront/Pagination.tsx` — renders previous/next controls and page number buttons; accepts `currentPage`, `totalPages`, `onPageChange` props; is not rendered when `totalPages <= 1`

## 6. Product Gallery and Variant Selector Components

- [x] 6.1 Create `frontend/src/components/storefront/ProductGallery.tsx` — renders ordered image gallery from `images[]` sorted by `sortOrder`; shows large main image and thumbnail strip; clicking a thumbnail updates the main image; shows neutral placeholder if no images; sets correct `alt` from `altText` with fallback
- [x] 6.2 Create `frontend/src/components/storefront/VariantSelector.tsx` — derives available `size` and `color` values from `variants[]`; renders size buttons and color swatches; marks combinations with no non-deleted variant as disabled; on selection updates displayed variant (emits `onVariantChange` callback); accepts `variants: ProductVariant[]` and `onVariantChange: (v: ProductVariant | null) => void` props

## 7. Storefront Pages

- [x] 7.1 Create `frontend/src/pages/storefront/` directory
- [x] 7.2 Create `frontend/src/pages/storefront/CatalogPage.tsx` — reads `page`, `categoryId`, `search`, `sort`, `order` from `useSearchParams`; calls `productService.getAll({ ...params, status: 'Active', limit: 20 })`; renders `<ProductGrid>` and `<Pagination>`; includes search input (submit updates `?search=`) and sort select (updates `?sort=&order=`); resets to page 1 on filter/sort change; renders loading, empty, and error states
- [x] 7.3 Create `frontend/src/pages/storefront/ProductPage.tsx` — resolves product by slug (calls `productService.getAll({ slug })` or `getById`); renders `<ProductGallery>`, product name/brand/description, `<VariantSelector>`, and `<PriceTag>` that updates on variant selection; shows not-found state for non-existent or non-Active products; renders loading and error states

## 8. Routing Integration

- [x] 8.1 Read current `frontend/src/App.tsx` to understand existing route structure before modifying
- [x] 8.2 Add a `<Route element={<StorefrontLayout />}>` parent wrapping storefront routes: `<Route path="/" element={<Navigate to="/catalog" replace />}`, `<Route path="/catalog" element={<CatalogPage />} />`, `<Route path="/products/:slug" element={<ProductPage />} />`
- [x] 8.3 Verify all existing admin routes still render correctly (run the admin panel and confirm no layout regression)
- [x] 8.4 Add `React.lazy` + `<Suspense>` code-splitting for `CatalogPage` and `ProductPage` to keep storefront JS out of the admin bundle

## 9. Unit Tests

- [x] 9.1 Write unit test for `PriceTag` — verify single price renders when no `compareAtPrice`; verify both prices with strikethrough when `compareAtPrice > publicPrice`; verify supplier fields never appear in output
- [x] 9.2 Write unit test for `ProductCard` — verify image, name, brand and price render; verify placeholder renders when no image; verify card links to correct `/products/:slug`
- [x] 9.3 Write unit test for `VariantSelector` — verify sizes and colors derived from variants; verify unavailable combination is disabled; verify `onVariantChange` called with correct variant on selection
- [x] 9.4 Write unit test for `Pagination` — verify not rendered when `totalPages <= 1`; verify page change callback fires on next/previous/page number click

## 10. Review and Update Existing Unit Tests (MANDATORY)

- [x] 10.1 Run existing frontend unit tests (`npm test -- --watchAll=false`) to confirm no regressions from new imports or service changes
- [x] 10.2 Review existing test files that import `productService` or `categoryService` and update mocks/stubs to reflect the now-implemented methods
- [x] 10.3 Confirm all pre-existing tests continue to pass after review

## 11. Run Unit Tests and Verify State (MANDATORY)

- [x] 11.1 Run full frontend unit test suite: `cd frontend && npm test -- --watchAll=false --passWithNoTests`
- [x] 11.2 Confirm all new tests pass and no pre-existing tests regressed
- [x] 11.3 Create report `openspec/changes/modern-frontend-ui/reports/YYYY-MM-DD-step-11-unit-test-verification.md` with test command, pass/fail counts, runtime, and notes

## 12. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 12.1 Ensure backend server is running (start if needed) and frontend dev server is running (`cd frontend && npm start`)
- [x] 12.2 Use Playwright MCP `browser_navigate` to open `http://localhost:3001` and take a snapshot to verify the storefront shell renders (header, category nav, footer visible)
- [x] 12.3 Navigate to `/catalog` — verify product grid renders with product cards (image, name, price visible); take screenshot
- [x] 12.4 Click a category in the header nav — verify URL updates to `?categoryId=<id>` and grid filters to that category; take screenshot
- [x] 12.5 Use the search input on the catalog page — type a product name fragment and submit; verify URL updates to `?search=<term>` and filtered results appear; take screenshot
- [x] 12.6 Use the sort control — select "Name A–Z"; verify URL updates and grid re-renders; take screenshot
- [x] 12.7 Click on a product card — verify navigation to `/products/:slug`; verify product name, gallery images, and price display correctly; take screenshot
- [x] 12.8 Interact with `VariantSelector` (if product has variants) — select a size and color; verify price updates; take screenshot
- [x] 12.9 Verify no supplier fields (`supplierId`, `supplierReference`, `supplierCost`) appear in any rendered HTML
- [x] 12.10 Navigate to an admin route (e.g., `/products` admin page) — verify admin layout is intact with no storefront header or footer
- [x] 12.11 Create report `openspec/changes/modern-frontend-ui/reports/YYYY-MM-DD-step-12-e2e-testing.md` with all workflows executed, browser interactions, screenshots/snapshots references, and outcomes

## 13. Update Technical Documentation (MANDATORY)

- [x] 13.1 Update `docs/frontend-standards.md` — add storefront route namespace (`/`, `/catalog`, `/products/:slug`), document the `components/storefront/` and `pages/storefront/` folder structure, add recommended Cypress test file `storefront.cy.ts`, document design token CSS convention
- [x] 13.2 Review `docs/api-spec.yml` — confirm the `GET /products`, `GET /products/:id`, `GET /categories` responses match what the storefront types expect; no changes required unless discrepancy found
- [x] 13.3 Document the CRA-vs-Vite decision in `docs/frontend-standards.md` under a "Stack Decisions" section (or equivalent): CRA remains the build tool; Vite migration deferred pending explicit approval

## 14. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 14.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [x] 14.2 Verify all tasks above are marked `[x]` and required reports exist under `openspec/changes/modern-frontend-ui/reports/`
- [x] 14.3 Stage all relevant files: frontend source (`frontend/src/`), styles, types, services, components, pages, updated App.tsx, unit tests, updated docs, and OpenSpec artifacts (exclude `.env`, `node_modules/`, `dist/`, `coverage/`)
- [x] 14.4 Create commit with Conventional Commit message: `feat(storefront): implement modern Inditex-style public storefront UI`
- [x] 14.5 Push branch `feature/modern-frontend-ui` to remote origin
- [x] 14.6 Create Pull Request with `gh pr create` and report the PR URL in chat
