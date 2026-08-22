# Shopify shop prerequisites

- Date: 2026-08-22
- Change: shopify-liquid-theme-mavile-visual-port

## Status

**Incomplete.** No Shopify store credentials are configured in this workspace. Theme files are scaffolded and can be pushed later with `shopify theme dev --path shopify/theme --store <store>.myshopify.com`.

## Checklist (operator)

- [ ] Shop name Mavile
- [ ] Currency EUR, timezone Europe/Madrid
- [ ] Spain market; languages Spanish (default) + English at `/en`
- [ ] Password protection or storefront `noindex`
- [ ] Classic customer accounts
- [ ] Shopify cookie banner disabled
- [ ] Menus: All, Women, Men, Accessories, Shoes
- [ ] Collection handles: `women`, `men`, `accessories`, `shoes`
- [ ] 8–12 sample products with variants and 2+ images
- [ ] Policies: privacy, refund, terms, shipping
- [ ] Checkout branding (logo, colours, radius)

`shopify theme dev` and live Playwright wait on this list.
