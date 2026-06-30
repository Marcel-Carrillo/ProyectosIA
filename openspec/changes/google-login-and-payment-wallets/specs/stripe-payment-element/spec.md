## ADDED Requirements

### Requirement: Checkout uses Stripe Payment Element
The storefront checkout page (authenticated and guest) SHALL render the Stripe `PaymentElement` instead of the legacy `CardElement`. The Payment Element SHALL display all payment methods enabled in the Stripe Dashboard for the account and customer's country, including credit/debit cards, Google Pay, and PayPal (when enabled). Payment confirmation SHALL use `stripe.confirmPayment` with a `return_url`.

#### Scenario: Payment Element renders in authenticated checkout
- **WHEN** a logged-in customer reaches the payment step of checkout
- **THEN** the Stripe Payment Element is displayed, showing available payment methods for the customer's browser/device
- **THEN** card input, Google Pay (if supported), and PayPal (if enabled) are selectable

#### Scenario: Payment Element renders in guest checkout
- **WHEN** a guest customer reaches the payment step of checkout
- **THEN** the same Stripe Payment Element is rendered with the same available methods

#### Scenario: Successful payment via card
- **WHEN** a customer enters valid card details and submits the Payment Element
- **THEN** `stripe.confirmPayment` is called with the `clientSecret` from the backend
- **THEN** on success, the browser is redirected to `return_url` (order confirmation page)
- **THEN** the `payment_intent.succeeded` webhook sets `CustomerOrder.paymentStatus = Paid`

#### Scenario: Successful payment via Google Pay
- **WHEN** a customer selects Google Pay in the Payment Element and authorizes the payment on a supported device/browser
- **THEN** `stripe.confirmPayment` completes and the browser redirects to `return_url`
- **THEN** the webhook sets `paymentStatus = Paid` — no direct client-side status mutation

#### Scenario: Successful payment via PayPal
- **WHEN** a customer selects PayPal in the Payment Element and completes the PayPal flow
- **THEN** `stripe.confirmPayment` completes and the browser redirects to `return_url`
- **THEN** the webhook sets `paymentStatus = Paid`

#### Scenario: Payment fails
- **WHEN** the payment is declined or fails
- **THEN** the Payment Element displays an inline error message
- **THEN** `paymentStatus` remains `PendingPayment`; no order state mutation occurs client-side

#### Scenario: return_url handles order confirmation
- **WHEN** the browser arrives at the `return_url` after payment
- **THEN** the frontend reads the `payment_intent` query parameter, fetches order status, and displays a confirmation or error screen

### Requirement: Backend PaymentIntent unchanged
The backend `createPaymentIntent` SHALL continue to use `automatic_payment_methods: { enabled: true }`. No change to the PaymentIntent creation endpoint, webhook handler, idempotency, or `paymentStatus` state machine is required for the Payment Element migration.

#### Scenario: PaymentIntent creation returns client secret
- **WHEN** `POST /api/public/checkout` or `POST /api/public/checkout/guest` is called
- **THEN** the response includes a `clientSecret` usable by both `CardElement` (legacy) and `PaymentElement` (new)
- **THEN** `automatic_payment_methods.enabled = true` is set on the PaymentIntent
