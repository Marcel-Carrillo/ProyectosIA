## ADDED Requirements

### Requirement: Authenticated buyer can list their own saved addresses

The system SHALL expose `GET /api/public/account/addresses` behind `requireCustomerAuth`, returning only `CustomerAddress` records owned by the token's `customerId`. Each item SHALL include `id`, `type`, `isDefault`, `fullName`, `phone`, `streetLine1`, `streetLine2`, `city`, `province`, `postalCode`, `country`, `createdAt`, `updatedAt`.

#### Scenario: List own addresses

- **WHEN** an authenticated buyer requests `GET /api/public/account/addresses`
- **THEN** the system returns `200` with only that buyer's addresses

#### Scenario: No addresses returns an empty list

- **WHEN** an authenticated buyer with no saved addresses requests `GET /api/public/account/addresses`
- **THEN** the system returns `200` with an empty array

### Requirement: Authenticated buyer can create a saved address

The system SHALL expose `POST /api/public/account/addresses` behind `requireCustomerAuth`. `customerId` SHALL be derived from the token only, never from the request body. Required fields: `type` (`Shipping` | `Billing`), `fullName` (max 150), `streetLine1` (max 150), `city` (max 100), `province` (max 100), `postalCode` (max 20), `country` (max 100). Optional fields: `phone` (max 30), `streetLine2` (max 150), `isDefault` (boolean, default `false`). If `isDefault: true` is sent, the system SHALL unset `isDefault` on any other address of the same `type` owned by the same customer, in the same transaction. On success the system SHALL return `201` with the created address.

#### Scenario: Create a valid address

- **WHEN** an authenticated buyer submits `POST /api/public/account/addresses` with all required fields
- **THEN** the system creates the address scoped to their `customerId` and returns `201`

#### Scenario: Creating a default address unsets the previous default of the same type

- **WHEN** an authenticated buyer with an existing default `Shipping` address creates a new address with `type: "Shipping"` and `isDefault: true`
- **THEN** the new address becomes the default `Shipping` address and the previously-default one has `isDefault` set to `false`

#### Scenario: Missing required field is rejected

- **WHEN** an authenticated buyer submits a new address without `streetLine1` or another required field
- **THEN** the system returns `400` with error code `VALIDATION_ERROR` and creates no address

### Requirement: Authenticated buyer can update or delete their own saved address

The system SHALL expose `PATCH /api/public/account/addresses/:id` and `DELETE /api/public/account/addresses/:id` behind `requireCustomerAuth`. Both SHALL verify the address belongs to the token's `customerId`; an address belonging to a different customer or a non-existent address SHALL return `404` with error code `ADDRESS_NOT_FOUND`. Setting `isDefault: true` via `PATCH` SHALL unset `isDefault` on any other address of the same `type` owned by the same customer, in the same transaction. `DELETE` SHALL succeed with `204` even when the deleted address was the default of its type (the buyer simply has no default of that type afterward).

#### Scenario: Update own address

- **WHEN** an authenticated buyer submits `PATCH /api/public/account/addresses/:id` for an address they own, changing only `city`
- **THEN** the system updates that field and returns `200`

#### Scenario: Cannot update another customer's address

- **WHEN** an authenticated buyer submits `PATCH /api/public/account/addresses/:id` for an address owned by a different customer
- **THEN** the system returns `404` with error code `ADDRESS_NOT_FOUND` and makes no change

#### Scenario: Setting default via update unsets the previous default

- **WHEN** an authenticated buyer with an existing default `Billing` address patches a different `Billing` address to `isDefault: true`
- **THEN** that address becomes the default and the previous default `Billing` address has `isDefault` set to `false`

#### Scenario: Delete own address

- **WHEN** an authenticated buyer requests `DELETE /api/public/account/addresses/:id` for an address they own
- **THEN** the system removes the address and returns `204`

#### Scenario: Cannot delete another customer's address

- **WHEN** an authenticated buyer requests `DELETE /api/public/account/addresses/:id` for an address owned by a different customer
- **THEN** the system returns `404` with error code `ADDRESS_NOT_FOUND` and does not delete it

### Requirement: At most one default address per type per customer

The system SHALL enforce, at the data layer, that a customer has at most one `CustomerAddress` with `isDefault = true` per `type`. This invariant SHALL hold under concurrent default-setting requests for the same customer and type.

#### Scenario: Only one default shipping address exists after concurrent updates

- **WHEN** two concurrent requests each attempt to set a different address as the default `Shipping` address for the same customer
- **THEN** exactly one address ends up with `isDefault = true` for `type = Shipping` once both requests complete

#### Scenario: Shipping and billing defaults are independent

- **WHEN** a customer has a default `Shipping` address and a default `Billing` address
- **THEN** setting a new default `Shipping` address does not affect the default `Billing` address
