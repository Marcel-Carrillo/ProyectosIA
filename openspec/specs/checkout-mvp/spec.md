# Spec: Checkout MVP

## Purpose

Public storefront cart and checkout flow. Buyers add variants to a cart, complete shipping/billing, optionally apply a coupon, and create a `CustomerOrder` with snapshotted line items. Supports guest and authenticated paths. MVP payment remains `Pending` (no payment gateway). Supplier-internal data must never appear in responses.

## Requirements

### Requirement: Buyer can manage a shopping cart in the storefront

The storefront SHALL provide a cart persisted in browser `localStorage` via `CartContext`. Each line SHALL reference `productVariantId` and `quantity`. The PDP SHALL allow "Add to cart" for the selected variant. `/cart` SHALL list items with customer-safe product display data, allow quantity updates and removal, and link to checkout. Cart is client-side only for MVP; server validates at checkout.

#### Scenario: Add variant to cart from PDP

- **WHEN** a buyer selects a variant and clicks Add to cart
- **THEN** the cart gains or increments that line and persists to localStorage

#### Scenario: Update quantity on cart page

- **WHEN** a buyer changes quantity on `/cart`
- **THEN** the cart updates and persists

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

### Requirement: Authenticated buyer can complete checkout

The system SHALL expose `POST /api/public/checkout` behind `requireCustomerAuth`. `customerId` SHALL come from the token only. Request body SHALL match guest checkout fields except email/name may default from profile. The response SHALL include `clientSecret` from the Stripe PaymentIntent. Unauthenticated calls SHALL return `401`.

#### Scenario: Authenticated checkout uses token customer and returns clientSecret

- **WHEN** a logged-in buyer submits checkout
- **THEN** the order `customerId` matches the access token and `clientSecret` is present in the response

#### Scenario: Authenticated checkout Stripe failure prevents order

- **WHEN** the Stripe API fails during authenticated checkout
- **THEN** the system returns `503` with `PAYMENT_GATEWAY_UNAVAILABLE` and no order is created

### Requirement: Checkout snapshots catalog prices at purchase time

For each line item the server SHALL snapshot `productNameSnapshot`, `variantSnapshot`, `skuSnapshot`, and `unitPrice` from the variant at creation time; compute line and order totals server-side. Responses SHALL NOT include `supplierCost`, `supplierReference`, or internal notes.

#### Scenario: Price snapshot preserved after catalog change

- **WHEN** variant `publicPrice` changes after checkout
- **THEN** `GET` of the order returns the original snapshotted `unitPrice`

#### Scenario: Invalid variant rejected

- **WHEN** checkout includes a non-existent or inactive variant
- **THEN** the system returns `404` with `VARIANT_NOT_FOUND` and creates no order

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
