## ADDED Requirements

### Requirement: Cart is a full page

The cart SHALL render as `/cart` (not a drawer) with line items, quantity increment/decrement, remove, summary, and a styled empty state. Quantity and remove SHALL use the Ajax Cart API without a full page reload. Checkout SHALL navigate to Shopify-hosted checkout.

#### Scenario: Update quantity without reload

- **WHEN** a shopper increments a cart line quantity
- **THEN** the line total and cart total update via Ajax Cart and the document does not fully reload

#### Scenario: Empty cart

- **WHEN** the cart has zero lines
- **THEN** the empty-state treatment is shown and the checkout action is not offered

#### Scenario: Checkout hand-off

- **WHEN** a shopper with at least one line proceeds to checkout
- **THEN** the browser reaches Shopify-hosted `/checkout` and payment is not processed by Mavile Stripe

### Requirement: Classic customer accounts

The shop SHALL use classic customer accounts. Login, register, account overview, order detail, addresses, and password reset SHALL render with Mavile account styling via `templates/customers/*.liquid`. Payment status shown to the customer SHALL be Shopify’s customer-facing order/payment presentation, not Mavile internal fulfillment or supplier-order status.

#### Scenario: Login uses Shopify customers

- **WHEN** a customer submits valid credentials on `/account/login`
- **THEN** Shopify authenticates the customer and `/account` shows their Shopify orders

#### Scenario: No Mavile 2FA page

- **WHEN** a customer uses account recovery or login
- **THEN** the theme does not render Mavile email-OTP 2FA or OAuth buttons backed by the Mavile API
