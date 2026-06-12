## ADDED Requirements

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
