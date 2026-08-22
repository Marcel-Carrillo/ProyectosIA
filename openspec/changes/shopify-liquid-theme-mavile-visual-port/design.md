## Context

Mavile today is a custom React storefront (`frontend/`) plus Express/Prisma/Stripe (`backend/`). Shoppers browse numeric catalog URLs, add Prisma variant ids to cart, and pay with Stripe. The operator chose **Online Store 2.0 (Liquid)** so Shopify owns commerce; this repo keeps only the Mavile look.

`frontend/` and `backend/` stay in production until a later cutover. This change adds a parallel surface under `shopify/theme`. Brand parity (not pixel parity) is the acceptance bar.

**Layers:** Shopify Online Store (Liquid sections/snippets/templates) is the presentation layer. There is no Mavile Presentation/Application/Domain/Infrastructure work. Prisma schema, repositories, controllers, and React services are untouched.

**Supplier data:** Shopify cost-per-item is admin-only. The theme MUST NOT render supplier metafields or any storefront-visible cost namespace.

## Goals / Non-Goals

**Goals:**

- Ship a Dawn-based OS 2.0 theme that renders home, collection, product, cart, search, content, 404, password, and classic account pages in the Mavile visual language.
- Drive nav from Shopify collections + menus (`women`, `men`, `accessories`, `shoes`).
- Hand off to hosted Shopify Checkout with Checkout branding (logo, colours, radius).
- Wire the Mavile cookie UI to the Customer Privacy API.
- Gate Theme Check in CI; keep the development store password-protected or `noindex`.

**Non-Goals:**

- Storefront API, Hydrogen, or Mavile API calls from the theme.
- Catalog/DNS/CJ/history migration or decommission of Lambda/Stripe.
- Checkout UI extensions beyond branding.
- Reviews and wishlist.

## Decisions

### D1 — Theme in this repo at `shopify/theme`

One review flow; tokens stay next to the React source of truth during the transition.

**Alternative:** separate repo. Rejected — splits brand assets from the token file operators already maintain.

### D2 — Dawn base, stripped and restyled

Keep Dawn a11y primitives, media gallery, facets, and cart mechanics. Replace CSS with Mavile token CSS. Delete unused sections.

**Alternative:** blank theme. Rejected — would rebuild variant/media/cart bugs. **Hydrogen:** rejected by the operator.

### D3 — Self-hosted Inter subset in `assets/`

`font-display: swap`, preload. No Google Fonts request (performance + GDPR).

### D4 — Keep Mavile CSS variable names

`assets/mavile-tokens.css` copies `frontend/src/styles/tokens.css` 1:1. A small merchant-editable subset overrides via `{% style %}` in `theme.liquid`.

### D5 — Nav from Admin menus, not hardcoded categories

`linklists.main-menu` plus collection handles. Four hardcoded nav keys would recreate the rigidity this replatform removes.

### D6 — Markets: ES at `/`, EN at `/en`

Switcher is `{% form 'localization' %}` restyled as Spain/UK flags. Spain-primary, EUR only for MVP. No country selector in this change.

### D7 — Custom cookie UI → Customer Privacy API

Disable Shopify’s built-in banner. Mapping: Mavile analytics → `analytics` + `preferences`; Mavile marketing → `marketing` + `sale_of_data`. Confirm with the operator in the consent spec notes; both locales must show reject as prominent as accept.

### D8 — Classic customer accounts

Only classic templates (`templates/customers/*.liquid`) can carry the Mavile account look. New customer accounts are Shopify-hosted and branding-only.

**Alternative:** new accounts. Rejected for this change — would drop account-page parity.

### D9 — Hosted checkout, branding only

`checkout.liquid` is sunset. Checkout Extensibility beyond branding is a later change. Shoppers will see Shopify checkout chrome; that divergence is accepted.

### D10 — Cart is a page, not a drawer

Matches current `CartPage`. Dawn’s cart drawer is disabled.

### D11 — Colour changes hero image only

Thumbnail strip always shows the full sorted media set (`ProductGallery` behaviour). Dawn’s default “hide non-matching media” MUST be overridden with theme JS.

### D12 — Variant pills + Section Rendering API

Replace Dawn dropdowns. Unavailable combinations disabled from `variant.available`. Do not treat `available` as a delivery promise in copy.

### D13 — Custom hero section; Files for imagery

Ken Burns presets, scrim, grain, 7s rotation, `prefers-reduced-motion` static. Upload rights-cleared (or licensed Unsplash) assets to Shopify Files — do not hot-link Unsplash URLs.

### D14 — Policies vs Pages

Legal: Shopify Policies (checkout links). Editorial: Shopify Pages. Contact: `{% form 'contact' %}`.

### D15 — No Storefront API, no React, no Mavile fetches

Liquid SSR. Theme JS may use Ajax Cart (`/cart/add.js`, `/cart/change.js`) and Section Rendering only. No tokens in theme files.

### D16 — Quality gates

Theme Check + Prettier Liquid plugin + ESLint on `shopify/theme/assets/*.js`. Existing `frontend` ESLint / Vitest / Jest suites are unchanged and MUST still be recorded as N/A-with-reason in verification reports. No Prisma DB step; Playwright against `shopify theme dev` replaces curl.

## Risks / Trade-offs

- **[Launch-gap illusion]** Theme merge ≠ live `mavile.es` → `docs/shopify-migration-launch-gap.md` is a required deliverable.
- **[Reviews/wishlist lost at cutover]** No core Shopify equivalent → deferred; launch-gap lists the decision.
- **[Checkout/account brand drift]** Hosted checkout cannot match `CheckoutPage` → accepted; classic accounts mitigate account pages.
- **[Performance]** Hero motion + blur header + large photos → Lighthouse budget (mobile perf ≥ 90 on home/collection/product); Shopify CDN `image_url`; honour reduced motion.
- **[GDPR consent mapping]** Four Shopify consent categories vs two Mavile toggles → document mapping; no analytics/marketing scripts before consent.
- **[SEO duplication]** Two catalogs → password or `noindex` until cutover.
- **[Supplier leak]** Metafields on the storefront → never render cost/supplier namespaces.
- **[Spec drift]** Unimplemented hybrid change still in `openspec/changes/` → withdraw the directory; do not archive/sync its specs.

## Migration Plan

1. Withdraw `shopify-headless-catalog-phase1` (delete the change folder; do not `openspec archive` — archive is post-merge and would sync abandoned specs).
2. Scaffold theme; develop against a password-protected development store with 8–12 representative products.
3. Merge theme to `develop` with Theme Check CI. Production Mavile stack unchanged.
4. Later changes (not this one): catalog migration, Markets/tax/shipping, CJ app, Checkout branding sign-off, DNS cutover, decommission.

**Rollback:** unpublish the unpublished theme; `frontend/`/`backend/` remain the live store.

## Open Questions

- Exact development store URL and Shopify plan (needed to run `shopify theme dev`; does not block writing theme files).
- Whether Bizum is required for Spain at cutover (payments config, not theme).
- Final hero photography set (placeholders allowed for theme build).
