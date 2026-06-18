## Why

The platform has three critical gaps blocking a sellable, secure ecommerce flow:

1. **Storefront (KAN-51):** Buyers cannot register, sign in, manage an account, save a wishlist, or apply coupons.
2. **Checkout (KAN-21):** The public catalog works but there is no cart or checkout — no real orders from the store.
3. **Admin security (KAN-23):** The entire admin panel (`/api/admin/*`) is unauthenticated; customer PII and supplier data are exposed to anyone with the URL.

This unified change delivers customer auth, full checkout MVP, and admin login in one coordinated implementation with **separate JWT namespaces** (`aud: "customer"` vs `aud: "admin"`).

## What Changes

### Customer storefront (KAN-51)

- `CustomerAccount`, refresh/reset tokens, OAuth (Google, Apple, Facebook), TOTP 2FA, password recovery.
- Public APIs: `/api/public/auth/*`, `/api/public/account/*` (profile, orders, wishlist).
- Storefront UI: login, register, account area, 2FA, recovery flows.

### Checkout MVP (KAN-21)

- Frontend **cart** (local state persisted in `localStorage`): add from PDP, `/cart` page.
- **Checkout flow**: shipping/billing → coupon → confirm → create `CustomerOrder` via public API.
- **Guest checkout** and **authenticated checkout** paths; price snapshots on line items.
- MVP payment: `paymentStatus = Pending` (no Stripe); order processable by admins (KAN-19 path).

### Admin authentication (KAN-23)

- `AdminUser` model (or seeded single admin) + `AdminRefreshToken`.
- `/api/admin/auth/login`, `logout`, `refresh`, `me` with `aud: "admin"` JWT.
- `requireAdminAuth` middleware on **all** existing `/api/admin/*` routes (except auth login).
- Admin login page, `AdminAuthContext`, route guard on admin `Layout`; unauthenticated users redirected to `/admin/login`.

### Shared commerce features (from expanded KAN-51 scope)

- **Wishlist** per authenticated customer.
- **Coupons** validate/apply at checkout.

## Capabilities

### New Capabilities

- `customer-account-authentication`: Storefront registration/login (email, Google, Apple, Facebook), 2FA, password recovery, sessions, "My account".
- `checkout-mvp`: Cart, checkout UI, guest and authenticated order placement via `/api/public/checkout/*`, coupon integration, `CustomerOrder` creation with snapshots.
- `admin-authentication`: Admin login, JWT gate on `/api/admin/*`, frontend admin route protection.
- `storefront-wishlist`: Authenticated wishlist CRUD.
- `storefront-coupons`: Coupon validate/apply at checkout.

### Modified Capabilities

- `customer-management`: Buyers access own profile via `/api/public/account/*`; admin CRM stays on `/api/admin/customers`.
- `customer-order-management`: Orders may be **created** via public checkout endpoints; admin list/edit/status endpoints remain admin-only and protected by `requireAdminAuth`.

## Impact

- **APIs:** `/api/public/auth/*`, `/api/public/account/*`, `/api/public/checkout/*`, `/api/public/coupons/*`, `/api/admin/auth/*`; all existing admin routes gated.
- **Backend:** Auth modules (customer + admin), checkout service, wishlist, coupons; Prisma migrations (`CustomerAccount`, `AdminUser`, `WishlistItem`, `Coupon`, etc.).
- **Frontend:** Storefront auth + cart + checkout + account; admin login + guards on all admin pages.
- **Security:** Dual JWT secrets; supplier data never in public responses; admin PII/supplier costs only after admin login.
- **Jira:** Unified under this change — KAN-51, KAN-21, KAN-23 (subtasks KAN-52–54, KAN-43–45, KAN-46–48).

## Non-goals

- Stripe or real payment capture (MVP stays `Pending`).
- Admin RBAC / multi-role permissions (single admin role for MVP).
- Admin coupon CRUD UI (seed coupons via migration).
- Reliable stock promises (`stockPolicy = SupplierManaged`).
- Email change with re-verification in profile.
