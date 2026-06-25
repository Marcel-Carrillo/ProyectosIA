# Product Management

## Purpose

Provides admin CRUD operations for products, including slug auto-generation, paginated and filterable listing, and an enforced status lifecycle (Draft → Active → Inactive / Archived).

## Requirements

### Requirement: Admin can create a product
The system SHALL allow an admin to create a new product. The product status SHALL default to `Draft`. The slug SHALL be auto-generated from the product name in kebab-case. If the generated slug is already taken, the system SHALL retry with a numeric suffix (e.g., `summer-dress-2`) up to 5 attempts before returning an error.

#### Scenario: Successful product creation
- **WHEN** admin submits `POST /api/admin/products` with a valid `name`
- **THEN** system creates the product with status `Draft`, auto-generates a unique slug, and returns `201` with the created product in the standard envelope

#### Scenario: Slug collision is resolved automatically
- **WHEN** admin creates a product whose name generates a slug already used by another product
- **THEN** system appends a numeric suffix and retries until a unique slug is found, returning `201` with the resolved slug

#### Scenario: Slug exhaustion after 5 retries
- **WHEN** all 5 slug collision retries are exhausted
- **THEN** system returns `409` with error code `PRODUCT_SLUG_CONFLICT`

#### Scenario: Missing required name field
- **WHEN** admin submits `POST /api/admin/products` without a `name`
- **THEN** system returns `400` with a validation error

---

### Requirement: Admin can list products
The system SHALL provide a paginated list of products. The list SHALL support filtering by `status` and `categoryId`. The list SHALL support optional `search` by name. Soft-deleted products SHALL NOT appear in the list.

#### Scenario: List products with default pagination
- **WHEN** admin sends `GET /api/admin/products` with no query parameters
- **THEN** system returns `200` with a paginated list of non-deleted products (default `page=1`, `pageSize=20`)

#### Scenario: Filter by status
- **WHEN** admin sends `GET /api/admin/products?status=Active`
- **THEN** system returns only products with status `Active`

#### Scenario: Filter by category
- **WHEN** admin sends `GET /api/admin/products?categoryId=<id>`
- **THEN** system returns only products belonging to that category

#### Scenario: Search by name
- **WHEN** admin sends `GET /api/admin/products?search=dress`
- **THEN** system returns products whose name contains "dress" (case-insensitive)

---

### Requirement: Admin can get a product by id
The system SHALL return full product details for a given product id. Soft-deleted products SHALL NOT be retrievable.

#### Scenario: Successful product retrieval
- **WHEN** admin sends `GET /api/admin/products/:id` with a valid id
- **THEN** system returns `200` with the product data in the standard envelope

#### Scenario: Product not found
- **WHEN** admin sends `GET /api/admin/products/:id` with a non-existent or soft-deleted id
- **THEN** system returns `404` with error code `PRODUCT_NOT_FOUND`

---

### Requirement: Admin can update a product
The system SHALL allow an admin to update product fields and trigger status lifecycle transitions via `PATCH /api/admin/products/:id`. All fields are optional; only provided fields are updated.

#### Scenario: Successful field update
- **WHEN** admin sends `PATCH /api/admin/products/:id` with valid optional fields
- **THEN** system updates only the provided fields and returns `200` with the updated product

#### Scenario: Activate a Draft product with active variants
- **WHEN** admin sends `PATCH /api/admin/products/:id` with `{ "status": "Active" }` and the product has at least one active variant
- **THEN** system transitions the product to `Active` and returns `200`

#### Scenario: Activate a Draft product with no active variants
- **WHEN** admin sends `PATCH /api/admin/products/:id` with `{ "status": "Active" }` and the product has no active variants
- **THEN** system returns `422` with error code `PRODUCT_REQUIRES_ACTIVE_VARIANT`

#### Scenario: Attempt to reactivate an Archived product
- **WHEN** admin sends `PATCH /api/admin/products/:id` with `{ "status": "Active" }` and the product is currently `Archived`
- **THEN** system returns `422` with error code `PRODUCT_ARCHIVED_CANNOT_REACTIVATE`

#### Scenario: Update non-existent product
- **WHEN** admin sends `PATCH /api/admin/products/:id` with a non-existent id
- **THEN** system returns `404` with error code `PRODUCT_NOT_FOUND`

---

### Requirement: Admin can soft-delete a product
The system SHALL allow an admin to soft-delete a product. The product SHALL be excluded from all list and get operations after deletion. Associated variants and images SHALL remain in the database but be inaccessible via product endpoints.

#### Scenario: Successful soft-delete
- **WHEN** admin sends `DELETE /api/admin/products/:id` with a valid id
- **THEN** system sets `deletedAt` on the product and returns `204`

#### Scenario: Delete non-existent product
- **WHEN** admin sends `DELETE /api/admin/products/:id` with a non-existent id
- **THEN** system returns `404` with error code `PRODUCT_NOT_FOUND`

---

### Requirement: Product status lifecycle is enforced
The system SHALL enforce the following status transition rules:
- `Draft` → `Active` (requires ≥1 active variant)
- `Active` → `Inactive`
- `Active` → `Archived`
- `Inactive` → `Active` (requires ≥1 active variant)
- `Inactive` → `Archived`
- `Archived` → any other status is FORBIDDEN

#### Scenario: Valid lifecycle transition Draft to Active
- **WHEN** product is in `Draft` status and has at least one active variant
- **THEN** status transition to `Active` is accepted

#### Scenario: Invalid transition from Archived
- **WHEN** product is in `Archived` status and admin attempts any status change
- **THEN** system returns `422` with error code `PRODUCT_ARCHIVED_CANNOT_REACTIVATE`

---

### Requirement: Product create persists translations
`ProductService.createProduct` SHALL accept an optional `translations` array alongside the existing product fields. Each entry SHALL be validated (`locale` ∈ {`en`,`es`}; `name` ≤ 150 chars; `description` ≤ 2000 chars) before persistence. Valid translations SHALL be created atomically with the product in the same transaction. The `source` field SHALL default to `manual` for admin-authored translations.

#### Scenario: Product created with two locale translations
- **WHEN** `createProduct` is called with `translations: [{locale: "en", name: "..."}, {locale: "es", name: "..."}]`
- **THEN** the product and both translation rows SHALL be created in the same DB transaction

#### Scenario: Translation validation fails on create
- **WHEN** `createProduct` is called with a translation whose `name` exceeds 150 characters
- **THEN** the system SHALL return a `ValidationError` and not persist any row

### Requirement: Product update upserts translations
`ProductService.updateProduct` SHALL accept an optional `translations` array. Provided translations SHALL be upserted by `(productId, locale)`; locales not included in the array SHALL be left unchanged. Validation rules are identical to create.

#### Scenario: Update adds a missing ES translation
- **WHEN** `updateProduct` is called on a product that has only an `en` translation, with `translations: [{locale: "es", name: "..."}]`
- **THEN** the `es` row SHALL be created; the `en` row SHALL remain unchanged

#### Scenario: Update overwrites an existing translation
- **WHEN** `updateProduct` is called with an `es` translation whose `name` differs from the stored value
- **THEN** the `es` row SHALL be updated with the new name

### Requirement: Product read responses include full translations array for admin
When the admin service fetches a product or a product list, the returned domain object SHALL include a `translations` field with all `ProductTranslation` rows for that product. This allows the admin controller to serialize them in the response for form pre-population.

#### Scenario: Admin fetch includes translations
- **WHEN** `getProductById` is called from an admin context
- **THEN** the returned object SHALL include a `translations` array with all locale rows

### Requirement: Product soft-delete cascades to translations
When a product is soft-deleted (setting `deletedAt`), its `ProductTranslation` rows SHALL remain in the database (they are not orphaned). When a product is hard-deleted, the cascade constraint on `productId` SHALL delete all translation rows automatically.

#### Scenario: Soft-deleted product keeps translations
- **WHEN** a product's `deletedAt` is set
- **THEN** its `ProductTranslation` rows SHALL remain accessible to admins for recovery scenarios

#### Scenario: Hard-deleted product removes translations
- **WHEN** a product row is hard-deleted from the database
- **THEN** all `ProductTranslation` rows for that product SHALL be removed via cascade
