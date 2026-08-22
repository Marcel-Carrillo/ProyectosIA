# Mavile Shopify theme

Online Store 2.0 Liquid theme that ports the **Mavile visual system** (`frontend/src/styles/tokens.css` and `storefront.css`) onto Shopify.

Until DNS cutover, the live customer store remains the React app in `frontend/` plus `backend/`. This folder is the Shopify surface.

## Layout

```text
shopify/
  README.md
  .theme-check.yml
  shopify.theme.toml
  theme/                 # Theme root for Shopify CLI
```

The theme follows Dawn OS 2.0 conventions (JSON templates, section groups) without vendoring Dawn’s CSS/JS. Presentation classes keep the `storefront-*` names from the React storefront.

## Commands

```bash
cd shopify
shopify theme dev --path theme --store <dev-store>.myshopify.com
shopify theme check --path theme
npx eslint theme/assets --ext .js
```

Do not put Storefront or Admin API tokens in theme files.

## Gates

| Check | Command |
|-------|---------|
| Theme Check | `shopify theme check --path shopify/theme` (from `shopify/`) |
| Theme JS | `npx eslint shopify/theme/assets --ext .js` |
| React storefront | `cd frontend && npx eslint src --ext .ts,.tsx` (unchanged) |

## Locales

Spanish is the default locale file (`locales/es.default.json`). English is `locales/en.json`. Markets must publish EN at `/en`.
