# Spec: Customer Management

## Purpose

Admin CRUD surface for managing customer master records and their shipping/billing addresses. Enables store administrators to create, list, retrieve, update, and delete customers and their addresses from the admin panel. Required precondition for order processing and supplier fulfillment (the shipping address flows from this record to supplier orders). Customer PII (email, phone) is admin-only and must never be exposed on customer-facing public APIs.

## Requirements

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

### Requirement: Admin can retrieve a single customer
The system SHALL expose `GET /api/admin/customers/:id` (numeric id) returning the full customer record including their `addresses` array. A non-existent id SHALL return `404` with error code `CUSTOMER_NOT_FOUND`; a non-numeric id SHALL return `400` with error code `VALIDATION_ERROR`. The response SHALL NOT include any supplier cost, supplier reference, or internal fulfillment data.

#### Scenario: Get an existing customer with addresses
- **WHEN** an admin requests `GET /api/admin/customers/:id` for an existing customer
- **THEN** the system returns `200` with the customer record including `firstName`, `lastName`, `email`, `phone`, `createdAt`, `updatedAt`, and an `addresses` array

#### Scenario: Get a missing customer
- **WHEN** an admin requests `GET /api/admin/customers/:id` for an id that does not exist
- **THEN** the system returns `404` with error code `CUSTOMER_NOT_FOUND`

#### Scenario: Non-numeric id is rejected
- **WHEN** an admin requests `GET /api/admin/customers/abc`
- **THEN** the system returns `400` with error code `VALIDATION_ERROR`

### Requirement: Admin can create a customer
The system SHALL expose `POST /api/admin/customers` to create a customer. `firstName` (max 100), `lastName` (max 100), and `email` (max 255, valid email format, unique) are required. `phone` (max 30) is optional. The email SHALL be stored normalized (trimmed and lowercased). A duplicate `email` SHALL return `409` with error code `CUSTOMER_EMAIL_CONFLICT`. On success the system SHALL return `201` with the created customer. Validation failures SHALL return `400` with error code `VALIDATION_ERROR` and not persist any record.

#### Scenario: Create with valid data
- **WHEN** an admin submits `POST /api/admin/customers` with valid `firstName`, `lastName`, and `email`
- **THEN** the system creates the customer and returns `201` with the created record

#### Scenario: Duplicate email is rejected
- **WHEN** an admin submits `POST /api/admin/customers` with an `email` that already exists
- **THEN** the system returns `409` with error code `CUSTOMER_EMAIL_CONFLICT` and creates no record

#### Scenario: Missing required fields
- **WHEN** an admin submits `POST /api/admin/customers` without `firstName`, `lastName`, or `email`
- **THEN** the system returns `400` with error code `VALIDATION_ERROR` and creates no record

#### Scenario: Invalid email format
- **WHEN** an admin submits an `email` that is not a valid email format
- **THEN** the system returns `400` with error code `VALIDATION_ERROR` and creates no record

### Requirement: Admin can update a customer
The system SHALL expose `PATCH /api/admin/customers/:id` for partial updates of any editable field (`firstName`, `lastName`, `email`, `phone`). The same validation rules as creation SHALL apply to provided fields, including email uniqueness. Updating a missing customer SHALL return `404` with error code `CUSTOMER_NOT_FOUND`. A duplicate email on update SHALL return `409` with error code `CUSTOMER_EMAIL_CONFLICT`. A successful update SHALL return `200` with the updated customer.

#### Scenario: Partial update of contact details
- **WHEN** an admin submits `PATCH /api/admin/customers/:id` changing only `phone`
- **THEN** the system updates that field, leaves other fields unchanged, and returns `200` with the updated record

#### Scenario: Email update with duplicate is rejected
- **WHEN** an admin updates a customer's `email` to one already used by another customer
- **THEN** the system returns `409` with error code `CUSTOMER_EMAIL_CONFLICT` and does not modify the record

#### Scenario: Update a missing customer
- **WHEN** an admin submits `PATCH /api/admin/customers/:id` for an id that does not exist
- **THEN** the system returns `404` with error code `CUSTOMER_NOT_FOUND`

### Requirement: Admin can delete a customer (blocked if orders exist)
The system SHALL expose `DELETE /api/admin/customers/:id` which physically removes the customer record. If the customer has one or more associated `CustomerOrder` records the system SHALL return `409` with error code `CUSTOMER_HAS_ORDERS` and SHALL NOT remove the customer. Deleting a missing customer SHALL return `404` with error code `CUSTOMER_NOT_FOUND`. On success the system SHALL return `204`.

#### Scenario: Delete a customer with no orders
- **WHEN** an admin requests `DELETE /api/admin/customers/:id` for a customer with no orders
- **THEN** the system removes the customer and returns `204`

#### Scenario: Delete blocked when customer has orders
- **WHEN** an admin requests `DELETE /api/admin/customers/:id` for a customer who has at least one `CustomerOrder`
- **THEN** the system returns `409` with error code `CUSTOMER_HAS_ORDERS` and keeps the customer record

#### Scenario: Delete a missing customer
- **WHEN** an admin requests `DELETE /api/admin/customers/:id` for an id that does not exist
- **THEN** the system returns `404` with error code `CUSTOMER_NOT_FOUND`

### Requirement: Admin can list addresses for a customer
The system SHALL expose `GET /api/admin/customers/:customerId/addresses` returning all addresses belonging to that customer. A non-existent `customerId` SHALL return `404` with error code `CUSTOMER_NOT_FOUND`. Field definitions follow `docs/data-model.md` (CustomerAddress).

#### Scenario: List addresses for an existing customer
- **WHEN** an admin requests `GET /api/admin/customers/:customerId/addresses` for an existing customer
- **THEN** the system returns `200` with an array of that customer's addresses

#### Scenario: List addresses for a missing customer
- **WHEN** an admin requests `GET /api/admin/customers/:customerId/addresses` for a non-existent customer
- **THEN** the system returns `404` with error code `CUSTOMER_NOT_FOUND`

### Requirement: Admin can create an address for a customer
The system SHALL expose `POST /api/admin/customers/:customerId/addresses` to add an address to a customer. Required fields: `type` (enum: `Shipping` | `Billing`), `fullName` (max 150), `streetLine1` (max 150), `city` (max 100), `province` (max 100), `postalCode` (max 20), `country` (max 100). Optional fields: `phone` (max 30), `streetLine2` (max 150). A non-existent `customerId` SHALL return `404` with error code `CUSTOMER_NOT_FOUND`. On success the system SHALL return `201` with the created address.

#### Scenario: Create a valid address
- **WHEN** an admin submits `POST /api/admin/customers/:customerId/addresses` with all required fields
- **THEN** the system creates the address and returns `201` with the created record

#### Scenario: Missing required address field
- **WHEN** an admin submits a new address without `streetLine1` or other required fields
- **THEN** the system returns `400` with error code `VALIDATION_ERROR` and creates no address

#### Scenario: Invalid type value
- **WHEN** an admin submits an address with a `type` value other than `Shipping` or `Billing`
- **THEN** the system returns `400` with error code `VALIDATION_ERROR`

#### Scenario: Address for missing customer
- **WHEN** an admin submits an address for a `customerId` that does not exist
- **THEN** the system returns `404` with error code `CUSTOMER_NOT_FOUND` and creates no address

### Requirement: Admin can update a customer address
The system SHALL expose `PATCH /api/admin/customers/:customerId/addresses/:addressId` for partial updates of any editable address field. The system SHALL verify that the address belongs to the specified customer. If the customer does not exist, the system SHALL return `404` with error code `CUSTOMER_NOT_FOUND`. If the address does not exist or does not belong to the customer, the system SHALL return `404` with error code `ADDRESS_NOT_FOUND`. A successful update SHALL return `200` with the updated address.

#### Scenario: Partial update of address
- **WHEN** an admin submits `PATCH /api/admin/customers/:customerId/addresses/:addressId` changing only `city`
- **THEN** the system updates that field and returns `200` with the updated address

#### Scenario: Address ownership is enforced
- **WHEN** an admin submits `PATCH /api/admin/customers/:customerId/addresses/:addressId` where the address belongs to a different customer
- **THEN** the system returns `404` with error code `ADDRESS_NOT_FOUND`

### Requirement: Admin can delete a customer address
The system SHALL expose `DELETE /api/admin/customers/:customerId/addresses/:addressId` to remove an address. The system SHALL verify ownership (address belongs to the customer). If the customer does not exist the system SHALL return `404` with error code `CUSTOMER_NOT_FOUND`. If the address does not exist or belongs to a different customer the system SHALL return `404` with error code `ADDRESS_NOT_FOUND`. On success the system SHALL return `204`.

#### Scenario: Delete an existing address
- **WHEN** an admin requests `DELETE /api/admin/customers/:customerId/addresses/:addressId` for an existing address that belongs to the customer
- **THEN** the system removes the address and returns `204`

#### Scenario: Delete address with ownership mismatch
- **WHEN** the address does not belong to the specified customer
- **THEN** the system returns `404` with error code `ADDRESS_NOT_FOUND`

### Requirement: Customer data is never exposed on customer-facing APIs
The system SHALL NOT expose admin customer management endpoints under `/api/public/customers` or any admin CRM list/create/update/delete route. Customer PII for **admin operations** SHALL remain on `/api/admin/customers/*`. Authenticated buyers MAY read and update **their own** profile fields through `/api/public/account/profile` only (scoped by customer session). No supplier cost, supplier reference, or internal fulfillment note SHALL appear in any customer or address response.

#### Scenario: No public customer management endpoint exists
- **WHEN** a client requests any `/api/public/customers` path
- **THEN** the system does not serve admin customer management data (the route does not exist)

#### Scenario: Buyer cannot list all customers
- **WHEN** an unauthenticated or authenticated buyer requests admin customer list paths
- **THEN** the system does not expose bulk customer CRM data on public routes
