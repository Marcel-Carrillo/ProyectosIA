## MODIFIED Requirements

### Requirement: Admin can list customers with pagination and search
The system SHALL expose `GET /api/admin/customers` returning customers in the standard response envelope `{ success, data, message }` where `data` contains `{ items, total, page, pageSize }`. The endpoint SHALL accept `page` (default 1), `pageSize` (default 20, clamped to a maximum of 100), and `search` (case-insensitive match on `firstName`, `lastName`, or `email`). Admin list endpoints SHALL NOT be exposed under `/api/public/*`. Authenticated buyers access their own profile only via `/api/public/account/*` (see `customer-account-authentication` spec). Field definitions follow `docs/data-model.md` (Customer).

#### Scenario: List returns paginated customers
- **WHEN** an admin requests `GET /api/admin/customers`
- **THEN** the system returns `200` with up to 20 customers in `data.items` and the correct `total`, `page`, and `pageSize`

#### Scenario: Search by name or email
- **WHEN** an admin requests `GET /api/admin/customers?search=ana`
- **THEN** the system returns only customers whose `firstName`, `lastName`, or `email` contains "ana" (case-insensitive)

#### Scenario: Page size is bounded
- **WHEN** an admin requests a `pageSize` greater than 100
- **THEN** the system clamps the page size to 100 instead of returning an unbounded result set

### Requirement: Customer data is never exposed on customer-facing APIs
The system SHALL NOT expose admin customer management endpoints under `/api/public/customers` or any admin CRM list/create/update/delete route. Customer PII for **admin operations** SHALL remain on `/api/admin/customers/*`. Authenticated buyers MAY read and update **their own** profile fields through `/api/public/account/profile` only (scoped by customer session). No supplier cost, supplier reference, or internal fulfillment note SHALL appear in any customer or address response.

#### Scenario: No public customer management endpoint exists
- **WHEN** a client requests any `/api/public/customers` path
- **THEN** the system does not serve admin customer management data (the route does not exist)

#### Scenario: Buyer cannot list all customers
- **WHEN** an unauthenticated or authenticated buyer requests admin customer list paths
- **THEN** the system does not expose bulk customer CRM data on public routes
