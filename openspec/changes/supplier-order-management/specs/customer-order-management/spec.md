## MODIFIED Requirements

### Requirement: Customer orders are admin-only and separate from supplier orders

Customer order endpoints SHALL exist only under `/api/admin/customer-orders`. The system SHALL NOT expose customer-order management on `/api/public/*`. Customer orders and supplier orders are different concepts. Supplier-order generation SHALL be implemented at `POST /api/admin/customer-orders/:id/supplier-orders` (see `supplier-order-management` spec). Customer order detail MAY include a list of linked supplier order ids/numbers for navigation but SHALL NOT embed supplier costs or references.

#### Scenario: No public customer-order route

- **WHEN** a client requests any `/api/public/customer-orders` path
- **THEN** the system returns `404` (route not found)

#### Scenario: Supplier-order generation is available for eligible orders

- **WHEN** an admin requests `POST /api/admin/customer-orders/:id/supplier-orders` for a paid or processing customer order with valid variant suppliers
- **THEN** the system returns `201` (or `200` if idempotent) with the created or existing supplier orders

#### Scenario: Supplier-order generation rejects ineligible orders

- **WHEN** an admin requests `POST /api/admin/customer-orders/:id/supplier-orders` for a cancelled or unpaid customer order
- **THEN** the system returns `422` with error code `CUSTOMER_ORDER_NOT_ELIGIBLE`
