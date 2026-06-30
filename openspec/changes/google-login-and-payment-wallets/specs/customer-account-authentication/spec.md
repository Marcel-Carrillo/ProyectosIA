## MODIFIED Requirements

### Requirement: Google OAuth account linking rule
The system SHALL apply the following account-linking rule when a customer authenticates via Google OAuth:
- If a `CustomerAccount` exists with a matching `googleId` → authenticate and update `lastLoginAt`.
- If a `CustomerAccount` exists with a matching `email` but no `googleId` → set `googleId` on the existing account, authenticate, and update `lastLoginAt`. No duplicate account SHALL be created.
- If no `CustomerAccount` exists with the Google email → create a new `Customer` and `CustomerAccount` with `authProvider = 'google'`, trigger the welcome coupon (WELCOME-15%) and welcome email, and issue a session.

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
