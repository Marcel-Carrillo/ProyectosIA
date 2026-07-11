# Spec: CJ Dropshipping Catalog Sync

## Purpose

Admin-only, read-only pull of a supplier's CJ Dropshipping catalog (categories, products, variants, cost, and stock) into `CjCatalogItem` staging records for review. Staging data is strictly isolated from the live public catalog (`Product`/`ProductVariant`) — nothing is auto-published, and an administrator must explicitly promote staged data through the dedicated promotion flow (see `cj-catalog-promotion`). Depends on a `Connected` CJ Dropshipping connection (see `cj-connection-management`).

## Requirements

### Requirement: Admin can trigger a read-only CJ Dropshipping catalog and inventory pull
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/sync` which fetches categories, products, variants, and stock quantity from the CJ Dropshipping API (`GET /product/getCategory`, `GET /product/listV2`, `GET /product/variant/query`, stock queries) for the connected account and upserts them into `CjCatalogItem` staging records keyed by `(supplierIntegrationId, externalRef)`, where `externalRef` maps to CJ's `vid` (variant id). The sync SHALL NOT create, update, or delete any `Product` or `ProductVariant` record, and SHALL NOT auto-publish staged data to the public catalog. The sync requires a connection with `status = Connected`; otherwise the system SHALL return `422` with error code `CJ_CONNECTION_NOT_READY`. Missing supplier or connection SHALL return `404` with error code `CJ_CONNECTION_NOT_FOUND`. On completion the system SHALL update `lastSyncedAt` on the connection and return `200` with a summary `{ itemsUpserted, itemsFailed, syncedAt }`.

#### Scenario: Successful sync populates staging records
- **WHEN** an admin requests `POST /api/admin/suppliers/:supplierId/cj/sync` for a supplier with `status = Connected`
- **THEN** the system upserts `CjCatalogItem` records for each CJ Dropshipping product/variant returned, updates `lastSyncedAt`, and returns `200` with `{ itemsUpserted, itemsFailed, syncedAt }`

#### Scenario: Sync is idempotent on re-run
- **WHEN** an admin triggers the sync twice in succession with no upstream catalog changes
- **THEN** the second run updates the existing `CjCatalogItem` records by `externalRef` (CJ's `vid`) instead of creating duplicates

#### Scenario: Reject sync when connection is not verified
- **WHEN** an admin requests a sync for a supplier whose CJ Dropshipping connection has `status = Disconnected` or `status = Error`
- **THEN** the system returns `422` with error code `CJ_CONNECTION_NOT_READY` and performs no upstream calls

#### Scenario: Reject sync for a missing connection
- **WHEN** an admin requests a sync for a supplier with no configured CJ Dropshipping connection
- **THEN** the system returns `404` with error code `CJ_CONNECTION_NOT_FOUND`

#### Scenario: Sync does not modify the live catalog
- **WHEN** a sync completes successfully
- **THEN** no `Product` or `ProductVariant` record is created, updated, or deleted as a result

### Requirement: Partial sync failures are reported per item without aborting the whole sync
The system SHALL process each fetched CJ Dropshipping item independently, evaluating each upstream response by its body (`success`/`code`), not HTTP status alone. If an individual item fails to map or persist, the system SHALL record it with `syncStatus = Failed` and a non-sensitive error summary, continue processing remaining items, and include the failure count in the sync response `itemsFailed`. A total upstream failure (for example, CJ Dropshipping is unreachable, or authentication fails) SHALL abort the sync and return `502` with error code `CJ_API_UNAVAILABLE`, leaving previously staged records unchanged. The sync SHALL respect a maximum page-count safety cap to prevent an unbounded loop against a misbehaving upstream pagination sequence.

#### Scenario: One malformed item does not block the rest of the sync
- **WHEN** a sync fetches 10 CJ Dropshipping items and one has invalid/unmappable data
- **THEN** the system persists 9 `CjCatalogItem` records with `syncStatus = Synced`, marks the failing one `syncStatus = Failed`, and returns `itemsFailed: 1` in the response

#### Scenario: Upstream API unavailability aborts the sync
- **WHEN** CJ Dropshipping is unreachable, or returns a persistent authentication or logical failure (`success: false`) during a sync attempt
- **THEN** the system returns `502` with error code `CJ_API_UNAVAILABLE` and leaves existing staged records unchanged

### Requirement: Admin can list staged CJ catalog items for review, including promotion status
The system SHALL expose `GET /api/admin/suppliers/:supplierId/cj/catalog` returning staged `CjCatalogItem` records in the standard response envelope `{ success, data, message }` where `data` contains `{ items, total, page, pageSize }`. The endpoint SHALL accept `page` (default 1), `pageSize` (default 20, clamped to max 100), `syncStatus` (`Synced` | `Failed`), and `promotionState` (`NotPromoted` | `Active` | `Inactive`). Each item SHALL include `externalRef`, `title`, `sku`, `supplierCost`, `stockQuantity`, `syncStatus`, `lastSyncedAt`, and a derived `promotionState` computed from whether the item is linked to a `ProductVariant` (via `ProductVariant.cjCatalogItemId`) and BOTH that variant's status AND its parent `Product`'s status (a newly-promoted `Product` defaults to `Draft` and is never served by any `/api/public/*` route regardless of its variant's status, so `promotionState` MUST reflect actual storefront visibility, not the variant alone): no link SHALL yield `NotPromoted`; a link where the variant `status = Active` AND the parent `Product` `status = Active` SHALL yield `Active`; a link where either the variant or its parent `Product` has any other status SHALL yield `Inactive`. When an item is linked, the response SHALL also include `productId` and `productVariantId`; these SHALL be `null` when `promotionState = NotPromoted`. Items SHALL NOT include the raw upstream payload or CJ-internal identifiers beyond what is explicitly documented.

#### Scenario: List staged items for a supplier
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/cj/catalog`
- **THEN** the system returns `200` with up to 20 staged items in `data.items` and the correct `total`, `page`, and `pageSize`

#### Scenario: Filter staged items by sync status
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/cj/catalog?syncStatus=Failed`
- **THEN** the system returns only staged items with `syncStatus = Failed`

#### Scenario: Filter staged items by promotion state
- **WHEN** an admin requests `GET /api/admin/suppliers/:supplierId/cj/catalog?promotionState=NotPromoted`
- **THEN** the system returns only staged items that have no linked `ProductVariant`

#### Scenario: A not-yet-promoted item reports NotPromoted with null product references
- **WHEN** an admin lists the staged catalog and an item has never been promoted
- **THEN** the item's `promotionState` is `NotPromoted` and `productId`/`productVariantId` are `null`

#### Scenario: A promoted and active item reports Active with its product references
- **WHEN** an admin lists the staged catalog and an item is linked to a `ProductVariant` with `status = Active` whose parent `Product` also has `status = Active`
- **THEN** the item's `promotionState` is `Active` and `productId`/`productVariantId` reference the promoted records

#### Scenario: A promoted but deactivated item reports Inactive without losing its product references
- **WHEN** an admin lists the staged catalog and an item is linked to a `ProductVariant` with `status = Inactive`
- **THEN** the item's `promotionState` is `Inactive` and `productId`/`productVariantId` still reference the promoted records

#### Scenario: A promoted item whose parent Product is still Draft reports Inactive, not Active
- **WHEN** an admin lists the staged catalog and an item is linked to a `ProductVariant` with `status = Active` but whose parent `Product` still has `status = Draft` (the default when promoting without `activate: true`)
- **THEN** the item's `promotionState` is `Inactive`, since the product is not actually visible on the storefront while `Draft`

### Requirement: Staged CJ data, supplier cost, and origin linkage are never exposed on customer-facing APIs
The system SHALL NOT expose `CjCatalogItem` records, `supplierCost`, `ProductVariant.cjCatalogItemId`, or raw CJ Dropshipping payloads on any `/api/public/*` route. Staged catalog data SHALL remain isolated from the public product catalog until an administrator explicitly promotes it (see `cj-catalog-promotion`).

#### Scenario: No public CJ catalog endpoint exists
- **WHEN** a client requests any `/api/public/*` path containing `cj`
- **THEN** the system does not serve the request (the route does not exist)

#### Scenario: Public product responses are unaffected by staged or linkage data
- **WHEN** a client requests `/api/public/products` or `/api/public/products/:id`
- **THEN** the response contains no `CjCatalogItem` fields, `supplierCost`, `cjCatalogItemId`, or CJ external references

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
