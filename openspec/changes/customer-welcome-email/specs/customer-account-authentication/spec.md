## MODIFIED Requirements

### Requirement: Buyer can register with email and password

The system SHALL expose `POST /api/public/auth/register` accepting `{ email, password, firstName, lastName, phone? }`. The email SHALL be normalized (trimmed, lowercased). Password SHALL be at least 8 characters with letters and digits. On success the system SHALL create or link a `Customer` and a `CustomerAccount` with `authProvider = local`, hash the password with bcrypt (cost ≥ 12), issue an access token (`aud: "customer"`) and set an httpOnly refresh cookie. Success SHALL return `201` with `{ account, customer, accessToken }` in the standard envelope. Duplicate email with an existing account SHALL return `409` with code `ACCOUNT_EMAIL_CONFLICT`. Validation failures SHALL return `400` with `VALIDATION_ERROR`. Credentials and tokens SHALL NOT appear in logs. After a successful account creation, the system SHALL asynchronously generate a welcome coupon and dispatch a welcome email (see `customer-welcome-email` capability); SMTP failure SHALL NOT affect the `201` response.

#### Scenario: Register creates new customer and account

- **WHEN** a buyer submits valid registration data for an email with no existing account
- **THEN** the system creates `Customer` + `CustomerAccount`, returns `201`, sets refresh cookie, and asynchronously sends a welcome email with a discount coupon

#### Scenario: Register links existing admin-created customer

- **WHEN** a buyer registers with an email that matches an existing `Customer` without an account
- **THEN** the system creates `CustomerAccount` linked to that customer, returns `201`, and asynchronously sends a welcome email

#### Scenario: Duplicate email is rejected

- **WHEN** a buyer registers with an email that already has a `CustomerAccount`
- **THEN** the system returns `409` with code `ACCOUNT_EMAIL_CONFLICT`

#### Scenario: Weak password is rejected

- **WHEN** a buyer submits a password shorter than 8 characters or without letters and digits
- **THEN** the system returns `400` with code `VALIDATION_ERROR`
