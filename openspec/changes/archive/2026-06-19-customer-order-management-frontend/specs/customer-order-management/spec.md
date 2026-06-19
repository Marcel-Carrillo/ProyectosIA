## ADDED Requirements

### Requirement: Admin order list supports date-range filtering

The admin customer orders list UI SHALL provide `createdFrom` and `createdTo` date controls that sync to URL search params and pass ISO date values to `GET /api/admin/customer-orders`. The backend list endpoint SHALL accept optional `createdFrom` and `createdTo` query parameters and filter orders by `createdAt` (inclusive day bounds in UTC). Changing the date range SHALL reset pagination to page 1.

#### Scenario: Filter orders created within a date range

- **WHEN** an admin sets `createdFrom` and `createdTo` on `CustomerOrdersPage` and applies the filter
- **THEN** the list request includes both query params and returns only orders whose `createdAt` falls within the range

#### Scenario: Date range syncs to URL

- **WHEN** an admin changes the date-range inputs
- **THEN** `createdFrom` and `createdTo` appear in the page URL and survive refresh

### Requirement: Admin order detail shows a derived status timeline

The admin customer order detail page SHALL render a status timeline card showing key milestones derived from order timestamps: Created (`createdAt`), Paid (`paidAt` when set), Cancelled (`cancelledAt` when set), and Last updated (`updatedAt`). The UI SHALL include a short note that intermediate status transitions are not shown until a history model exists.

#### Scenario: Timeline shows paid milestone

- **WHEN** an admin views an order with `paidAt` set
- **THEN** the timeline includes a Paid milestone with that timestamp

#### Scenario: Timeline omits paid when not paid

- **WHEN** an admin views an order with `paidAt` null
- **THEN** the Paid milestone is not shown

### Requirement: Admin customer-order UI meets mobile admin patterns

Customer order admin pages SHALL use `fullscreen="sm-down"` on modals opened from the detail page (refund/return flows). Primary action buttons on list and detail pages SHALL meet a 44px minimum tap target on viewports ≤576px. Layout SHALL remain usable without horizontal overflow at 360px width.

#### Scenario: Detail modals are fullscreen on small screens

- **WHEN** an admin opens a refund or return modal on a viewport ≤576px
- **THEN** the modal renders fullscreen

#### Scenario: No horizontal overflow at 360px

- **WHEN** the orders list or detail page is rendered at 360px width
- **THEN** no horizontal scrollbar is required for primary content

### Requirement: Admin customer-order UI has automated test coverage

The system SHALL include RTL tests for `CustomerOrdersPage` and `CustomerOrderDetailPage` and Cypress E2E coverage for the admin order list → detail → status-update workflow. Tests SHALL assert that supplier-internal fields (`supplierCost`, `supplierReference`, `supplierId`) never appear in the rendered DOM.

#### Scenario: RTL asserts no supplier cost in detail DOM

- **WHEN** `CustomerOrderDetailPage` is rendered with fixture order data
- **THEN** the document does not contain text matching supplier cost or reference field labels/values

#### Scenario: Cypress covers status update workflow

- **WHEN** the Cypress customer-orders spec runs against a running stack
- **THEN** it visits the list, opens an order, updates a status field, and verifies the badge updates

## MODIFIED Requirements

### Requirement: Admin can list customer orders with pagination, filters, and search

The system SHALL expose `GET /api/admin/customer-orders` returning customer orders in the standard response envelope `{ success, data, message }` where `data` contains `{ items, total, page, pageSize }`. The endpoint SHALL accept `page` (default 1), `pageSize` (default 20, clamped to max 100), `customerId`, `status` (`CustomerOrderStatus`), `paymentStatus` (`PaymentStatus`), `fulfillmentStatus` (`FulfillmentStatus`), `search` (match on `orderNumber`, customer first/last name, or email), `createdFrom` and `createdTo` (optional ISO date strings filtering `createdAt`), `sort` (`createdAt` | `totalAmount` | `orderNumber`, default `createdAt`), and `order` (`asc` | `desc`, default `desc`). The admin list UI SHALL expose controls for status filters, date range, and search with URL synchronization.

#### Scenario: List returns paginated orders

- **WHEN** an admin requests `GET /api/admin/customer-orders`
- **THEN** the system returns `200` with up to 20 orders in `data.items` and the correct `total`, `page`, and `pageSize`

#### Scenario: Filter by customer and status

- **WHEN** an admin requests `GET /api/admin/customer-orders?customerId=1&status=Paid`
- **THEN** the system returns only orders for that customer with `status = Paid`

#### Scenario: Search by order number

- **WHEN** an admin requests `GET /api/admin/customer-orders?search=ORD-000042`
- **THEN** the system returns orders whose `orderNumber` matches the search term

#### Scenario: Page size is bounded

- **WHEN** an admin requests `pageSize` greater than 100
- **THEN** the system clamps the page size to 100

#### Scenario: Filter by created date range

- **WHEN** an admin requests `GET /api/admin/customer-orders?createdFrom=2026-06-01&createdTo=2026-06-30`
- **THEN** the system returns only orders with `createdAt` within that inclusive UTC date range
