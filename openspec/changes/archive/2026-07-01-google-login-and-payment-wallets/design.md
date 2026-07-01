## Context

The storefront uses a password-based `CustomerAccount` model with Stripe Card Element for payments. The backend already contains a complete Google OAuth flow (`GET /api/public/auth/google`, `googleAuthStart`, `googleAuthCallback`, `google-auth-library`), an `oauthLogin` service method, and `CustomerAccount` fields for `googleId`, `authProvider`. The Stripe `PaymentIntent` is already created with `automatic_payment_methods: { enabled: true }`, meaning Google Pay and PayPal are gated only by the frontend element and Stripe Dashboard configuration.

## Goals / Non-Goals

**Goals:**
- Complete and expose the existing Google OAuth backend through a "Continue with Google" button in the login and register UI.
- Migrate the checkout UI from `CardElement` to `PaymentElement`, making Google Pay and PayPal appear automatically.
- Keep the existing webhook, `paymentStatus` state machine, idempotency, and admin refund flow intact.
- Ensure new Google registrations receive the WELCOME-15% coupon and welcome email (already in `oauthLogin` — verify, not build).

**Non-Goals:**
- PayPal native SDK (Path B) — not needed unless Stripe-PayPal is regionally unavailable.
- Apple Sign-In, Facebook login — infrastructure exists; separate change.
- Any change to supplier data, fulfillment, orders, shipments, or refund business logic.

## Decisions

### D1 — Google OAuth: reuse existing backend, add frontend only

The backend OAuth flow is complete. The only gaps are: SSM credentials populated, authorized redirect URI in Google Cloud Console, and the frontend "Continue with Google" button. No new routes, middleware, or service methods.

**Account-linking rule:** if the Google email matches an existing `CustomerAccount` with no `googleId` → set `googleId` on that account (link). If no account exists → create new `Customer` + `CustomerAccount` with `authProvider = 'google'`. This matches the existing `oauthLogin` implementation (finds by `{ OR: [{ googleId }, { email }] }`).

**Coupon & welcome email:** already triggered in `oauthLogin` via `ensureWelcomeCouponExists`. No code change needed — just verification.

**Alternative considered:** build a dedicated "Link account" UI step. Rejected — the current silent linking (matching by email) is sufficient for MVP and avoids UX friction.

### D2 — Google Pay + PayPal: Stripe Payment Element, no new backend

Migrating from `CardElement` to `PaymentElement` is purely a frontend change. The backend `createPaymentIntent` with `automatic_payment_methods: { enabled: true }` already supports all methods enabled in the Stripe Dashboard. The existing `stripe.confirmPayment` call replaces `stripe.confirmCardPayment`.

**Alternative considered:** keep Card Element, add explicit `paymentMethodTypes: ['google_pay', 'paypal']` to the PaymentIntent. Rejected — Payment Element is the Stripe-recommended path, handles method availability per device/browser, and requires less code than managing multiple element types.

### D3 — PayPal via Stripe (Path A)

PayPal is enabled in the Stripe Dashboard and appears in the Payment Element. The `payment_intent.succeeded` webhook, `StripeWebhookEvent` idempotency table, and `paymentStatus → Paid` transition are unchanged. Admin refunds use `stripe.refunds.create` as before.

**Alternative (Path B — native PayPal SDK):** would require new routes, new webhook, payment-provider abstraction, and changes to the refund pipeline. Chosen only as fallback if Stripe-PayPal is not available in Spain.

### D4 — No schema migration expected

`CustomerAccount` already has `googleId String?`, `authProvider String`, `status`. Verify at implementation time; add migration only if a column is genuinely missing.

## Risks / Trade-offs

- **[Risk] Stripe-PayPal regional availability** — PayPal as a Stripe payment method has limited regional support. If unavailable for Spain (ES), Path B is required (own change).  
  → **Mitigation:** verify in Stripe Dashboard before starting implementation. If unavailable, scope to Google login + Google Pay only for this change.

- **[Risk] Google Pay domain verification** — Google Pay requires the domain (`mavile.es`) to be registered and verified via Stripe's domain registration API or Dashboard before the button appears in production.  
  → **Mitigation:** include domain verification as an explicit setup step in tasks. Test with Stripe test mode on localhost using a test `requestPayerName` flow.

- **[Risk] Payment Element visual regression** — replacing Card Element changes the checkout UI; existing Stripe styling/theme may need updating.  
  → **Mitigation:** E2E Playwright test covers the full checkout flow with the new element before PR.

- **[Risk] `confirmPayment` redirect behavior** — `stripe.confirmPayment` for wallets triggers a redirect by default. Need `return_url` and the order-confirmation page to handle the redirect correctly.  
  → **Mitigation:** set `return_url` pointing to `/order-confirmation?orderId=...`; verify redirect handling in the checkout flow.

## Migration Plan

1. **Pre-flight (no code):** populate `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in SSM; set redirect URI in Google Cloud Console; enable Google Pay + PayPal in Stripe Dashboard; verify PayPal availability for ES; register `mavile.es` domain in Stripe for Google Pay.
2. **Backend verification:** run existing OAuth tests; confirm `googleId` column in schema; confirm `oauthLogin` triggers coupon. Add migration only if column missing.
3. **Frontend — Google login:** add "Continue with Google" button on login/register pages; handle redirect and `?token=` callback.
4. **Frontend — Payment Element:** replace `CardElement` with `PaymentElement` in authenticated checkout; update `stripe.confirmPayment`; add `return_url` handling.
5. **Frontend — Guest checkout:** same Payment Element migration for guest flow.
6. **E2E + deploy:** run Playwright checkout flow, deploy to production, verify Google Pay + PayPal appear on supported device.

**Rollback:** revert frontend Payment Element to Card Element; Google OAuth button can be hidden via feature flag or simply removed. No DB rollback needed.

## Open Questions

- Is PayPal available as a Stripe payment method for Spain (ES)? → **Verify before implementation starts.**
- Does the current checkout page use `CardElement` or is it already using a newer Stripe element? → **Verify in `frontend/src/pages/storefront/CheckoutPage.tsx`.**
- Is `googleId` already a column in `CustomerAccount` in `schema.prisma`? → **Verify at implementation start; migrate only if missing.**
