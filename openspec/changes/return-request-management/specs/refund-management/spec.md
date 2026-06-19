## MODIFIED Requirements

### Requirement: Admin can create a total or partial refund for a customer order

The system SHALL expose `POST /api/admin/refunds` accepting `customerOrderId` (required), `amount` (required, > 0), `returnRequestId` (optional, nullable — **must reference an existing `ReturnRequest` when provided**), `reason` (optional, max 500 chars), and `paymentProviderReference` (optional, max 150 chars). The system SHALL validate: (1) the order exists; (2) the order payment status is `Paid` or `PartiallyRefunded`; (3) amount does not exceed refundable balance; (4) when `returnRequestId` is provided, the referenced `ReturnRequest` SHALL exist — evaluated inside a Prisma transaction. The new refund SHALL be created with `status = Pending`.

#### Scenario: Create a valid partial refund

- **WHEN** an admin submits `POST /api/admin/refunds` with a valid `customerOrderId` and `amount` that does not exceed the refundable balance
- **THEN** the system creates the refund with `status = Pending` and returns `201` with the refund

#### Scenario: Create a total refund

- **WHEN** an admin submits an `amount` exactly equal to the full `totalAmount` (and no prior completed refunds exist)
- **THEN** the system creates the refund with `status = Pending` and returns `201`

#### Scenario: Create a refund linked to a return request

- **WHEN** an admin submits a valid refund body with a `returnRequestId` referencing an existing `ReturnRequest`
- **THEN** the system creates the refund with `status = Pending` and the `returnRequestId` FK persisted and returns `201`

#### Scenario: Reject refund with non-existent returnRequestId

- **WHEN** an admin submits a `returnRequestId` that does not correspond to any existing `ReturnRequest`
- **THEN** the system returns `404` with error code `RETURN_REQUEST_NOT_FOUND`

#### Scenario: Reject amount exceeding refundable balance

- **WHEN** an admin submits an `amount` greater than the refundable balance
- **THEN** the system returns `409` with error code `REFUND_AMOUNT_EXCEEDS_BALANCE`

#### Scenario: Reject refund on unpaid order

- **WHEN** an admin submits a refund for an order whose `paymentStatus` is not `Paid` or `PartiallyRefunded`
- **THEN** the system returns `409` with error code `REFUND_ORDER_NOT_PAID`

#### Scenario: Reject refund on non-existent order

- **WHEN** an admin submits a `customerOrderId` that does not exist
- **THEN** the system returns `404` with error code `CUSTOMER_ORDER_NOT_FOUND`
