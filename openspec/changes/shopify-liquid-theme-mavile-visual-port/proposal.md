## Why

Mavile’s competitive edge is brand and merchandising, not a custom commerce engine. Operators need Shopify’s catalog, checkout, payments, accounts, orders, and app ecosystem, while shoppers keep the Mavile visual language. The unimplemented hybrid change (`shopify-headless-catalog-phase1`) kept Prisma and Stripe and used Shopify only as a catalog source; that direction is withdrawn.

**Stack approval:** the operator chose Online Store 2.0 (Liquid theme) over Hydrogen and over the hybrid adapter. Adding `shopify/theme` and Shopify CLI is an explicit exception to `docs/base-standards.md` §17 for this change.

## What Changes

- Add an Online Store 2.0 Liquid theme at `shopify/theme` (Dawn base, restyled with Mavile tokens and storefront CSS).
- Port **visual system only**: tokens, header/footer/nav, hero, collection grid, product card, PDP gallery and variant pills, cart page, ES/EN flag switcher, cookie banner look, content/legal rhythm, brand assets.
- Shopify owns catalog, collections, cart, hosted Checkout, Shopify Payments, customer accounts, orders, refunds, shipping, Markets, Admin, and apps (CJ via the Shopify app, not Mavile Lambda).
- Withdraw `shopify-headless-catalog-phase1` (unimplemented). Do not sync its delta specs into `openspec/specs/`.
- Document the launch gap (`docs/shopify-migration-launch-gap.md`): DNS, catalog migration, CJ app, and decommission of Lambda/Stripe are **follow-up changes**, not this one.
- Existing `frontend/` and `backend/` stay running until a future cutover. The Shopify store stays password-protected or `noindex` until then.

**BREAKING (at future cutover, not this merge):** shoppers will use Shopify Checkout and Shopify customer accounts instead of Stripe and Mavile auth. This change does not cut over `mavile.es`.

## Non-goals

- Hydrogen, Storefront API storefront, or pointing the Vite SPA at Shopify.
- Product, customer, or order migration into Shopify.
- `mavile.es` DNS cutover or decommissioning Express/Prisma/Stripe/Lambda.
- Installing or mapping the CJ Dropshipping Shopify app.
- Recreating Stripe, custom 2FA, OAuth login, or the Mavile admin panel.
- Checkout UI extensions beyond Checkout branding settings.
- Product reviews and wishlist (no Shopify core equivalent; deferred).
- Changing `docs/data-model.md` or `docs/api-spec.yml`.

## Capabilities

### New Capabilities

- `mavile-shopify-theme-visual-system`: Tokens, typography, colour schemes, motion, buttons, fields, self-hosted Inter, brand assets.
- `mavile-shopify-theme-storefront-shell`: Layout, header, nav, footer, language switcher, hero, content/policy pages, search, 404, password gate.
- `mavile-shopify-theme-catalog-surfaces`: Collection grid, product card, price, pagination, facets, PDP gallery, variant picker.
- `mavile-shopify-theme-cart-and-account`: Cart page, checkout hand-off, classic customer account templates.
- `mavile-shopify-theme-consent`: Cookie banner and preferences wired to the Shopify Customer Privacy API.

### Modified Capabilities

- None. This adds a parallel surface. Existing `public-catalog-api` and Mavile purchase specs stay as-is until cutover.

## Impact

**Domain:** Shopify Product / ProductVariant / Collection become the live catalog at cutover. Mavile Product, ProductVariant, Category, CustomerOrder, SupplierOrder, Shipment, ReturnRequest, and Refund are **unchanged in this change**. Supplier cost must never be rendered from a storefront-visible metafield.

**Customer-facing:** Nothing live on `mavile.es`. On the development store: brand-parity browse, PDP, cart, hosted checkout, classic accounts, ES/EN. Checkout look is Shopify-hosted (branding only). Reviews and wishlist are absent.

**Internal:** Merchandising and orders will eventually move to Shopify Admin. This change only adds theme code, CLI tooling, Theme Check CI, and launch-gap documentation.

**APIs:** No Mavile API changes. Theme JS may use Ajax Cart and Section Rendering only. No Storefront/Admin tokens in the theme.

**Systems:** New `shopify/` tree and Shopify CLI. `frontend/` and `backend/` untouched. Quality gate for the theme is Theme Check + Prettier + scoped ESLint on theme JS, not the existing `frontend` ESLint path.
