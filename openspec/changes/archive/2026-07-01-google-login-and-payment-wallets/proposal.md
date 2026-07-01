## Why

The storefront currently requires shoppers to create a password-based account and pay exclusively by card through Stripe's Card Element. Adding Google login, Google Pay, and PayPal reduces two of the highest-friction points in fashion ecommerce — account creation and payment entry — directly improving conversion and reducing cart abandonment.

## What Changes

- **Google login (complete existing implementation):** The backend OAuth flow for Google already exists (`/api/public/auth/google`, `googleAuthController`, `google-auth-library`). This change wires it up end-to-end: verifies SSM credentials are in place, confirms the account-linking rule (email match → link `googleId`; new email → create account), ensures new Google registrations receive the WELCOME-15% coupon and welcome email, and adds the "Continue with Google" button to the login/register UI.
- **Google Pay at checkout (Stripe Payment Element):** The existing `PaymentIntent` already enables `automatic_payment_methods`. Migrating the checkout UI from the legacy Card Element to the Stripe Payment Element exposes Google Pay (and other wallets) with no backend changes.
- **PayPal at checkout (via Stripe — Path A):** Enable PayPal as a Stripe payment method in the Stripe Dashboard. It appears natively inside the Payment Element alongside Google Pay. The existing webhook, idempotency, `paymentStatus` state machine, and admin refund flow all remain unchanged.

**Non-goals**
- PayPal native SDK integration (Path B) — out of scope unless Stripe-PayPal is unavailable in the account region.
- Apple Pay, Facebook login (infrastructure exists for both; separate change).
- Admin-panel changes — no internal views are affected.
- Any change to supplier fulfillment, stock, order processing, or shipment logic.

## Capabilities

### New Capabilities
- `google-oauth-login`: End-to-end Google Sign-In flow for customer registration and login, including account linking, CSRF state validation, welcome coupon, and session issuance.
- `stripe-payment-element`: Checkout UI migration from Card Element to Stripe Payment Element, enabling Google Pay and PayPal wallet rendering in both authenticated and guest checkout.
- `paypal-stripe-checkout`: PayPal as a payment method surfaced through the Stripe Payment Element; no new backend payment provider.

### Modified Capabilities
- `customer-account-authentication`: OAuth account-linking rule added (Google email match → set `googleId`; new email → create account with coupon).
- `checkout-mvp`: Checkout page migrates to Stripe Payment Element; accepted payment methods expand to include Google Pay and PayPal.
- `stripe-payment-gateway`: `automatic_payment_methods` already enabled; confirm no change needed to PaymentIntent creation; document Google Pay domain verification requirement.

## Impact

**Backend**
- No new routes or migrations expected (Google OAuth routes exist; Stripe path requires no new endpoints).
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` SSM parameters are populated.
- Confirm `CustomerAccount.googleId` column exists in `schema.prisma`; add migration only if missing.
- Confirm `oauthLogin` already triggers welcome coupon + email for new Google registrations (it does — `ensureWelcomeCouponExists` is called in the OAuth branch).

**Frontend**
- Login/Register pages: add "Continue with Google" button using the existing `/api/public/auth/google` redirect.
- Checkout page: replace Stripe `CardElement` with `PaymentElement`; update `stripe.confirmPayment` call.
- Guest checkout: same Payment Element migration.

**External / config**
- Google Cloud Console: authorized redirect URI = `API_PUBLIC_URL/api/public/auth/google/callback`.
- Stripe Dashboard: enable Google Pay (requires domain verification for `mavile.es`) and PayPal (subject to regional availability).
- AWS SSM: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` must be set in `/ecommerce/prod/`.

**Dependencies**
- `qrcode.react` already added (unrelated); no new npm dependencies expected for Path A (Stripe Payment Element is part of `@stripe/react-stripe-js` already installed).
