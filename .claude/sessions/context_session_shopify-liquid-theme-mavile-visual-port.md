# Context Session: shopify-liquid-theme-mavile-visual-port

## Change location
`openspec/changes/shopify-liquid-theme-mavile-visual-port/`

- [proposal.md](../../openspec/changes/shopify-liquid-theme-mavile-visual-port/proposal.md)
- [design.md](../../openspec/changes/shopify-liquid-theme-mavile-visual-port/design.md)
- [tasks.md](../../openspec/changes/shopify-liquid-theme-mavile-visual-port/tasks.md)
- Specs: `specs/mavile-shopify-theme-visual-system`, `storefront-shell`, `catalog-surfaces`, `cart-and-account`, `consent`

## Jira
None (no `.jira` file).

## Branch
`feature/shopify-liquid-theme-mavile-visual-port` from `develop`.

## Scope summary
Port **only** the Mavile visual system onto a Shopify Online Store 2.0 Liquid theme at `shopify/theme`. Shopify owns catalog, cart, hosted checkout, payments, classic customer accounts, orders, and apps.

**In:** tokens, layout shell, hero, collection grid, PDP, cart page, content/search/404, classic accounts, ES/EN, cookie banner → Customer Privacy API.

**Out:** Express/Prisma/Stripe, Mavile admin, Hydrogen, Storefront API, product/DNS/CJ migration, reviews, wishlist.

**Backend:** N/A — do not edit `backend/`.

**Frontend (React):** N/A for behavior — `frontend/src` is the visual reference only (copy tokens, CSS classes, brand assets). New surface is Liquid.

## Workspace isolation
Feature branch in the current checkout (related OpenSpec artifacts already present; no worktree).
