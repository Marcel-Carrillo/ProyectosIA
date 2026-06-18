## Context

The storefront catalog is live; `Customer`, `CustomerOrder`, and admin CRUD exist (KAN-17/18). There is **no** buyer identity, **no** cart/checkout, and **no** admin auth gate. This design unifies KAN-51, KAN-21, and KAN-23 with strict separation between customer and admin JWT namespaces.

## Goals / Non-Goals

**Goals:**
- Customer auth: email/password, Google/Apple/Facebook OAuth, TOTP 2FA, password recovery, account area.
- Checkout: cart → checkout → `CustomerOrder` creation (guest + authenticated), coupons, snapshots, `paymentStatus = Pending`.
- Admin auth: login screen, protect all `/api/admin/*` and admin React routes.
- Wishlist for logged-in buyers.
- Never expose supplier-internal fields on public APIs.

**Non-Goals:**
- Payment gateway (Stripe).
- Admin RBAC beyond single admin role.
- Admin coupon management UI.

## Decisions

### Decision 1: Dual JWT namespaces (customer vs admin)
**Choice:**
- Customer: `CUSTOMER_JWT_SECRET`, `aud: "customer"`, cookie name `customer_refresh`.
- Admin: `ADMIN_JWT_SECRET`, `aud: "admin"`, cookie name `admin_refresh`.
- Middleware `requireCustomerAuth` and `requireAdminAuth` each reject wrong `aud`.  
**Rationale:** KAN-23 and KAN-51 explicitly require isolation; prevents token confusion.

### Decision 2: `CustomerAccount` separate from `Customer`
**Choice:** 1:1 optional relation; guest checkout creates `Customer` without account.  
**Rationale:** CRM + guest orders without forcing registration.

### Decision 3: `AdminUser` model (seeded single admin for MVP)
**Choice:** `AdminUser` (`email`, `passwordHash`, `status`) + `AdminRefreshToken`. Seed from env `ADMIN_EMAIL` / `ADMIN_PASSWORD` on first migrate or via migration SQL.  
**Alternative:** Env-only credentials without DB. Rejected — harder to extend to multiple admins later.  
**Rationale:** Matches customer auth pattern; KAN-23 MVP allows single admin.

### Decision 4: Protect all admin routes in one middleware mount
**Choice:** Register `requireAdminAuth` before all `/api/admin/*` routers except `POST /api/admin/auth/login` and `POST /api/admin/auth/refresh`.  
**Rationale:** Closes R1 (unauthenticated admin) in one pass.

### Decision 5: Frontend admin guard
**Choice:** `AdminAuthProvider` + `RequireAdminAuth` wrapping admin `Layout` routes; `/admin/login` outside guard. Storefront routes unaffected.  
**Rationale:** Parallels `CustomerAuthContext` / `RequireCustomerAuth`.

### Decision 6: Cart — client-side MVP
**Choice:** `CartContext` + `localStorage` key `storefront_cart`; items `{ productVariantId, quantity, snapshot metadata for display }`. Server re-validates variant ids and prices at checkout.  
**Rationale:** KAN-21 MVP; no server cart table until needed.

### Decision 7: Checkout service (shared guest + auth)
**Choice:** `checkoutService.createOrder` used by:
- `POST /api/public/checkout/guest` — find-or-create `Customer` by email.
- `POST /api/public/checkout` — `customerId` from token only.  
Reuses admin order creation rules (snapshots, totals, transactional items). Optional `couponCode`.  
**Rationale:** Single source of truth; aligns with `customer-order-management` snapshot rules.

### Decision 8: Public order creation vs admin order management
**Choice:** **Create** orders on `/api/public/checkout*`; **list/get/update status** remains `/api/admin/customer-orders` (protected). Buyers see own orders via `/api/public/account/orders`.  
**Rationale:** Modifies `customer-order-management` requirement from "no public routes" to "no public admin management"; creation is buyer-initiated.

### Decision 9: OAuth, 2FA, password recovery (customer only)
**Choice:** As in prior KAN-51 design — TOTP on `CustomerAccount`, SMTP reset tokens, Google/Apple/Facebook OAuth. **Not** offered for admin in MVP.  
**Rationale:** KAN-23 MVP is credential login only.

### Decision 10: Coupons & wishlist
**Choice:** Unchanged from KAN-51 expansion — `Coupon`/`CouponRedemption`, `WishlistItem`; validate at checkout.

## Risks / Trade-offs

- **[Risk] Large unified PR** → Implement in layers: admin gate first (security) → customer auth → checkout → wishlist/coupons; parallel agents per Jira subtask groups.
- **[Risk] Breaking admin API consumers/tests** → Update all admin integration tests to login first; document test helper.
- **[Risk] Cart price drift** → Checkout always snapshots server-side prices at order creation.
- **[Trade-off] No server cart** → Multi-device cart not synced until phase 2.

## Migration Plan

1. `add_admin_auth` — `AdminUser`, `AdminRefreshToken`, seed admin.
2. `add_customer_account_auth` — customer auth tables.
3. `add_password_reset_and_2fa` — customer security fields.
4. `add_wishlist_coupons` — commerce support tables.
5. Wire middleware on admin routes before exposing checkout publicly.
6. Rollback: disable middleware mounts and remove new routes.

## Open Questions

- Confirm SMTP + OAuth credentials for customer flows; `ADMIN_EMAIL`/`ADMIN_PASSWORD` for seed.
- Coordinate E2E order: admin login → create supplier order path still manual (KAN-19).
