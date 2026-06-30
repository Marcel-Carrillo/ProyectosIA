## ADDED Requirements

### Requirement: PayPal is available as a checkout payment method via Stripe
The system SHALL support PayPal as a payment method at checkout through the Stripe Payment Element (Path A). PayPal SHALL appear as a selectable option when: (a) it is enabled in the Stripe Dashboard for the account, and (b) it is available for the customer's country. The entire PayPal flow SHALL be handled by Stripe — no PayPal SDK, no separate PayPal webhook, and no changes to the refund pipeline are required.

#### Scenario: PayPal option appears in Payment Element
- **WHEN** PayPal is enabled in the Stripe Dashboard and the customer's country supports PayPal via Stripe
- **THEN** a PayPal option is rendered inside the Stripe Payment Element on the checkout page

#### Scenario: Customer pays with PayPal
- **WHEN** a customer selects PayPal and completes the PayPal authorization
- **THEN** Stripe receives the payment confirmation and fires `payment_intent.succeeded`
- **THEN** the existing webhook handler sets `CustomerOrder.paymentStatus = Paid` — no special PayPal handling in backend code

#### Scenario: PayPal payment fails or is cancelled
- **WHEN** a customer cancels the PayPal flow or PayPal declines
- **THEN** `stripe.confirmPayment` returns an error
- **THEN** the Payment Element displays an inline error; `paymentStatus` remains `PendingPayment`

#### Scenario: Admin refund for PayPal order
- **WHEN** an admin initiates a refund for an order paid via PayPal through Stripe
- **THEN** the existing `stripe.refunds.create(paymentIntentId)` flow is used unchanged
- **THEN** Stripe routes the refund back to the customer's PayPal account

### Requirement: PayPal availability is verified before implementation
Before implementation, the team SHALL verify that PayPal is available as a Stripe payment method for the account's country (Spain/ES). If unavailable, PayPal is deferred to a separate change using the native PayPal SDK (Path B).

#### Scenario: PayPal not available via Stripe
- **WHEN** the Stripe Dashboard does not offer PayPal for the account's region
- **THEN** this capability (paypal-stripe-checkout) is deferred; implementation proceeds with google-oauth-login and stripe-payment-element only
