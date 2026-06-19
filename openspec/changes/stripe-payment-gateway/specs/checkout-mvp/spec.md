## MODIFIED Requirements

### Requirement: Buyer can complete checkout as guest

The system SHALL expose `POST /api/public/checkout/guest` accepting `email`, `firstName`, `lastName`, `phone?`, `items[]` (`productVariantId`, `quantity`), `shippingAddressSnapshot`, `billingAddressSnapshot`, optional `couponCode`. The server SHALL find-or-create `Customer` by normalized email (no `CustomerAccount`), snapshot prices, compute totals, apply coupon if valid, set `status = PendingPayment`, `paymentStatus = Pending`, `fulfillmentStatus = NotStarted`, create a Stripe PaymentIntent, persist `stripePaymentIntentId`, and return `201` with customer-safe order data **and `clientSecret`**. If Stripe PaymentIntent creation fails, the order SHALL NOT be persisted and the endpoint SHALL return `503` with `PAYMENT_GATEWAY_UNAVAILABLE`.

#### Scenario: Guest checkout creates order and returns clientSecret

- **WHEN** a guest submits valid checkout with cart items
- **THEN** the system creates `CustomerOrder` with snapshotted items and Stripe PaymentIntent and returns `201` with `clientSecret` in the response body

#### Scenario: Guest order visible after later registration

- **WHEN** the buyer later registers with the same email
- **THEN** the order appears in `/api/public/account/orders`

#### Scenario: Stripe failure prevents order creation

- **WHEN** the Stripe API is unavailable during guest checkout
- **THEN** the system returns `503` with `PAYMENT_GATEWAY_UNAVAILABLE` and no order is created

---

### Requirement: Authenticated buyer can complete checkout

The system SHALL expose `POST /api/public/checkout` behind `requireCustomerAuth`. `customerId` SHALL come from the token only. Request body SHALL match guest checkout fields except email/name may default from profile. The response SHALL include `clientSecret` from the Stripe PaymentIntent. Unauthenticated calls SHALL return `401`.

#### Scenario: Authenticated checkout uses token customer and returns clientSecret

- **WHEN** a logged-in buyer submits checkout
- **THEN** the order `customerId` matches the access token and `clientSecret` is present in the response

#### Scenario: Authenticated checkout Stripe failure prevents order

- **WHEN** the Stripe API fails during authenticated checkout
- **THEN** the system returns `503` with `PAYMENT_GATEWAY_UNAVAILABLE` and no order is created

---

### Requirement: Checkout UI flow includes Stripe Elements payment step

The storefront SHALL provide `/checkout` after `/cart` with steps: review items → shipping/billing forms → optional coupon → **payment (Stripe Elements)** → confirmation. The payment step SHALL use `@stripe/react-stripe-js` and `<PaymentElement>`. On confirmed payment, the buyer is directed to the order confirmation page, which polls for `paymentStatus = Paid`. Layout SHALL work at 360px width minimum. Failure SHALL show the Stripe error and allow retry without losing the order.

#### Scenario: Complete checkout with successful payment

- **WHEN** a buyer proceeds from cart through checkout, completes the payment form, and Stripe confirms payment
- **THEN** an order is created and the confirmation page polls until `paymentStatus = Paid`

#### Scenario: Checkout without cart items redirects

- **WHEN** a buyer opens `/checkout` with an empty cart
- **THEN** the UI redirects to `/cart`

#### Scenario: Payment failure allows retry

- **WHEN** Stripe returns a payment error on the payment step
- **THEN** the UI displays the error and the buyer can retry without losing their shipping information
