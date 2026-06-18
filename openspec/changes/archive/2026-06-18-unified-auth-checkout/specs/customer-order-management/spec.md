## MODIFIED Requirements

### Requirement: Customer orders are admin-only and separate from supplier orders

Customer order **management** endpoints (list, get, create-by-admin, status updates, supplier-order generation) SHALL exist under `/api/admin/customer-orders` and SHALL require `requireAdminAuth`. The system SHALL additionally allow **buyer-initiated order creation** via `POST /api/public/checkout` and `POST /api/public/checkout/guest` (see `checkout-mvp` spec). Buyer order **read** access SHALL be via `/api/public/account/orders` scoped to the authenticated `customerId`. The system SHALL NOT expose admin order management on unauthenticated `/api/public/customer-orders` paths. Customer orders and supplier orders remain different concepts. Supplier-order generation SHALL remain at `POST /api/admin/customer-orders/:id/supplier-orders`. Customer order detail on admin routes MAY include linked supplier order ids/numbers but SHALL NOT embed supplier costs or references in public buyer responses.

#### Scenario: No public admin-style customer-order route

- **WHEN** a client requests `GET /api/public/customer-orders`
- **THEN** the system returns `404` (route not found)

#### Scenario: Public checkout creates order

- **WHEN** a buyer completes `POST /api/public/checkout/guest` with valid data
- **THEN** a `CustomerOrder` is created and visible to admins via `GET /api/admin/customer-orders`

#### Scenario: Admin customer-order routes require auth

- **WHEN** a client calls `GET /api/admin/customer-orders` without admin token
- **THEN** the system returns `401`

#### Scenario: Supplier-order generation is available for eligible orders

- **WHEN** an authenticated admin requests `POST /api/admin/customer-orders/:id/supplier-orders` for a paid or processing customer order with valid variant suppliers
- **THEN** the system returns `201` (or `200` if idempotent) with the created or existing supplier orders

#### Scenario: Supplier-order generation rejects ineligible orders

- **WHEN** an admin requests `POST /api/admin/customer-orders/:id/supplier-orders` for a cancelled or unpaid customer order
- **THEN** the system returns `422` with error code `CUSTOMER_ORDER_NOT_ELIGIBLE`
