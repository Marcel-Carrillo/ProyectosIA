## VERIFIED Requirements

No requirement changes for KAN-28. Backend delivery is verified against the authoritative main spec at `openspec/specs/customer-order-management/spec.md`.

### Verification checklist (KAN-28 backend)

The apply agent SHALL confirm each item before marking the change complete:

#### Scenario: Prisma models exist with required fields

- **WHEN** inspecting `backend/prisma/schema.prisma`
- **THEN** `CustomerOrder` and `CustomerOrderItem` models exist with `status`, `paymentStatus`, `fulfillmentStatus`, address snapshots, totals, currency, and FKs to `Customer` / `ProductVariant`

#### Scenario: Admin list endpoint with pagination and filters

- **WHEN** `GET /api/admin/customer-orders` is called with `page`, `pageSize`, `customerId`, `status`, `paymentStatus`, `fulfillmentStatus`, or `search`
- **THEN** the system returns `200` with paginated results in the standard envelope

#### Scenario: Admin get, create, and status update

- **WHEN** admin calls `GET /api/admin/customer-orders/:id`, `POST /api/admin/customer-orders`, or `PATCH /api/admin/customer-orders/:id/status`
- **THEN** responses follow the main spec (201 on create, 404 for missing id, 422 for invalid transitions)

#### Scenario: Supplier fields never appear

- **WHEN** any customer order response is inspected
- **THEN** no `supplierId`, `supplierReference`, or `supplierCost` fields are present

#### Scenario: Business rules enforced

- **WHEN** a paid order is updated with `paymentStatus = PendingPayment`
- **THEN** the system returns `422`
- **WHEN** a cancelled order's `fulfillmentStatus` is advanced
- **THEN** the system returns `422`
