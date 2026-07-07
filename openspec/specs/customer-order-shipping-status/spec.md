## Purpose

Give customers a clear, customer-safe view of where their order stands in shipping, without exposing internal fulfillment mechanics or supplier data. The customer account order list and detail endpoints (`GET /api/public/account/orders`, `GET /api/public/account/orders/:id`) expose a derived `shippingStatus` computed at read time from the order's `Shipment` records, plus a whitelisted `shipments` array on the detail view. Internal `fulfillmentStatus` and any supplier order identifiers are never exposed to customers, and shipping information is only surfaced once payment is no longer pending.

## Requirements

### Requirement: Customer order responses include a derived shipping status
The system SHALL compute a customer-facing `shippingStatus` (one of `Preparing`, `Shipped`, `InTransit`, `Delivered`, `Problem`) for each `CustomerOrder` returned by `GET /api/public/account/orders` and `GET /api/public/account/orders/:id`, derived from the order's associated `Shipment` records without persisting the derived value.

#### Scenario: Order with no shipments is Preparing
- **WHEN** a customer requests their own order and it has no associated `Shipment` records
- **THEN** the response includes `shippingStatus: "Preparing"`

#### Scenario: Order with only Pending shipments is Preparing
- **WHEN** a customer requests their own order and every associated `Shipment` has `status: "Pending"`
- **THEN** the response includes `shippingStatus: "Preparing"`

#### Scenario: Any Failed or Returned shipment marks the order as Problem
- **WHEN** a customer requests their own order and at least one associated `Shipment` has `status: "Failed"` or `status: "Returned"`, regardless of the status of other shipments on the same order
- **THEN** the response includes `shippingStatus: "Problem"`

#### Scenario: All shipments Delivered marks the order as Delivered
- **WHEN** a customer requests their own order, it has at least one associated `Shipment`, and every associated shipment has `status: "Delivered"`
- **THEN** the response includes `shippingStatus: "Delivered"`

#### Scenario: Any shipment InTransit marks the order as InTransit
- **WHEN** a customer requests their own order and at least one associated `Shipment` has `status: "InTransit"`, and no shipment on the order has `status: "Failed"` or `status: "Returned"`, and not every shipment is `Delivered`
- **THEN** the response includes `shippingStatus: "InTransit"`

#### Scenario: Any shipment Shipped (and none InTransit/Problem/all-Delivered) marks the order as Shipped
- **WHEN** a customer requests their own order and at least one associated `Shipment` has `status: "Shipped"`, with no shipment `Failed`, `Returned`, or `InTransit`, and not every shipment `Delivered`
- **THEN** the response includes `shippingStatus: "Shipped"`

### Requirement: Order detail includes whitelisted shipment tracking details
The system SHALL include a `shipments` array on the `GET /api/public/account/orders/:id` response containing only `status`, `carrier`, `trackingNumber`, `trackingUrl`, `shippedAt`, and `deliveredAt` for each associated `Shipment`. The system SHALL NOT include this order's supplier order identifiers, supplier order relations, or any other supplier-facing data in this array or anywhere else in the customer-facing order response.

#### Scenario: Shipment tracking details are present on the order detail response
- **WHEN** a customer requests their own order that has one or more associated `Shipment` records
- **THEN** the response's `shipments` array includes, for each shipment, exactly `status`, `carrier`, `trackingNumber`, `trackingUrl`, `shippedAt`, and `deliveredAt`

#### Scenario: Supplier data is never present in the customer-facing shipment fields
- **WHEN** a customer requests their own order that has one or more associated `Shipment` records with a non-null `supplierOrderId`
- **THEN** the response does not contain a `supplierOrderId` field, a `supplierOrder` field, or any supplier identifier anywhere in the order or shipment payload

#### Scenario: Order list response omits the full shipment array
- **WHEN** a customer requests `GET /api/public/account/orders`
- **THEN** each item in the response includes `shippingStatus` but does not include a `shipments` array

### Requirement: Internal fulfillment status is not exposed to customers
The system SHALL NOT include the internal `fulfillmentStatus` field (order-level or per-item) in the responses of `GET /api/public/account/orders` or `GET /api/public/account/orders/:id`.

#### Scenario: fulfillmentStatus is absent from the customer-facing order response
- **WHEN** a customer requests their own order via either the list or detail endpoint
- **THEN** the response does not contain a `fulfillmentStatus` field at the order level or on any item in `items[]`

### Requirement: Shipping status is only meaningful once payment is complete
The customer-facing order detail and order list views SHALL only present shipping status information (badge, tracking section) once an order's `status` is no longer `PendingPayment`.

#### Scenario: Shipping status hidden while payment is pending
- **WHEN** a customer views their own order with `status = PendingPayment`
- **THEN** the page does not display a shipping status badge or shipping/tracking section

#### Scenario: Shipping status shown once payment is complete
- **WHEN** a customer views their own order with `status` other than `PendingPayment` (for example `Paid`, `Processing`, `Completed`)
- **THEN** the page displays the shipping status badge, and the order detail page displays the shipping/tracking section
