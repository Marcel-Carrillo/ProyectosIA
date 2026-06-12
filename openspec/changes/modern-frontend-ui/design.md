## Context

The frontend is a Create React App (React 18, TypeScript 4.9, React Bootstrap 5.3, React Router 6) application. Currently it contains only an admin panel with a dark "Admin" navbar and a set of management pages (products, categories, suppliers, customers, orders, etc.) most of which render "Coming soon". The `productService.ts` and `categoryService.ts` files exist but all methods `throw new Error('Not implemented')`.

There is no public storefront. This design adds a completely new customer-facing surface without touching the existing admin panel.

## Goals / Non-Goals

**Goals:**
- Deliver a minimalist, editorial public storefront (Zara/Inditex aesthetic) built on the existing CRA + React Bootstrap stack.
- Isolate storefront routes and layout from the admin panel so both can evolve independently.
- Implement `productService` and `categoryService` methods needed by the storefront.
- Apply a CSS design-token layer (neutral palette, type scale, whitespace) on top of Bootstrap without replacing the framework.
- Cover the storefront with Cypress e2e tests and unit tests for core display components.

**Non-Goals:**
- Cart, checkout, payment, or order placement.
- Customer accounts, wishlist, or order history.
- Vite migration or replacement of React Bootstrap.
- Any backend or API changes.
- CMS-managed content or homepage personalization.

## Decisions

### Decision 1: Stay on Create React App, do not migrate to Vite

**Choice:** CRA (`react-scripts` 5.0.1) remains as the build tool.

**Rationale:** The project already has a working CRA setup with TypeScript, ESLint, Cypress config, and a test suite. Migrating to Vite is a stack-level change requiring explicit approval (base-standards §12) and delivers no functional value for this MVP scope. CRA supports all the required patterns (lazy imports, code splitting via `React.lazy`, CSS modules, env vars).

**Alternative considered:** Vite — faster dev server, better HMR; ruled out for this change due to migration scope and approval requirement.

---

### Decision 2: Design tokens as a CSS layer over Bootstrap

**Choice:** A new `frontend/src/styles/tokens.css` file defines CSS custom properties (variables) for the Inditex-inspired design system: neutral palette, minimalist type scale, generous whitespace. Bootstrap components are used directly and customized via these variables and override classes. No Tailwind, no UI-kit replacement.

**Rationale:** React Bootstrap 5.3 already uses Bootstrap's CSS custom properties infrastructure, making a CSS variable layer a natural extension. Adding Tailwind or swapping the UI kit is a framework change out of scope.

Token categories:
- `--color-*` — neutral palette (white, off-white, light gray, mid gray, near-black)
- `--font-family-*` — sans-serif editorial stack
- `--font-size-*` — type scale (xs → 3xl)
- `--font-weight-*` — regular / medium / semibold
- `--spacing-*` — generous whitespace scale (4px base)
- `--radius-*` — subtle border radii
- `--shadow-*` — minimal elevation shadows

**Alternative considered:** Sass Bootstrap overrides — more powerful but adds Sass compilation overhead and complexity; CSS variables are simpler and sufficient.

---

### Decision 3: Route isolation via nested layout routes

**Choice:** React Router 6 layout routes split the app into two independent layout trees:
- `<StorefrontLayout>` wrapping `/`, `/catalog`, `/products/:slug`
- `<AdminLayout>` (existing `<Layout>`) wrapping `/admin/*` (all current routes moved under `/admin` prefix, or kept as-is with the storefront at `/` and admin at current paths)

**Implementation detail:** The storefront lives at `/` (root and sub-routes). Existing admin routes stay under their current paths. `App.tsx` uses React Router's element-based route composition to select the correct layout based on path.

**Rationale:** Independent layouts mean storefront and admin can have entirely different header, nav, footer, and global styles without conditional rendering logic in a single layout.

---

### Decision 4: No global state manager for storefront MVP

**Choice:** Local `useState`/`useEffect` hooks in page-level components, consistent with the existing admin panel pattern. No Redux, Zustand, or Context API for catalog data.

**Rationale:** The storefront MVP has two pages (catalog + detail) with no shared mutable state between them. URL query params handle catalog filter/pagination state (bookmarkable, browser-back friendly). Global state would be premature complexity.

**Alternative considered:** React Query for server-state caching — deferred to a future phase when multiple pages need the same data.

---

### Decision 5: Catalog filter state lives in URL query parameters

**Choice:** `page`, `categoryId`, `search`, `sort`, `order` are stored as URL search params (`useSearchParams`). Navigating to a catalog URL with params restores the filter state.

**Rationale:** Makes pages shareable and bookmarkable; enables browser back/forward; avoids state desync on page reload.

---

### Decision 6: Service layer implementation target

**Choice:** Implement the following methods in the existing service files:
- `productService.ts`: `getAll(params: ProductQueryParams)` → `ProductListResponse`, `getById(id: number)` → `ProductResponse`
- `categoryService.ts`: `getAll()` → `Category[]`

These use `REACT_APP_API_BASE_URL` (default `http://localhost:3000`). All methods use axios, handle errors by re-throwing, and are fully typed (TypeScript strict).

The storefront consumes only public-safe fields. Supplier fields (`supplierId`, `supplierReference`, `supplierCost`) are excluded server-side at the Prisma level and must not be typed or accessed on the client.

## Risks / Trade-offs

- **[Risk] Admin routes may conflict with `/` storefront root** → Mitigation: Audit `App.tsx` before coding; move admin root to `/admin` or ensure exact route matching prevents collisions. Add a routing smoke test to CI.
- **[Risk] Bootstrap customization produces visual inconsistency** → Mitigation: Limit overrides to design tokens and utility classes; do not modify Bootstrap source files; document token usage in `storefront.css` header.
- **[Risk] Product images may be missing or low-quality in development data** → Mitigation: Implement a graceful image fallback (placeholder silhouette) in `ProductCard` and `ProductGallery`.
- **[Risk] CRA build performance with additional components** → Mitigation: Use `React.lazy` + `Suspense` for storefront route chunks so admin users never load storefront JS.
- **[Trade-off] URL-param filter state vs. component state** → URL params add `useSearchParams` boilerplate but provide bookmarkability and correct back-button behavior, which is essential for a product catalog UX.

## Migration Plan

1. Create `feature/modern-frontend-ui` branch from `master`.
2. Implement design tokens and storefront layout (no route changes yet) — confirm visual direction early.
3. Implement `productService` and `categoryService` methods with unit tests.
4. Build catalog and detail pages; update `App.tsx` routing last (minimizes conflict risk).
5. Run full Cypress suite to confirm admin routes are unaffected.
6. Open PR; require CodeRabbit review and all CI gates to pass before merge.

Rollback: The storefront is additive (new routes, new components). Reverting the PR restores the previous state with zero risk to admin functionality.

## Open Questions

- **Admin route prefix**: Should existing admin routes move to `/admin/*` (clean separation) or stay at current paths with the storefront occupying only `/`, `/catalog`, and `/products/:slug`? Recommend keeping current admin paths unchanged to minimize diff.
- **Product image CDN**: Are product images served from a CDN or the same origin? Affects CORS config and `<img>` src construction in `ProductGallery`.
