## ADDED Requirements

### Requirement: System sends welcome email with discount coupon on new account creation

When a new `CustomerAccount` is successfully created (local registration or first-time OAuth sign-up), the system SHALL automatically generate a unique welcome coupon and send a branded welcome email to the customer's address. The email send SHALL be fire-and-forget: SMTP failure SHALL NOT abort, revert, or return an error for the registration request. The system SHALL log the failure at `warn` level. The welcome coupon SHALL be of type `percentage` with value configurable via `WELCOME_COUPON_PERCENT` (default `15`), `maxUses = 1`, `active = true`, `startsAt = now()`, and `expiresAt = now() + WELCOME_COUPON_VALIDITY_DAYS days` (default `30`). The coupon code SHALL be unique and non-guessable (format `WELCOME-<token>` uppercased, consistent with existing coupon normalization). `minOrderAmount` SHALL be configurable via `WELCOME_COUPON_MIN_ORDER` (default `0`).

#### Scenario: New local registration triggers welcome email

- **WHEN** a buyer completes `POST /api/public/auth/register` successfully
- **THEN** the system creates a welcome `Coupon` and sends a branded welcome email containing the coupon code, discount percentage, and expiry date

#### Scenario: First-time OAuth registration triggers welcome email

- **WHEN** a buyer authenticates via OAuth and a new `CustomerAccount` is created for the first time
- **THEN** the system creates a welcome `Coupon` and sends a branded welcome email

#### Scenario: Repeat OAuth login does NOT trigger welcome email

- **WHEN** a buyer authenticates via OAuth and an existing `CustomerAccount` is found
- **THEN** the system does NOT create a new welcome coupon and does NOT send a welcome email

#### Scenario: SMTP failure does not block registration

- **WHEN** the SMTP transport raises an error during welcome email dispatch
- **THEN** the registration response completes successfully with `201`, the error is logged at `warn` level, and no exception is propagated to the caller

#### Scenario: Welcome coupon is single-use

- **WHEN** a buyer attempts to redeem the welcome coupon a second time
- **THEN** the system returns `409` with code `COUPON_EXHAUSTED` (enforced by existing coupon checkout logic)

#### Scenario: Welcome coupon respects expiry

- **WHEN** a buyer attempts to validate the welcome coupon after `expiresAt`
- **THEN** the system returns `valid: false` with reason `expired`

### Requirement: Welcome email content matches Mavile brand identity

The welcome email SHALL use the same HTML structure, inline CSS palette (`#faf9f7` background, `#1a1a18` text, `#d4a853` accent), and Inter font stack as the existing `passwordResetEmail.ts` template. The email SHALL contain: brand name ("Mavile"), a personalised greeting using `customer.firstName`, the coupon code in a visually distinct block, the discount percentage and expiry date, a call-to-action button linking to `FRONTEND_URL`, and unsubscribe/contact footer. The plain-text fallback SHALL include all the same information without HTML.

#### Scenario: HTML email includes coupon code

- **WHEN** the welcome email template is built with valid inputs
- **THEN** the rendered HTML contains the customer's first name, the coupon code, the discount percentage, and the shop URL

#### Scenario: Plain-text fallback includes coupon code

- **WHEN** the welcome email template is built with valid inputs
- **THEN** the `text` output contains the coupon code and discount percentage
