## Why

The storefront (`frontend/`, React CRA, client-side rendered) serves every route with the same static `<title>Mavile</title>` and one generic meta description from `frontend/public/index.html`. There is no per-page title/description, no Open Graph/Twitter metadata, no canonical URLs, no structured data, and `frontend/public/robots.txt` neither restricts private/admin routes nor references a sitemap. As a result, public catalog and content pages are not well represented in Google search results or social link previews, and internal admin/account/checkout routes are not excluded from indexing. This change adds the technical SEO foundation needed for public pages to be indexable and well-structured, now that the storefront has stable catalog and content routes.

## Non-Goals

- No migration to server-side rendering (SSR), static generation (SSG), or a prerendering service. The storefront remains a CRA client-side-rendered SPA.
- No introduction of locale-segmented URLs or `hreflang` tags. Locale (`es`/`en`) continues to resolve client-side as it does today.
- No change to the product detail route from `/catalog/:id` (numeric id) to a slug-based URL.
- No change to admin authentication, layout, or business logic — only crawl/indexing directives for admin routes.

## What Changes

- Add a reusable `Seo` component (`react-helmet-async`) rendering per-route `<title>`, meta description, canonical URL, Open Graph/Twitter tags, and optional JSON-LD structured data.
- Add `Product` and `BreadcrumbList` JSON-LD structured data on the product detail page.
- Apply `noindex, nofollow` to all non-public storefront routes: `/admin/login`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/cart`, `/checkout`, `/order-confirmation/:orderNumber`, `/account`, `/account/profile`, `/account/orders`, `/account/orders/:id`, `/account/wishlist`, `/account/security/2fa`, and all admin back-office routes (`/products`, `/products/:id`, `/categories`, `/suppliers`, `/customers`, `/customer-orders`, `/customer-orders/:id`, `/supplier-orders`, `/supplier-orders/:id`, `/shipments`, `/shipments/:id`, `/return-requests`, `/return-requests/:id`, `/refunds`, `/refunds/:id`).
- Rewrite `frontend/public/robots.txt` to disallow the routes above and reference `sitemap.xml`.
- Add a new public backend endpoint `GET /api/public/sitemap.xml` that dynamically generates a sitemap from active products, categories, and static content-page slugs.
- Audit and fix `alt` text on product images across the product listing and product detail pages.
- Fix the static `lang` attribute in `frontend/public/index.html` to match the app's default locale.

## Capabilities

### New Capabilities
- `storefront-seo`: Per-route metadata (title, description, canonical, Open Graph/Twitter, robots directives, JSON-LD structured data) for storefront pages, plus the crawl directives (`robots.txt`) and dynamic sitemap that support discoverability of public pages while excluding private/admin routes.

### Modified Capabilities
(none — no existing `openspec/specs/` capabilities cover SEO, metadata, or public catalog browsing today)

## Impact

- **Frontend**: `frontend/src/App.tsx` (HelmetProvider wiring), new `frontend/src/components/storefront/Seo.tsx`, `frontend/src/pages/storefront/CatalogPage.tsx`, `ProductPage.tsx`, `ContentPage.tsx`, `StorefrontLayout.tsx`, all admin/account/auth pages (noindex only), `frontend/public/robots.txt`, `frontend/public/index.html`, `frontend/package.json` (new dependency `react-helmet-async`).
- **Backend**: new public route `GET /api/public/sitemap.xml` under the existing `/api/public/...` convention; must expose only public-safe fields (no supplier cost, credentials, or internal fulfillment data), per base standards.
- **Docs**: `docs/api-spec.yml` (new sitemap endpoint), `docs/frontend-standards.md` (Seo component convention).
- **Customer-facing impact**: yes — improves discoverability and link-sharing previews for catalog/content pages.
- **Internal supplier fulfillment impact**: none — this change only affects metadata, crawl directives, and a read-only sitemap endpoint; no changes to order lifecycle, fulfillment status, payment status, returns, or refunds.
