# Spec: Spocket Catalog Sync

## Purpose

Admin-only, read-only pull of a supplier's Spocket product/variant catalog, cost, and stock into `SpocketCatalogItem` staging records for review. Staging data is strictly isolated from the live public catalog (`Product`/`ProductVariant`) — nothing is auto-published, and an administrator must explicitly promote staged data through the existing admin product/variant management flow. Depends on a `Connected` Spocket connection (see `spocket-connection-management`).

## Requirements

### Requirement: Admin can trigger a read-only Spocket catalog and inventory pull
The system SHALL expose `POST /api/admin/suppliers/:supplierId/spocket/sync` which fetches products, variants, cost, and stock quantity from the Spocket API for the supplier's connected account and upserts them into `SpocketCatalogItem` staging records keyed by `(supplierIntegrationId, externalRef)`. The sync SHALL NOT create, update, or delete any `Product` or `ProductVariant` record, and SHALL NOT auto-publish staged data to the public catalog. The sync requires a connection with `status = Connected`; otherwise the system SHALL return `422` with error code `SPOCKET_CONNECTION_NOT_READY`. Missing supplier or connection SHALL return `404` with error code `SPOCKET_CONNECTION_NOT_FOUND`. On completion the system SHALL update `lastSyncedAt` on the connection and return `200` with a summary `{ itemsUpserted, itemsFailed, syncedAt }`.

#### Scenario: Successful sync populates staging records
- **WHEN** an admin requests `POST /api/admin/suppliers/:supplierId/spocket/sync` for a supplier with `status = Connected`
- **THEN** the system upserts `SpocketCatalogItem` records for each Spocket product/variant returned, updates `lastSyncedAt`, and returns `200` with `{ itemsUpserted, itemsFailed, syncedAt }`

#### Scenario: Sync is idempotent on re-run
- **WHEN** an admin triggers the sync twice in succession with no upstream catalog changes
- **THEN** the second run updates the existing `SpocketCatalogItem` records by `externalRef` instead of creating duplicates

#### Scenario: Reject sync when connection is not verified
- **WHEN** an admin requests a sync for a supplier whose Spocket connection has `status = Disconnected` or `status = Error`
- **THEN** the system returns `422` with error code `SPOCKET_CONNECTION_NOT_READY` and performs no upstream calls

#### Scenario: Reject sync for a missing connection
- **WHEN** an admin requests a sync for a supplier with no configured Spocket connection
- **THEN** the system returns `404` with error code `SPOCKET_CONNECTION_NOT_FOUND`

#### Scenario: Sync does not modify the live catalog
- **WHEN** a sync completes successfully
- **THEN** no `Product` or `ProductVariant` record is created, updated, or deleted as a result

### Requirement: Partial sync failures are reported per item without aborting the whole sync
The system SHALL process each fetched Spocket item independently; if an individual item fails to map or persist, the system SHALL record it with `syncStatus = Failed` and a non-sensitive error summary, continue processing remaining items, and include the failure count in the sync response `itemsFailed`. A total upstream failure (for example, the Spocket API is unreachable) SHALL abort the sync and return `502` with error code `SPOCKET_API_UNAVAILABLE`, leaving previously staged records unchanged.

#### Scenario: One malformed item does not block the rest of the sync
- **WHEN** a sync fetches 10 Spocket items and one has invalid/unmappable data
- **THEN** the system persists 9 `SpocketCatalogItem` records with `syncStatus = Synced`, marks the failing one `syncStatus = Failed`, and returns `itemsFailed: 1` in the response

#### Scenario: Upstream API unavailability aborts the sync
- **WHEN** the Spocket API is unreachable or returns a persistent 5xx during a sync attempt
- **THEN** the system returns `502` with error code `SPOCKET_API_UNAVAILABLE` and leaves existing staged records unchanged

### Requirement: Admin can list staged Spocket catalog items for review
The system SHALL expose `GET /api/admin/suppliers/:supplierId/spocket/catalog` returning staged `SpocketCatalogItem` records in the standard response envelope `{ success, data, message }` where `data` contains `{ items, total, page, pageSize }`. The endpoint SHALL accept `page` (default 1), `pageSize` (default 20, clamped to max 100), and `syncStatus` (`Synced` | `Failed`). Each item SHALL include `externalRef`, `title`, `supplierCost`, `stockQuantity`, `syncStatus`, and `lastSyncedAt`.

#### Scenario: List staged items for a supplier
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/spocket/catalog`
- **THEN** the system returns `200` with up to 20 staged items in `data.items` and the correct `total`, `page`, and `pageSize`

#### Scenario: Filter staged items by sync status
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/spocket/catalog?syncStatus=Failed`
- **THEN** the system returns only staged items with `syncStatus = Failed`

### Requirement: Staged Spocket data and supplier cost are never exposed on customer-facing APIs
The system SHALL NOT expose `SpocketCatalogItem` records, `supplierCost`, or raw Spocket payloads on any `/api/public/*` route. Staged catalog data SHALL remain isolated from the public product catalog until an administrator explicitly promotes data through the existing admin product/variant management flow (unchanged by this capability).

#### Scenario: No public Spocket catalog endpoint exists
- **WHEN** a client requests any `/api/public/*` path containing `spocket`
- **THEN** the system does not serve the request (the route does not exist)

#### Scenario: Public product responses are unaffected by staged data
- **WHEN** a client requests `/api/public/products` or `/api/public/products/:id`
- **THEN** the response contains no `SpocketCatalogItem` fields, `supplierCost`, or Spocket external references
