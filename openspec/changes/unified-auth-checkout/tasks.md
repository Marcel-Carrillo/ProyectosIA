# Tasks

> **Unified change:** KAN-51 + KAN-21 + KAN-23 → OpenSpec `unified-auth-checkout`
>
> | Jira | Scope | Subtasks |
> |------|-------|----------|
> | KAN-23 | Admin auth (do first — security) | KAN-46 Backend, KAN-47 Frontend, KAN-48 Integration |
> | KAN-51 | Customer auth, wishlist, coupons | KAN-52 Backend, KAN-53 Frontend, KAN-54 Integration |
> | KAN-21 | Cart + checkout MVP | KAN-43 Backend, KAN-44 Frontend, KAN-45 Integration |
>
> Reports: `openspec/changes/unified-auth-checkout/reports/`
>
> **Agent workflow (MANDATORY):** Mark `- [x]` immediately after each sub-task. Verification only after tests + report.

## 0. Setup (MANDATORY - FIRST)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md`
- [x] 0.2 Create branch `feature/unified-auth-checkout` (or `feature/KAN-51`) from `master`
- [x] 0.3 Verify branch status

---

## A. Admin authentication (KAN-23) — implement first

### A1. Backend (KAN-46)

- [x] A1.1 Prisma: `AdminUser`, `AdminRefreshToken`; seed from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
- [x] A1.2 `adminTokenService` (`aud: "admin"`), `adminAuthService`, `adminAuthController`
- [x] A1.3 `requireAdminAuth` middleware; mount on **all** `/api/admin/*` except login/refresh
- [x] A1.4 Routes `/api/admin/auth/*`; env `ADMIN_JWT_SECRET`; tests + update admin tests to login first

### A2. Frontend (KAN-47)

- [x] A2.1 `AdminAuthContext`, `adminAuthService`, axios admin interceptor
- [x] A2.2 `AdminLoginPage` at `/admin/login`
- [x] A2.3 `RequireAdminAuth` on admin `Layout` routes; logout in navbar
- [x] A2.4 Unit tests; verify unauthenticated `/customers` redirects to login

### A3. Integration (KAN-48)

- [x] A3.1 Smoke: login → access customers API → logout → 401 on admin API

---

## B. Customer account authentication (KAN-51)

### B1. Backend (KAN-52) — core auth

- [x] B1.1 Prisma: `CustomerAccount`, `CustomerRefreshToken`; migration + generate
- [x] B1.2 Customer token service (`aud: "customer"`), password hasher, Google verifier
- [x] B1.3 `customerAuthService` + `customerAccountService`; public auth/account routes
- [x] B1.4 `requireCustomerAuth`; order isolation tests

### B2. Backend (KAN-52) — extended auth

- [x] B2.1 2FA (TOTP), password reset tokens, SMTP email
- [x] B2.2 Apple + Facebook OAuth routes
- [x] B2.3 Tests for 2FA, reset, OAuth mocks

### B3. Backend (KAN-52) — wishlist & coupons

- [x] B3.1 `WishlistItem` migration + `/api/public/account/wishlist`
- [x] B3.2 `Coupon`, `CouponRedemption` + `/api/public/coupons/validate`

### B4. Frontend (KAN-53)

- [x] B4.1 `CustomerAuthContext`, login/register, Google/Apple/Facebook buttons
- [x] B4.2 Account pages: profile, orders, wishlist, 2FA, forgot/reset password
- [x] B4.3 `StorefrontHeader` auth state; route guards
- [x] B4.4 Unit tests

### B5. Integration (KAN-54)

- [x] B5.1 Smoke: register → login → profile → wishlist → logout

---

## C. Checkout MVP (KAN-21)

### C1. Backend (KAN-43)

- [x] C1.1 `checkoutService.createOrder` — snapshots, totals, coupon apply, transactional
- [x] C1.2 `POST /api/public/checkout/guest` + `POST /api/public/checkout` (auth)
- [x] C1.3 Tests: guest, auth, coupon, snapshot, variant not found

### C2. Frontend (KAN-44)

- [x] C2.1 `CartContext` + localStorage; Add to cart on PDP
- [x] C2.2 `CartPage` (`/cart`), `CheckoutPage` (`/checkout`) — guest + auth paths, coupon field
- [x] C2.3 Order confirmation page; responsive 360px+
- [x] C2.4 Unit tests

### C3. Integration (KAN-45)

- [x] C3.1 E2E path: cart → guest checkout → order → admin login → see order in admin panel
- [x] C3.2 E2E path: login → cart → checkout with coupon → order in My orders

---

## D. Full integration smoke (all three features)

- [x] D.1 Guest checkout → register same email → order in account
- [x] D.2 Admin cannot access panel without login; customer token rejected on admin API
- [x] D.3 Customer token cannot access admin routes

---

## E. Review and Update Existing Unit Tests (MANDATORY)

- [x] E.1 Update all admin integration/controller tests to authenticate first
- [x] E.2 Full backend + frontend suites green

## F. Run Unit Tests and Verify Database State (MANDATORY)

- [x] F.1 DB baseline; run Jest + `tsc` both sides
- [x] F.2 Restore DB; report `reports/2026-06-18-step-F-unit-test-and-db-verification.md`

## G. Manual Endpoint Testing with curl (MANDATORY)

- [x] G.1 Admin auth: login, me, refresh, logout; protected route 401 without token
- [x] G.2 Customer auth: register, login, 2FA, reset, OAuth (or mock)
- [x] G.3 Checkout guest + auth + coupon; wishlist CRUD
- [x] G.4 Restore DB; report `reports/2026-06-18-step-G-curl-endpoint-testing.md`

## H. E2E Testing with Playwright MCP (MANDATORY)

- [x] H.1 Admin login → customers list
- [x] H.2 Storefront: cart → checkout → confirmation
- [x] H.3 Register → wishlist → checkout logged in
- [x] H.4 Report `reports/2026-06-18-step-H-e2e-testing.md`

## I. Update Technical Documentation (MANDATORY)

- [x] I.1 `docs/data-model.md` — AdminUser, CustomerAccount, Wishlist, Coupon, checkout entities
- [x] I.2 `docs/api-spec.yml` — all new endpoints; note admin auth requirement on existing admin paths
- [x] I.3 `docs/backend-standards.md` — dual JWT namespaces + middleware section if needed

## J. Commit and Create Pull Request (MANDATORY - LAST)

- [x] J.1 Apply `ai-specs/skills/commit/SKILL.md`
- [x] J.2 All tasks `[x]` + reports exist
- [x] J.3 Commit, push, `gh pr create` — reference KAN-51, KAN-21, KAN-23 in PR body
