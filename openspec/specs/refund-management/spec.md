# Spec: Refund Management

## Purpose

Admin surface for issuing and tracking refunds against paid customer orders. Supports total and partial refunds with a state machine lifecycle, automatic `CustomerOrder.paymentStatus` synchronization, and admin-only access. Supplier-internal data must never appear in refund responses.

## Requirements

### Requirement: Admin can list refunds with pagination and filters

The system SHALL expose `GET /api/admin/refunds` returning a paginated list of refunds in the standard response envelope `{ success, data, meta }`. The endpoint SHALL require admin authentication. It SHALL accept `page` (default 1), `limit` (default 10, max 100), `customerOrderId` (integer, optional), and `status` (RefundStatus enum, optional). Results SHALL be ordered by `createdAt` descending by default.

#### Scenario: List returns paginated refunds

- **WHEN** an admin requests `GET /api/admin/refunds`
- **THEN** the system returns `200` with up to 10 refunds in `data` and pagination metadata in `meta`

#### Scenario: Filter by customer order

- **WHEN** an admin requests `GET /api/admin/refunds?customerOrderId=5`
- **THEN** the system returns only refunds belonging to order 5

#### Scenario: Filter by status

- **WHEN** an admin requests `GET /api/admin/refunds?status=Completed`
- **THEN** the system returns only refunds with `status = Completed`

#### Scenario: Unauthenticated request is rejected

- **WHEN** a client calls `GET /api/admin/refunds` without a valid admin token
- **THEN** the system returns `401`

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

### Requirement: Admin can retrieve a single refund by ID

The system SHALL expose `GET /api/admin/refunds/:id` returning the refund matching the given ID. A non-existent ID SHALL return `404` with error code `REFUND_NOT_FOUND`. The endpoint SHALL require admin authentication.

#### Scenario: Get existing refund

- **WHEN** an admin requests `GET /api/admin/refunds/:id` for an existing refund
- **THEN** the system returns `200` with the full refund object

#### Scenario: Get non-existent refund

- **WHEN** an admin requests `GET /api/admin/refunds/:id` for an ID that does not exist
- **THEN** the system returns `404` with error code `REFUND_NOT_FOUND`

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

### Requirement: Refund endpoints are admin-only and do not expose supplier data

All refund endpoints SHALL require `requireAdminAuth` middleware. Refund responses SHALL NOT include any supplier-related fields (`supplierId`, `supplierCost`, `supplierReference`).

#### Scenario: Admin routes require authentication

- **WHEN** any request hits `/api/admin/refunds` without a valid admin bearer token
- **THEN** the system returns `401`

#### Scenario: No supplier fields in refund response

- **WHEN** an admin retrieves any refund
- **THEN** the response contains no supplier-related fields

### Requirement: Admin UI provides a functional Refunds management page

The system SHALL provide a `RefundsPage` replacing the "Coming soon" stub, with a filterable paginated table. It SHALL provide a `RefundDetailPage` showing all refund fields and a `RefundStatusControl` component to transition states. A "Create Refund" button SHALL be accessible from `CustomerOrderDetailPage` when the order paymentStatus is `Paid` or `PartiallyRefunded`.

#### Scenario: RefundsPage shows list of refunds

- **WHEN** an admin navigates to the Refunds page
- **THEN** the system displays a paginated list of refunds with filters for status and order

#### Scenario: Create Refund from order detail

- **WHEN** an admin views a paid customer order and clicks "Create Refund"
- **THEN** the system opens a form pre-filled with `customerOrderId` to create a new refund

#### Scenario: Status control transitions refund

- **WHEN** an admin selects a new valid status from `RefundStatusControl` and confirms
- **THEN** the system updates the refund status and reflects the change in the UI
