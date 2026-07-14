## MODIFIED Requirements

### Requirement: Admin can create an address for a customer
The system SHALL expose `POST /api/admin/customers/:customerId/addresses` to add an address to a customer. Required fields: `type` (enum: `Shipping` | `Billing`), `fullName` (max 150), `streetLine1` (max 150), `city` (max 100), `province` (max 100), `postalCode` (max 20), `country` (max 100). Optional fields: `phone` (max 30), `streetLine2` (max 150), `isDefault` (boolean, default `false`). A non-existent `customerId` SHALL return `404` with error code `CUSTOMER_NOT_FOUND`. If `isDefault: true` is sent, the system SHALL unset `isDefault` on any other address of the same `type` belonging to the same customer, in the same transaction. On success the system SHALL return `201` with the created address.

#### Scenario: Create a valid address
- **WHEN** an admin submits `POST /api/admin/customers/:customerId/addresses` with all required fields
- **THEN** the system creates the address and returns `201` with the created record

#### Scenario: Creating a default address unsets the previous default of the same type
- **WHEN** an admin creates a new `Shipping` address with `isDefault: true` for a customer who already has a default `Shipping` address
- **THEN** the new address becomes the default `Shipping` address and the previous default has `isDefault` set to `false`

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
The system SHALL expose `PATCH /api/admin/customers/:customerId/addresses/:addressId` for partial updates of any editable address field, including `isDefault`. The system SHALL verify that the address belongs to the specified customer. If the customer does not exist, the system SHALL return `404` with error code `CUSTOMER_NOT_FOUND`. If the address does not exist or does not belong to the customer, the system SHALL return `404` with error code `ADDRESS_NOT_FOUND`. If `isDefault: true` is sent, the system SHALL unset `isDefault` on any other address of the same `type` belonging to the same customer, in the same transaction. A successful update SHALL return `200` with the updated address.

#### Scenario: Partial update of address
- **WHEN** an admin submits `PATCH /api/admin/customers/:customerId/addresses/:addressId` changing only `city`
- **THEN** the system updates that field and returns `200` with the updated address

#### Scenario: Address ownership is enforced
- **WHEN** an admin submits `PATCH /api/admin/customers/:customerId/addresses/:addressId` where the address belongs to a different customer
- **THEN** the system returns `404` with error code `ADDRESS_NOT_FOUND`

#### Scenario: Setting default via admin update unsets the previous default
- **WHEN** an admin patches a customer's `Billing` address to `isDefault: true` while a different `Billing` address of the same customer is currently the default
- **THEN** the patched address becomes the default and the previous default has `isDefault` set to `false`

## ADDED Requirements

### Requirement: Admin address responses include the isDefault flag

`GET /api/admin/customers/:id` and `GET /api/admin/customers/:customerId/addresses` responses SHALL include `isDefault` on each address in the `addresses` array, reflecting the same one-default-per-type invariant enforced for the self-service address endpoints in `customer-account-authentication`.

#### Scenario: Admin sees which address is the default

- **WHEN** an admin retrieves a customer that has a default `Shipping` address
- **THEN** that address is returned with `isDefault: true` and any other `Shipping` address for that customer is returned with `isDefault: false`
