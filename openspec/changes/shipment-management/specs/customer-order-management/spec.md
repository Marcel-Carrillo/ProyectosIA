## ADDED Requirements

### Requirement: CustomerOrder shipments back-relation
The `CustomerOrder` Prisma model SHALL expose a `shipments Shipment[]` back-relation, allowing the system to query all shipments associated with a given customer order.

#### Scenario: Query shipments for a customer order
- **WHEN** the system queries a customer order with shipments included
- **THEN** all linked shipment records are returned

#### Scenario: New customer orders start with empty shipments list
- **WHEN** a customer order is created
- **THEN** its `shipments` relation is empty
