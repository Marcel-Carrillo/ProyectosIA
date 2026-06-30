## ADDED Requirements

### Requirement: Customer can sign in or register with Google
The system SHALL allow a customer to authenticate using their Google account via OAuth 2.0. If the Google email matches an existing `CustomerAccount`, the system SHALL link the `googleId` to that account and issue a session. If no account exists, the system SHALL create a new `Customer` and `CustomerAccount` with `authProvider = 'google'` and issue a session. New Google registrations SHALL receive the WELCOME-15% coupon and a welcome email, identical to local registration.

#### Scenario: New customer registers with Google
- **WHEN** a customer clicks "Continue with Google" and authorizes the application for the first time with an email not in the system
- **THEN** a new `Customer` and `CustomerAccount` are created with `authProvider = 'google'` and the Google `sub` stored as `googleId`
- **THEN** the WELCOME-15% coupon is created and a welcome email is sent to the customer's email
- **THEN** the system issues a customer access token (JWT, 15 min) and sets the refresh token as an httpOnly signed cookie
- **THEN** the browser is redirected to `/account?token=<accessToken>`

#### Scenario: Existing customer logs in with Google (account already linked)
- **WHEN** a customer clicks "Continue with Google" and their `googleId` already matches a `CustomerAccount`
- **THEN** `lastLoginAt` is updated
- **THEN** the system issues a new session (access token + refresh cookie)
- **THEN** the browser is redirected to `/account?token=<accessToken>`

#### Scenario: Existing local account linked by matching email
- **WHEN** a customer clicks "Continue with Google" and their Google email matches an existing `CustomerAccount` that has no `googleId`
- **THEN** the system sets `googleId` on the existing account
- **THEN** `lastLoginAt` is updated and a new session is issued
- **THEN** no duplicate account is created

#### Scenario: CSRF state mismatch is rejected
- **WHEN** the OAuth callback is received without a valid `oauth_state` cookie or with a mismatched `state` parameter
- **THEN** the system clears the state cookie and responds with HTTP 400 and code `OAUTH_VERIFICATION_FAILED`

#### Scenario: Google id_token fails verification
- **WHEN** the exchanged id_token has an invalid signature, wrong `aud`, or unverified email
- **THEN** the system responds with HTTP 401 and code `OAUTH_VERIFICATION_FAILED`

#### Scenario: Disabled account attempts Google login
- **WHEN** a customer whose `CustomerAccount.status = 'Disabled'` authenticates via Google
- **THEN** the system responds with HTTP 403 and code `ACCOUNT_DISABLED`

### Requirement: Frontend exposes Google login entry point
The storefront login and register pages SHALL display a "Continue with Google" button that redirects to `GET /api/public/auth/google`. The button SHALL only appear when the backend reports `google: true` from `GET /api/public/auth/oauth/providers`. On return from the callback, the frontend SHALL read the `?token=` query parameter, store the access token, and restore the customer session.

#### Scenario: Google button visible when OAuth is configured
- **WHEN** `GET /api/public/auth/oauth/providers` returns `{ "google": true }`
- **THEN** the "Continue with Google" button is rendered on the login and register pages

#### Scenario: Google button hidden when OAuth is not configured
- **WHEN** `GET /api/public/auth/oauth/providers` returns `{ "google": false }`
- **THEN** the "Continue with Google" button is not rendered

#### Scenario: Session restored after OAuth redirect
- **WHEN** the customer is redirected back to `/account?token=<accessToken>`
- **THEN** the frontend reads the token from the URL, stores it, removes it from the URL, and loads the account page as authenticated
