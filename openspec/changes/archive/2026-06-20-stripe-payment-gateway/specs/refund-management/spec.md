## MODIFIED Requirements

### Requirement: Admin can advance a refund through its state machine

The system SHALL expose `PATCH /api/admin/refunds/:id/status` accepting `status` (required) and `paymentProviderReference` (optional, max 150 chars). Allowed transitions: Pending to Processing, Pending to Cancelled, Processing to Completed, Processing to Failed, Processing to Cancelled. Terminal states (Completed, Failed, Cancelled) SHALL NOT allow further transitions. Invalid transitions SHALL return `409` with error code `REFUND_TRANSITION_INVALID`. When transitioning from `Pending` to `Processing`, the system SHALL call `stripe.refunds.create` using the `CustomerOrder.stripePaymentIntentId`; the Stripe refund id SHALL be stored in `Refund.paymentProviderReference`; if the Stripe call fails the transition SHALL be aborted and `409` with `REFUND_STRIPE_ERROR` returned. When transitioning to `Completed`, the system SHALL set `processedAt = now()` and recalculate `CustomerOrder.paymentStatus` within a Prisma transaction.

#### Scenario: Advance from Pending to Processing creates Stripe refund

- **WHEN** an admin submits `PATCH /api/admin/refunds/:id/status` with status `Processing` for a Pending refund
- **THEN** the system calls `stripe.refunds.create`, stores the Stripe refund id, and returns `200` with the updated refund showing `status = Processing`

#### Scenario: Stripe failure on Processing transition keeps refund Pending

- **WHEN** `stripe.refunds.create` returns an error on the Pending→Processing transition
- **THEN** the refund remains `Pending` and the endpoint returns `409` with `REFUND_STRIPE_ERROR`

#### Scenario: Complete a refund sets processedAt and updates paymentStatus

- **WHEN** an admin transitions a refund to Completed
- **THEN** the system sets `processedAt` to the current timestamp and recalculates `CustomerOrder.paymentStatus`

#### Scenario: Full order refund completion transitions paymentStatus to Refunded

- **WHEN** the sum of all Completed refunds for an order equals `CustomerOrder.totalAmount`
- **THEN** `CustomerOrder.paymentStatus` is set to `Refunded`

#### Scenario: Partial refund completion transitions paymentStatus to PartiallyRefunded

- **WHEN** the sum of all Completed refunds is greater than 0 but less than `CustomerOrder.totalAmount`
- **THEN** `CustomerOrder.paymentStatus` is set to `PartiallyRefunded`

#### Scenario: Cancel from Processing

- **WHEN** an admin submits status Cancelled for a refund in Processing state
- **THEN** the system returns `200` with the updated refund showing `status = Cancelled`

#### Scenario: Reject transition from terminal state

- **WHEN** an admin attempts to transition a refund already in Completed, Failed, or Cancelled
- **THEN** the system returns `409` with error code `REFUND_TRANSITION_INVALID`

#### Scenario: Reject invalid transition

- **WHEN** an admin attempts to transition a refund directly from Pending to Completed
- **THEN** the system returns `409` with error code `REFUND_TRANSITION_INVALID`
