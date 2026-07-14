## MODIFIED Requirements

### Requirement: Admin can push a supplier order to CJ Dropshipping, always in sandbox mode in this increment
The system SHALL expose `POST /api/admin/supplier-orders/:supplierOrderId/cj/push` accepting an optional `logisticName`. If `logisticName` is omitted, or when the push is triggered automatically by `fulfillment-automation`, the system SHALL first call the freight-quote step and select a `logisticName` automatically using the store's configured auto-selection policy (cheapest available option, or an admin-configured default/allow-listed carrier when configured). The system SHALL then create a CJ Dropshipping order via `POST /shopping/order/createOrderV3`. The system SHALL force `isSandbox: 1` on every call to this endpoint in this increment, gated by a server-side configuration flag (`CJ_SANDBOX_ORDERS`, default `true`); the request body SHALL NOT accept an `isSandbox` field, so no caller, manual or automatic, can create a real (non-sandbox) CJ order. On success the system SHALL persist `externalProvider = "CJDropshipping"`, `externalOrderId` (from CJ's response), `sandbox = true`, and `pushedAt` on the `SupplierOrder`, keeping these fields separate from the existing internal `status`/`trackingNumber` fields. A supplier order that already has a non-null `externalOrderId` SHALL be rejected with `409` and error code `CJ_ORDER_ALREADY_PUSHED`, whether the push attempt was manual or automatic (this rejection is the idempotency guard for automatic pushes triggered by Stripe webhook retries). Missing supplier order SHALL return `404` with error code `SUPPLIER_ORDER_NOT_FOUND`. A total upstream failure SHALL return `502` with error code `CJ_API_UNAVAILABLE` and leave the supplier order's external fields unchanged; when the push was triggered automatically, this failure SHALL additionally be surfaced through the alert path defined in `fulfillment-automation`.

#### Scenario: Successful sandbox push with an explicit logisticName
- **WHEN** an admin manually pushes a supplier order with no existing `externalOrderId` and a valid `logisticName`
- **THEN** the system calls CJ Dropshipping's order creation with `isSandbox: 1`, persists `externalOrderId`, `externalProvider = "CJDropshipping"`, `sandbox = true`, and `pushedAt`, and returns `201` with the updated supplier order

#### Scenario: Automatic push auto-selects a logistics option
- **WHEN** the fulfillment automation pipeline pushes a supplier order with no existing `externalOrderId` and no `logisticName` supplied
- **THEN** the system quotes freight, selects a `logisticName` according to the configured auto-selection policy, and proceeds with the push using that selection

#### Scenario: Reject a duplicate push regardless of trigger
- **WHEN** a push is attempted, manually or automatically, for a supplier order that already has a non-null `externalOrderId`
- **THEN** the system returns `409` with error code `CJ_ORDER_ALREADY_PUSHED` and creates no new CJ order

#### Scenario: isSandbox cannot be overridden from the request
- **WHEN** an admin submits a push request including an `isSandbox` field in the body
- **THEN** the system ignores the field entirely and still forces sandbox mode according to `CJ_SANDBOX_ORDERS`

#### Scenario: Upstream failure leaves the supplier order unchanged and alerts on automatic pushes
- **WHEN** the push request to CJ Dropshipping fails due to an unreachable API or a logical failure in the response body
- **THEN** the system returns `502` with error code `CJ_API_UNAVAILABLE`, the supplier order's `externalOrderId` remains null, and if the push was triggered automatically an alert is raised per `fulfillment-automation`

### Requirement: Admin can pull the status and tracking of a pushed CJ Dropshipping order
The system SHALL expose `GET /api/admin/supplier-orders/:supplierOrderId/cj/order` which calls CJ Dropshipping's `GET /shopping/order/getOrderDetail` using the supplier order's `externalOrderId`, and persists the returned `externalOrderStatus`, `externalTrackingNumber`, `externalTrackingProvider`, and `lastStatusSyncedAt`, returning them in the response. In addition to this manual, on-demand pull, the scheduled job defined in `fulfillment-automation` SHALL call the same underlying status-pull logic automatically for supplier orders that have been pushed (non-null `externalOrderId`) but have not yet reached a terminal `externalOrderStatus`. This remains a pull-based mechanism — the system SHALL NOT expose or require any inbound webhook endpoint for this data in this increment. A supplier order with no `externalOrderId` SHALL return `422` with error code `CJ_ORDER_NOT_PUSHED` on the manual endpoint, and SHALL simply be skipped (not treated as an error) by the scheduled job.

#### Scenario: Manual status pull updates and returns external order state
- **WHEN** an admin requests the CJ Dropshipping order status for a supplier order that has been pushed
- **THEN** the system calls CJ Dropshipping's order detail endpoint, persists `externalOrderStatus`, `externalTrackingNumber`, `externalTrackingProvider`, and `lastStatusSyncedAt`, and returns `200` with these fields

#### Scenario: Scheduled sync pulls status for pushed, non-terminal supplier orders
- **WHEN** the scheduled status-sync job runs and finds a supplier order with a non-null `externalOrderId` and a non-terminal `externalOrderStatus`
- **THEN** the job calls CJ Dropshipping's order detail endpoint for that supplier order and persists the same fields as the manual pull

#### Scenario: Scheduled sync skips supplier orders that were never pushed
- **WHEN** the scheduled status-sync job runs and finds a supplier order with `externalOrderId = null`
- **THEN** the job skips that supplier order without raising an error

#### Scenario: Reject manual status pull for an order that was never pushed
- **WHEN** an admin requests the CJ Dropshipping order status for a supplier order with no `externalOrderId`
- **THEN** the system returns `422` with error code `CJ_ORDER_NOT_PUSHED`
