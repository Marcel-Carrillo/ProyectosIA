## Why

Store administrators need a central interface to manage customer records and their shipping/billing addresses. Without this capability, customer data cannot be corrected when it blocks supplier fulfillment (wrong address, invalid email), and there is no reliable master record to support order processing or future self-service features.

## What Changes

- New `Customer` CRUD module: list (with pagination and search), create, edit, and delete customers.
- New `CustomerAddress` sub-resource: list, create, edit, and delete addresses (Shipping | Billing) per customer.
- Delete customer is blocked with 409 if the customer has associated `CustomerOrder` records.
- New admin REST API endpoints under `/api/admin/customers` and `/api/admin/customers/:id/addresses`.
- New frontend pages and modals for customer and address management (admin panel).
- No changes to the existing `Customer` or `CustomerAddress` Prisma schema — entities are already defined; only the application and API layers are new.

## Capabilities

### New Capabilities

- `customer-management`: Admin CRUD for Customer entities (list, create, edit, delete) and their CustomerAddress sub-resources (list, create, edit, delete). Includes validation (unique email, blocked delete on orders), paginated search, and full frontend UI following the supplier-management pattern.

### Modified Capabilities

<!-- No existing specs require requirement-level changes. The Customer and CustomerAddress entities are referenced in the data model but have no existing spec. -->

## Impact

- **APIs**: new endpoints under `/api/admin/customers` and `/api/admin/customers/:id/addresses`; `docs/api-spec.yml` must be updated.
- **Backend**: new `CustomersModule` (`src/customers/`) with controller, service, repository, and DTOs.
- **Frontend**: new `CustomersPage`, form modal, address management, hooks, and API service; new route registered in the admin router.
- **Domain concepts affected**: `Customer`, `CustomerAddress` (read), `CustomerOrder` (referenced for delete guard).
- **Data model**: no schema changes required; existing Prisma entities are used as-is.
- **Security**: admin-only endpoints; customer PII (email, phone) must not be logged in plain text; supplier cost and internal fulfillment data must never appear in customer responses.
- **Scope**: internal/admin-facing only; no customer-facing public API in this change.

## Non-goals

- Customer self-registration or login (no public auth in this change).
- Customer-facing order history or address management.
- Automated email/notification on customer creation.
- Soft-delete for customers (blocked delete is sufficient for MVP).
- Integration with payment providers or shipping carriers.
