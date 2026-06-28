## ADDED Requirements

### Requirement: System can auto-generate a welcome coupon for a new customer

The system SHALL support programmatic coupon creation (not only through the admin panel) for the purpose of issuing welcome discounts. A welcome coupon SHALL have: `type = "percentage"`, `value = WELCOME_COUPON_PERCENT`, `maxUses = 1`, `active = true`, `startsAt = now()`, `expiresAt = now() + WELCOME_COUPON_VALIDITY_DAYS days`, `minOrderAmount = WELCOME_COUPON_MIN_ORDER`, and a unique code with prefix `WELCOME-` followed by a cryptographically random token (uppercased, matching the `code.trim().toUpperCase()` normalization applied at validation). The code SHALL be guaranteed unique at creation time. Auto-generated coupons SHALL be visible in the admin coupon list alongside manually created ones.

#### Scenario: Welcome coupon is created with correct attributes

- **WHEN** the system auto-generates a welcome coupon for a new customer
- **THEN** a `Coupon` record exists with `type = "percentage"`, `value = 15` (default), `maxUses = 1`, `active = true`, and a unique `WELCOME-` prefixed code

#### Scenario: Welcome coupon code is unique

- **WHEN** two customers register concurrently
- **THEN** each receives a distinct welcome coupon code with no collision

#### Scenario: Welcome coupon is redeemable at checkout

- **WHEN** a buyer applies their welcome coupon code during checkout
- **THEN** the existing `Checkout applies coupon atomically` requirement applies and a `15%` discount is calculated on `subtotalAmount`
