# Spec: Supplier Order Management

## Purpose

Admin surface for managing supplier orders — the internal fulfillment record of what the store requested from suppliers to fulfill customer orders. Enables store administrators to list, search, inspect, manually create, auto-generate from customer orders, and advance supplier orders through `status` transitions. Supplier orders are strictly separate from customer orders. Supplier costs and references are admin-internal only and must never appear on `/api/public/*` routes.

## Requirements

### Requirement: Admin can list supplier orders with pagination and filters

The system SHALL expose `GET /api/admin/supplier-orders` returning supplier orders in the standard response envelope `{ success, data, message }` where `data` contains `{ items, total, page, pageSize }`. The endpoint SHALL accept `page` (default 1), `pageSize` (default 20, clamped to max 100), `customerOrderId`, `supplierId`, `status` (`SupplierOrderStatus`), `search` (match on `supplierOrderNumber`), `sort` (`createdAt` | `supplierOrderNumber`, default `createdAt`), and `order` (`asc` | `desc`, default `desc`). Field definitions follow `docs/data-model.md` (SupplierOrder, SupplierOrderItem).

#### Scenario: List returns paginated supplier orders

- **WHEN** an admin requests `GET /api/admin/supplier-orders`
- **THEN** the system returns `200` with up to 20 supplier orders in `data.items` and the correct `total`, `page`, and `pageSize`

#### Scenario: Filter by customer order and supplier

- **WHEN** an admin requests `GET /api/admin/supplier-orders?customerOrderId=1&supplierId=2`
- **THEN** the system returns only supplier orders for that customer order and supplier

#### Scenario: Filter by status

- **WHEN** an admin requests `GET /api/admin/supplier-orders?status=Requested`
- **THEN** the system returns only supplier orders with `status = Requested`

#### Scenario: Page size is bounded

- **WHEN** an admin requests `pageSize` greater than 100
- **THEN** the system clamps the page size to 100

### Requirement: Admin can retrieve a single supplier order with items

The system SHALL expose `GET /api/admin/supplier-orders/:id` returning the supplier order header, line items (with `supplierReferenceSnapshot` and `supplierCost`), tracking fields, and references to `customerOrderId` and `supplierId`. A non-existent id SHALL return `404` with error code `SUPPLIER_ORDER_NOT_FOUND`.

#### Scenario: Get an existing supplier order with items

- **WHEN** an admin requests `GET /api/admin/supplier-orders/:id` for an existing supplier order
- **THEN** the system returns `200` with the order including `items[]`, `status`, tracking fields, and `internalNotes`

#### Scenario: Get a missing supplier order

- **WHEN** an admin requests `GET /api/admin/supplier-orders/:id` for an id that does not exist
- **THEN** the system returns `404` with error code `SUPPLIER_ORDER_NOT_FOUND`

### Requirement: Admin can manually create a supplier order

The system SHALL expose `POST /api/admin/supplier-orders` accepting `customerOrderId`, `supplierId`, `items[]` (`customerOrderItemId`, `productVariantId`, `quantity`, `supplierCost`), and optional `internalNotes`. The server SHALL validate that the customer order exists and has `status` of `Paid` or `Processing`; that the supplier exists and is not `Blocked`; that each item references a valid customer order item belonging to the customer order; that `quantity` is greater than 0; and that `supplierCost` is greater than or equal to 0. On create the server SHALL snapshot `supplierReferenceSnapshot` from the variant's `supplierReference`; generate a unique `supplierOrderNumber`; set initial `status = Draft` for header and items; and persist header + items transactionally. Missing customer order SHALL return `404` (`CUSTOMER_ORDER_NOT_FOUND`). Missing supplier SHALL return `404` (`SUPPLIER_NOT_FOUND`). Invalid customer order state SHALL return `422` (`CUSTOMER_ORDER_NOT_ELIGIBLE`). Validation failures SHALL return `400` (`VALIDATION_ERROR`).

#### Scenario: Create with valid data

- **WHEN** an admin submits `POST /api/admin/supplier-orders` with a valid paid customer order, supplier, and items
- **THEN** the system creates the supplier order with snapshotted items and returns `201` with the full supplier order

#### Scenario: Reject creation from unpaid customer order

- **WHEN** an admin submits a create request for a customer order with `status = PendingPayment`
- **THEN** the system returns `422` with error code `CUSTOMER_ORDER_NOT_ELIGIBLE` and creates no supplier order

#### Scenario: Reject item from different customer order

- **WHEN** an admin submits an item whose `customerOrderItemId` does not belong to the given `customerOrderId`
- **THEN** the system returns `400` with error code `VALIDATION_ERROR`

### Requirement: Admin can auto-generate supplier orders from a customer order

The system SHALL expose `POST /api/admin/customer-orders/:id/supplier-orders` with no request body. The server SHALL load the customer order with items and variants; validate the customer order has `status` of `Paid` or `Processing` and is not `Cancelled`; group unfulfilled line items by each variant's `supplierId`; create one `SupplierOrder` per supplier with corresponding `SupplierOrderItem` rows; snapshot `supplierCost` from variant `supplierCost` and `supplierReferenceSnapshot` from variant `supplierReference`; set initial status `Draft`; generate unique `supplierOrderNumber` per order; and run the entire operation in a single transaction. If supplier orders already exist for all items, the operation SHALL be idempotent and return existing orders without duplicates (`200`). If some suppliers already have orders, only missing suppliers SHALL be created. On success the server SHALL update the customer order `fulfillmentStatus` to `SupplierOrderPlaced` when at least one supplier order is created or already exists. Missing customer order SHALL return `404` (`CUSTOMER_ORDER_NOT_FOUND`). Ineligible customer order SHALL return `422` (`CUSTOMER_ORDER_NOT_ELIGIBLE`). Variant without supplier SHALL return `422` (`VARIANT_SUPPLIER_MISSING`).

#### Scenario: Generate one supplier order per supplier

- **WHEN** an admin requests `POST /api/admin/customer-orders/:id/supplier-orders` for a paid order with items from two different suppliers
- **THEN** the system creates two supplier orders (one per supplier) and returns `201` with the list of supplier orders

#### Scenario: Update fulfillment status on generation

- **WHEN** supplier orders are successfully generated for a customer order with `fulfillmentStatus = PendingSupplierOrder`
- **THEN** the customer order `fulfillmentStatus` becomes `SupplierOrderPlaced`

#### Scenario: Idempotent re-generation

- **WHEN** an admin requests generation for a customer order that already has supplier orders covering all items
- **THEN** the system returns `200` with the existing supplier orders and does not create duplicates

#### Scenario: Reject generation for cancelled order

- **WHEN** an admin requests generation for a customer order with `status = Cancelled`
- **THEN** the system returns `422` with error code `CUSTOMER_ORDER_NOT_ELIGIBLE`

### Requirement: Admin can update supplier order status

The system SHALL expose `PATCH /api/admin/supplier-orders/:id/status` accepting `status` (required), optional `trackingNumber`, and optional `trackingUrl`. The server SHALL validate `status` against `SupplierOrderStatus` enum and enforce transition rules. On transition to `Requested` the server SHALL set `requestedAt`; to `Confirmed` set `confirmedAt`; to `Shipped` set `shippedAt`; to `Delivered` set `deliveredAt`. Item statuses SHALL mirror the header status. Invalid transitions SHALL return `422` (`SUPPLIER_ORDER_STATUS_TRANSITION_INVALID`). Successful updates SHALL return `200` with the updated supplier order. After status update the server SHALL recompute the parent customer order `fulfillmentStatus`: all supplier orders `Delivered` → `Fulfilled`; any `OutOfStock` or `Cancelled` with none delivered → `Blocked`; mix of terminal and in-progress → `PartiallyFulfilled`.

#### Scenario: Advance status to Shipped with tracking

- **WHEN** an admin submits `PATCH` with `status: Shipped`, `trackingNumber`, and `trackingUrl`
- **THEN** the system updates the supplier order, sets `shippedAt`, and returns `200` with tracking fields populated

#### Scenario: Reject invalid status transition

- **WHEN** an admin attempts to change status from `Delivered` to `Draft`
- **THEN** the system returns `422` with error code `SUPPLIER_ORDER_STATUS_TRANSITION_INVALID`

#### Scenario: Recompute customer fulfillment on delivery

- **WHEN** all supplier orders for a customer order reach `Delivered`
- **THEN** the parent customer order `fulfillmentStatus` becomes `Fulfilled`

#### Scenario: Update a missing supplier order

- **WHEN** an admin submits `PATCH /api/admin/supplier-orders/:id/status` for a non-existent id
- **THEN** the system returns `404` with error code `SUPPLIER_ORDER_NOT_FOUND`

### Requirement: Supplier orders are admin-only

Supplier order endpoints SHALL exist only under `/api/admin/supplier-orders` and `/api/admin/customer-orders/:id/supplier-orders`. The system SHALL NOT expose supplier-order management on `/api/public/*`. `supplierCost` and `supplierReferenceSnapshot` SHALL appear only on admin supplier-order responses, never on customer-order or public routes.

#### Scenario: No public supplier-order route

- **WHEN** a client requests any `/api/public/supplier-orders` path
- **THEN** the system returns `404` (route not found)

#### Scenario: Customer order responses omit supplier cost

- **WHEN** an admin retrieves any customer order response
- **THEN** the payload contains no `supplierCost` or `supplierReference` fields
