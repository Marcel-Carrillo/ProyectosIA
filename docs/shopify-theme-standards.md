# Shopify Theme Standards (Mavile)

The Shopify Online Store 2.0 theme lives at `shopify/theme`. It ports the Mavile visual system onto Liquid. Shopify owns catalog, cart, hosted checkout, payments, classic customer accounts, and Admin.

Until cutover, `frontend/` (React) plus `backend/` remain the live `mavile.es` stack.

## Tokens

`assets/mavile-tokens.css` must stay value-for-value aligned with `frontend/src/styles/tokens.css`. Keep the same CSS custom property names. Inter is self-hosted (`inter-latin-400/500/600.woff2`); do not load Google Fonts.

## Markup

Reuse `storefront-*` BEM classes from `frontend/src/styles/storefront.css` (copied as `mavile-storefront.css`) so the two surfaces stay comparable.

## JavaScript

Vanilla ES modules are not required; deferred classic scripts are fine. Allowed network calls:

* Ajax Cart (`cart/add.js`, `cart/change.js`)
* Section Rendering API
* Customer Privacy API (`Shopify.customerPrivacy.setTrackingConsent`)

Forbidden: Storefront API, Admin API, any Mavile `/api/` URL, tokens in theme files.

## Locales

All chrome strings go through `t` filters and `locales/es.default.json` + `locales/en.json`. Merchandising copy lives in Shopify Admin.

## Quality gates

* `shopify theme check --path shopify/theme`
* `npx eslint shopify/theme/assets --ext .js`
* Playwright: `shopify/e2e/theme.spec.ts` when `SHOPIFY_THEME_PREVIEW_URL` is set

## Supplier data

Do not render cost, supplier reference, or storefront-visible supplier metafields. Availability copy must not promise warehouse delivery from `variant.available`.
