# Spec: Customer Account Authentication

## Purpose

Public storefront authentication and self-service account area for buyers. Enables registration and login (email/password, Google, Apple, Facebook OAuth), optional TOTP 2FA, password recovery, customer-scoped sessions, profile access, and own order history. Distinct from admin authentication (KAN-23). Supplier-internal data must never appear in customer-facing responses.

## Requirements

### Requirement: Buyer can register with email and password

The system SHALL expose `POST /api/public/auth/register` accepting `{ email, password, firstName, lastName, phone? }`. The email SHALL be normalized (trimmed, lowercased). Password SHALL be at least 8 characters with letters and digits. On success the system SHALL create or link a `Customer` and a `CustomerAccount` with `authProvider = local`, hash the password with bcrypt (cost ≥ 12), issue an access token (`aud: "customer"`) and set an httpOnly refresh cookie. Success SHALL return `201` with `{ account, customer, accessToken }` in the standard envelope. Duplicate email with an existing account SHALL return `409` with code `ACCOUNT_EMAIL_CONFLICT`. Validation failures SHALL return `400` with `VALIDATION_ERROR`. Credentials and tokens SHALL NOT appear in logs.

#### Scenario: Register creates new customer and account

- **WHEN** a buyer submits valid registration data for an email with no existing account
- **THEN** the system creates `Customer` + `CustomerAccount`, returns `201`, and sets refresh cookie

#### Scenario: Register links existing admin-created customer

- **WHEN** a buyer registers with an email that matches an existing `Customer` without an account
- **THEN** the system creates `CustomerAccount` linked to that customer and returns `201`

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

The system SHALL expose `GET /api/public/auth/{google|apple|facebook}` to initiate each OAuth flow and matching callback routes to complete it. `GET /api/public/auth/google/callback` and `GET /api/public/auth/facebook/callback` receive provider redirects via query params. `POST /api/public/auth/apple/callback` receives Apple's redirect as `application/x-www-form-urlencoded` body (Apple's protocol requirement). Each start handler SHALL generate a cryptographically random `state` token, store it encrypted in a short-lived httpOnly cookie (`oauth_state`, max 10 min), and redirect to the provider's authorization URL. Each callback SHALL verify the `state` cookie before processing the code; a missing or mismatched state SHALL return `400` with code `OAUTH_VERIFICATION_FAILED`. Each callback SHALL verify identity server-side, require a verified email from the provider, apply the same email merge rule as registration, store the provider id (`googleId`, `appleId`, or `facebookId`) and `authProvider` (one of `local` | `google` | `apple` | `facebook`) on the account, issue tokens, and redirect to `${FRONTEND_URL}/account?token=${accessToken}`. OAuth verification failure SHALL return `401` with code `OAUTH_VERIFICATION_FAILED`. If provider credentials are not configured, the system SHALL return `501` with code `OAUTH_NOT_CONFIGURED`. Apple SHALL send name/email data only on the first authorization; subsequent logins will not include the `user` field — the system SHALL handle this gracefully using the stored profile.

#### Scenario: Google login for new buyer

- **WHEN** a buyer completes Google OAuth with a new email
- **THEN** the system creates `Customer` + `CustomerAccount` with `authProvider = google`, sets refresh cookie, and redirects to `${FRONTEND_URL}/account?token=…`

#### Scenario: Google login merges existing customer

- **WHEN** a buyer completes Google OAuth with an email matching an existing `Customer` without an account
- **THEN** the system links the new `CustomerAccount` to that customer

#### Scenario: Google login for existing Google account

- **WHEN** a buyer completes Google OAuth and `googleId` already exists
- **THEN** the system logs in that account and issues new tokens

#### Scenario: Apple login for new buyer

- **WHEN** a buyer completes Apple OAuth (`POST /apple/callback`) with a new email
- **THEN** the system creates `Customer` + `CustomerAccount` with `authProvider = apple`, sets refresh cookie, and redirects to the storefront

#### Scenario: Apple first login includes name; subsequent logins do not

- **WHEN** a buyer logs in with Apple for the first time, Apple sends `{ user: "{\"name\":{\"firstName\":\"…\",\"lastName\":\"…\"}}" }` in the POST body
- **THEN** the system saves those names on the `Customer` record
- **WHEN** the same buyer logs in again, the `user` field is absent
- **THEN** the system uses the already-stored name and logs in without error

#### Scenario: Apple login for existing Apple account

- **WHEN** a buyer completes Apple OAuth and `appleId` already exists
- **THEN** the system logs in that account and issues new tokens

#### Scenario: Facebook login for new buyer

- **WHEN** a buyer completes Facebook OAuth (`GET /facebook/callback`) with a new email
- **THEN** the system creates `Customer` + `CustomerAccount` with `authProvider = facebook`, sets refresh cookie, and redirects to the storefront

#### Scenario: Facebook login merges existing customer

- **WHEN** a buyer completes Facebook OAuth with an email matching an existing `Customer` without an account
- **THEN** the system links the new `CustomerAccount` to that customer

#### Scenario: Facebook login for existing Facebook account

- **WHEN** a buyer completes Facebook OAuth and `facebookId` already exists
- **THEN** the system logs in that account and issues new tokens

#### Scenario: OAuth state mismatch is rejected

- **WHEN** a callback arrives without the `oauth_state` cookie or with a non-matching state
- **THEN** the system clears the cookie and returns `400` with code `OAUTH_VERIFICATION_FAILED`

#### Scenario: Provider not configured returns 501

- **WHEN** a buyer initiates an OAuth flow for a provider whose credentials are not set in the environment
- **THEN** the system returns `501` with code `OAUTH_NOT_CONFIGURED`

### Requirement: Frontend can discover which OAuth providers are available

The system SHALL expose `GET /api/public/auth/oauth/providers` (no auth required) returning `{ google: boolean, apple: boolean, facebook: boolean }` indicating which providers have credentials configured. The frontend SHALL use this to conditionally render social login buttons.

#### Scenario: Providers endpoint reflects configuration

- **WHEN** only `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set in the environment
- **THEN** the endpoint returns `{ google: true, apple: false, facebook: false }`

### Requirement: OAuth mock endpoint available in non-production environments

The system SHALL expose `POST /api/public/auth/oauth/mock` accepting `{ provider, providerId, email, firstName?, lastName? }` that bypasses real provider verification and issues a full session. This endpoint SHALL return `404` when `NODE_ENV === production`. It is intended for automated integration tests only.

#### Scenario: Mock login issues session in test/dev

- **WHEN** a non-production environment receives a valid mock OAuth payload
- **THEN** the system returns `200` with `{ account, customer, accessToken }` and sets refresh cookie

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
