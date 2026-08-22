# Shopify migration — launch gap

This page lists work that remains **after** the Mavile Liquid theme is merged. Merging the theme does **not** put `mavile.es` on Shopify.

`docs/data-model.md` and `docs/api-spec.yml` are unchanged by the theme change: they still describe the live Express/Prisma/Stripe stack.

## Still required before cutover

| Item | Owner | Blocks live traffic? |
|------|--------|----------------------|
| Shopify development (then production) shop | Operator | Yes |
| Markets: Spain, EUR, ES default, EN at `/en` | Operator | Yes |
| Shopify Payments (Spain; confirm Bizum if required) | Operator | Yes |
| Collections `women`, `men`, `accessories`, `shoes` + menus | Operator | Yes |
| Catalog and media migration from Prisma/CJ | Operator + later change | Yes |
| Classic customer accounts enabled; Shopify cookie banner disabled | Operator | Theme account/consent |
| Checkout branding (logo, colours, radius) | Operator | Brand on checkout |
| CJ Dropshipping Shopify app install and mapping | Operator | Fulfillment |
| Tax and shipping rates | Operator | Checkout |
| Rights-cleared hero/category photography | Operator | Visual polish |
| Password / `noindex` until cutover | Operator | SEO |
| Customer and order history migration (if needed) | Later change | Accounts |
| DNS `mavile.es` → Shopify | Later change | Yes |
| Decommission Lambda / Prisma / Stripe | Later change | Cost |
| Reviews and wishlist replacements (apps or drop) | Later change | Feature parity |
| Theme Check + Playwright against a real preview URL | Engineering | Quality |

## Not in the theme change

* Express, Prisma, Stripe, Mavile admin, custom 2FA
* Hydrogen / Storefront API storefront
* Checkout UI extensions beyond branding
