## ADDED Requirements

### Requirement: Admin can promote staged CJ catalog items into real products
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/catalog/promote` accepting `{ items: [{ cjCatalogItemId, publicPrice?, compareAtPrice? }], categoryId, activate? }`. The system SHALL group the requested `CjCatalogItem` records by their CJ product id (`pid`): items sharing a `pid` SHALL be promoted into a single `Product` with one `ProductVariant` per item (per CJ variant id, `vid`). Each created `ProductVariant` SHALL be linked to its source `CjCatalogItem` via `cjCatalogItemId`. `categoryId` SHALL be required and SHALL reference an existing `Category`; a missing or invalid `categoryId` SHALL return `422` with error code `CJ_PROMOTION_CATEGORY_REQUIRED`. Each item's `publicPrice` SHALL be either the explicit value provided in the request or, if omitted, computed as `supplierCost * CJ_DEFAULT_MARKUP_MULTIPLIER`; if neither is available (no configured default and no explicit value), the system SHALL return `422` with error code `CJ_PROMOTION_PRICE_REQUIRED`. The operation SHALL be transactional: if any requested item fails validation (unknown `cjCatalogItemId`, `syncStatus != Synced`, missing price resolution, missing category), the system SHALL return `422` with a per-item error list and SHALL NOT persist any partial changes. New `ProductVariant` SKUs SHALL be derived deterministically as `CJ-<externalRef>` to guarantee uniqueness independent of CJ's own `sku` field.

#### Scenario: Promote a single staged item creates a new product and variant
- **WHEN** an admin requests `POST /api/admin/suppliers/:supplierId/cj/catalog/promote` with one `cjCatalogItemId`, an explicit `publicPrice`, and a valid `categoryId`
- **THEN** the system creates one `Product` (`status = Draft` unless `activate: true`) and one `ProductVariant` with `sku = CJ-<externalRef>`, `cjCatalogItemId` set to the source item's id, and returns `201` with the created product/variant identifiers

#### Scenario: Promoting multiple items sharing the same CJ product id creates one product with multiple variants
- **WHEN** an admin requests promotion of three `CjCatalogItem` records that share the same `pid` (different sizes/colors)
- **THEN** the system creates a single `Product` and three `ProductVariant` records, each linked to its own source `CjCatalogItem` via `cjCatalogItemId`

#### Scenario: Promotion without an explicit price falls back to the configured default markup
- **WHEN** an admin requests promotion of an item without `publicPrice` in the request, and `CJ_DEFAULT_MARKUP_MULTIPLIER` is configured
- **THEN** the system sets `publicPrice = supplierCost * CJ_DEFAULT_MARKUP_MULTIPLIER` on the created variant

#### Scenario: Promotion fails when price cannot be resolved
- **WHEN** an admin requests promotion of an item without `publicPrice` and no default markup is configured
- **THEN** the system returns `422` with error code `CJ_PROMOTION_PRICE_REQUIRED` and creates no records

#### Scenario: Promotion fails when category is missing
- **WHEN** an admin requests promotion without a valid `categoryId`
- **THEN** the system returns `422` with error code `CJ_PROMOTION_CATEGORY_REQUIRED` and creates no records

#### Scenario: Promotion rejects items that failed sync
- **WHEN** an admin requests promotion of a `CjCatalogItem` with `syncStatus = Failed`
- **THEN** the system returns `422` with error code `CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE` and creates no records

#### Scenario: Re-promoting an already-promoted item is idempotent
- **WHEN** an admin requests promotion of a `CjCatalogItem` that is already linked to a `ProductVariant` via `cjCatalogItemId`
- **THEN** the system does not create a duplicate `Product`/`ProductVariant`, resolves to the existing linked variant, and returns `200`

#### Scenario: A partially invalid bulk request persists nothing
- **WHEN** an admin requests promotion of five items where one references a non-existent `cjCatalogItemId`
- **THEN** the system returns `422` with a per-item error list identifying the invalid item, and none of the other four items are promoted

### Requirement: Admin can activate a promoted item's storefront visibility
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/catalog/:cjCatalogItemId/activate` which sets the linked `ProductVariant.status` to `Active` and, applying the existing product-activation rule, sets the parent `Product.status` to `Active`. A `cjCatalogItemId` with no linked `ProductVariant` SHALL return `422` with error code `CJ_CATALOG_ITEM_NOT_PROMOTED`.

#### Scenario: Activating a promoted item makes it visible on the storefront
- **WHEN** an admin requests activation for a `cjCatalogItemId` linked to an inactive `ProductVariant`
- **THEN** the system sets the variant and parent product to `Active`, and the product subsequently appears in `GET /api/public/products`

#### Scenario: Activation fails for a non-promoted item
- **WHEN** an admin requests activation for a `cjCatalogItemId` with no linked `ProductVariant`
- **THEN** the system returns `422` with error code `CJ_CATALOG_ITEM_NOT_PROMOTED`

### Requirement: Admin can deactivate a promoted item without losing its CJ origin link
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/catalog/:cjCatalogItemId/deactivate` which sets the linked `ProductVariant.status` to `Inactive`. The system SHALL NOT clear `ProductVariant.cjCatalogItemId` and SHALL NOT set `deletedAt` as part of this action. A `cjCatalogItemId` with no linked `ProductVariant` SHALL return `422` with error code `CJ_CATALOG_ITEM_NOT_PROMOTED`.

#### Scenario: Deactivating hides the product from the storefront but preserves the link
- **WHEN** an admin requests deactivation for a `cjCatalogItemId` linked to an active `ProductVariant`
- **THEN** the system sets the variant to `Inactive`, the product no longer appears in `GET /api/public/products`, and `ProductVariant.cjCatalogItemId` remains set to the same `CjCatalogItem`

#### Scenario: A deactivated item can be reactivated later using the same link
- **WHEN** an admin requests activation again for a previously deactivated `cjCatalogItemId`
- **THEN** the system reuses the existing linked `ProductVariant` (no new `Product`/`ProductVariant` created) and sets it back to `Active`

### Requirement: CJ catalog origin data and linkage are never exposed on customer-facing APIs
The system SHALL NOT expose `ProductVariant.cjCatalogItemId`, `CjCatalogItem` records, or `supplierCost` on any `/api/public/*` route, in addition to the existing supplier-data protections. Admin responses for promoted/activated/deactivated items SHALL follow the existing admin serializer allow-list conventions and SHALL NOT include `rawPayload`.

#### Scenario: Public product responses omit the CJ linkage
- **WHEN** a client requests `GET /api/public/products/:id` for a product that was promoted from a CJ catalog item
- **THEN** the response contains no `cjCatalogItemId`, `supplierCost`, or any other CJ/supplier-internal field

#### Scenario: Admin promotion response omits the raw CJ payload
- **WHEN** an admin successfully promotes a `CjCatalogItem`
- **THEN** the response does not include the item's `rawPayload`
