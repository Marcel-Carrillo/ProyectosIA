# Backend plan — shopify-liquid-theme-mavile-visual-port

**Status:** Out of scope.

This change adds a Shopify Online Store 2.0 Liquid theme. It does **not** modify:

- `backend/src/**`
- Prisma schema or migrations
- Express routes, Stripe, CJ Lambda, OpenAPI (`docs/api-spec.yml`)
- `docs/data-model.md` contracts

No backend-developer subagent was spawned. There is no Application/Domain/Infrastructure work.

Verification still runs backend `npm test` / `npm run lint` as a **regression** gate to prove the theme change did not touch the API.
