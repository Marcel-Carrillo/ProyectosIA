# Spec: Customer Order Management

## Purpose

Admin surface for managing customer orders — the commercial record of what customers bought from the store. Enables store administrators to list, search, inspect, create (admin/seed path), and advance orders through three independent status dimensions: order `status`, `paymentStatus`, and `fulfillmentStatus`. Customer orders are strictly separate from supplier orders. Required foundation for supplier-order fulfillment (KAN-19). Supplier-internal data must never appear in customer-order API responses.

## ADDED Requirements

### Requirement: Admin can list customer orders with pagination, filters, and search

The system SHALL expose `GET /api/admin/customer-orders` returning customer orders in the standard response envelope `{ success, data, message }` where `data` contains `{ items, total, page, pageSize }`. The endpoint SHALL accept `page` (default 1), `pageSize` (default 20, clamped to max 100), `customerId`, `status` (`CustomerOrderStatus`), `paymentStatus` (`PaymentStatus`), `fulfillmentStatus` (`FulfillmentStatus`), `search` (match on `orderNumber`, customer first/last name, or email), `sort` (`createdAt` | `totalAmount` | `orderNumber`, default `createdAt`), and `order` (`asc` | `desc`, default `desc`). Field definitions follow `docs/data-model.md` (CustomerOrder, CustomerOrderItem).

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

### Requirement: Admin can retrieve a single customer order with items and snapshots

The system SHALL expose `GET /api/admin/customer-orders/:id` returning the order header, line items (with snapshots), address snapshots, and a customer reference. Responses SHALL NOT include `supplierId`, `supplierReference`, `supplierCost`, or other supplier-internal fields. A non-existent id SHALL return `404` with error code `CUSTOMER_ORDER_NOT_FOUND`.

#### Scenario: Get an existing order with items

- **WHEN** an admin requests `GET /api/admin/customer-orders/:id` for an existing order
- **THEN** the system returns `200` with the order including `items[]`, `shippingAddressSnapshot`, `billingAddressSnapshot`, and the three status fields

#### Scenario: Get a missing order

- **WHEN** an admin requests `GET /api/admin/customer-orders/:id` for an id that does not exist
- **THEN** the system returns `404` with error code `CUSTOMER_ORDER_NOT_FOUND`

#### Scenario: Supplier fields are absent

- **WHEN** an admin retrieves any customer order response
- **THEN** the payload contains no `supplierId`, `supplierReference`, or `supplierCost` fields

### Requirement: Admin can create a customer order with snapshots and server-side totals

The system SHALL expose `POST /api/admin/customer-orders` accepting `customerId`, `items[]` (`productVariantId`, `quantity`), `shippingAddressSnapshot`, and `billingAddressSnapshot`. For each item the server SHALL snapshot `productNameSnapshot`, `variantSnapshot`, `skuSnapshot`, and `unitPrice` from the variant at creation time; compute `totalPrice` per line and `subtotalAmount`/`totalAmount` server-side; generate a unique `orderNumber`; set initial `status = PendingPayment`, `paymentStatus = Pending`, `fulfillmentStatus = NotStarted`. Creation SHALL be transactional (order + all items). Missing customer or variant SHALL return `404` (`CUSTOMER_NOT_FOUND` or `VARIANT_NOT_FOUND`). Validation failures SHALL return `400` with `VALIDATION_ERROR`.

#### Scenario: Create with valid items snapshots catalog data

- **WHEN** an admin submits `POST /api/admin/customer-orders` with a valid `customerId` and items
- **THEN** the system creates the order with snapshotted line items, computed totals, and returns `201` with the full order

#### Scenario: Snapshots remain after catalog price change

- **WHEN** a product variant's `publicPrice` changes after an order is created
- **THEN** a subsequent `GET` returns the original snapshotted `unitPrice`, not the new catalog price

#### Scenario: Missing customer

- **WHEN** an admin submits a `customerId` that does not exist
- **THEN** the system returns `404` with error code `CUSTOMER_NOT_FOUND` and creates no order

#### Scenario: Invalid quantity

- **WHEN** an admin submits an item with `quantity` less than or equal to 0
- **THEN** the system returns `400` with error code `VALIDATION_ERROR`

### Requirement: Admin can update order, payment, and fulfillment status independently

The system SHALL expose `PATCH /api/admin/customer-orders/:id/status` accepting optional `status`, `paymentStatus`, and `fulfillmentStatus`. Only provided fields are updated. Each field SHALL be validated against its own allowed values and transition rules. Critical business rules from `docs/data-model.md` SHALL be enforced: a paid order cannot move back to `PendingPayment`; a cancelled order cannot advance `fulfillmentStatus`. Invalid transitions SHALL return `422` with codes `ORDER_STATUS_TRANSITION_INVALID`, `PAYMENT_STATUS_TRANSITION_INVALID`, or `FULFILLMENT_STATUS_TRANSITION_INVALID`. Successful updates SHALL return `200` with the updated order. Setting payment to `Paid` SHOULD set `paidAt`; cancelling SHOULD set `cancelledAt`.

#### Scenario: Update payment status independently

- **WHEN** an admin submits `PATCH` with only `paymentStatus: Paid`
- **THEN** the system updates `paymentStatus` without changing `status` or `fulfillmentStatus` unless explicitly provided

#### Scenario: Reject paid to pending payment

- **WHEN** an admin attempts to change `status` from `Paid` to `PendingPayment`
- **THEN** the system returns `422` with error code `ORDER_STATUS_TRANSITION_INVALID`

#### Scenario: Reject fulfillment advance on cancelled order

- **WHEN** an admin attempts to advance `fulfillmentStatus` on an order with `status = Cancelled`
- **THEN** the system returns `422` with error code `FULFILLMENT_STATUS_TRANSITION_INVALID`

#### Scenario: Update a missing order

- **WHEN** an admin submits `PATCH /api/admin/customer-orders/:id/status` for a non-existent id
- **THEN** the system returns `404` with error code `CUSTOMER_ORDER_NOT_FOUND`

### Requirement: Customer orders are admin-only and separate from supplier orders

Customer order endpoints SHALL exist only under `/api/admin/customer-orders`. The system SHALL NOT expose customer-order management on `/api/public/*`. Customer orders and supplier orders are different concepts; this change SHALL NOT implement supplier-order generation (`POST .../supplier-orders`).

#### Scenario: No public customer-order route

- **WHEN** a client requests any `/api/public/customer-orders` path
- **THEN** the system returns `404` (route not found)

#### Scenario: Supplier-order generation is not available

- **WHEN** an admin requests `POST /api/admin/customer-orders/:id/supplier-orders`
- **THEN** the system returns `404` (deferred to KAN-19)
