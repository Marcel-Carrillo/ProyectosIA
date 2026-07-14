## ADDED Requirements

### Requirement: Fulfillment automation is controlled by a feature flag with manual actions retained as fallback

The system SHALL introduce a server-side feature flag `FULFILLMENT_AUTOMATION_ENABLED` (default `false`). When disabled, the system SHALL behave exactly as before this change: supplier-order generation, CJ push, and status pulls remain fully manual admin actions. When enabled, the automatic chain defined by this capability SHALL run in addition to — never instead of — the existing manual endpoints in `supplier-order-management` and `cj-supplier-order-push`, which SHALL remain callable by an admin at any time as a fallback (for example, if automation fails or an order needs manual intervention).

#### Scenario: Automation disabled preserves fully manual behavior

- **WHEN** `FULFILLMENT_AUTOMATION_ENABLED` is `false` and a customer order is marked `Paid`
- **THEN** no supplier order is auto-generated and no CJ push is auto-triggered; an admin must use the existing manual endpoints

#### Scenario: Automation enabled still allows manual override

- **WHEN** `FULFILLMENT_AUTOMATION_ENABLED` is `true` and an automatically-generated supplier order needs a manual status correction
- **THEN** an admin can still call the existing manual `PATCH /api/admin/supplier-orders/:id/status` and CJ push/status endpoints directly

### Requirement: Customer order payment success automatically triggers supplier order generation and CJ push

When `FULFILLMENT_AUTOMATION_ENABLED` is `true` and the Stripe `payment_intent.succeeded` webhook marks a `CustomerOrder` as `Paid`, the system SHALL, within the same automation pipeline and after the existing payment-success handling completes: (1) automatically invoke supplier-order generation for that customer order (per the automatic-generation requirement in `supplier-order-management`); (2) for each resulting CJ-fulfilled supplier order with no existing `externalOrderId`, automatically invoke the CJ push with auto-selected logistics (per `cj-supplier-order-push`). Both steps SHALL reuse the existing idempotency guards (`externalOrderId` uniqueness, supplier-order generation idempotency) so that Stripe webhook retries never create duplicate supplier orders or duplicate CJ orders. If step (1) or (2) fails for a given order, the failure SHALL NOT roll back the payment or order `Paid` status; it SHALL be recorded and surfaced through the alert path below, leaving the order in a state an admin can recover manually.

#### Scenario: End-to-end automatic chain on payment success

- **WHEN** automation is enabled and a customer order's payment succeeds via the Stripe webhook
- **THEN** the system automatically generates the customer order's supplier order(s) and pushes each CJ-fulfilled supplier order to CJ Dropshipping (sandbox), with zero manual admin steps

#### Scenario: Webhook retry does not duplicate supplier orders or CJ pushes

- **WHEN** Stripe redelivers the `payment_intent.succeeded` webhook for an order whose supplier orders were already generated and already pushed to CJ
- **THEN** the automation pipeline detects the existing supplier orders and existing `externalOrderId` values and performs no duplicate creation or push

#### Scenario: A failure in automatic CJ push does not affect payment status

- **WHEN** automation is enabled, supplier-order generation succeeds, but the automatic CJ push fails with `CJ_API_UNAVAILABLE`
- **THEN** the customer order's `paymentStatus` and `status` remain `Paid`, the supplier order's `externalOrderId` remains null, and an alert is raised per the alerting requirement below

### Requirement: A scheduled job automatically syncs CJ order status into the admin and into customer-facing shipping status

The system SHALL run a scheduled job (mirroring the existing catalog auto-provisioning job's EventBridge pattern) that, when `FULFILLMENT_AUTOMATION_ENABLED` is `true`, periodically pulls CJ Dropshipping status for supplier orders with a non-null `externalOrderId` and a non-terminal `externalOrderStatus` (per the scheduled-sync requirement in `cj-supplier-order-push`), and propagates resulting changes into `Shipment` records (per the automatic-shipment requirement in `shipment-management`). Because `customer-order-shipping-status` already derives the customer-facing `shippingStatus` from `Shipment` records at read time, no additional customer-facing propagation step is required beyond keeping `Shipment` records current.

#### Scenario: Scheduled job keeps admin and customer-facing status current

- **WHEN** the scheduled job runs and finds a supplier order whose CJ status has advanced from "awaiting shipment" to "shipped"
- **THEN** the job updates the supplier order's external status fields and creates or advances the linked `Shipment` to `Shipped`, after which the customer's account order page reflects `shippingStatus: "Shipped"` on its next read

#### Scenario: Scheduled job is re-entrant

- **WHEN** the scheduled job runs twice in a row with no CJ status change in between
- **THEN** the second run makes no further changes to supplier orders or shipments beyond updating `lastStatusSyncedAt`

### Requirement: Automation failures are logged and surfaced through an alert path

Any failure in the automatic supplier-order generation, automatic CJ push, or scheduled status-sync steps SHALL be logged with structured context (customer order id, supplier order id where applicable, failure reason) without logging secrets or cost figures, and SHALL be surfaced to store administrators through a visible alert mechanism (at minimum, a queryable failure/alert list in the admin panel) so a stalled order is never silent.

#### Scenario: Failed automatic push is visible to an admin

- **WHEN** an automatic CJ push fails
- **THEN** an admin can see that failure recorded in the admin panel's alert/failure list, including the affected customer order and supplier order

#### Scenario: No secrets or costs in automation logs

- **WHEN** any automation step logs a failure or success event
- **THEN** the log entry contains no CJ API credentials, Stripe secrets, `supplierCost`, or freight cost figures

### Requirement: Logistics auto-selection policy is admin-configurable

When automatically selecting a `logisticName` for a CJ push, the system SHALL default to the cheapest option returned by the freight quote unless the store has configured a default carrier or an allow-list of acceptable carriers, in which case the cheapest option within that allow-list SHALL be selected. If no option in the freight quote satisfies the configured allow-list, the automatic push SHALL fail with a dedicated error and be surfaced through the alert path rather than falling back to an unlisted carrier.

#### Scenario: Default policy selects the cheapest option

- **WHEN** no carrier allow-list is configured and a freight quote returns multiple logistics options
- **THEN** the automatic push selects the option with the lowest price

#### Scenario: Configured allow-list restricts selection

- **WHEN** an allow-list of carriers is configured and the freight quote returns both allow-listed and non-allow-listed options
- **THEN** the automatic push selects the cheapest option among only the allow-listed carriers

#### Scenario: No acceptable option fails safely

- **WHEN** an allow-list is configured and none of the freight quote's options match it
- **THEN** the automatic push does not proceed with a non-allow-listed carrier, and the failure is surfaced through the alert path
