# Spec: Stripe Refund Sync

## Purpose

Stripe-side refund orchestration and webhook reconciliation. Covers the Stripe API call triggered on the Pending→Processing refund transition, idempotency handling, `charge.refunded` webhook reconciliation that advances admin-initiated refunds to Completed, and data-exposure rules ensuring Stripe identifiers never leak to public endpoints.

## Requirements

### Requirement: Admin-initiated refund creates a Stripe refund on Processing transition

When an admin transitions a `Refund` from `Pending` to `Processing`, the refund service SHALL call `stripe.refunds.create` with the `payment_intent` id from the associated `CustomerOrder.stripePaymentIntentId`, `amount` in minor units via `toStripeAmount`, and an idempotency key `refund:{refundId}`. Existing validations (`REFUND_ORDER_NOT_PAID`, `REFUND_AMOUNT_EXCEEDS_BALANCE`) SHALL execute before the Stripe call. If the Stripe call succeeds, the returned Stripe refund id SHALL be stored in `Refund.paymentProviderReference`. If the Stripe call fails, the refund SHALL remain in `Pending` state and the endpoint SHALL return `409` with error code `REFUND_STRIPE_ERROR`.

#### Scenario: Processing transition creates Stripe refund

- **WHEN** an admin transitions a refund from `Pending` to `Processing`
- **THEN** the system calls `stripe.refunds.create` and stores the Stripe refund id in `paymentProviderReference`

#### Scenario: Stripe failure keeps refund in Pending

- **WHEN** `stripe.refunds.create` returns an API error
- **THEN** the refund remains in `Pending` state and the endpoint returns `409` with `REFUND_STRIPE_ERROR`

#### Scenario: Stripe refund idempotency on retry

- **WHEN** the admin retries the Processing transition for the same refund after a transient error
- **THEN** the Stripe idempotency key `refund:{refundId}` prevents a duplicate Stripe refund from being issued

#### Scenario: Stripe refund amount matches refund amount

- **WHEN** the Stripe refund is created
- **THEN** the amount sent to Stripe equals `Refund.amount` converted to integer minor units

---

### Requirement: charge.refunded webhook reconciles admin-initiated refunds

When the system receives a verified `charge.refunded` event from Stripe, the handler SHALL resolve the associated `Refund` record by matching `Refund.paymentProviderReference` to the Stripe refund id within the event's `charge.refunds.data`. If the `Refund` is already in `Completed` state, the handler SHALL be a no-op. If the `Refund` is in `Processing` state, the handler SHALL transition it to `Completed`, set `processedAt = now()`, and trigger the existing `CustomerOrder.paymentStatus` recalculation within a Prisma transaction.

#### Scenario: charge.refunded advances Processing refund to Completed

- **WHEN** a verified `charge.refunded` event arrives and the matched Refund is in `Processing`
- **THEN** the system transitions the Refund to `Completed`, sets `processedAt`, and recalculates `CustomerOrder.paymentStatus`

#### Scenario: charge.refunded is idempotent for already-Completed refunds

- **WHEN** a `charge.refunded` event arrives for a Refund already in `Completed`
- **THEN** the system returns `200` with no state change

#### Scenario: paymentStatus recalculated after refund completed

- **WHEN** all completed refund amounts equal `CustomerOrder.totalAmount`
- **THEN** `CustomerOrder.paymentStatus` is set to `Refunded`

#### Scenario: Partial refund sets paymentStatus to PartiallyRefunded

- **WHEN** completed refund amounts are less than `CustomerOrder.totalAmount`
- **THEN** `CustomerOrder.paymentStatus` is set to `PartiallyRefunded`

---

### Requirement: Stripe refund fields are admin-only and never exposed publicly

The `Refund.paymentProviderReference` field (Stripe refund id) SHALL appear only in admin refund responses. No public or customer-facing endpoint SHALL include Stripe refund ids, Stripe charge ids, or Stripe payment intent ids.

#### Scenario: Public endpoints do not expose Stripe identifiers

- **WHEN** a customer calls any `/api/public/*` endpoint
- **THEN** no Stripe refund id, charge id, or payment intent id appears in the response body
