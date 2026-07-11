## ADDED Requirements

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
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/connection/verify` which authenticates against CJ Dropshipping (`POST /authentication/getAccessToken` with the configured `apiKey`, caching the resulting `accessToken`/`refreshToken` keyed off the response's own `accessTokenExpiryDate`) and then calls `GET /setting/get` using the resulting token as a minimal authenticated check. Success/failure SHALL be determined by the response body's `success`/`code` fields, never by HTTP status alone, since CJ returns HTTP 200 even for logical errors. On success the system SHALL set `status = Connected`, update `lastVerifiedAt`, and return `200` with `{ healthy: true }`. On failure the system SHALL set `status = Error`, update `lastVerifiedAt`, and return `200` with `{ healthy: false, reason }` where `reason` is a fixed, non-sensitive summary that never includes the API key, access token, refresh token, or raw upstream response text. Missing connection SHALL return `404` with error code `CJ_CONNECTION_NOT_FOUND`.

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
