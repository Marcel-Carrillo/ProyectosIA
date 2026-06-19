## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md`: verify current branch, working tree state, and remote
- [x] 0.2 Create and switch to feature branch `feature/stripe-payment-gateway` from `master`
- [x] 0.3 Verify branch creation with `git branch --show-current`

## 1. Backend: Data Model and Prisma Migration

- [x] 1.1 Add `stripePaymentIntentId String? @unique @db.VarChar(255)` to `CustomerOrder` in `backend/prisma/schema.prisma` with index
- [x] 1.2 Add `stripeChargeId String? @db.VarChar(255)` to `CustomerOrder` with index
- [x] 1.3 Add `StripeWebhookEvent` model: `id`, `stripeEventId @unique`, `type String`, `customerOrderId Int?`, `createdAt DateTime @default(now())`
- [x] 1.4 Run `npx prisma migrate dev --name add-stripe-payment-fields` and verify migration applies cleanly
- [x] 1.5 Run `npx prisma generate` to update the client
- [x] 1.6 Update `docs/data-model.md`: add new `CustomerOrder` Stripe fields and `StripeWebhookEvent` model

## 2. Backend: Stripe Infrastructure Layer

- [x] 2.1 Install Stripe SDK: `npm install stripe` in `backend/`
- [x] 2.2 Create `backend/src/infrastructure/stripe/stripeClient.ts` — singleton initialized from `STRIPE_SECRET_KEY` and `STRIPE_MODE` (test/live)
- [x] 2.3 Add `STRIPE_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` to env validation in `backend/src/index.ts` (production guard)
- [x] 2.4 Update `.env.example` with all `STRIPE_*` variable documentation
- [x] 2.5 Create `backend/src/infrastructure/stripe/toStripeAmount.ts` — `toStripeAmount(amount: Decimal, currency: string): number` helper using `Math.round(amount.times(100).toNumber())`
- [x] 2.6 Write unit tests for `toStripeAmount` covering EUR nominal values, rounding edge cases, and zero amount

## 3. Backend: Domain Models

- [x] 3.1 Update `backend/src/domain/models/customerOrder.ts` — add `stripePaymentIntentId: string | null` and `stripeChargeId: string | null` to the `CustomerOrder` domain model type
- [x] 3.2 Create `backend/src/domain/models/stripeWebhookEvent.ts` — `StripeWebhookEvent` type

## 4. Backend: Payment Service (PaymentIntent + Config + Webhook)

- [x] 4.1 Create `backend/src/application/services/paymentService.ts` with methods:
  - `createPaymentIntent(order: CustomerOrder): Promise<{ clientSecret: string; stripePaymentIntentId: string }>` — calls Stripe with amount/currency/metadata/idempotency-key
  - `getConfig(): { publishableKey: string; mode: string }`
  - `handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void>` — verifies signature, deduplicates via `StripeWebhookEvent`, dispatches to event handlers
  - `handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void>` — resolves order, sets `paymentStatus=Paid`, `status=Paid`, `paidAt`, `stripeChargeId`
  - `handlePaymentIntentFailed(event: Stripe.Event): Promise<void>` — sets `paymentStatus=Failed`
  - `handleChargeRefunded(event: Stripe.Event): Promise<void>` — reconciles `Refund` by `paymentProviderReference`, advances to `Completed` if in `Processing`
- [x] 4.2 Add `CustomerOrderRepository` lookup method: `findByStripePaymentIntentId(id: string): Promise<CustomerOrder | null>`
- [x] 4.3 Add `StripeWebhookEventRepository` with `findByStripeEventId` and `create` methods
- [x] 4.4 Add `StripeWebhookEventRepository` infrastructure implementation using Prisma
- [x] 4.5 Write unit tests for `paymentService`: PaymentIntent creation params, webhook signature guard, idempotent event dedup, each event handler's state transitions, guard against regressing `Paid` orders, `charge.refunded` reconciliation idempotency

## 5. Backend: Checkout Service — PaymentIntent Integration

- [x] 5.1 Update `backend/src/application/services/checkoutService.ts`: after `createOrder` call, invoke `paymentService.createPaymentIntent(order)`; persist `stripePaymentIntentId` on order; if Stripe call fails, rollback order creation and throw `PAYMENT_GATEWAY_UNAVAILABLE` (503)
- [x] 5.2 Update checkout service return type to include `{ order, clientSecret }`
- [x] 5.3 Add `PAYMENT_GATEWAY_UNAVAILABLE` to the validator/error codes registry
- [x] 5.4 Update unit tests for `checkoutService` to cover: successful PaymentIntent creation + `stripePaymentIntentId` persisted; Stripe failure rolls back order; idempotency key format matches `order:{orderNumber}:pi`

## 6. Backend: Refund Service — Stripe Refund Sync

- [x] 6.1 Update refund service `Pending → Processing` transition: call `stripe.refunds.create({ payment_intent, amount: toStripeAmount(...), ... })` with idempotency key `refund:{refundId}`; store Stripe refund id in `Refund.paymentProviderReference`; if Stripe fails, abort transition and throw `REFUND_STRIPE_ERROR` (409)
- [x] 6.2 Add `REFUND_STRIPE_ERROR` to error codes registry
- [x] 6.3 Update unit tests for refund service: Stripe refund created on Processing transition; Stripe failure keeps refund Pending; `paymentProviderReference` stores Stripe refund id; idempotency key format; `REFUND_AMOUNT_EXCEEDS_BALANCE` guard fires before Stripe call

## 7. Backend: Controllers and Routes

- [x] 7.1 Create `backend/src/presentation/controllers/paymentController.ts` with handlers:
  - `getConfig` → calls `paymentService.getConfig()`, returns `{ publishableKey, mode }`
  - `handleWebhook` → reads raw body from `req.rawBody`, calls `paymentService.handleWebhookEvent`; returns 400 on signature error, 200 otherwise
- [x] 7.2 Create `backend/src/routes/public/paymentRoutes.ts` — register `GET /config` (express.json) and `POST /webhook` (express.raw before json)
- [x] 7.3 Update `backend/src/index.ts`: mount `express.raw({ type: 'application/json' })` on `/api/public/payments/webhook` **before** the global `express.json()` middleware; import and mount `paymentRoutes` at `/api/public/payments`
- [x] 7.4 Update checkout controller to pass `clientSecret` through in the response body
- [x] 7.5 Write unit tests for `paymentController`: config returns publishable key; webhook rejects invalid signature; webhook processes valid Stripe test event; secret key never in response

## 8. Frontend: Install Stripe Dependencies

- [x] 8.1 Install `@stripe/stripe-js` and `@stripe/react-stripe-js` in `frontend/`: `npm install @stripe/stripe-js @stripe/react-stripe-js`
- [x] 8.2 Update `docs/frontend-standards.md` to document Stripe.js/Elements usage conventions

## 9. Frontend: Payment Step in Checkout

- [x] 9.1 Create `frontend/src/services/paymentService.ts` — `getStripeConfig(): Promise<{ publishableKey, mode }>` calling `GET /api/public/payments/config`
- [x] 9.2 Update `frontend/src/pages/storefront/CheckoutPage.tsx`: add payment step after address/coupon step using `<Elements>` provider (load Stripe from config), `<PaymentElement>`, and `stripe.confirmPayment` call with `clientSecret`
- [x] 9.3 Handle payment confirmation flow: on Stripe.js client-side success, navigate to `/order-confirmation/:orderNumber` with "processing" state; poll `GET /api/public/account/orders` every 2 s (max 30 s) for `paymentStatus = Paid`; on timeout show fallback message
- [x] 9.4 Handle payment failure: display Stripe error message; show retry button; preserve order and shipping data
- [x] 9.5 Handle `requires_action` (3DS): rely on Stripe.js `confirmPayment` automatic redirect/modal handling
- [x] 9.6 Write unit tests for checkout payment step: renders PaymentElement; success navigates to confirmation; failure shows error and retry; polling stops at Paid; polling timeout shows fallback

## 10. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 10.1 Review and update `backend/src/application/services/__tests__/checkoutService.test.ts` for new `clientSecret` return value and Stripe mock
- [x] 10.2 Review and update `backend/src/application/services/__tests__/refundService.test.ts` (or equivalent) for Stripe sync assertions
- [x] 10.3 Verify no existing test imports break due to new Stripe infrastructure imports (mock `stripeClient` in tests that don't need a real Stripe call)
- [x] 10.4 Add integration test that asserts no `sk_` or `STRIPE_SECRET_KEY` value appears in any response from checkout, config, or webhook endpoints

## 11. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 11.1 Capture pre-test database baseline: count of `CustomerOrder`, `Refund`, `StripeWebhookEvent` rows
- [x] 11.2 Run targeted unit tests: `cd backend && npx jest --testPathPattern="stripe|payment|checkout|refund" --forceExit`
- [x] 11.3 Run full backend unit test suite: `cd backend && npx jest --forceExit`
- [x] 11.4 Run frontend unit tests: `cd frontend && npx react-scripts test --watchAll=false --forceExit`
- [x] 11.5 Verify post-test database state matches pre-test baseline; restore if any mutations remain
- [x] 11.6 Create report `openspec/changes/stripe-payment-gateway/reports/YYYY-MM-DD-step-11-unit-test-and-db-verification.md`
- [x] 11.7 Mark step complete only after all tests pass and report file exists

## 12. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 12.1 Start backend server if not running
- [x] 12.2 Test `GET /api/public/payments/config` — verify returns `publishableKey` and `mode`; verify no `sk_` value present
- [x] 12.3 Test `POST /api/public/checkout` with valid test payload — verify `201` response includes `clientSecret` and `stripePaymentIntentId` on order; restore (delete) test order after
- [x] 12.4 Test `POST /api/public/checkout` with Stripe unavailable (mock) — verify `503 PAYMENT_GATEWAY_UNAVAILABLE` and no order created
- [x] 12.5 Test `POST /api/public/payments/webhook` with forged signature — verify `400 PAYMENT_WEBHOOK_SIGNATURE_INVALID`
- [x] 12.6 Test `POST /api/public/payments/webhook` with valid Stripe CLI test event (`payment_intent.succeeded`) — verify order transitions to `Paid`; restore order state after (signed locally with `generateTestHeaderString` + `whsec_placeholder`)
- [x] 12.7 Test `PATCH /api/admin/refunds/:id/status` with `{ status: "Processing" }` on a `Paid` order refund — verify Stripe refund id stored in `paymentProviderReference`; restore refund state after (verified via `e2e/stripe-checkout.spec.ts` with real `sk_test_*`)
- [x] 12.8 Test duplicate webhook event — verify idempotent `200` with no second state change (verified: StripeWebhookEvent count=1 after two identical POSTs)
- [x] 12.9 Verify database state matches pre-test baseline after all cleanup
- [x] 12.10 Create report `openspec/changes/stripe-payment-gateway/reports/YYYY-MM-DD-step-12-curl-endpoint-testing.md`

## 13. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 13.1 Ensure frontend and backend servers are running
- [x] 13.2 Navigate to `/catalog` and add a product to cart
- [x] 13.3 Proceed through checkout to the payment step; verify `<PaymentElement>` is rendered
- [x] 13.4 Fill checkout form with Stripe test card `4242 4242 4242 4242` (exp 12/34, CVC 123) and confirm payment (verified via `e2e/stripe-checkout.spec.ts` with real Stripe keys)
- [x] 13.5 Verify navigation to `/order-confirmation/:orderNumber` and polling begins (verified in E2E success flow)
- [x] 13.6 Wait for `paymentStatus = Paid` (webhook processing); verify confirmation page shows success (verified: simulated webhook + public payment-status polling)
- [x] 13.7 Test payment failure: use Stripe test card `4000 0000 0000 9995` (verified via `e2e/stripe-checkout.spec.ts`)
- [x] 13.8 Verify no Stripe secret key appears in browser network responses
- [x] 13.9 Restore any test orders created during E2E testing
- [x] 13.10 Create report `openspec/changes/stripe-payment-gateway/reports/YYYY-MM-DD-step-13-e2e-testing.md`

## 14. Update Technical Documentation (MANDATORY)

- [x] 14.1 Update `docs/data-model.md`: `CustomerOrder` new Stripe fields, `StripeWebhookEvent` model, payment state transitions diagram
- [x] 14.2 Update `docs/api-spec.yml`: new endpoints `GET /api/public/payments/config` and `POST /api/public/payments/webhook`; updated checkout response schema (add `clientSecret`); new error codes `PAYMENT_GATEWAY_UNAVAILABLE`, `PAYMENT_WEBHOOK_SIGNATURE_INVALID`, `REFUND_STRIPE_ERROR`; updated `PATCH /api/admin/refunds/:id/status` behavior note
- [x] 14.3 Update `docs/backend-standards.md`: Stripe client conventions, raw-body middleware ordering requirement, webhook signature verification pattern
- [x] 14.4 Update `docs/frontend-standards.md`: Stripe.js/Elements usage, `clientSecret` handling, payment polling pattern
- [x] 14.5 Update `docs/development_guide.md`: `STRIPE_*` env vars table, test vs live mode, `stripe listen` local webhook testing command

## 15. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 15.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [x] 15.2 Verify all tasks are marked `[x]` and required reports exist under `openspec/changes/stripe-payment-gateway/reports/`
- [x] 15.3 Stage all relevant files: backend src, frontend src, prisma schema + migration, OpenSpec artifacts, docs (exclude `.env`, `node_modules`, `dist`, `coverage`)
- [x] 15.4 Create commit with message: `feat(payments): integrate Stripe PaymentIntent checkout, webhook-driven status sync, and admin refund sync`
- [x] 15.5 Push branch: `git push -u origin feature/stripe-payment-gateway`
- [x] 15.6 Create Pull Request with `gh pr create` and report PR URL in chat
