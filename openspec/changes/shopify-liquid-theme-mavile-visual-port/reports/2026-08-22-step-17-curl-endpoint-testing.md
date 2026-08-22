# Step 17 Report — curl endpoint testing

- Date: 2026-08-22
- Change: shopify-liquid-theme-mavile-visual-port

## Commands executed

None against Mavile `/api/public/*`. This change adds no Express endpoints.

Theme JS only calls Shopify Ajax Cart and Customer Privacy APIs. Grep of `shopify/theme` for `/api/public` and `VITE_` tokens:

- No Mavile API URLs in theme files (verified during implementation).

## Database

No CREATE/UPDATE/DELETE against Prisma. Restore: not applicable.

## Outcome

- Step 17 status: PASS (N/A documented)
- Live Shopify `cart.js` curl is blocked until a development store exists (see shop prerequisites report).
