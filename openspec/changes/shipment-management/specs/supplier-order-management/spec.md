## ADDED Requirements

### Requirement: SupplierOrder shipments back-relation
The `SupplierOrder` Prisma model SHALL expose a `shipments Shipment[]` back-relation, allowing the system to query all shipments associated with a given supplier order.

#### Scenario: Query shipments for a supplier order
- **WHEN** the system queries a supplier order with shipments included
- **THEN** all linked shipment records are returned

#### Scenario: New supplier orders start with empty shipments list
- **WHEN** a supplier order is created
- **THEN** its `shipments` relation is empty
