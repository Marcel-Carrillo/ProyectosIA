# Spec: Storefront Coupons

## Purpose

Buyers can validate and apply coupon codes during checkout. Discount calculation is server-authoritative; supplier-internal data is never exposed.

## Requirements

### Requirement: Buyer can validate a coupon code

The system SHALL expose `POST /api/public/coupons/validate` accepting `{ code, subtotalAmount }`. The system SHALL check `active`, date window (`startsAt`/`expiresAt`), `minOrderAmount`, and `maxUses` vs `usedCount`. Success SHALL return `200` with `{ valid: true, discountAmount, type, value }`. Invalid codes SHALL return `200` with `{ valid: false, reason }` or `404` with `COUPON_NOT_FOUND` for unknown codes. Validate SHALL be rate limited.

#### Scenario: Valid percentage coupon

- **WHEN** a buyer validates an active 10% code against subtotal €100
- **THEN** the system returns `discountAmount` of €10

#### Scenario: Expired coupon rejected

- **WHEN** a buyer validates a code past `expiresAt`
- **THEN** the system returns `valid: false` with reason `expired`

#### Scenario: Below minimum order amount

- **WHEN** subtotal is below `minOrderAmount`
- **THEN** the system returns `valid: false` with reason `min_order_not_met`

### Requirement: Checkout applies coupon atomically

When a checkout request includes `couponCode`, the system SHALL re-validate the coupon, compute `discountAmount`, set order `discountAmount`, adjust `totalAmount`, and create a `CouponRedemption` in the same transaction as order creation. Exceeded `maxUses` SHALL return `409` with `COUPON_EXHAUSTED`. Double redemption on the same order SHALL be prevented.

#### Scenario: Successful checkout with coupon

- **WHEN** checkout includes a valid coupon and correct subtotal
- **THEN** the order is created with reduced `totalAmount` and a redemption record

#### Scenario: Concurrent exhaustion prevented

- **WHEN** `usedCount` would exceed `maxUses` at commit time
- **THEN** the system returns `409` with code `COUPON_EXHAUSTED` and creates no order

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
