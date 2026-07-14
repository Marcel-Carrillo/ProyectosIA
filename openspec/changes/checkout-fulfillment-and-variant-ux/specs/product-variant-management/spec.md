## ADDED Requirements

### Requirement: Product variant exposes a supplier-synced stock quantity

Every `ProductVariant` linked to a `CjCatalogItem` SHALL carry a `stockQuantity` (integer, >= 0) reflecting that `CjCatalogItem`'s `stockQuantity` at the time of the last catalog sync or promotion. `stockQuantity` SHALL NOT be directly settable by admins through the variant create/update endpoints; it SHALL only change as a result of the supplier catalog sync/promotion process. Variants with no linked `CjCatalogItem` SHALL default `stockQuantity` to `0` unless the product uses a fulfillment model where stock does not apply, in which case this field is out of scope for this increment.

#### Scenario: Newly promoted variant carries the supplier's stock quantity

- **WHEN** a `CjCatalogItem` with `stockQuantity = 12` is promoted to a `ProductVariant`
- **THEN** the resulting `ProductVariant.stockQuantity` is `12`

#### Scenario: Stock quantity updates on the next catalog sync

- **WHEN** a linked `CjCatalogItem`'s `stockQuantity` changes from `12` to `0` during a scheduled catalog sync
- **THEN** the corresponding `ProductVariant.stockQuantity` is updated to `0` on that sync run

#### Scenario: Admin variant update requests cannot set stockQuantity directly

- **WHEN** an admin sends `PATCH /api/admin/products/:id/variants/:variantId` with a `stockQuantity` field in the body
- **THEN** the system ignores that field and the variant's `stockQuantity` remains driven only by the supplier catalog sync

### Requirement: Admin variant responses include stockQuantity

`GET /api/admin/products/:id/variants`, `GET /api/admin/products/:id/variants/:variantId`, create, and update responses SHALL include `stockQuantity` alongside the existing variant fields.

#### Scenario: Admin sees current stock on a variant

- **WHEN** an admin retrieves a variant via any admin variant endpoint
- **THEN** the response includes the variant's current `stockQuantity`
