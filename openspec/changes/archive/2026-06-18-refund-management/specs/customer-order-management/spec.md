## ADDED Requirements

### Requirement: CustomerOrder paymentStatus is synchronized by the refund lifecycle

The system SHALL automatically recalculate and update `CustomerOrder.paymentStatus` whenever a refund is created or its status changes, inside the same Prisma transaction. The recalculation rule is: if the sum of all refunds with `status IN (Completed)` equals `totalAmount`, set `paymentStatus = Refunded`; if the sum is greater than 0 and less than `totalAmount`, set `paymentStatus = PartiallyRefunded`; otherwise, leave `paymentStatus` unchanged. This transition is driven by `refundService` and does not require a separate admin `PATCH` call on the order.

#### Scenario: paymentStatus becomes PartiallyRefunded after partial refund completes

- **WHEN** an admin transitions a refund to `Completed` and `Σ completed refund amounts < CustomerOrder.totalAmount`
- **THEN** `CustomerOrder.paymentStatus` is set to `PartiallyRefunded`

#### Scenario: paymentStatus becomes Refunded after full refund completes

- **WHEN** the total of all `Completed` refunds for an order equals `CustomerOrder.totalAmount`
- **THEN** `CustomerOrder.paymentStatus` is set to `Refunded`

#### Scenario: paymentStatus is unchanged when a refund is cancelled

- **WHEN** an admin cancels a refund that was in `Processing` state and no other completed refunds exist
- **THEN** `CustomerOrder.paymentStatus` is not changed to `PartiallyRefunded` or `Refunded`

#### Scenario: paymentStatus sync happens in the same transaction as refund update

- **WHEN** a refund status update fails after updating `paymentStatus`
- **THEN** the entire transaction is rolled back and both the refund and `paymentStatus` retain their previous values

### Requirement: Admin can initiate refund creation from the order detail page

The system SHALL display a "Create Refund" action button on `CustomerOrderDetailPage` when `CustomerOrder.paymentStatus` is `Paid` or `PartiallyRefunded`. Clicking the button SHALL navigate to or open the create-refund form with `customerOrderId` pre-filled.

#### Scenario: Create Refund button is visible for paid orders

- **WHEN** an admin views a customer order with `paymentStatus = Paid`
- **THEN** a "Create Refund" button is displayed in the order detail

#### Scenario: Create Refund button is not shown for unpaid orders

- **WHEN** an admin views a customer order with `paymentStatus = Pending`
- **THEN** no "Create Refund" button is displayed
