## ADDED Requirements

### Requirement: Shipments are created and advanced automatically from synced CJ Dropshipping status

When the scheduled CJ status-sync job (see `fulfillment-automation`, `cj-supplier-order-push`) observes a new `externalOrderStatus` or `externalTrackingNumber` for a pushed `SupplierOrder`, the system SHALL create a `Shipment` for that supplier order's `customerOrderId`/`supplierOrderId` pair if none exists yet, and SHALL otherwise advance the existing `Shipment`'s `status` using only transitions allowed by the existing shipment status state machine. The mapping from CJ external order status to `Shipment.status` SHALL be: an in-production/awaiting-pickup CJ status maps to `Pending` (no shipment transition needed); a CJ status indicating the parcel has been picked up or shipped maps to `Shipped`; a CJ status indicating the parcel is in transit maps to `InTransit`; a CJ status indicating final delivery maps to `Delivered`; a CJ status indicating a failed or returned delivery maps to `Failed` or `Returned` respectively. If the mapped target status is not a valid transition from the shipment's current status per the existing state machine, the system SHALL skip that transition, leave the shipment unchanged, and surface it through the alert path defined in `fulfillment-automation` rather than raising a data-layer error. `carrier` and `trackingNumber`/`trackingUrl` SHALL be pre-filled from `externalTrackingProvider`/`externalTrackingNumber` when creating the shipment automatically.

#### Scenario: First status sync creates a shipment

- **WHEN** the status-sync job observes a CJ status indicating the parcel has shipped for a `SupplierOrder` with no existing `Shipment`
- **THEN** the system creates a `Shipment` linked to that supplier order's `customerOrderId` and `supplierOrderId`, with `status = Shipped`, `shippedAt` set, and `carrier`/`trackingNumber` populated from the CJ tracking fields

#### Scenario: Later status sync advances the existing shipment

- **WHEN** the status-sync job later observes a CJ status indicating delivery for a supplier order whose shipment is currently `Shipped` or `InTransit`
- **THEN** the system transitions that shipment to `Delivered` and sets `deliveredAt`, per the existing valid transitions

#### Scenario: Invalid mapped transition is skipped, not errored

- **WHEN** the status-sync job observes a CJ status that would map to a shipment status transition not allowed from the shipment's current status by the existing state machine
- **THEN** the system leaves the shipment's status unchanged, does not raise a data-layer error, and raises an alert per `fulfillment-automation`

#### Scenario: Automatic shipment updates respect the terminal-state rule

- **WHEN** the status-sync job observes a new CJ status for a supplier order whose shipment is already `Delivered`, `Failed`, or `Returned`
- **THEN** the system makes no further status transition on that shipment, consistent with the existing terminal-state rule
