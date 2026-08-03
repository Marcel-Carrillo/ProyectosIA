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

### Requirement: Checkout forms are prefilled from the buyer's saved defaults or profile

When an authenticated buyer opens `/checkout`, the shipping form SHALL be prefilled from their default `Shipping` `CustomerAddress` (if one exists) and the billing form SHALL be prefilled from their default `Billing` `CustomerAddress` (if one exists). If no default address of a given type exists, the corresponding form SHALL be prefilled with `firstName`, `lastName`, and `phone` from the buyer's profile only, leaving address fields empty. Guest buyers SHALL NOT receive any server-sourced prefill; their forms start empty. Prefilled values SHALL remain editable before submission.

#### Scenario: Authenticated buyer with saved defaults sees prefilled forms

- **WHEN** an authenticated buyer with a default `Shipping` address and a default `Billing` address opens `/checkout`
- **THEN** the shipping form is prefilled from the default `Shipping` address and the billing form is prefilled from the default `Billing` address

#### Scenario: Authenticated buyer without saved addresses sees profile-only prefill

- **WHEN** an authenticated buyer with no saved `CustomerAddress` records opens `/checkout`
- **THEN** the shipping and billing forms prefill `firstName`, `lastName`, and `phone` from the buyer's profile and leave address fields empty

#### Scenario: Guest buyer sees empty forms

- **WHEN** a guest (unauthenticated) buyer opens `/checkout`
- **THEN** the shipping and billing forms start empty with no server-sourced prefill

#### Scenario: Prefilled values remain editable

- **WHEN** a buyer's checkout forms are prefilled from a default address
- **THEN** the buyer can edit any prefilled field before submitting checkout

### Requirement: Buyer can clone shipping data into billing with "usar mismos datos"

The checkout page SHALL provide a "usar mismos datos" (use same data) control. While enabled, the billing form SHALL mirror the shipping form's field values, and further edits to the shipping form SHALL propagate to the billing form. Disabling the control SHALL leave the last-mirrored billing values in place as an editable, independent form. This control SHALL be available to both guest and authenticated buyers and requires no persistence to function.

#### Scenario: Enabling the control clones shipping into billing

- **WHEN** a buyer has filled the shipping form and enables "usar mismos datos"
- **THEN** the billing form immediately takes on the shipping form's current field values

#### Scenario: Editing shipping while the control is enabled keeps billing in sync

- **WHEN** the control is enabled and the buyer edits a shipping field
- **THEN** the corresponding billing field updates to match

#### Scenario: Disabling the control leaves billing independently editable

- **WHEN** a buyer disables "usar mismos datos" after it cloned values into billing
- **THEN** the billing form keeps its last mirrored values but no longer follows further shipping edits, and the buyer can edit it independently

#### Scenario: Guest buyer can use the clone control

- **WHEN** a guest buyer enables "usar mismos datos" during checkout
- **THEN** billing mirrors shipping for the duration of that checkout session, with no address persisted

### Requirement: Authenticated buyer can save the address entered at checkout as their default

The checkout page SHALL offer authenticated buyers a "save as default" option per address section (shipping, billing). When selected and checkout succeeds, the system SHALL persist the entered address as the buyer's default `CustomerAddress` of the corresponding `type`, replacing any previous default of that type (see `customer-account-authentication`). Declining this option SHALL NOT persist any address and SHALL NOT affect the order, which still snapshots the entered data as usual per the existing checkout snapshot requirement.

#### Scenario: Save as default persists the address

- **WHEN** an authenticated buyer checks "save as default" for shipping, completes checkout successfully, and had no prior default `Shipping` address
- **THEN** the entered shipping address is persisted as their default `Shipping` `CustomerAddress`

#### Scenario: Declining save as default does not persist an address

- **WHEN** an authenticated buyer completes checkout without checking "save as default"
- **THEN** no new `CustomerAddress` record is created from that checkout submission

#### Scenario: Order snapshot is unaffected by the save-as-default choice

- **WHEN** an authenticated buyer checks "save as default" and completes checkout
- **THEN** the created `CustomerOrder` still snapshots `shippingAddressSnapshot`/`billingAddressSnapshot` exactly as entered, independent of the saved default address record

### Requirement: Checkout payment UI uses Stripe Payment Element

The checkout page (authenticated and guest) SHALL use the Stripe `PaymentElement` component instead of the legacy `CardElement`. The storefront SHALL provide `/checkout` after `/cart` with steps: review items → shipping/billing forms → optional coupon → **payment (Stripe Payment Element)** → confirmation. The frontend SHALL call `stripe.confirmPayment({ elements, confirmParams: { return_url } })` instead of `stripe.confirmCardPayment`. All payment method rendering, selection, and validation SHALL be delegated to the Payment Element. On confirmed payment, the buyer is directed to the order confirmation page, which polls for `paymentStatus = Paid`. Layout SHALL work at 360px width minimum. Failure SHALL show the Stripe error and allow retry without losing the order.

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

#### Scenario: Complete checkout with successful payment

- **WHEN** a buyer proceeds from cart through checkout, completes the payment form, and Stripe confirms payment
- **THEN** an order is created and the confirmation page polls until `paymentStatus = Paid`

#### Scenario: Checkout without cart items redirects

- **WHEN** a buyer opens `/checkout` with an empty cart
- **THEN** the UI redirects to `/cart`

#### Scenario: Payment failure allows retry

- **WHEN** Stripe returns a payment error on the payment step
- **THEN** the UI displays the error and the buyer can retry without losing their shipping information
