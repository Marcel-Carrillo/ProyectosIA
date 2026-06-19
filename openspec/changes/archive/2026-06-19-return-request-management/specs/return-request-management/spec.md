## ADDED Requirements

### Requirement: Admin can list return requests with pagination and filters

The system SHALL expose `GET /api/admin/return-requests` returning a paginated list of return requests in the standard response envelope `{ success, data, meta }`. The endpoint SHALL require admin authentication. It SHALL accept `page` (default 1), `limit` (default 10, max 100), `customerOrderId` (integer, optional), and `status` (ReturnRequestStatus enum, optional). Results SHALL be ordered by `createdAt` descending by default.

#### Scenario: List returns paginated return requests

- **WHEN** an admin requests `GET /api/admin/return-requests`
- **THEN** the system returns `200` with up to 10 return requests in `data` and pagination metadata in `meta`

#### Scenario: Filter by customer order

- **WHEN** an admin requests `GET /api/admin/return-requests?customerOrderId=5`
- **THEN** the system returns only return requests belonging to order 5

#### Scenario: Filter by status

- **WHEN** an admin requests `GET /api/admin/return-requests?status=Requested`
- **THEN** the system returns only return requests with `status = Requested`

#### Scenario: Unauthenticated request is rejected

- **WHEN** a client calls `GET /api/admin/return-requests` without a valid admin token
- **THEN** the system returns `401`

### Requirement: Admin can create a return request for a customer order item

The system SHALL expose `POST /api/admin/return-requests` accepting `customerOrderId` (required, integer), `customerOrderItemId` (required, integer), and `reason` (required, max 500 chars). The system SHALL validate atomically inside a Prisma transaction: (1) the order exists; (2) the order `status` is not `Cancelled`; (3) the item exists; (4) the item belongs to the given order. The new return request SHALL be created with `status = Requested` and `requestedAt = now()`.

#### Scenario: Create a valid return request

- **WHEN** an admin submits `POST /api/admin/return-requests` with a valid `customerOrderId`, `customerOrderItemId`, and `reason`
- **THEN** the system creates the return request with `status = Requested` and returns `201` with the return request

#### Scenario: Reject creation on a cancelled order

- **WHEN** an admin submits a return request for an order with `status = Cancelled`
- **THEN** the system returns `409` with error code `RETURN_REQUEST_ORDER_CANCELLED`

#### Scenario: Reject when item does not belong to the order

- **WHEN** an admin submits a `customerOrderItemId` that belongs to a different order
- **THEN** the system returns `422` with error code `RETURN_REQUEST_ITEM_MISMATCH`

#### Scenario: Reject when order does not exist

- **WHEN** an admin submits a `customerOrderId` that does not exist
- **THEN** the system returns `404` with error code `CUSTOMER_ORDER_NOT_FOUND`

#### Scenario: Reject when item does not exist

- **WHEN** an admin submits a `customerOrderItemId` that does not exist
- **THEN** the system returns `404` with error code `CUSTOMER_ORDER_ITEM_NOT_FOUND`

#### Scenario: Reject missing or oversized reason

- **WHEN** an admin omits `reason` or provides a `reason` exceeding 500 characters
- **THEN** the system returns `400` with error code `VALIDATION_ERROR`

### Requirement: Admin can retrieve a single return request by ID

The system SHALL expose `GET /api/admin/return-requests/:id` returning the return request matching the given ID, including its related order reference and item reference. A non-existent ID SHALL return `404` with error code `RETURN_REQUEST_NOT_FOUND`. The endpoint SHALL require admin authentication.

#### Scenario: Get an existing return request

- **WHEN** an admin requests `GET /api/admin/return-requests/:id` for an existing return request
- **THEN** the system returns `200` with the full return request object

#### Scenario: Get a non-existent return request

- **WHEN** an admin requests `GET /api/admin/return-requests/:id` for an ID that does not exist
- **THEN** the system returns `404` with error code `RETURN_REQUEST_NOT_FOUND`

### Requirement: Admin can advance a return request through its state machine

The system SHALL expose `PATCH /api/admin/return-requests/:id/status` accepting `status` (required). The allowed transitions are:

- `Requested` → `Approved`, `Rejected`, `Cancelled`
- `Approved` → `Received`, `Cancelled`
- `Received` → `Refunded`, `Cancelled`
- `Rejected`, `Refunded`, `Cancelled` → (terminal, no further transitions)

Timestamps SHALL be set automatically on the following transitions: `approvedAt = now()` on `→ Approved`; `rejectedAt = now()` on `→ Rejected`; `receivedAt = now()` on `→ Received`. Invalid transitions SHALL return `409` with error code `RETURN_REQUEST_TRANSITION_INVALID`. Terminal-state transitions SHALL return `409` with the same code.

#### Scenario: Approve a requested return

- **WHEN** an admin submits `PATCH /api/admin/return-requests/:id/status` with `status = Approved` for a `Requested` return request
- **THEN** the system returns `200` with `status = Approved` and `approvedAt` set

#### Scenario: Reject a requested return

- **WHEN** an admin submits `status = Rejected` for a `Requested` return request
- **THEN** the system returns `200` with `status = Rejected` and `rejectedAt` set

#### Scenario: Mark a return as received

- **WHEN** an admin submits `status = Received` for an `Approved` return request
- **THEN** the system returns `200` with `status = Received` and `receivedAt` set

#### Scenario: Cancel from an active state

- **WHEN** an admin submits `status = Cancelled` for a `Requested` or `Approved` return request
- **THEN** the system returns `200` with `status = Cancelled`

#### Scenario: Reject transition from a terminal state

- **WHEN** an admin attempts to transition a return request already in `Rejected`, `Refunded`, or `Cancelled`
- **THEN** the system returns `409` with error code `RETURN_REQUEST_TRANSITION_INVALID`

#### Scenario: Reject an invalid transition

- **WHEN** an admin attempts to transition a return request from `Requested` directly to `Received`
- **THEN** the system returns `409` with error code `RETURN_REQUEST_TRANSITION_INVALID`

### Requirement: Return request endpoints are admin-only and do not expose supplier data

All return request endpoints SHALL require `requireAdminAuth` middleware. Return request responses SHALL NOT include any supplier-related fields (`supplierId`, `supplierCost`, `supplierReference`). The resource SHALL NOT be accessible via any `/api/public/...` path.

#### Scenario: Admin routes require authentication

- **WHEN** any request hits `/api/admin/return-requests` without a valid admin bearer token
- **THEN** the system returns `401`

#### Scenario: No supplier fields in return request response

- **WHEN** an admin retrieves any return request
- **THEN** the response contains no supplier-related fields

### Requirement: Admin UI provides a functional Return Requests management page

The system SHALL provide a `ReturnRequestsPage` replacing the "Coming soon" stub, with a filterable paginated table showing `id`, `customerOrderId`, `customerOrderItemId`, `reason`, `status`, and `requestedAt`. It SHALL provide a `ReturnRequestDetailPage` (route `return-requests/:id`) showing all fields and a `ReturnRequestStatusControl` component exposing approve, reject, and receive actions gated by the allowed transitions for the current state. The detail page SHALL be reachable from the list page.

#### Scenario: ReturnRequestsPage shows list of return requests

- **WHEN** an admin navigates to the Return Requests page
- **THEN** the system displays a paginated list of return requests with filters for `status` and `customerOrderId`

#### Scenario: ReturnRequestDetailPage shows detail and actions

- **WHEN** an admin navigates to `return-requests/:id`
- **THEN** the system displays the full return request and the available status actions for the current state

#### Scenario: ReturnRequestStatusControl hides invalid actions

- **WHEN** a return request is in `Rejected` state
- **THEN** no status action buttons are displayed (terminal state)

#### Scenario: ReturnRequestStatusControl transitions the request

- **WHEN** an admin selects a valid action from `ReturnRequestStatusControl` and confirms
- **THEN** the system updates the return request status and reflects the change in the UI
