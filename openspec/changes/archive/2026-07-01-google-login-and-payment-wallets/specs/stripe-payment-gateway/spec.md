## MODIFIED Requirements

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

### Requirement: Google Pay domain verification documented
The system SHALL document that `mavile.es` must be registered with Stripe's domain verification API (or Dashboard) before Google Pay renders in production. This is a configuration/operational requirement, not a code change.

#### Scenario: Google Pay domain not verified
- **WHEN** `mavile.es` has not been verified with Stripe for Google Pay
- **THEN** Google Pay does not appear in the Payment Element in production, even if enabled in the Dashboard
- **THEN** all other payment methods (card, PayPal) continue to work normally

#### Scenario: Google Pay domain verified
- **WHEN** `mavile.es` is registered and verified in Stripe's domain registration for Google Pay
- **THEN** Google Pay appears in the Payment Element on supported browsers/devices in production
