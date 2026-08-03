# Spec: CJ Dropshipping Catalog Promotion

## Purpose

Admin-only capability for promoting staged `CjCatalogItem` records into real `Product`/`ProductVariant` records, and for activating or deactivating a promoted item's storefront visibility without losing its CJ origin link (`ProductVariant.cjCatalogItemId`). Promotion is explicit and transactional; nothing is auto-published. Depends on staged data from `cj-catalog-sync`.

## Requirements

### Requirement: Admin can promote staged CJ catalog items into real products
The system SHALL expose `POST /api/admin/suppliers/:supplierId/cj/catalog/promote` accepting `{ items: [{ cjCatalogItemId, publicPrice?, compareAtPrice? }], categoryId?, activate? }`. The system SHALL group the requested `CjCatalogItem` records by their CJ product id (`pid`): items sharing a `pid` SHALL be promoted into a single `Product` with one `ProductVariant` per item (per CJ variant id, `vid`). Each created `ProductVariant` SHALL be linked to its source `CjCatalogItem` via `cjCatalogItemId`.

`categoryId` is now OPTIONAL. For each `pid`-group, the system SHALL resolve the category to assign, in this order, and SHALL resolve it once per `pid`-group (not once per variant), before opening the write transaction:
1. If the request supplies `categoryId`, use it as an explicit admin override, regardless of what CJ's own taxonomy reports.
2. Otherwise, resolve the group's CJ category from the source `CjCatalogItem.categoryId` (captured at sync time) via the CJ category taxonomy (`fetchCategories()`). If a local `Category` is already mapped to that CJ category (see `category-management`'s supplier category mapping), reuse it; otherwise create a new `Category` (auto-created categories default to `status = Inactive`) and its mapping.
3. If CJ category resolution is not possible (the item has no `categoryId`, the CJ categories API call fails, or the id cannot be resolved to a name), fall back to the configured `CJ_DEFAULT_CATEGORY_ID`.
4. If none of the above resolves to a valid `Category`, the system SHALL return `422` with error code `CJ_PROMOTION_CATEGORY_REQUIRED`.

A request `categoryId` that does not reference an existing `Category` SHALL still return `422` with error code `CJ_PROMOTION_CATEGORY_REQUIRED`. Each item's `publicPrice` SHALL be either the explicit value provided in the request or, if omitted, computed as `supplierCost * CJ_DEFAULT_MARKUP_MULTIPLIER`; if neither is available (no configured default and no explicit value), the system SHALL return `422` with error code `CJ_PROMOTION_PRICE_REQUIRED`. The operation SHALL be transactional: if any requested item fails validation (unknown `cjCatalogItemId`, `syncStatus != Synced`, missing price resolution, missing category), the system SHALL return `422` with a per-item error list and SHALL NOT persist any partial changes. New `ProductVariant` SKUs SHALL be derived deterministically as `CJ-<externalRef>` to guarantee uniqueness independent of CJ's own `sku` field.

#### Scenario: Promote a single staged item creates a new product and variant
- **WHEN** an admin requests `POST /api/admin/suppliers/:supplierId/cj/catalog/promote` with one `cjCatalogItemId`, an explicit `publicPrice`, and a valid `categoryId`
- **THEN** the system creates one `Product` (`status = Draft` unless `activate: true`) and one `ProductVariant` with `sku = CJ-<externalRef>`, `cjCatalogItemId` set to the source item's id, and returns `201` with the created product/variant identifiers

#### Scenario: Promoting multiple items sharing the same CJ product id creates one product with multiple variants
- **WHEN** an admin requests promotion of three `CjCatalogItem` records that share the same `pid` (different sizes/colors)
- **THEN** the system creates a single `Product` and three `ProductVariant` records, each linked to its own source `CjCatalogItem` via `cjCatalogItemId`

#### Scenario: Promotion without a request categoryId resolves the real CJ category automatically
- **WHEN** an admin requests promotion without `categoryId` in the request, and the item's `CjCatalogItem.categoryId` resolves to a CJ category with no existing local mapping
- **THEN** the system creates a new `Category` (`status = Inactive`) named after the resolved CJ category, creates a supplier category mapping for it, and assigns the created `Product` to that category

#### Scenario: Promotion without a request categoryId reuses an already-mapped local category
- **WHEN** an admin requests promotion without `categoryId`, and the item's CJ category is already mapped to an existing local `Category`
- **THEN** the system assigns the created `Product` to the existing mapped `Category` and does not create a duplicate category

#### Scenario: An explicit request categoryId overrides CJ's own category
- **WHEN** an admin requests promotion with an explicit `categoryId`, even though the item's `CjCatalogItem.categoryId` would resolve to a different CJ category
- **THEN** the system assigns the created `Product` to the requested `categoryId` and does not perform CJ category resolution for that group

#### Scenario: CJ category resolution failure falls back to the configured default category
- **WHEN** an admin requests promotion without `categoryId`, and resolving the CJ category fails (the CJ categories API is unavailable, or the item has no `CjCatalogItem.categoryId`), and `CJ_DEFAULT_CATEGORY_ID` is configured and valid
- **THEN** the system assigns the created `Product` to the `CJ_DEFAULT_CATEGORY_ID` category instead of failing the request

#### Scenario: Promotion without an explicit price falls back to the configured default markup
- **WHEN** an admin requests promotion of an item without `publicPrice` in the request, and `CJ_DEFAULT_MARKUP_MULTIPLIER` is configured
- **THEN** the system sets `publicPrice = supplierCost * CJ_DEFAULT_MARKUP_MULTIPLIER` on the created variant

#### Scenario: Promotion fails when price cannot be resolved
- **WHEN** an admin requests promotion of an item without `publicPrice` and no default markup is configured
- **THEN** the system returns `422` with error code `CJ_PROMOTION_PRICE_REQUIRED` and creates no records

#### Scenario: Promotion fails when no category can be resolved by any means
- **WHEN** an admin requests promotion without `categoryId`, CJ category resolution fails, and `CJ_DEFAULT_CATEGORY_ID` is not configured or invalid
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
