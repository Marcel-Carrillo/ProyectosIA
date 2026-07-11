## ADDED Requirements

### Requirement: Admin can trigger a CJ Dropshipping catalog sync from the CJ Catalog admin page
The CJ Catalog admin page's connection panel SHALL provide a "Sync catalog" action that calls `POST /api/admin/suppliers/:supplierId/cj/sync`. This action SHALL be enabled only when the connection's `status = Connected`; when the status is `Disconnected` or `Error`, the action SHALL be disabled with an indication that the connection must be verified first, avoiding an unnecessary `422 CJ_CONNECTION_NOT_READY` round-trip. While the sync request is in flight, the action SHALL show a disabled/loading state without blocking the rest of the page. On success, the admin panel SHALL display the result summary (`itemsUpserted`, `itemsFailed`), refresh the panel's `lastSyncedAt`, and refetch the staged catalog list so newly synced items appear without a manual page reload.

#### Scenario: Sync is enabled when the connection is verified
- **WHEN** an administrator views the connection panel and the connection `status = Connected`
- **THEN** the "Sync catalog" action is enabled

#### Scenario: Sync is disabled when the connection is not ready
- **WHEN** an administrator views the connection panel and the connection `status` is `Disconnected` or `Error`
- **THEN** the "Sync catalog" action is disabled and the panel indicates the connection must be verified first

#### Scenario: Successful sync refreshes the catalog list and shows a result summary
- **WHEN** an administrator clicks "Sync catalog" while `status = Connected` and the backend returns `{ itemsUpserted, itemsFailed, syncedAt }`
- **THEN** the admin panel shows the counts from the response, updates the panel's `lastSyncedAt`, and refetches the staged catalog list so the newly upserted items are visible

#### Scenario: Sync action is disabled while in flight
- **WHEN** an administrator clicks "Sync catalog"
- **THEN** the action becomes disabled with a loading indication until the request completes, and the rest of the page (existing catalog table, if already loaded) remains visible and interactive
