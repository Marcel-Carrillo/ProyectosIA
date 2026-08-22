# Frontend plan — shopify-liquid-theme-mavile-visual-port

**Subagent:** skipped. This is a Liquid theme, not a React feature. Plan written from `ai-specs/agents/frontend-developer.md` (presentation vs data, loading/error/empty states, a11y, no supplier leak) plus `design.md`. React `frontend/src` is **reference only**.

## Approach

Reuse Mavile BEM class names (`storefront-*`) in Liquid so `frontend/src/styles/storefront.css` can be copied as theme CSS. Shopify provides data (collections, product, cart). Theme JS is vanilla (no React, no Storefront API token).

## Files to create

| Path | Role |
|------|------|
| `shopify/README.md` | CLI, gates, which surface is authoritative |
| `shopify/.theme-check.yml` | Theme Check config |
| `shopify/shopify.theme.toml` | CLI environments |
| `shopify/theme/assets/mavile-tokens.css` | 1:1 port of `tokens.css` |
| `shopify/theme/assets/mavile-storefront.css` | Copy of `storefront.css` |
| `shopify/theme/assets/mavile-base.css` | html/body reset, Inter `@font-face` |
| `shopify/theme/assets/mavile-shopify.css` | Shopify-only overrides (forms, policies) |
| `shopify/theme/assets/inter-latin-*.woff2` | Self-hosted Inter 400/500/600 |
| `shopify/theme/assets/mavile-*.svg` | Brand marks |
| `shopify/theme/assets/mavile-header.js` | Mobile menu |
| `shopify/theme/assets/mavile-hero.js` | Slideshow |
| `shopify/theme/assets/mavile-gallery.js` | Colour → hero only |
| `shopify/theme/assets/mavile-variant-picker.js` | Pills + section rendering / cart add |
| `shopify/theme/assets/mavile-cart.js` | Ajax quantity/remove |
| `shopify/theme/assets/mavile-consent.js` | Customer Privacy API |
| `shopify/theme/layout/theme.liquid` | Shell |
| `shopify/theme/layout/password.liquid` | Pre-launch gate |
| `shopify/theme/sections/*` | header, footer, hero, collection, product, cart, page, search, 404, contact |
| `shopify/theme/snippets/*` | nav, language switcher, card, price, pagination, cookie, JSON-LD |
| `shopify/theme/templates/*.json` | OS 2.0 JSON templates |
| `shopify/theme/templates/customers/*.liquid` | Classic accounts |
| `shopify/theme/locales/es.default.json`, `en.json` | Chrome copy |
| `shopify/theme/config/settings_schema.json`, `settings_data.json` | Theme settings |
| `.github/workflows/shopify-theme-check.yml` | CI |
| `frontend/e2e/shopify-theme.spec.ts` (or `shopify/e2e/`) | Playwright against preview URL |

## Do not edit

- `frontend/src/**` (except no edits at all for this change)
- React routes, Stripe checkout, cookie context (those stay on the live Mavile stack)

## Empty / error / loading

- Empty collection and empty cart: locale strings + existing `.storefront-*` empty treatments.
- Sold-out variant: disabled pill, no delivery promise.
- Images: `image_url` + width/height; lazy below fold.

## A11y

Focus-visible, `aria-pressed` on lang/variant, `aria-expanded` on hamburger, modal focus trap on cookie preferences, `prefers-reduced-motion` on hero.

## Tests

Theme Check + ESLint on theme JS + Playwright when `SHOPIFY_THEME_PREVIEW_URL` is set. Vitest/Jest suites unchanged.
