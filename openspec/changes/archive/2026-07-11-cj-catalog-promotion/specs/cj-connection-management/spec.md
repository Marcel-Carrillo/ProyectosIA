## ADDED Requirements

### Requirement: Admin can configure a CJ Dropshipping connection for a supplier
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/connection` to create or update a `SupplierIntegration` record linking a `Supplier` to CJ Dropshipping. The request body SHALL accept `externalAccountRef` (optional, max 150 characters). The actual CJ Dropshipping API key SHALL be resolved from environment/SSM configuration (`CJDROPSHIPPING_API_KEY`) and SHALL NOT be accepted as a request field or persisted in any returnable database column. A non-existent `supplierId` SHALL return `404` with error code `SUPPLIER_NOT_FOUND`. On success the system SHALL persist the connection with initial `status = Disconnected` (until first successful verification) and return `200` or `201` with the connection record, excluding any secret material.

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
The system SHALL expose `GET /api/admin/suppliers/:supplierId/cj/connection` returning the connection's `status`, `externalAccountRef`, `lastVerifiedAt`, and `lastSyncedAt`. The response SHALL NEVER include the CJ Dropshipping API key or any other credential material. A supplier with no configured connection SHALL return `404` with error code `CJ_CONNECTION_NOT_FOUND`.

#### Scenario: Retrieve an existing connection
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/cj/connection` for a supplier with a configured connection
- **THEN** the system returns `200` with `status`, `externalAccountRef`, `lastVerifiedAt`, and `lastSyncedAt`, and no credential fields

#### Scenario: Retrieve a missing connection
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/cj/connection` for a supplier with no configured connection
- **THEN** the system returns `404` with error code `CJ_CONNECTION_NOT_FOUND`

### Requirement: Admin can verify a CJ Dropshipping connection
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/connection/verify` which performs a minimal authenticated call against the real CJ Dropshipping API using the configured credentials. On success the system SHALL set `status = Connected`, update `lastVerifiedAt`, and return `200` with `{ healthy: true }`. On failure the system SHALL set `status = Error`, update `lastVerifiedAt`, and return `200` with `{ healthy: false, reason }` where `reason` is a non-sensitive, human-readable error summary that never includes the API key or raw upstream credentials. Missing connection SHALL return `404` with error code `CJ_CONNECTION_NOT_FOUND`. This endpoint SHALL be rate-limited to prevent brute-forcing or hammering the upstream CJ Dropshipping API.

#### Scenario: Successful verification
- **WHEN** an admin requests `POST /api/admin/suppliers/:supplierId/cj/connection/verify` and the CJ Dropshipping API responds successfully to the authenticated check
- **THEN** the system sets `status = Connected`, updates `lastVerifiedAt`, and returns `200` with `{ healthy: true }`

#### Scenario: Failed verification
- **WHEN** an admin requests verification and the CJ Dropshipping API rejects the credentials or is unreachable
- **THEN** the system sets `status = Error`, updates `lastVerifiedAt`, and returns `200` with `{ healthy: false, reason }` containing no secret material

#### Scenario: Verify a missing connection
- **WHEN** an admin requests verification for a supplier with no configured CJ Dropshipping connection
- **THEN** the system returns `404` with error code `CJ_CONNECTION_NOT_FOUND`

### Requirement: CJ Dropshipping connection endpoints are admin-only and credentials are never exposed
CJ Dropshipping connection endpoints SHALL exist only under `/api/admin/suppliers/:supplierId/cj/*` and SHALL require admin authentication. The system SHALL NOT expose any CJ Dropshipping connection endpoint under `/api/public/*`. The CJ Dropshipping API key SHALL never appear in any API response, log line, or database column that is returned by an endpoint.

#### Scenario: No public CJ Dropshipping connection endpoint exists
- **WHEN** a client requests any `/api/public/*` path containing `cj`
- **THEN** the system does not serve the request (the route does not exist)

#### Scenario: Connection responses never include the API key
- **WHEN** an admin retrieves or verifies a CJ Dropshipping connection through any endpoint
- **THEN** the response payload contains no field with the raw CJ Dropshipping API key or credential value
