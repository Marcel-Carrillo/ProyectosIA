# Spec: Shipment Management

## Purpose

Admin surface for managing shipments — the customer-delivery records that track how goods reach the buyer. Enables store administrators to create shipments linked to customer orders (and optionally supplier orders), advance them through a status state machine, and inspect or filter the full shipment list. Shipments are complementary to supplier orders: a supplier order represents the procurement-level handoff while a shipment represents the outbound customer-delivery leg.

## Requirements

### Requirement: Shipment data model

The system SHALL maintain a `Shipment` entity in the database with the following fields: `id`, `customerOrderId` (required FK), `supplierOrderId` (optional FK), `carrier` (varchar 100, optional), `trackingNumber` (varchar 100, optional), `trackingUrl` (varchar 500, optional), `status` (string, default `Pending`), `shippedAt` (datetime, optional), `deliveredAt` (datetime, optional), `createdAt`, `updatedAt`. `CustomerOrder` and `SupplierOrder` SHALL each expose a `shipments` back-relation.

#### Scenario: Create shipment with required fields only

- **WHEN** a shipment is created with a valid `customerOrderId` and no optional fields
- **THEN** the shipment is persisted with `status = Pending`, `supplierOrderId = null`, and all optional fields null

#### Scenario: Create shipment with supplier order reference

- **WHEN** a shipment is created with a valid `customerOrderId` and a valid `supplierOrderId`
- **THEN** the shipment is persisted linked to both the customer order and the supplier order

#### Scenario: Reject shipment with non-existent customer order

- **WHEN** a shipment is created with a `customerOrderId` that does not exist
- **THEN** the system returns error `CUSTOMER_ORDER_NOT_FOUND` (404)

#### Scenario: Reject shipment with non-existent supplier order

- **WHEN** a shipment is created with a `supplierOrderId` that does not exist
- **THEN** the system returns error `SUPPLIER_ORDER_NOT_FOUND` (404)

#### Scenario: Reject shipment with invalid field lengths

- **WHEN** a shipment is created with `carrier` > 100 chars, `trackingNumber` > 100 chars, or `trackingUrl` > 500 chars
- **THEN** the system returns error `VALIDATION_ERROR` (400) with the offending field identified

### Requirement: Shipment status state machine

The system SHALL enforce the following status transitions. Terminal states (`Delivered`, `Failed`, `Returned`) SHALL NOT allow further transitions.

Allowed transitions:
- `Pending` → `Shipped`, `Failed`, `Returned`
- `Shipped` → `InTransit`, `Delivered`, `Failed`, `Returned`
- `InTransit` → `Delivered`, `Failed`, `Returned`

When transitioning to `Shipped`, the system SHALL set `shippedAt` to the current UTC timestamp. When transitioning to `Delivered`, the system SHALL set `deliveredAt` to the current UTC timestamp.

#### Scenario: Valid transition from Pending to Shipped

- **WHEN** an admin transitions a shipment from `Pending` to `Shipped`
- **THEN** the shipment status becomes `Shipped` and `shippedAt` is set to the current UTC time

#### Scenario: Valid transition from Shipped to Delivered

- **WHEN** an admin transitions a shipment from `Shipped` to `Delivered`
- **THEN** the shipment status becomes `Delivered` and `deliveredAt` is set to the current UTC time

#### Scenario: Valid transition from Shipped to InTransit

- **WHEN** an admin transitions a shipment from `Shipped` to `InTransit`
- **THEN** the shipment status becomes `InTransit`

#### Scenario: Valid transition from InTransit to Delivered

- **WHEN** an admin transitions a shipment from `InTransit` to `Delivered`
- **THEN** the shipment status becomes `Delivered` and `deliveredAt` is set

#### Scenario: Reject invalid transition from terminal state

- **WHEN** an admin attempts to transition a shipment already in `Delivered`, `Failed`, or `Returned`
- **THEN** the system returns error `SHIPMENT_STATUS_TRANSITION_INVALID` (400)

#### Scenario: Reject unknown target status

- **WHEN** an admin sends a status value not in the allowed set
- **THEN** the system returns error `SHIPMENT_STATUS_TRANSITION_INVALID` (400)

### Requirement: List shipments (admin)

The system SHALL provide a paginated list endpoint `GET /api/admin/shipments` accessible only to authenticated administrators, supporting optional filters: `customerOrderId` (integer), `supplierOrderId` (integer), `status` (string). The response SHALL include pagination metadata (`total`, `page`, `pageSize`). Page size SHALL be capped at 100.

#### Scenario: List all shipments without filters

- **WHEN** an admin calls `GET /api/admin/shipments`
- **THEN** the system returns a paginated list of all shipments ordered by `createdAt` descending

#### Scenario: Filter shipments by customer order

- **WHEN** an admin calls `GET /api/admin/shipments?customerOrderId=5`
- **THEN** the system returns only shipments linked to customer order 5

#### Scenario: Filter shipments by status

- **WHEN** an admin calls `GET /api/admin/shipments?status=Shipped`
- **THEN** the system returns only shipments with `status = Shipped`

#### Scenario: Reject unauthenticated list request

- **WHEN** the request has no valid admin session
- **THEN** the system returns 401 Unauthorized

### Requirement: Get shipment by id (admin)

The system SHALL provide `GET /api/admin/shipments/:id` returning the full shipment record including linked customer order summary (id, orderNumber, status) and supplier order summary (id, status) if present.

#### Scenario: Get existing shipment

- **WHEN** an admin requests `GET /api/admin/shipments/1`
- **THEN** the system returns the shipment with embedded customer order and supplier order summaries

#### Scenario: Get non-existent shipment

- **WHEN** an admin requests a shipment id that does not exist
- **THEN** the system returns error `SHIPMENT_NOT_FOUND` (404)

### Requirement: Create shipment (admin)

The system SHALL provide `POST /api/admin/shipments` for administrators to create a new shipment. The request body SHALL require `customerOrderId` and accept optional `supplierOrderId`, `carrier`, `trackingNumber`, `trackingUrl`. The initial status SHALL always be `Pending`.

#### Scenario: Successful shipment creation

- **WHEN** an admin posts a valid create-shipment request
- **THEN** the system returns 201 with the created shipment (status = Pending)

#### Scenario: Creation with supplier order pre-fills tracking context

- **WHEN** an admin creates a shipment with a `supplierOrderId`, and the supplier order has `trackingNumber` and `trackingUrl` set
- **THEN** the system optionally pre-fills those fields on the shipment if not explicitly provided in the request body

### Requirement: Update shipment status (admin)

The system SHALL provide `PATCH /api/admin/shipments/:id/status` for administrators to advance the shipment status following the state machine. The request body SHALL contain `status`.

#### Scenario: Successful status update

- **WHEN** an admin sends a valid status transition
- **THEN** the system returns 200 with the updated shipment

#### Scenario: Status update triggers timestamp side-effect

- **WHEN** an admin transitions to `Shipped`
- **THEN** `shippedAt` is set and returned in the response

### Requirement: Admin UI — ShipmentsPage

The system SHALL provide a `ShipmentsPage` in the admin panel replacing the "Coming soon" stub. The page SHALL display a paginated list of shipments with columns: id, customer order link, supplier order link (if present), carrier, tracking number, status badge, `createdAt`. The page SHALL support filtering by `status`, `customerOrderId`, and `supplierOrderId`. Each row SHALL link to the `ShipmentDetailPage`.

#### Scenario: Admin views shipments list

- **WHEN** an admin navigates to the Shipments admin page
- **THEN** a paginated list of shipments is displayed with filter controls

#### Scenario: Admin filters by status

- **WHEN** an admin selects a status from the filter dropdown
- **THEN** the list updates to show only shipments with that status

### Requirement: Admin UI — ShipmentDetailPage

The system SHALL provide a `ShipmentDetailPage` showing: shipment id, carrier, tracking number (with `trackingUrl` as a link if present), status badge, `shippedAt`, `deliveredAt`, `createdAt`, link to the associated customer order, link to the associated supplier order (if present). The page SHALL allow the admin to trigger status transitions allowed by the state machine.

#### Scenario: Admin views shipment detail

- **WHEN** an admin navigates to a shipment's detail page
- **THEN** all shipment fields and cross-links are displayed

#### Scenario: Admin advances shipment status

- **WHEN** an admin clicks a valid next-state action
- **THEN** the status is updated and the page reflects the new state

#### Scenario: Terminal state hides transition actions

- **WHEN** the shipment is in `Delivered`, `Failed`, or `Returned`
- **THEN** no status-transition action is shown

### Requirement: SupplierOrder–Shipment tracking design decision

`SupplierOrder.trackingNumber`, `trackingUrl`, `shippedAt`, and `deliveredAt` represent the procurement-level handoff. `Shipment` is the customer-delivery entity. The system SHALL treat these as complementary: creating a shipment from a supplier order MAY pre-fill tracking fields from the supplier order's header data, but SHALL NOT maintain bidirectional synchronization.

#### Scenario: No sync on independent update

- **WHEN** an admin updates `SupplierOrder.trackingNumber`
- **THEN** existing linked shipment tracking fields remain unchanged
