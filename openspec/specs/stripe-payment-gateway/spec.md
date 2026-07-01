# Spec: Stripe Payment Gateway

## Purpose

Infrastructure and API integration for Stripe payments. Provides the Stripe client singleton, PaymentIntent creation at checkout, publishable key configuration endpoint, and webhook handler that processes payment lifecycle events to keep order state in sync.

## Requirements

### Requirement: Stripe client infrastructure is isolated in the infrastructure layer

The system SHALL provide a `stripeClient.ts` singleton in `backend/src/infrastructure/stripe/` that initializes the Stripe SDK using `STRIPE_SECRET_KEY` and `STRIPE_API_VERSION`. The client SHALL be selected by `STRIPE_MODE` (`test | live`), defaulting to `test`. The secret key SHALL never be returned by any API endpoint, logged, or serialized. Application startup SHALL fail fast if `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` are missing.

#### Scenario: Stripe client initializes from environment

- **WHEN** the backend starts with valid `STRIPE_SECRET_KEY` and `STRIPE_MODE=test`
- **THEN** the Stripe client is initialized with the test key and no request fails at startup

#### Scenario: Missing secret key causes startup failure

- **WHEN** `STRIPE_SECRET_KEY` is absent from the environment
- **THEN** the application throws an error at startup and does not serve requests

#### Scenario: Secret key never appears in API responses or logs

- **WHEN** any endpoint is called
- **THEN** no response body or log message contains the value of `STRIPE_SECRET_KEY`

---

### Requirement: Checkout creates a Stripe PaymentIntent and returns clientSecret

After `checkoutService.createOrder` persists the `CustomerOrder`, the system SHALL call `stripe.paymentIntents.create` with `amount` (order `totalAmount` converted to integer minor units via a centralized helper), `currency` (order `currency` lowercased), `metadata: { customerOrderId, orderNumber }`, `automatic_payment_methods: { enabled: true }`, and an idempotency key `order:{orderNumber}:pi`. The resulting `stripePaymentIntentId` SHALL be persisted on the order. The checkout response SHALL include `clientSecret` alongside the standard order object. If the Stripe API call fails, the order creation SHALL be rolled back and the endpoint SHALL return `503` with error code `PAYMENT_GATEWAY_UNAVAILABLE`.

#### Scenario: Successful checkout returns clientSecret

- **WHEN** a buyer submits a valid checkout request
- **THEN** the system creates the order and a Stripe PaymentIntent and returns `201` with `clientSecret` in the response body

#### Scenario: stripePaymentIntentId is persisted on order

- **WHEN** checkout succeeds
- **THEN** `CustomerOrder.stripePaymentIntentId` matches the Stripe PaymentIntent id

#### Scenario: Stripe failure rolls back order

- **WHEN** the Stripe API returns an error during PaymentIntent creation
- **THEN** the system returns `503` with `PAYMENT_GATEWAY_UNAVAILABLE` and no `CustomerOrder` is persisted

#### Scenario: Idempotent retry on duplicate orderNumber

- **WHEN** the same checkout is submitted twice with the same `orderNumber`
- **THEN** the Stripe idempotency key prevents a second PaymentIntent from being created

---

### Requirement: PaymentIntent supports all Stripe-enabled methods

The backend SHALL continue to create PaymentIntents with `automatic_payment_methods: { enabled: true }`. This setting is sufficient to support cards, Google Pay, and PayPal (via Stripe) with no change to the PaymentIntent creation logic. The `paymentMethodTypes` array SHALL NOT be hardcoded so that Stripe can dynamically present methods based on the customer's country and browser.

#### Scenario: PaymentIntent creation unchanged

- **WHEN** `POST /api/public/checkout` or `POST /api/public/checkout/guest` is called
- **THEN** the PaymentIntent is created with `automatic_payment_methods: { enabled: true }`
- **THEN** no `payment_method_types` array is explicitly set (allowing Stripe to decide)
- **THEN** the `clientSecret` returned is compatible with the Stripe Payment Element

#### Scenario: Webhook handles all payment method types uniformly

- **WHEN** `payment_intent.succeeded` is received for a payment made via card, Google Pay, or PayPal
- **THEN** the webhook handler sets `CustomerOrder.paymentStatus = Paid` without branching on payment method
- **THEN** the `StripeWebhookEvent` idempotency record is created to prevent duplicate processing

---

### Requirement: Google Pay domain verification documented

The system SHALL document that `mavile.es` must be registered with Stripe's domain verification API (or Dashboard) before Google Pay renders in production. This is a configuration/operational requirement, not a code change.

#### Scenario: Google Pay domain not verified

- **WHEN** `mavile.es` has not been verified with Stripe for Google Pay
- **THEN** Google Pay does not appear in the Payment Element in production, even if enabled in the Dashboard
- **THEN** all other payment methods (card, PayPal) continue to work normally

#### Scenario: Google Pay domain verified

- **WHEN** `mavile.es` is registered and verified in Stripe's domain registration for Google Pay
- **THEN** Google Pay appears in the Payment Element on supported browsers/devices in production

---

### Requirement: Minor-unit amount conversion is centralized and exact

The system SHALL provide a shared helper `toStripeAmount(amount: Decimal, currency: string): number` that converts a Prisma `Decimal` to integer minor units using `Math.round(amount.times(100).toNumber())`. All PaymentIntent and Refund Stripe API calls SHALL use this helper exclusively.

#### Scenario: EUR amount converts correctly to cents

- **WHEN** `toStripeAmount(new Decimal("29.99"), "EUR")` is called
- **THEN** the result is `2999`

#### Scenario: Rounding is applied for fractional minor units

- **WHEN** `toStripeAmount(new Decimal("10.005"), "EUR")` is called
- **THEN** the result is an integer (no fractional cents)

---

### Requirement: Publishable key is exposed via a public config endpoint

The system SHALL expose `GET /api/public/payments/config` requiring no authentication. The response SHALL return `{ publishableKey: string, mode: "test" | "live" }`. The `publishableKey` SHALL come from `STRIPE_PUBLISHABLE_KEY` environment variable. The `STRIPE_SECRET_KEY` SHALL never appear in this or any other response.

#### Scenario: Config endpoint returns publishable key

- **WHEN** the frontend calls `GET /api/public/payments/config`
- **THEN** the system returns `200` with `publishableKey` and `mode`

#### Scenario: Config endpoint never returns secret key

- **WHEN** `GET /api/public/payments/config` is called
- **THEN** the response body does not contain `STRIPE_SECRET_KEY` value or any key starting with `sk_`

---

### Requirement: Webhook handler processes Stripe events securely and idempotently

The system SHALL expose `POST /api/public/payments/webhook` using `express.raw({ type: 'application/json' })` middleware (mounted BEFORE global `express.json()`). The handler SHALL verify the `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET` using `stripe.webhooks.constructEvent`. Verification failure SHALL return `400` with `PAYMENT_WEBHOOK_SIGNATURE_INVALID` and no state change. Before processing, the handler SHALL check `StripeWebhookEvent` for the incoming `event.id`; if found, it SHALL return `200` immediately (no-op). After successful processing, the `event.id` SHALL be persisted to `StripeWebhookEvent`. The endpoint SHALL always return `200` to Stripe after persisting the event (even if business-logic processing encounters a handled error).

#### Scenario: Valid signature allows processing

- **WHEN** a Stripe event with a valid `Stripe-Signature` is received
- **THEN** the system processes the event and returns `200`

#### Scenario: Invalid signature is rejected

- **WHEN** a request arrives at the webhook route with a missing or forged `Stripe-Signature`
- **THEN** the system returns `400` with `PAYMENT_WEBHOOK_SIGNATURE_INVALID` and makes no state change

#### Scenario: Duplicate event is ignored

- **WHEN** the same Stripe `event.id` is received twice
- **THEN** the system returns `200` on the second call and makes no additional state change

---

### Requirement: payment_intent.succeeded transitions order to Paid

When the system receives a verified `payment_intent.succeeded` event, it SHALL resolve the `CustomerOrder` by `stripePaymentIntentId` (or `metadata.customerOrderId`), set `paymentStatus = Paid`, `status = Paid`, `paidAt = now()`, and persist `stripeChargeId` from the latest charge on the intent — all within a single Prisma transaction. If the order is already `Paid` or in a terminal payment state, the handler SHALL be a no-op (idempotent).

#### Scenario: Successful payment transitions order

- **WHEN** a verified `payment_intent.succeeded` event arrives for a PendingPayment order
- **THEN** the system sets `paymentStatus = Paid`, `status = Paid`, and `paidAt = now()` and persists `stripeChargeId`

#### Scenario: Already-paid order is ignored

- **WHEN** a `payment_intent.succeeded` event arrives for an order already in `status = Paid`
- **THEN** the system returns `200` with no state change

#### Scenario: Unknown PaymentIntent is logged and ignored

- **WHEN** a `payment_intent.succeeded` event references a `stripePaymentIntentId` not in the database
- **THEN** the system logs a warning and returns `200` without throwing

---

### Requirement: payment_intent.payment_failed sets paymentStatus to Failed

When the system receives a verified `payment_intent.payment_failed` event, it SHALL resolve the order by `stripePaymentIntentId`, set `paymentStatus = Failed`, and leave `status = PendingPayment` unchanged (the order is recoverable — the buyer may retry).

#### Scenario: Failed payment updates paymentStatus only

- **WHEN** a verified `payment_intent.payment_failed` event arrives
- **THEN** the system sets `paymentStatus = Failed` and `status` remains `PendingPayment`

#### Scenario: Buyer retries and succeeds after failure

- **WHEN** a `payment_intent.succeeded` event arrives after a prior `payment_intent.payment_failed` for the same order
- **THEN** the system sets `paymentStatus = Paid`, `status = Paid`, and `paidAt = now()`

---

### Requirement: Frontend confirms payment using Stripe Elements

The storefront checkout flow SHALL integrate `@stripe/react-stripe-js` and mount a `<PaymentElement>` after order items and address forms. On form submit, the frontend SHALL call `stripe.confirmPayment` with the `clientSecret` from the checkout response. On client-side success, the frontend SHALL navigate to the order confirmation page and poll `GET /api/public/account/orders` (or order status endpoint) every 2 seconds, up to 30 seconds, until `paymentStatus = Paid`. If polling times out, the frontend SHALL display "Payment processing — check your email for confirmation." 3DS/requires_action scenarios SHALL be handled by Stripe.js automatically.

#### Scenario: Payment confirmed redirects to confirmation screen

- **WHEN** Stripe.js reports `paymentIntent.status = "succeeded"` client-side
- **THEN** the frontend navigates to `/order-confirmation/:orderNumber` and polls for Paid status

#### Scenario: Payment failure shows retry option

- **WHEN** Stripe.js returns a payment error
- **THEN** the frontend displays the Stripe error message and allows the buyer to retry without losing their order

#### Scenario: 3DS challenge is handled transparently

- **WHEN** Stripe.js triggers a 3DS modal
- **THEN** the buyer completes authentication and the flow resumes automatically

#### Scenario: Polling timeout shows fallback message

- **WHEN** the order has not reached Paid after 30 seconds of polling
- **THEN** the frontend displays "Payment processing — check your email for confirmation"
