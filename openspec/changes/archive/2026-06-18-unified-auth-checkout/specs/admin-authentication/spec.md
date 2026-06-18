# Spec: Admin Authentication

## Purpose

Protect the admin panel and `/api/admin/*` APIs with credential-based login and JWT sessions (`aud: "admin"`). Distinct from customer storefront auth (KAN-51). Required before safe production exposure of customer PII and supplier data.

## ADDED Requirements

### Requirement: Admin can log in with email and password

The system SHALL expose `POST /api/admin/auth/login` accepting `{ email, password }`. On success it SHALL return `200` with `{ admin, accessToken }` and set an httpOnly admin refresh cookie. Invalid credentials SHALL return `401` with `INVALID_CREDENTIALS` (generic message). Disabled admins SHALL return `403` with `ADMIN_DISABLED`.

#### Scenario: Successful admin login

- **WHEN** an admin submits correct credentials for an active `AdminUser`
- **THEN** the system returns `200` with an admin access token and refresh cookie

#### Scenario: Invalid admin credentials

- **WHEN** wrong email or password is submitted
- **THEN** the system returns `401` with a generic error message

### Requirement: Admin can refresh session and log out

The system SHALL expose `POST /api/admin/auth/refresh` and `POST /api/admin/auth/logout` with the same rotation/revocation pattern as customer auth but using `ADMIN_JWT_SECRET` and `aud: "admin"`. `GET /api/admin/auth/me` SHALL return the current admin profile (no `passwordHash`).

#### Scenario: Admin refresh rotates token

- **WHEN** a valid admin refresh cookie is presented
- **THEN** the system returns a new access token

#### Scenario: Admin logout revokes session

- **WHEN** an admin calls logout
- **THEN** refresh token is revoked and cookie cleared

### Requirement: All admin API routes require authentication

Every route under `/api/admin/*` except `POST /api/admin/auth/login` and `POST /api/admin/auth/refresh` SHALL require `requireAdminAuth`. Missing or invalid token SHALL return `401`. Customer tokens (`aud: "customer"`) SHALL NOT authenticate admin routes.

#### Scenario: Unauthenticated admin API rejected

- **WHEN** a client calls `GET /api/admin/customers` without admin token
- **THEN** the system returns `401`

#### Scenario: Customer token rejected on admin route

- **WHEN** a customer access token is sent to `/api/admin/customers`
- **THEN** the system returns `401`

### Requirement: Admin frontend routes are guarded

Admin React routes (`/products`, `/customers`, `/customer-orders`, etc.) SHALL be wrapped in `RequireAdminAuth`. Unauthenticated users SHALL redirect to `/admin/login`. `/admin/login` SHALL be accessible without auth. After login, redirect to the prior admin URL or default dashboard.

#### Scenario: Unauthenticated admin page redirects to login

- **WHEN** a user navigates to `/customers` without admin session
- **THEN** the app redirects to `/admin/login`

#### Scenario: Authenticated admin accesses panel

- **WHEN** an admin logs in successfully
- **THEN** admin routes render and API calls include the admin Bearer token

### Requirement: Admin credentials are not exposed

`passwordHash` and refresh token values SHALL never appear in API responses or logs. Admin seed credentials SHALL come from environment variables at deploy/migration time, not committed to the repo.

#### Scenario: Admin profile omits secrets

- **WHEN** `GET /api/admin/auth/me` succeeds
- **THEN** the response contains no `passwordHash`
