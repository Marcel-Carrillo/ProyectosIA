# Product Variant Management

## Purpose

Provides admin CRUD operations for product variants, including SKU uniqueness enforcement, pricing validation rules, and a strict policy that supplier-sensitive fields are never exposed in any API response.

## Requirements

### Requirement: Admin can create a product variant
The system SHALL allow an admin to create a variant scoped to a parent product. The `sku` field is required and MUST be unique across all variants. The `publicPrice` field is required and MUST be a positive decimal. The variant `status` SHALL default to `Active`.

#### Scenario: Successful variant creation
- **WHEN** admin sends `POST /api/admin/products/:id/variants` with valid `sku` and `publicPrice`
- **THEN** system creates the variant linked to the product and returns `201` with the variant in the standard envelope

#### Scenario: Duplicate SKU
- **WHEN** admin sends `POST /api/admin/products/:id/variants` with a `sku` already used by another variant
- **THEN** system returns `409` with error code `VARIANT_SKU_CONFLICT`

#### Scenario: Missing required publicPrice
- **WHEN** admin sends `POST /api/admin/products/:id/variants` without `publicPrice`
- **THEN** system returns `400` with a validation error

#### Scenario: compareAtPrice not greater than publicPrice
- **WHEN** admin provides `compareAtPrice` that is less than or equal to `publicPrice`
- **THEN** system returns `422` with error code `VARIANT_COMPARE_PRICE_INVALID`

#### Scenario: Parent product not found
- **WHEN** admin sends `POST /api/admin/products/:id/variants` with a non-existent product id
- **THEN** system returns `404` with error code `PRODUCT_NOT_FOUND`

---

### Requirement: Admin can list variants for a product
The system SHALL return all non-deleted variants belonging to a given product. Soft-deleted variants SHALL NOT appear in the list.

#### Scenario: Successful list
- **WHEN** admin sends `GET /api/admin/products/:id/variants` with a valid product id
- **THEN** system returns `200` with the list of non-deleted variants

#### Scenario: List for non-existent product
- **WHEN** admin sends `GET /api/admin/products/:id/variants` with a non-existent product id
- **THEN** system returns `404` with error code `PRODUCT_NOT_FOUND`

---

### Requirement: Admin can get a product variant by id
The system SHALL return full variant details for a given variant id, scoped to its parent product. Soft-deleted variants SHALL NOT be retrievable.

#### Scenario: Successful variant retrieval
- **WHEN** admin sends `GET /api/admin/products/:id/variants/:variantId`
- **THEN** system returns `200` with the variant data

#### Scenario: Variant not found or belongs to different product
- **WHEN** admin sends a variant id that does not exist or belongs to a different product
- **THEN** system returns `404` with error code `VARIANT_NOT_FOUND`

---

### Requirement: Admin can update a product variant
The system SHALL allow an admin to update variant fields via `PATCH /api/admin/products/:id/variants/:variantId`. All fields are optional. Price validation rules apply on update.

#### Scenario: Successful field update
- **WHEN** admin sends valid optional fields
- **THEN** system updates only the provided fields and returns `200` with the updated variant

#### Scenario: Update introduces invalid compareAtPrice
- **WHEN** admin updates `compareAtPrice` to a value ≤ current `publicPrice`
- **THEN** system returns `422` with error code `VARIANT_COMPARE_PRICE_INVALID`

#### Scenario: Update non-existent variant
- **WHEN** admin sends a non-existent `variantId`
- **THEN** system returns `404` with error code `VARIANT_NOT_FOUND`

---

### Requirement: Admin can soft-delete a product variant
The system SHALL allow soft-deleting a variant. A soft-deleted variant SHALL NOT count toward the product's active variant count for status activation purposes.

#### Scenario: Successful soft-delete
- **WHEN** admin sends `DELETE /api/admin/products/:id/variants/:variantId`
- **THEN** system sets `deletedAt` on the variant and returns `204`

#### Scenario: Delete non-existent variant
- **WHEN** admin sends a non-existent `variantId`
- **THEN** system returns `404` with error code `VARIANT_NOT_FOUND`

---

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

### Requirement: Variant supplier fields are never exposed in any API response
The system SHALL NEVER include `supplierId`, `supplierReference`, or `supplierCost` in any API response, including admin endpoints. This exclusion SHALL be enforced at the Prisma select level in the repository, not at the serializer level.

#### Scenario: Variant response omits supplier fields
- **WHEN** admin retrieves a variant (via list, get by id, create, or update)
- **THEN** the response body SHALL NOT contain `supplierId`, `supplierReference`, or `supplierCost` fields

#### Scenario: Supplier-leak assertion is verified by an automated test
- **WHEN** the test suite runs
- **THEN** at least one test explicitly asserts that no variant response body contains supplier fields, and this test MUST pass in CI
