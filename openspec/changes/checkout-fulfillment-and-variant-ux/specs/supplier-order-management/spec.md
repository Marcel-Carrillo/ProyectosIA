## MODIFIED Requirements

### Requirement: Admin can auto-generate supplier orders from a customer order

The system SHALL expose `POST /api/admin/customer-orders/:id/supplier-orders` with no request body. The server SHALL load the customer order with items and variants; validate the customer order has `status` of `Paid` or `Processing` and is not `Cancelled`; group unfulfilled line items by each variant's `supplierId`; create one `SupplierOrder` per supplier with corresponding `SupplierOrderItem` rows; snapshot `supplierCost` from variant `supplierCost` and `supplierReferenceSnapshot` from variant `supplierReference`; set initial status `Draft`; generate unique `supplierOrderNumber` per order; and run the entire operation in a single transaction. If supplier orders already exist for all items, the operation SHALL be idempotent and return existing orders without duplicates (`200`). If some suppliers already have orders, only missing suppliers SHALL be created. On success the server SHALL update the customer order `fulfillmentStatus` to `SupplierOrderPlaced` when at least one supplier order is created or already exists. Missing customer order SHALL return `404` (`CUSTOMER_ORDER_NOT_FOUND`). Ineligible customer order SHALL return `422` (`CUSTOMER_ORDER_NOT_ELIGIBLE`). Variant without supplier SHALL return `422` (`VARIANT_SUPPLIER_MISSING`). In addition to this manual admin-triggered endpoint, the same generation logic SHALL be invocable automatically by `fulfillment-automation` immediately after a customer order transitions to `Paid` via the Stripe webhook; the automatic path SHALL use the identical validation, grouping, snapshotting, and idempotency rules as the manual endpoint, so re-triggering (e.g. on webhook retry) never creates duplicate supplier orders.

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

#### Scenario: Automatic generation on payment success

- **WHEN** the Stripe `payment_intent.succeeded` webhook marks a customer order `Paid` and `fulfillment-automation` is enabled
- **THEN** the system automatically generates one supplier order per supplier for that customer order, using the same rules as the manual endpoint, without requiring an admin action

#### Scenario: Automatic generation is idempotent across webhook retries

- **WHEN** Stripe redelivers the `payment_intent.succeeded` webhook for a customer order that already has supplier orders covering all items
- **THEN** the automatic generation path returns the existing supplier orders and creates no duplicates, identically to the manual endpoint's idempotent re-generation behavior
