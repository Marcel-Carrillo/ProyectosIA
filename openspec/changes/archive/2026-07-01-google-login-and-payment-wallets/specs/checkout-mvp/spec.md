## MODIFIED Requirements

### Requirement: Checkout payment UI uses Stripe Payment Element
The checkout page (authenticated and guest) SHALL use the Stripe `PaymentElement` component instead of the legacy `CardElement`. The frontend SHALL call `stripe.confirmPayment({ elements, confirmParams: { return_url } })` instead of `stripe.confirmCardPayment`. All payment method rendering, selection, and validation SHALL be delegated to the Payment Element.

#### Scenario: Authenticated checkout renders Payment Element
- **WHEN** a logged-in customer reaches the payment step
- **THEN** the Stripe Payment Element is mounted with the `clientSecret` from the checkout response
- **THEN** available payment methods (card, Google Pay, PayPal) are displayed based on browser/device support and Stripe Dashboard configuration

#### Scenario: Guest checkout renders Payment Element
- **WHEN** a guest customer reaches the payment step
- **THEN** the same Payment Element is mounted using the guest checkout `clientSecret`

#### Scenario: Checkout redirects to confirmation page after payment
- **WHEN** `stripe.confirmPayment` resolves successfully
- **THEN** Stripe redirects the browser to `return_url` (order confirmation page) with `payment_intent` and `payment_intent_client_secret` query parameters
- **THEN** the confirmation page reads these parameters, fetches the order, and displays the result

#### Scenario: CardElement is removed from checkout
- **WHEN** the checkout page is rendered after this change
- **THEN** no legacy `CardElement` or `CardNumberElement` is rendered
- **THEN** `stripe.confirmCardPayment` is no longer called
