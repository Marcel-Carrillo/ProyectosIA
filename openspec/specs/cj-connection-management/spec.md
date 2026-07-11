# Spec: CJ Dropshipping Connection Management

## Purpose

Admin-only capability for configuring, inspecting, and verifying a supplier's connection to the CJ Dropshipping provider. A `SupplierIntegration` record links a `Supplier` to CJ Dropshipping (`provider = "CJDropshipping"`); the CJ Dropshipping API key itself is never accepted as request input or persisted in a returnable column — it is a single store-wide credential resolved from environment/SSM configuration (`CJDROPSHIPPING_API_KEY`) at request time. This is the foundation for supplier automation (see `cj-catalog-sync` for the read-only catalog pull and `cj-supplier-order-push` for sandbox order push).

## Requirements

### Requirement: Admin can configure a CJ Dropshipping connection for a supplier
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/connection` to create or update a `SupplierIntegration` record linking a `Supplier` to CJ Dropshipping (`provider = "CJDropshipping"`). The request body SHALL accept `externalAccountRef` (optional, max 150 characters). The CJ Dropshipping API key SHALL be resolved from environment/SSM configuration (`CJDROPSHIPPING_API_KEY`) and SHALL NOT be accepted as a request field or persisted in any returnable database column — it is a single store-wide credential, not per-supplier. A non-existent `supplierId` SHALL return `404` with error code `SUPPLIER_NOT_FOUND`. On success the system SHALL persist the connection with initial `status = Disconnected` (until first successful verification) and return `200` or `201` with the connection record, excluding any secret material.

#### Scenario: Create a new connection for a supplier
- **WHEN** an admin submits `POST /api/admin/suppliers/:supplierId/cj/connection` for a supplier with no existing connection
- **THEN** the system creates a `SupplierIntegration` record with `provider = "CJDropshipping"` and `status = Disconnected`, and returns `201` with the connection record

#### Scenario: Update an existing connection
- **WHEN** an admin submits `POST /api/admin/suppliers/:supplierId/cj/connection` for a supplier that already has a CJ Dropshipping connection
- **THEN** the system updates the existing record's `externalAccountRef` and returns `200` with the updated connection record

#### Scenario: Reject connection for a missing supplier
- **WHEN** an admin submits `POST /api/admin/suppliers/:supplierId/cj/connection` for a `supplierId` that does not exist
- **THEN** the system returns `404` with error code `SUPPLIER_NOT_FOUND` and creates no record

### Requirement: Admin can retrieve CJ Dropshipping connection status without secrets
The system SHALL expose `GET /api/admin/suppliers/:supplierId/cj/connection` returning the connection's `status`, `externalAccountRef`, `lastVerifiedAt`, and `lastSyncedAt`. The response SHALL NEVER include the CJ Dropshipping API key, access token, or refresh token. A supplier with no configured connection SHALL return `404` with error code `CJ_CONNECTION_NOT_FOUND`.

#### Scenario: Retrieve an existing connection
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/cj/connection` for a supplier with a configured connection
- **THEN** the system returns `200` with `status`, `externalAccountRef`, `lastVerifiedAt`, and `lastSyncedAt`, and no credential or token fields

#### Scenario: Retrieve a missing connection
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/cj/connection` for a supplier with no configured connection
- **THEN** the system returns `404` with error code `CJ_CONNECTION_NOT_FOUND`

### Requirement: Admin can verify a CJ Dropshipping connection
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/connection/verify` which authenticates against CJ Dropshipping (`POST /authentication/getAccessToken` with the configured `apiKey`, caching the resulting `accessToken`/`refreshToken` keyed off the response's own `accessTokenExpiryDate`) and then calls `GET /setting/get` using the resulting token as a minimal authenticated check. Success/failure SHALL be determined by the response body's `success`/`code` fields, never by HTTP status alone, since CJ returns HTTP 200 even for logical errors. On success the system SHALL set `status = Connected`, update `lastVerifiedAt`, and return `200` with `{ healthy: true }`. On failure the system SHALL set `status = Error`, update `lastVerifiedAt`, and return `200` with `{ healthy: false, reason }` where `reason` is a fixed, non-sensitive summary that never includes the API key, access token, refresh token, or raw upstream response text. Missing connection SHALL return `404` with error code `CJ_CONNECTION_NOT_FOUND`. This endpoint SHALL be rate-limited to prevent brute-forcing or hammering the upstream CJ Dropshipping API.

#### Scenario: Successful verification
- **WHEN** an admin requests `POST /api/admin/suppliers/:supplierId/cj/connection/verify` and CJ Dropshipping's authentication and settings check both succeed (`success: true`)
- **THEN** the system sets `status = Connected`, updates `lastVerifiedAt`, and returns `200` with `{ healthy: true }`

#### Scenario: Failed verification is determined by the response body, not HTTP status
- **WHEN** an admin requests verification and CJ Dropshipping returns HTTP 200 with `success: false` in the body (for example, an invalid or expired API key)
- **THEN** the system treats this as a failed verification, sets `status = Error`, updates `lastVerifiedAt`, and returns `200` with `{ healthy: false, reason }` containing no secret material

#### Scenario: Verify a missing connection
- **WHEN** an admin requests verification for a supplier with no configured CJ Dropshipping connection
- **THEN** the system returns `404` with error code `CJ_CONNECTION_NOT_FOUND`

### Requirement: CJ Dropshipping connection endpoints are admin-only and credentials are never exposed
CJ Dropshipping connection endpoints SHALL exist only under `/api/admin/suppliers/:supplierId/cj/*` and SHALL require admin authentication. The system SHALL NOT expose any CJ Dropshipping connection endpoint under `/api/public/*`. The CJ Dropshipping API key, access token, and refresh token SHALL never appear in any API response, log line, or database column that is returned by an endpoint.

#### Scenario: No public CJ connection endpoint exists
- **WHEN** a client requests any `/api/public/*` path containing `cj`
- **THEN** the system does not serve the request (the route does not exist)

#### Scenario: Connection responses never include credentials or tokens
- **WHEN** an admin retrieves or verifies a CJ Dropshipping connection through any endpoint
- **THEN** the response payload contains no field with the raw API key, access token, or refresh token value

### Requirement: Admin can configure a CJ Dropshipping connection from the CJ Catalog admin page
The admin panel SHALL provide a connection panel on the CJ Catalog page (`suppliers/:supplierId/cj-catalog`) that lets an administrator create or update the CJ Dropshipping connection without leaving the page. The panel SHALL present a "Configure connection" action that opens a form accepting only an optional `externalAccountRef` text field (max 150 characters); the form SHALL NOT present any field for an API key, secret, or credential of any kind. Submitting the form SHALL call `POST /api/admin/suppliers/:supplierId/cj/connection` and, on success, SHALL refresh the panel to reflect the created or updated connection.

#### Scenario: Admin configures a connection for the first time
- **WHEN** an administrator opens the CJ Catalog page for a supplier with no existing connection and submits the "Configure connection" form (with or without an `externalAccountRef`)
- **THEN** the admin panel calls `POST .../cj/connection`, and on success displays the connection panel with `status = Disconnected` and the submitted `externalAccountRef`

#### Scenario: Admin updates an existing connection's account reference
- **WHEN** an administrator opens "Configure connection" for a supplier that already has a connection and changes the `externalAccountRef`
- **THEN** the admin panel calls `POST .../cj/connection` and refreshes the panel with the updated value

#### Scenario: No credential input is ever rendered
- **WHEN** an administrator opens the "Configure connection" form
- **THEN** the only editable field is `externalAccountRef`; no password-type or credential-labeled field is present anywhere in the form

### Requirement: Admin can view CJ Dropshipping connection status on the CJ Catalog admin page
On loading the CJ Catalog page, the admin panel SHALL call `GET /api/admin/suppliers/:supplierId/cj/connection` and render the result in a connection panel showing `provider`, `status`, `externalAccountRef`, `lastVerifiedAt`, and `lastSyncedAt`. When the backend returns `404 CJ_CONNECTION_NOT_FOUND`, the admin panel SHALL render a "not configured" state with a "Configure connection" call to action instead of a generic error message, and SHALL NOT attempt to load the staged catalog list in this state.

#### Scenario: Connection status renders for a configured supplier
- **WHEN** an administrator opens the CJ Catalog page for a supplier with an existing connection
- **THEN** the panel displays the connection's `status`, `externalAccountRef` (or a placeholder when null), `lastVerifiedAt`, and `lastSyncedAt`

#### Scenario: Missing connection shows a configuration call to action, not a bare error
- **WHEN** an administrator opens the CJ Catalog page for a supplier with no configured connection
- **THEN** the admin panel shows the "not configured" panel state with a "Configure connection" action, and does not render the previous bare `CJ_CONNECTION_NOT_FOUND` error message, and does not call the staged catalog list endpoint

### Requirement: Admin can verify the CJ Dropshipping connection from the CJ Catalog admin page
The connection panel SHALL provide a "Verify" action that calls `POST /api/admin/suppliers/:supplierId/cj/connection/verify`. While the request is in flight, the action SHALL be disabled to prevent duplicate submissions. On response, the admin panel SHALL refresh the connection panel (reflecting the updated `status` and `lastVerifiedAt`) and SHALL display the returned `healthy` outcome and, when present, the `reason` string verbatim. When the backend returns HTTP `429` for exceeding the verification rate limit, the admin panel SHALL display a message indicating the admin must wait before retrying, without treating it as a generic failure.

#### Scenario: Successful verification updates the panel
- **WHEN** an administrator clicks "Verify" and the backend returns `{ healthy: true }`
- **THEN** the admin panel shows a success indication, and the panel's `status` and `lastVerifiedAt` refresh to the updated values

#### Scenario: Failed verification surfaces the backend reason
- **WHEN** an administrator clicks "Verify" and the backend returns `{ healthy: false, reason }`
- **THEN** the admin panel shows a warning containing the `reason` text as returned by the backend, and the panel's `status` and `lastVerifiedAt` refresh

#### Scenario: Rate limit is handled distinctly from a generic error
- **WHEN** an administrator clicks "Verify" after exceeding the endpoint's rate limit and the backend returns `429`
- **THEN** the admin panel shows a message indicating too many verification attempts and to retry later, and does not treat the response as a connection failure

#### Scenario: Verify action is disabled while in flight
- **WHEN** an administrator clicks "Verify"
- **THEN** the "Verify" action becomes disabled until the request completes, preventing a second concurrent verification request
