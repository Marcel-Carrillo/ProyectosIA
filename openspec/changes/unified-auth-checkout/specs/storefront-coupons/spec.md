# Spec: Storefront Coupons

## Purpose

Buyers can validate and apply coupon codes during checkout. Discount calculation is server-authoritative; supplier-internal data is never exposed.

## ADDED Requirements

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
