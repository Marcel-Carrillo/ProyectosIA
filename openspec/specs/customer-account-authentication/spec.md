# Spec: Customer Account Authentication

## Purpose

Public storefront authentication and self-service account area for buyers. Enables registration and login (email/password, Google, Apple, Facebook OAuth), optional TOTP 2FA, password recovery, customer-scoped sessions, profile access, and own order history. Distinct from admin authentication (KAN-23). Supplier-internal data must never appear in customer-facing responses.

## Requirements

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

### Requirement: Buyer can log in and log out with email and password

The system SHALL expose `POST /api/public/auth/login` accepting `{ email, password }` and `POST /api/public/auth/logout`. Login success SHALL return `200` with `{ account, customer, accessToken }` and set refresh cookie. Invalid credentials SHALL return `401` with code `INVALID_CREDENTIALS` using a generic message (no user enumeration). Disabled accounts SHALL return `403` with code `ACCOUNT_DISABLED`. Logout SHALL revoke the refresh token, clear the cookie, and return `200`.

#### Scenario: Successful login

- **WHEN** a buyer submits correct email and password for an active account
- **THEN** the system returns `200` with tokens and updates `lastLoginAt`

#### Scenario: Invalid credentials

- **WHEN** a buyer submits a wrong password or unknown email
- **THEN** the system returns `401` with code `INVALID_CREDENTIALS` and an identical generic error message

#### Scenario: Logout revokes session

- **WHEN** an authenticated buyer calls `POST /api/public/auth/logout`
- **THEN** the refresh token is revoked, the cookie is cleared, and subsequent refresh fails

### Requirement: Buyer can refresh access token

The system SHALL expose `POST /api/public/auth/refresh` reading the httpOnly refresh cookie, validating the stored hash, rotating the refresh token, and returning `200` with `{ accessToken }`. Invalid or revoked tokens SHALL return `401` with code `REFRESH_TOKEN_INVALID`.

#### Scenario: Refresh rotates token

- **WHEN** a buyer presents a valid refresh cookie
- **THEN** the system returns a new access token and replaces the refresh cookie

#### Scenario: Revoked refresh token is rejected

- **WHEN** a buyer presents a refresh token that was revoked on logout
- **THEN** the system returns `401` with code `REFRESH_TOKEN_INVALID`

### Requirement: Buyer can sign in with Google, Apple, or Facebook OAuth

The system SHALL expose `GET /api/public/auth/{google|apple|facebook}` and matching callback routes. Each callback SHALL verify identity server-side, require a verified email from the provider, apply the same email merge rule as registration, store the provider id (`googleId`, `appleId`, or `facebookId`), set `authProvider`, issue tokens, and redirect to the storefront. OAuth verification failure SHALL return `401` with code `OAUTH_VERIFICATION_FAILED`.

For Google specifically, the system SHALL apply the following account-linking rule:
- If a `CustomerAccount` exists with a matching `googleId` → authenticate and update `lastLoginAt`.
- If a `CustomerAccount` exists with a matching `email` but no `googleId` → set `googleId` on the existing account, authenticate, and update `lastLoginAt`. No duplicate account SHALL be created.
- If no `CustomerAccount` exists with the Google email → create a new `Customer` and `CustomerAccount` with `authProvider = 'google'`, trigger the welcome coupon (WELCOME-15%) and welcome email, and issue a session.

#### Scenario: Google login for new buyer

- **WHEN** a buyer completes Google OAuth with a new email
- **THEN** the system creates `Customer` + `CustomerAccount` and redirects with an active session

#### Scenario: Google login merges existing customer

- **WHEN** a buyer completes Google OAuth with an email matching an existing `Customer` without an account
- **THEN** the system links the new `CustomerAccount` to that customer

#### Scenario: Google login for existing Google account

- **WHEN** a buyer completes Google OAuth and `googleId` already exists
- **THEN** the system logs in that account and issues new tokens

#### Scenario: New Google registration triggers welcome coupon

- **WHEN** a customer completes Google OAuth for the first time with an email not in the system
- **THEN** `ensureWelcomeCouponExists` is called and the resulting coupon is emailed to the customer
- **THEN** the welcome email is sent to the Google account's email address

#### Scenario: Returning Google user skips coupon

- **WHEN** a customer who already has a `CustomerAccount` (with or without `googleId`) authenticates via Google
- **THEN** no new coupon is created and no welcome email is sent

#### Scenario: Email-matched account gets googleId linked silently

- **WHEN** a customer authenticates via Google and their email matches an existing local account
- **THEN** `googleId` is set on the existing `CustomerAccount`
- **THEN** the customer's session is issued without interruption — no UI prompt required

### Requirement: Google OAuth credentials required for production

The system SHALL read `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from environment variables (SSM in production). `GET /api/public/auth/oauth/providers` SHALL return `{ "google": false }` when these variables are absent, and the "Continue with Google" button SHALL not render.

#### Scenario: Google OAuth disabled when credentials missing

- **WHEN** `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is not set
- **THEN** `GET /api/public/auth/oauth/providers` returns `{ "google": false }`
- **THEN** no Google login button is rendered in the frontend

#### Scenario: Google OAuth enabled when credentials present

- **WHEN** both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- **THEN** `GET /api/public/auth/oauth/providers` returns `{ "google": true }`

### Requirement: Buyer can read current session

The system SHALL expose `GET /api/public/auth/me` requiring a valid customer access token. Success SHALL return `200` with `{ account, customer }` excluding `passwordHash`, `googleId`, and refresh token data. Missing or invalid token SHALL return `401`.

#### Scenario: Get current user

- **WHEN** a buyer sends a valid `Authorization: Bearer` customer access token
- **THEN** the system returns `200` with account and customer profile fields safe for the buyer

#### Scenario: Missing token

- **WHEN** a buyer calls `/me` without a token
- **THEN** the system returns `401`

### Requirement: Authenticated buyer can view and update own profile

The system SHALL expose `GET /api/public/account/profile` and `PATCH /api/public/account/profile` behind `requireCustomerAuth`. `PATCH` SHALL accept optional `firstName`, `lastName`, `phone` only (email change out of MVP). `customerId` SHALL be derived from the token only. Success returns `200` with `{ customer }`.

#### Scenario: Get own profile

- **WHEN** an authenticated buyer requests profile
- **THEN** the system returns only their `Customer` record

#### Scenario: Update name and phone

- **WHEN** an authenticated buyer patches `firstName` and `phone`
- **THEN** the system updates those fields and returns `200`

### Requirement: Authenticated buyer can list and view own orders only

The system SHALL expose `GET /api/public/account/orders` (paginated) and `GET /api/public/account/orders/:id` behind `requireCustomerAuth`. Orders SHALL be filtered by the token's `customerId` only. Responses SHALL include customer-safe order fields and SHALL NOT include `supplierId`, `supplierReference`, `supplierCost`, or internal fulfillment notes. Accessing another customer's order SHALL return `404` with `CUSTOMER_ORDER_NOT_FOUND`.

#### Scenario: List own orders

- **WHEN** an authenticated buyer requests their order list
- **THEN** the system returns only orders where `customerId` matches the token

#### Scenario: Cannot read another customer's order

- **WHEN** buyer A requests an order belonging to buyer B
- **THEN** the system returns `404` with code `CUSTOMER_ORDER_NOT_FOUND`

#### Scenario: Supplier fields absent from order response

- **WHEN** a buyer retrieves any order via account endpoints
- **THEN** the payload contains no supplier-internal fields

### Requirement: Customer auth endpoints are rate limited and namespaced

Auth endpoints (`/register`, `/login`, `/refresh`, `/google/callback`) SHALL be rate limited. Access tokens SHALL require `aud: "customer"` and SHALL NOT be accepted by admin routes. Admin tokens (future) SHALL NOT authenticate customer account routes. `passwordHash` and raw refresh tokens SHALL never be returned or logged.

#### Scenario: Wrong audience rejected

- **WHEN** a token with `aud` other than `customer` is sent to `/api/public/account/profile`
- **THEN** the system returns `401`

#### Scenario: Secrets not in API responses

- **WHEN** any auth or account endpoint returns account data
- **THEN** `passwordHash`, provider ids, `totpSecret`, and refresh token values are absent

### Requirement: Buyer can recover password via email

The system SHALL expose `POST /api/public/auth/forgot-password` accepting `{ email }` and `POST /api/public/auth/reset-password` accepting `{ token, password }`. Forgot-password SHALL always return a generic success message (anti-enumeration). Valid reset tokens SHALL be single-use, expire within 1 hour, and stored hashed. Successful reset SHALL invalidate active refresh tokens for that account. Invalid or expired tokens SHALL return `400` with code `RESET_TOKEN_INVALID`.

#### Scenario: Forgot password sends email when account exists

- **WHEN** a buyer requests forgot-password for a registered email
- **THEN** the system sends a reset email and returns a generic success response

#### Scenario: Reset password with valid token

- **WHEN** a buyer submits a valid token and a strong new password
- **THEN** the system updates `passwordHash`, marks the token used, and returns `200`

#### Scenario: Expired reset token rejected

- **WHEN** a buyer submits a token older than 1 hour
- **THEN** the system returns `400` with code `RESET_TOKEN_INVALID`

### Requirement: Buyer can enable and use TOTP two-factor authentication

The system SHALL allow an authenticated buyer to enroll TOTP via `POST /api/public/account/security/2fa/setup` (returns QR/secret) and `POST /api/public/account/security/2fa/confirm` (verifies first code, sets `totpEnabled`). Disable SHALL require `POST /api/public/account/security/2fa/disable` with password confirmation. When `totpEnabled` is true, `POST /login` SHALL return `200` with `{ mfaRequired: true, mfaToken }` instead of a full access token until `POST /api/public/auth/2fa/verify` succeeds with a valid TOTP code.

#### Scenario: Login requires 2FA when enabled

- **WHEN** a buyer with `totpEnabled` logs in with correct password
- **THEN** the system returns `mfaRequired` and a short-lived `mfaToken` without a refresh cookie

#### Scenario: 2FA verify issues full session

- **WHEN** the buyer submits a valid TOTP code with the `mfaToken`
- **THEN** the system issues access and refresh tokens

#### Scenario: Invalid TOTP code rejected

- **WHEN** the buyer submits an incorrect TOTP code
- **THEN** the system returns `401` with code `INVALID_TOTP_CODE`
