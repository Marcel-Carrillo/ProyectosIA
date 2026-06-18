# Spec: Storefront Wishlist

## Purpose

Authenticated buyers can save product variants to a personal wishlist from the storefront. Wishlist is scoped strictly to the logged-in `customerId`.

## ADDED Requirements

### Requirement: Authenticated buyer can manage wishlist items

The system SHALL expose `GET /api/public/account/wishlist`, `POST /api/public/account/wishlist` (`{ productVariantId }`), and `DELETE /api/public/account/wishlist/:productVariantId` behind `requireCustomerAuth`. Each item SHALL reference one `productVariantId` per customer (unique pair). Responses SHALL include customer-safe product/variant display fields only (no supplier data). Inactive or missing variants SHALL return `404` with `VARIANT_NOT_FOUND`.

#### Scenario: Add variant to wishlist

- **WHEN** an authenticated buyer posts a valid active `productVariantId`
- **THEN** the system creates the wishlist item and returns `201`

#### Scenario: Duplicate add is idempotent

- **WHEN** an authenticated buyer adds a variant already on the wishlist
- **THEN** the system returns `200` with the existing item (no duplicate row)

#### Scenario: List own wishlist only

- **WHEN** an authenticated buyer requests the wishlist
- **THEN** the system returns only items for the token's `customerId`

#### Scenario: Remove wishlist item

- **WHEN** an authenticated buyer deletes an item on their wishlist
- **THEN** the system removes it and returns `204`

#### Scenario: Unauthenticated access denied

- **WHEN** a client calls wishlist endpoints without a valid customer token
- **THEN** the system returns `401`
