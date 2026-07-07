## ADDED Requirements

### Requirement: Admin can configure a Spocket connection for a supplier
The system SHALL expose `POST /api/admin/suppliers/:supplierId/spocket/connection` to create or update a `SupplierIntegration` record linking a `Supplier` to Spocket. The request body SHALL accept `externalAccountRef` (optional, max 150 characters). The actual Spocket API key SHALL be resolved from environment/SSM configuration (`SPOCKET_API_KEY`) and SHALL NOT be accepted as a request field or persisted in any returnable database column. A non-existent `supplierId` SHALL return `404` with error code `SUPPLIER_NOT_FOUND`. On success the system SHALL persist the connection with initial `status = Disconnected` (until first successful verification) and return `200` or `201` with the connection record, excluding any secret material.

#### Scenario: Create a new connection for a supplier
- **WHEN** an admin submits `POST /api/admin/suppliers/:supplierId/spocket/connection` for a supplier with no existing connection
- **THEN** the system creates a `SupplierIntegration` record with `provider = "Spocket"` and `status = Disconnected`, and returns `201` with the connection record

#### Scenario: Update an existing connection
- **WHEN** an admin submits `POST /api/admin/suppliers/:supplierId/spocket/connection` for a supplier that already has a Spocket connection
- **THEN** the system updates the existing record's `externalAccountRef` and returns `200` with the updated connection record

#### Scenario: Reject connection for a missing supplier
- **WHEN** an admin submits `POST /api/admin/suppliers/:supplierId/spocket/connection` for a `supplierId` that does not exist
- **THEN** the system returns `404` with error code `SUPPLIER_NOT_FOUND` and creates no record

### Requirement: Admin can retrieve Spocket connection status without secrets
The system SHALL expose `GET /api/admin/suppliers/:supplierId/spocket/connection` returning the connection's `status`, `externalAccountRef`, `lastVerifiedAt`, and `lastSyncedAt`. The response SHALL NEVER include the Spocket API key or any other credential material. A supplier with no configured connection SHALL return `404` with error code `SPOCKET_CONNECTION_NOT_FOUND`.

#### Scenario: Retrieve an existing connection
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/spocket/connection` for a supplier with a configured connection
- **THEN** the system returns `200` with `status`, `externalAccountRef`, `lastVerifiedAt`, and `lastSyncedAt`, and no credential fields

#### Scenario: Retrieve a missing connection
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/spocket/connection` for a supplier with no configured connection
- **THEN** the system returns `404` with error code `SPOCKET_CONNECTION_NOT_FOUND`

### Requirement: Admin can verify a Spocket connection
The system SHALL expose `POST /api/admin/suppliers/:supplierId/spocket/connection/verify` which performs a minimal authenticated call against the Spocket API using the configured credentials. On success the system SHALL set `status = Connected`, update `lastVerifiedAt`, and return `200` with `{ healthy: true }`. On failure the system SHALL set `status = Error`, update `lastVerifiedAt`, and return `200` with `{ healthy: false, reason }` where `reason` is a non-sensitive, human-readable error summary that never includes the API key or raw upstream credentials. Missing connection SHALL return `404` with error code `SPOCKET_CONNECTION_NOT_FOUND`.

#### Scenario: Successful verification
- **WHEN** an admin requests `POST /api/admin/suppliers/:supplierId/spocket/connection/verify` and the Spocket API responds successfully to the authenticated check
- **THEN** the system sets `status = Connected`, updates `lastVerifiedAt`, and returns `200` with `{ healthy: true }`

#### Scenario: Failed verification
- **WHEN** an admin requests verification and the Spocket API rejects the credentials or is unreachable
- **THEN** the system sets `status = Error`, updates `lastVerifiedAt`, and returns `200` with `{ healthy: false, reason }` containing no secret material

#### Scenario: Verify a missing connection
- **WHEN** an admin requests verification for a supplier with no configured Spocket connection
- **THEN** the system returns `404` with error code `SPOCKET_CONNECTION_NOT_FOUND`

### Requirement: Spocket connection endpoints are admin-only and credentials are never exposed
Spocket connection endpoints SHALL exist only under `/api/admin/suppliers/:supplierId/spocket/*` and SHALL require admin authentication. The system SHALL NOT expose any Spocket connection endpoint under `/api/public/*`. The Spocket API key SHALL never appear in any API response, log line, or database column that is returned by an endpoint.

#### Scenario: No public Spocket connection endpoint exists
- **WHEN** a client requests any `/api/public/*` path containing `spocket`
- **THEN** the system does not serve the request (the route does not exist)

#### Scenario: Connection responses never include the API key
- **WHEN** an admin retrieves or verifies a Spocket connection through any endpoint
- **THEN** the response payload contains no field with the raw Spocket API key or credential value
