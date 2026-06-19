# Context Session: stripe-payment-gateway

## Change Overview
Stripe payment gateway integration: PaymentIntent-based checkout, webhook-driven status reconciliation, and admin refund synchronization.

## Key Files
- Proposal: openspec/changes/stripe-payment-gateway/proposal.md
- Design: openspec/changes/stripe-payment-gateway/design.md
- Specs: openspec/changes/stripe-payment-gateway/specs/
- Tasks: openspec/changes/stripe-payment-gateway/tasks.md

## Scope
- Backend: Stripe infra layer, PaymentService, CheckoutService update, RefundService update, PaymentController, PaymentRoutes, Prisma migration
- Frontend: @stripe/react-stripe-js integration, CheckoutPage payment step, polling, error handling

## Critical Design Decisions
1. Collect-at-checkout (automatic capture, not authorize/capture)
2. Webhook is the ONLY authoritative signal for Paid — never client-side
3. Stripe refund created on Pending→Processing transition
4. StripeWebhookEvent table for idempotency
5. express.raw() scoped to /api/public/payments/webhook BEFORE express.json()
6. Config endpoint GET /api/public/payments/config for publishable key
7. toStripeAmount() centralized helper for Decimal→minor units

## State Transitions
- checkout → PendingPayment/Pending
- payment_intent.succeeded → Paid/Paid + paidAt + stripeChargeId
- payment_intent.payment_failed → paymentStatus=Failed (status=PendingPayment)
- Refund Pending→Processing → stripe.refunds.create + paymentProviderReference
- charge.refunded → Refund Processing→Completed + paymentStatus recalc

## New Error Codes
- PAYMENT_GATEWAY_UNAVAILABLE (503)
- PAYMENT_WEBHOOK_SIGNATURE_INVALID (400)
- REFUND_STRIPE_ERROR (409)

## Branch
feature/stripe-payment-gateway
