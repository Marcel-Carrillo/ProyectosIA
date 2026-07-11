# Step 11 Report - E2E Testing with Playwright MCP

- Date: 2026-07-10
- Change: migrate-cra-to-vite
- Agent: Claude Code (Fable 5)

## Environment

- Backend: Docker on `:3000` (dev DB seeded, 12 products)
- Frontend: Vite dev server on `:3001` (and separately the production build served statically on `:5050`)

## Workflows Executed

### 1. Storefront (dev server, `:3001`)

1. `browser_navigate` → `/catalog`: page renders — header, category navigation, hero, search, sort, footer, cookie consent banner. Product grid shows **"12 piezas"** with real products fetched through the Vite proxy.
2. Click product card "Acetate Sunglasses" → lazy-loaded route `/catalog/120` renders: breadcrumb, image gallery with thumbnails, brand/title/price (165,00 €), variant selector (Color: Tortoise), description, Add-to-cart button, reviews section ("Aún no hay opiniones").
3. i18n switch: click language switcher **ES → EN** → UI re-renders in English ("Opiniones de clientes" → "Customer reviews", "Aún no hay opiniones" → "No reviews yet"). JSON locale imports resolve correctly under Vite.

### 2. Production build parity (`:5050`, `npx serve -s build`)

- `/catalog` loads from the static `frontend/build/` artifacts: full render, "12 piezas" fetched from the backend, lazy chunks (`CatalogPage`, `ProductPage`) load without blank screens, Bootstrap CSS renders correctly (no unstyled flash / ordering regression).

### 3. Admin (dev server, `:3001`)

1. `browser_navigate` → `/admin/login`: Admin sign-in form renders.
2. `browser_fill_form` + click Sign in (seeded dev credentials) → redirected to `/products?sort=createdAt&order=desc`: products table renders with real data (image, name link `/products/120`, slug) — authenticated admin API calls work through the new tooling.

## Error Scenario / Console Checks

- Console errors across all workflows: **only** the expected `401` responses from `/api/public/auth/refresh` and `/api/admin/auth/refresh` (unauthenticated session probes on page load — identical behavior pre-migration).
- No `undefined` API base URL errors (env var migration verified at runtime), no missing-asset errors (no `%PUBLIC_URL%` regressions), no CSP/module-loading errors.

## Data Persistence

- All flows were read-only (browse + login). No data created or mutated; DB counts match the step 9 restored baseline.

## Environment Restoration

- Browser session closed (`browser_close`). Admin session cookie discarded with the browser context.
- Static-build server and Vite dev server left running only for local verification; no persistent state.

## Outcome

- Step 11 status: **PASS**
- Blocking issues: none
