## Why

The checkout MVP creates `CustomerOrder` records in `PendingPayment`/`Pending` state but never collects real money, making the store commercially inoperable. Integrating Stripe closes this gap: customers pay at checkout with a PCI-compliant card form, orders are confirmed automatically on verified payment, and admins can issue refunds that sync back to Stripe — enabling a fully operational supplier-fulfilled commerce cycle.

## What Changes

- Stripe SDK added as a backend dependency; a singleton `stripeClient` wraps key/mode resolution.
- Two new fields on `CustomerOrder`: `stripePaymentIntentId` (unique) and `stripeChargeId`, both nullable and indexed.
- New `StripeWebhookEvent` model for idempotency and audit (persists processed `event.id` to prevent double-processing).
- `checkoutService.createOrder` now creates a Stripe PaymentIntent after persisting the order and returns `clientSecret` to the caller.
- New endpoint `GET /api/public/payments/config` exposes the publishable key and mode to the frontend securely.
- New endpoint `POST /api/public/payments/webhook` (raw body, Stripe-signature-verified) handles `payment_intent.succeeded` → order `Paid`, `payment_intent.payment_failed` → `paymentStatus = Failed`, and `charge.refunded` → refund reconciliation.
- Admin refund flow extended: when a `Refund` is processed, a Stripe refund is created and its id stored in `Refund.paymentProviderReference`; existing validations (`REFUND_ORDER_NOT_PAID`, `REFUND_AMOUNT_EXCEEDS_BALANCE`) are applied before calling Stripe.
- Frontend checkout UI gains a Stripe Elements payment step; confirmation polling waits for backend `Paid` state before showing success.
- `express.raw()` middleware mounted on the webhook route before the global `express.json()` to preserve the raw body required for signature verification.
- **BREAKING:** checkout response shape changes — adds `clientSecret` field; clients must pass it to Stripe.js to confirm payment.

## Capabilities

### New Capabilities
- `stripe-payment-gateway`: Stripe client infrastructure, PaymentIntent creation at checkout, config endpoint (publishable key), webhook handler (signature verification, idempotency, event routing), `StripeWebhookEvent` model, new `CustomerOrder` Stripe fields, payment status state machine (Pending → Paid / Failed), frontend payment confirmation with Stripe Elements, test/live mode switch via env.
- `stripe-refund-sync`: Admin-initiated refunds now call `stripe.refunds.create`, persist the Stripe refund id in `Refund.paymentProviderReference`, and reconcile inbound `charge.refunded` webhook events idempotently.

### Modified Capabilities
- `checkout-mvp`: checkout endpoints now return `clientSecret` alongside the order; checkout UI adds a payment confirmation step via Stripe.js.
- `refund-management`: refund service calls Stripe on processing; Stripe refund id stored; `charge.refunded` webhook reconciles without double-counting admin-initiated refunds.

## Impact

**Domain concepts:** `CustomerOrder` (new Stripe fields, payment status transitions), `Refund` (Stripe sync on processing).

**APIs:**
- `POST /api/public/checkout` and `POST /api/public/checkout/guest` — response adds `clientSecret`.
- `GET /api/public/payments/config` — new.
- `POST /api/public/payments/webhook` — new (raw body).
- `POST /api/admin/refunds` / `PATCH /api/admin/refunds/{id}/status` — now trigger Stripe refund creation.

**Backend infrastructure:** Stripe Node.js SDK (`stripe`), new env vars (`STRIPE_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`), raw-body middleware ordering in `index.ts`.

**Frontend dependencies:** `@stripe/stripe-js` (+ `@stripe/react-stripe-js`), new Payment Element component, checkout flow update.

**Prisma migration:** adds `stripePaymentIntentId`, `stripeChargeId` to `CustomerOrder`; adds `StripeWebhookEvent` model.

**Non-goals:** saved cards / off-session payments, multi-currency, Apple/Google Pay wallets, authorize-then-capture, automated dunning/retry UI, Stripe Tax, non-card payment methods (SEPA, Klarna), multi-provider abstraction layer.
