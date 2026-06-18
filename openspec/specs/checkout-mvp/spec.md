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

The system SHALL expose `POST /api/public/checkout/guest` accepting `email`, `firstName`, `lastName`, `phone?`, `items[]` (`productVariantId`, `quantity`), `shippingAddressSnapshot`, `billingAddressSnapshot`, optional `couponCode`. The server SHALL find-or-create `Customer` by normalized email (no `CustomerAccount`), snapshot prices, compute totals, apply coupon if valid, set `status = PendingPayment`, `paymentStatus = Pending`, `fulfillmentStatus = NotStarted`, and return `201` with customer-safe order data.

#### Scenario: Guest checkout creates order

- **WHEN** a guest submits valid checkout with cart items
- **THEN** the system creates `CustomerOrder` with snapshotted items and returns `201`

#### Scenario: Guest order visible after later registration

- **WHEN** the buyer later registers with the same email
- **THEN** the order appears in `/api/public/account/orders`

### Requirement: Authenticated buyer can complete checkout

The system SHALL expose `POST /api/public/checkout` behind `requireCustomerAuth`. `customerId` SHALL come from the token only. Request body SHALL match guest checkout fields except email/name may default from profile. Unauthenticated calls SHALL return `401`.

#### Scenario: Authenticated checkout uses token customer

- **WHEN** a logged-in buyer submits checkout
- **THEN** the order `customerId` matches the access token

### Requirement: Checkout snapshots catalog prices at purchase time

For each line item the server SHALL snapshot `productNameSnapshot`, `variantSnapshot`, `skuSnapshot`, and `unitPrice` from the variant at creation time; compute line and order totals server-side. Responses SHALL NOT include `supplierCost`, `supplierReference`, or internal notes.

#### Scenario: Price snapshot preserved after catalog change

- **WHEN** variant `publicPrice` changes after checkout
- **THEN** `GET` of the order returns the original snapshotted `unitPrice`

#### Scenario: Invalid variant rejected

- **WHEN** checkout includes a non-existent or inactive variant
- **THEN** the system returns `404` with `VARIANT_NOT_FOUND` and creates no order

### Requirement: Checkout UI flow is responsive

The storefront SHALL provide `/checkout` after `/cart` with steps: review items → shipping/billing forms → optional coupon → confirmation. Layout SHALL work at 360px width minimum. Success SHALL show order confirmation with `orderNumber`.

#### Scenario: Complete checkout from cart

- **WHEN** a buyer proceeds from cart through checkout and confirms
- **THEN** an order is created and confirmation displays the order number

#### Scenario: Checkout without cart items redirects

- **WHEN** a buyer opens `/checkout` with an empty cart
- **THEN** the UI redirects to `/cart`
