# Session: unified-auth-checkout

## Change
- OpenSpec: `openspec/changes/unified-auth-checkout`
- Jira: KAN-51, KAN-21, KAN-23
- Branch: `feature/unified-auth-checkout`

## Artifacts
- proposal.md, design.md, tasks.md
- specs: admin-authentication, customer-account-authentication, checkout-mvp, storefront-wishlist, storefront-coupons, customer-management, customer-order-management

## Implementation order
1. Admin auth (security gate) — backend then frontend
2. Customer auth + wishlist + coupons — backend then frontend
3. Checkout MVP — backend then frontend
4. Integration tests, verification reports, docs, PR

## Key decisions
- Dual JWT: `aud: "admin"` / `aud: "customer"`, separate secrets and refresh cookies
- Cart: client localStorage; server validates at checkout
- `checkoutService.createOrder` shared by guest + auth paths
