## ADDED Requirements

### Requirement: Customer can resume payment on a pending order
The system SHALL allow an authenticated customer to request a valid Stripe `clientSecret` to resume payment on their own `CustomerOrder`, but only while that order's `status` is `PendingPayment` and `paymentStatus` is `Pending` or `Failed`. The system SHALL never expose `stripePaymentIntentId` or `stripeChargeId` in the response.

#### Scenario: Resume payment reuses an existing payable PaymentIntent
- **WHEN** an authenticated customer requests a payment session for their own order that is `PendingPayment`, and the order's existing Stripe PaymentIntent is still in a payable state (`requires_payment_method`, `requires_confirmation`, or `requires_action`) with an amount matching the order's `totalAmount`
- **THEN** the system returns `200` with the existing PaymentIntent's `client_secret` and the order's public details, without creating a new PaymentIntent

#### Scenario: Resume payment reissues a new PaymentIntent when the existing one is no longer usable
- **WHEN** an authenticated customer requests a payment session for their own `PendingPayment` order, and the order's Stripe PaymentIntent is missing, `canceled`, or no longer matches the order's `totalAmount`
- **THEN** the system creates a new Stripe PaymentIntent using an idempotency key distinct from the original checkout key, persists the new `stripePaymentIntentId` on the order, and returns `200` with the new `client_secret`

#### Scenario: Resume payment rejected for an order that is not payable
- **WHEN** an authenticated customer requests a payment session for their own order whose `status` is not `PendingPayment`, or whose `paymentStatus` is `Paid`
- **THEN** the system returns `409 ORDER_NOT_PAYABLE` and does not call Stripe

#### Scenario: Resume payment rejected for another customer's order
- **WHEN** an authenticated customer requests a payment session for an order that does not belong to them, or that does not exist
- **THEN** the system returns `404 CUSTOMER_ORDER_NOT_FOUND`

### Requirement: Customer can cancel a pending order
The system SHALL allow an authenticated customer to cancel their own `CustomerOrder` while it is still `PendingPayment`, setting `status = Cancelled`, `fulfillmentStatus = Cancelled`, and `cancelledAt` to the current time, and SHALL cancel the associated Stripe PaymentIntent. The system SHALL re-verify the order's `paymentStatus` immediately before committing the cancellation to protect against a concurrent payment webhook.

#### Scenario: Successful cancellation of a pending order
- **WHEN** an authenticated customer cancels their own order that is `PendingPayment` with `paymentStatus` `Pending` or `Failed`
- **THEN** the system sets `status = Cancelled`, `fulfillmentStatus = Cancelled`, `cancelledAt = now()`, cancels the order's Stripe PaymentIntent, and returns `200` with the updated public order

#### Scenario: Cancellation is idempotent for an already-cancelled order
- **WHEN** an authenticated customer cancels their own order that is already `status = Cancelled`
- **THEN** the system returns `200` with the current order state and performs no further state change or Stripe call

#### Scenario: Cancellation rejected when the order has just been paid
- **WHEN** an authenticated customer requests cancellation of their own order, and a `payment_intent.succeeded` webhook has already transitioned `paymentStatus` to `Paid` at the moment the system re-verifies state inside the cancellation transaction
- **THEN** the system aborts the cancellation, leaves the order unchanged, and returns `409 ORDER_NOT_CANCELLABLE`

#### Scenario: Cancellation rejected when Stripe reports the PaymentIntent as already captured
- **WHEN** the local cancellation transaction commits the `Cancelled` state, but the subsequent call to cancel the Stripe PaymentIntent fails because Stripe reports the PaymentIntent as already captured or otherwise not cancellable
- **THEN** the system rolls back the order's status to its prior state and returns `409 ORDER_NOT_CANCELLABLE`

#### Scenario: Cancellation rejected for an order that is not in a cancellable state
- **WHEN** an authenticated customer requests cancellation of their own order whose `status` is not `PendingPayment` and is not already `Cancelled` (for example `Paid`, `Processing`, `Completed`, or `Refunded`)
- **THEN** the system returns `409 ORDER_NOT_CANCELLABLE` and does not modify the order

#### Scenario: Cancellation rejected for another customer's order
- **WHEN** an authenticated customer requests cancellation of an order that does not belong to them, or that does not exist
- **THEN** the system returns `404 CUSTOMER_ORDER_NOT_FOUND`

### Requirement: Pending order actions are hidden once payment or cancellation is no longer possible
The customer-facing order detail and order list views SHALL only present "Complete payment" and "Cancel order" actions while an order's `status` is `PendingPayment`.

#### Scenario: Actions shown for a pending order
- **WHEN** a customer views the detail page of their own order with `status = PendingPayment`
- **THEN** the page displays both a "Complete payment" action and a "Cancel order" action

#### Scenario: Actions hidden for a non-pending order
- **WHEN** a customer views the detail page of their own order with `status` other than `PendingPayment` (for example `Paid`, `Processing`, `Completed`, `Cancelled`, or `Refunded`)
- **THEN** the page does not display the "Complete payment" or "Cancel order" actions
