# Step 10 Report - E2E Testing with Playwright MCP

- Date: 2026-07-01
- Change: storefront-seo-foundation
- Agent: claude-sonnet-5

## Environment

- Backend running via `docker compose up -d` (port 3000), DB healthy.
- Frontend served two ways during this step:
  1. A local production build (`npm run build` + `npx serve -s build -l 5050`) — used to confirm the meta-tag duplication bug was NOT a dev-only/StrictMode artifact.
  2. The Dockerized dev server (`ecommerce-frontend`, port 3001, rebuilt via `docker compose up -d --build frontend` after each source change) — used for the full functional E2E pass against the real local backend/DB.

## Finding and Fix (discovered during this step — see design.md and tasks.md 2.4 for full rationale)

Initial navigation to `/catalog` showed **two** `<meta name="description">` tags and **two** `<meta property="og:title">` tags simultaneously in the rendered DOM — one from the page's own `Seo` and one from `StorefrontLayout`'s defensive fallback `Seo` (task 2.4) / the static tag in `index.html`. Root-caused to `react-helmet-async`'s React 19 code path (`React19Dispatcher`), which does not dedupe `<meta>` tags across independently-mounted `Helmet` instances the way its legacy (pre-React-19) dispatcher does, and does not remove pre-existing static `<meta>` tags from `index.html` at all (unlike `<title>`, which it does correctly prioritize).

**Fix applied:** removed the `StorefrontLayout`-level fallback `Seo` (every storefront route already renders its own complete `Seo`, so no coverage gap) and removed the static `meta[name="description"]` from `frontend/public/index.html`. Re-verified on both the production build and the Docker dev server that only one `<meta name="description">` and one `og:title` remain per route.

## Workflows Executed

1. **`/catalog`** — navigated, evaluated `document.title`, `meta[name="description"]`, `meta[property="og:title"]`, `link[rel="canonical"]`.
   - Result: `title = "Todo | Mavile"`, exactly one description (`"Descubre la colección Mavile..."`), exactly one `og:title`, canonical `https://mavile.es/catalog` (prod build) / `http://localhost:3001/catalog` (dev server).
2. **`/catalog/46`** (product detail) — navigated, evaluated title/description/og:title/canonical/JSON-LD.
   - Result: `title = "Gafas de Sol de Acetato | Mavile"`, one description, one `og:title`, canonical `http://localhost:3001/catalog/46`, exactly 2 `<script type="application/ld+json">` blocks:
     - `Product` (`name`, `image`, `description`; `sku`/`offers` correctly omitted for this specific product since it has no active priced variant — matches the conditional logic in `ProductPage.tsx`)
     - `BreadcrumbList` (Home → Accesorios → Gafas de Sol de Acetato, with correct `item` URLs, including the category link resolved via `useStorefrontCategories()`)
3. **`/admin/login`** — navigated (unauthenticated). `meta[name="robots"]` = `"noindex, nofollow"`. Title = `"Admin sign in | Mavile"`.
4. **Admin login → `/products`** — logged in with seeded admin credentials (`backend/.env`), landed on `/products?sort=createdAt&order=desc`. `meta[name="robots"]` = `"noindex, nofollow"` (confirms the single `Layout.tsx`-level `Seo noindex` covers the real admin page, consistent with the `Layout.test.tsx` unit test).
5. **`/checkout`** (empty cart) — redirected to `/cart` per existing app behavior (`Navigate` when cart is empty); confirmed `/cart` renders `meta[name="robots"] = "noindex, nofollow"` and `title = "Carrito | Mavile"`. `CheckoutPage.tsx`'s own `<Seo noindex>` on its `payment`/`details` render branches was verified by direct source read (identical pattern to `CartPage`, both already unit-tested); not independently re-exercised live since the seeded product available in this session had no purchasable variant (`Add to cart` disabled), so a non-empty cart could not be produced in this pass.
6. **`/pages/shipping`** — title `"Envíos"`, description matches the `pages` i18n namespace content, canonical `http://localhost:3001/pages/shipping`.
7. **`/robots.txt`** (frontend container, after rebuild) — confirmed `Disallow` rules for all private routes and `Sitemap:` directive pointing at the backend sitemap endpoint.

## Data Persistence / Cleanup

- No data-mutating actions were performed (no product created/updated/deleted, no order placed). Admin login created a session/refresh token only; no DB state change.
- Docker containers (`db`, `mailpit`, `backend`, `frontend`) left running per the user's existing local dev workflow; no cleanup action required beyond what a normal `docker compose down` would do (not executed, matching how the project's local dev environment is normally left running between sessions).

## Outcome

- Step 10 status: PASS (after the fix described above)
- Blocking issues: none remaining
