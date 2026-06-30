## 0. Setup: Create Feature Branch (MANDATORY — FIRST STEP)

> Before executing this step, apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide whether to work in the current checkout or a dedicated Git worktree.

- [x] 0.1 Create feature branch `feature/google-login-and-payment-wallets` from `develop`
- [x] 0.2 Verify branch creation and confirm current working branch

## 1. Pre-flight: External Configuration Verification

> These checks are required before any code change. If any check fails, document the blocker in `openspec/changes/google-login-and-payment-wallets/reports/preflight.md` and defer the affected capability.

- [x] 1.1 Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in AWS SSM (`/ecommerce/prod/GOOGLE_CLIENT_ID`, `/ecommerce/prod/GOOGLE_CLIENT_SECRET`) — DONE: populated via `aws ssm put-parameter` (String + SecureString, region eu-north-1)
- [x] 1.2 Verify the authorized redirect URI in Google Cloud Console matches `API_PUBLIC_URL/api/public/auth/google/callback` — DONE: URI `https://api.mavile.es/api/public/auth/google/callback` configured by user in Google Cloud Console OAuth 2.0 Client
- [x] 1.3 Verify Google Pay is enabled in the Stripe Dashboard for the account — DONE: enabled via Stripe API on pmc_1Tk1S0DhzetI2439f8YmsEbs (available=true, value=on)
- [x] 1.4 Verify PayPal is available as a Stripe payment method for the account's country (Spain/ES) — DONE: enabled via Stripe API (available=true, value=on)
- [x] 1.5 Register `mavile.es` domain in Stripe for Google Pay domain verification — DONE: registered via Stripe API, id=apwc_1To0T6DhzetI2439wCtgRH8z
- [x] 1.6 Confirm `customerAuthService.oauthLogin` already calls `ensureWelcomeCouponExists` for new Google accounts (read `backend/src/application/services/customerAuthService.ts` lines ~307–369)

## 2. Backend: Schema and OAuth Verification

- [x] 2.1 Read `backend/prisma/schema.prisma` and confirm `CustomerAccount` has `googleId String?` column; if missing, add the field and generate a migration (`npx prisma migrate dev --name add-google-id`)
- [x] 2.2 Confirm `GET /api/public/auth/oauth/providers` returns `{ "google": true/false }` based on env vars (read `oauthConfig.ts:isGoogleOAuthConfigured`)
- [x] 2.3 Confirm `google-auth-library` is listed as a dependency in `backend/package.json`
- [x] 2.4 Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to SSM if missing:
  - `aws ssm put-parameter --name /ecommerce/prod/GOOGLE_CLIENT_ID --value "..." --type String --region eu-north-1`
  - `aws ssm put-parameter --name /ecommerce/prod/GOOGLE_CLIENT_SECRET --value "..." --type SecureString --region eu-north-1`
- [x] 2.5 Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `backend/.env` (dev) and `backend/.env.example` (placeholder)
- [x] 2.6 Add the new SSM parameters to `serverless.yml` environment section if not already present

## 3. Frontend: Google Login Button

- [x] 3.1 Read `frontend/src/services/customerAuthService.ts` to understand existing `customerLogin` and OAuth helpers
- [x] 3.2 In the login page (`frontend/src/pages/storefront/LoginPage.tsx`), call `GET /api/public/auth/oauth/providers` on mount and conditionally render the "Continue with Google" button
- [x] 3.3 The button links to `${API_BASE}/api/public/auth/google` (a full-page redirect, not `axios`)
- [x] 3.4 Apply consistent storefront button styling (`storefront-btn storefront-btn--outline`) and the Google icon (`react-bootstrap-icons` or inline SVG)
- [x] 3.5 Add the same "Continue with Google" button to the register page (`frontend/src/pages/storefront/RegisterPage.tsx` or equivalent) with the same conditional rendering
- [x] 3.6 Add a visual separator ("O continúa con") between the email/password form and the Google button on both pages
- [x] 3.7 Add i18n keys for the Google button and separator in `frontend/src/i18n/locales/es/auth.json` and `frontend/src/i18n/locales/en/auth.json`

## 4. Frontend: OAuth Callback — Session Restoration

- [x] 4.1 Read `frontend/src/App.tsx` to understand routing and the `/account` route
- [x] 4.2 In the AccountPage or a dedicated `OAuthCallbackHandler` component, detect `?token=<accessToken>` in the URL on mount
- [x] 4.3 If the token param is present: call `setCustomerAccessToken(token)`, remove it from the URL with `history.replaceState`, then reload the customer session via `customerMe()`
- [x] 4.4 Update `CustomerAuthContext` to expose a `restoreFromToken(token)` helper or handle the token directly in the account page effect
- [x] 4.5 Ensure the user lands on `/account` fully authenticated after the Google callback redirect

## 5. Frontend: Checkout — Migrate to Stripe Payment Element

- [x] 5.1 Read the current checkout page (`frontend/src/pages/storefront/CheckoutPage.tsx`) to identify whether `CardElement` or `PaymentElement` is currently used
- [x] 5.2 Replace `CardElement` (and `CardNumberElement` / `CardExpiryElement` / `CardCvcElement` if used) with `PaymentElement` from `@stripe/react-stripe-js`
- [x] 5.3 Replace `stripe.confirmCardPayment(clientSecret, { payment_method: { card: element } })` with `stripe.confirmPayment({ elements, confirmParams: { return_url: '${window.location.origin}/order-confirmation' } })`
- [x] 5.4 Pass the `clientSecret` to `<Elements stripe={stripePromise} options={{ clientSecret }}>` wrapping the form
- [x] 5.5 Remove any custom card field labels, icons, or error handling that was specific to `CardElement`; let `PaymentElement` handle its own UI
- [x] 5.6 Add `return_url` pointing to `/order-confirmation?orderId=<orderId>` (or the existing order confirmation route) so Stripe can redirect after payment

## 6. Frontend: Guest Checkout — Same Payment Element Migration

- [x] 6.1 Identify the guest checkout page/component (may be the same `CheckoutPage.tsx` or a separate guest flow)
- [x] 6.2 Apply the same `PaymentElement` migration as steps 5.2–5.6 to the guest checkout form
- [x] 6.3 Ensure `return_url` is also set for guest checkout redirects

## 7. Frontend: Order Confirmation — Handle Payment Redirect

- [x] 7.1 Read the order confirmation page or route to understand how it currently displays payment results
- [x] 7.2 On mount, read `payment_intent` and `payment_intent_client_secret` from URL query params (set by Stripe redirect)
- [x] 7.3 If these params are present, call `stripe.retrievePaymentIntent(clientSecret)` to confirm the payment status
- [x] 7.4 Display a success message when `paymentIntent.status === 'succeeded'`; display an error/retry message for other statuses
- [x] 7.5 Remove the params from the URL after processing (`history.replaceState`)

## 8. Review and Update Existing Unit Tests (MANDATORY)

- [x] 8.1 Read `backend/src/routes/public/__tests__/customerAuthExtended.test.ts` and any existing OAuth tests; confirm they still pass with any schema change made in step 2.1
- [x] 8.2 Read frontend test files for login, register, and checkout pages; update snapshots or assertions if the UI changed (Google button added, CardElement removed)
- [x] 8.3 Add unit tests for the OAuth callback token-restoration logic (step 4)
- [x] 8.4 Verify that `mockResolvedValue` for `isGoogleOAuthConfigured` is correctly handled in existing auth tests

## 9. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 9.1 Capture pre-test baseline: count of `CustomerAccount` rows, confirm no `googleId` column issues
- [x] 9.2 Run targeted backend unit tests: `cd backend && npx jest --testPathPattern="customerAuth" --forceExit`
- [x] 9.3 Run full backend unit test suite: `cd backend && npx jest --forceExit`
- [x] 9.4 Run frontend unit tests: `cd frontend && npx react-scripts test --watchAll=false --testMatch="**/LoginPage*,**/CheckoutPage*,**/customerAuthService*"`
- [x] 9.5 Verify post-test database state: no orphaned `CustomerAccount` rows, no mutation from test runs
- [x] 9.6 Create report `openspec/changes/google-login-and-payment-wallets/reports/YYYY-MM-DD-step-9-unit-test-and-db-verification.md`
- [x] 9.7 Mark step complete only after all tests pass and report file exists

## 10. Manual Endpoint Testing with curl (MANDATORY — AGENT MUST EXECUTE)

- [x] 10.1 Ensure backend server is running (`cd backend && npx ts-node-dev src/index.ts` or equivalent)
- [x] 10.2 Test `GET /api/public/auth/oauth/providers` — verify `{ "google": true/false }` response based on env
- [x] 10.3 Test `GET /api/public/auth/google` — verify redirect to Google OAuth URL (HTTP 302 with `Location` header)
- [x] 10.4 Test `POST /api/public/auth/login` with a local account that has no `googleId` — verify normal login still works
- [x] 10.5 Test `GET /api/public/payments/config` — verify Stripe publishable key is returned for Payment Element initialization
- [x] 10.6 Test error cases: missing `state` cookie on callback (`GET /api/public/auth/google/callback?code=x` without cookie) — verify HTTP 400
- [x] 10.7 Create report `openspec/changes/google-login-and-payment-wallets/reports/YYYY-MM-DD-step-10-curl-endpoint-testing.md`
- [x] 10.8 Verify database state unchanged after curl tests

## 11. E2E Testing with Playwright MCP (MANDATORY — AGENT MUST EXECUTE)

- [x] 11.1 Start frontend and backend servers
- [x] 11.2 Navigate to `/login` using `browser_navigate`; take snapshot and confirm "Continue with Google" button is visible (if Google OAuth is configured)
- [x] 11.3 Navigate to `/register`; confirm "Continue with Google" button also appears on the register page
- [x] 11.4 Navigate to checkout (add a product first if needed); confirm the Stripe Payment Element renders with card input (Google Pay and PayPal depend on browser/device support in test environment)
- [x] 11.5 Complete a test card payment through the Payment Element (`4242 4242 4242 4242`, future expiry, any CVC); verify redirect to order confirmation page
- [x] 11.6 Verify order confirmation page displays a success message after the redirect
- [x] 11.7 Test error scenario: submit checkout with an invalid card (`4000 0000 0000 0002`); verify inline error message in Payment Element
- [x] 11.8 Restore test environment: cancel or void any test payment intents created; clean up any test orders in DB if needed
- [x] 11.9 Create report `openspec/changes/google-login-and-payment-wallets/reports/YYYY-MM-DD-step-11-e2e-testing.md`
- [x] 11.10 Mark step complete only after all E2E tests pass and report exists

## 12. Update Technical Documentation (MANDATORY)

- [x] 12.1 Update `docs/api-spec.yml`: add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the environment variable list in the production setup section; confirm Google OAuth routes are documented
- [x] 12.2 Update `docs/development_guide.md`: add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the local dev env vars section; document that Google Pay requires domain verification in Stripe before going to production
- [x] 12.3 Update `backend/.env.example`: add `GOOGLE_CLIENT_ID=` and `GOOGLE_CLIENT_SECRET=` placeholders with comments
- [x] 12.4 Update `docs/data-model.md` only if a migration was added in step 2.1 (new `googleId` column)
- [x] 12.5 Update `serverless.yml` comments to include the new SSM parameters in the creation reference block at the bottom

## 13. Commit and Create Pull Request (MANDATORY — LAST STEP)

- [x] 13.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [x] 13.2 Verify all tasks above are marked `[x]` and all required reports exist under `openspec/changes/google-login-and-payment-wallets/reports/`
- [x] 13.3 Stage all relevant files (exclude `.env`, `node_modules`, `dist`, `coverage`)
- [x] 13.4 Create commit: `feat(auth,checkout): add Google login and Stripe Payment Element (Google Pay + PayPal)`
- [x] 13.5 Push branch `feature/google-login-and-payment-wallets` to remote origin
- [x] 13.6 Create Pull Request with `gh pr create` targeting `develop`; include summary of the three capabilities, pre-flight checklist results, and E2E verification status; report PR URL in chat
