## ADDED Requirements

### Requirement: Product entity has required and optional fields
The system SHALL model a `Product` domain entity with the following fields: `id` (auto-incremented integer, primary key), `name` (string, required, max 150 characters), `slug` (string, unique, required, max 200 characters), `description` (string, optional, max 2000 characters), `brand` (string, optional, max 100 characters), `status` (string, one of `Draft`, `Active`, `Inactive`, `Archived`, defaults to `Draft`), `mainImageUrl` (string, optional, max 500 characters), `categoryId` (integer, optional, foreign key referencing Category), `createdAt` (DateTime), `updatedAt` (DateTime).

#### Scenario: Product is created with required fields only
- **WHEN** a product is created with only `name` provided
- **THEN** the product is persisted with `status = Draft`, `slug` auto-generated from `name`, and all optional fields set to null

#### Scenario: Product is created with all fields
- **WHEN** a product is created with `name`, `description`, `brand`, `mainImageUrl`, `categoryId`, and an explicit `slug` provided
- **THEN** all fields are persisted correctly on the product record

---

### Requirement: Product name is required and has a maximum length
The system SHALL reject product creation or update requests where `name` is missing or exceeds 150 characters.

#### Scenario: Create with missing name
- **WHEN** `POST /api/admin/products` is called without a `name` field
- **THEN** the system returns HTTP 422 with a validation error

#### Scenario: Create with name exceeding max length
- **WHEN** `POST /api/admin/products` is called with a `name` longer than 150 characters
- **THEN** the system returns HTTP 422 with a validation error

---

### Requirement: Product slug is auto-generated and unique
The system SHALL auto-generate the `slug` from the product `name` using kebab-case transformation when no explicit slug is provided. If the generated slug collides with an existing one, the system MUST append a numeric suffix (`-2`, `-3`, …) until a unique slug is found. Slug uniqueness MUST be enforced globally.

#### Scenario: Slug auto-generated from name
- **WHEN** `POST /api/admin/products` is called with `name = "Summer Dress"` and no `slug`
- **THEN** the product is persisted with `slug = "summer-dress"`

#### Scenario: Slug collision resolved with suffix
- **WHEN** a product with `slug = "summer-dress"` already exists and a new product is created with `name = "Summer Dress"`
- **THEN** the new product is persisted with `slug = "summer-dress-2"`

#### Scenario: Explicit slug provided on create
- **WHEN** `POST /api/admin/products` is called with `name = "Summer Dress"` and `slug = "my-custom-slug"`
- **THEN** the product is persisted with `slug = "my-custom-slug"`

#### Scenario: Duplicate explicit slug rejected
- **WHEN** `POST /api/admin/products` is called with a `slug` already used by another product
- **THEN** the system returns HTTP 409 with `code: "PRODUCT_SLUG_ALREADY_EXISTS"`

---

### Requirement: Product category reference must exist
If `categoryId` is provided, it MUST reference an existing Category record.

#### Scenario: Create with valid categoryId
- **WHEN** `POST /api/admin/products` is called with a `categoryId` referencing an existing category
- **THEN** the product is created and linked to that category

#### Scenario: Create with invalid categoryId
- **WHEN** `POST /api/admin/products` is called with a `categoryId` that does not exist
- **THEN** the system returns HTTP 422 with `code: "CATEGORY_NOT_FOUND"`

---

### Requirement: Product status lifecycle is enforced
A `Product` MUST follow the status lifecycle rules: `Draft` is the initial status. A product can transition to `Active` only if it has at least one variant with `status = Active`. A product may transition to `Inactive` or `Archived` from any status. An `Archived` product cannot be reactivated.

#### Scenario: Activate product with active variant
- **WHEN** `PUT /api/admin/products/:id` is called with `status = Active` and the product has at least one variant with `status = Active`
- **THEN** the product status is updated to `Active` and HTTP 200 is returned

#### Scenario: Activate product without active variant
- **WHEN** `PUT /api/admin/products/:id` is called with `status = Active` and the product has no variant with `status = Active`
- **THEN** the system returns HTTP 422 with `code: "PRODUCT_REQUIRES_ACTIVE_VARIANT"`

#### Scenario: Archive an active product
- **WHEN** `PUT /api/admin/products/:id` is called with `status = Archived` on an `Active` product
- **THEN** the product status is updated to `Archived` and HTTP 200 is returned

#### Scenario: Reactivate an archived product is rejected
- **WHEN** `PUT /api/admin/products/:id` is called with `status = Active` on an `Archived` product
- **THEN** the system returns HTTP 422 with `code: "PRODUCT_ARCHIVED_CANNOT_REACTIVATE"`

---

### Requirement: List products returns products with optional filtering
`GET /api/admin/products` SHALL return a list of all products. An optional `status` query parameter SHALL filter results by status. An optional `categoryId` query parameter SHALL filter results by category.

#### Scenario: List all products
- **WHEN** `GET /api/admin/products` is called without query parameters
- **THEN** the system returns HTTP 200 with all products regardless of status

#### Scenario: List filtered by status
- **WHEN** `GET /api/admin/products?status=Active` is called
- **THEN** only products with `status = Active` are returned

#### Scenario: List filtered by categoryId
- **WHEN** `GET /api/admin/products?categoryId=3` is called
- **THEN** only products linked to category ID 3 are returned

---

### Requirement: Get product by ID returns product or 404
`GET /api/admin/products/:id` SHALL return the full product record including its variants and images. If the product does not exist, the system MUST return HTTP 404.

#### Scenario: Product found
- **WHEN** `GET /api/admin/products/:id` is called with a valid existing product ID
- **THEN** the system returns HTTP 200 with the product data, its variants, and its images

#### Scenario: Product not found
- **WHEN** `GET /api/admin/products/:id` is called with a non-existent ID
- **THEN** the system returns HTTP 404 with `code: "PRODUCT_NOT_FOUND"`

---

### Requirement: Create product returns the created record
`POST /api/admin/products` SHALL validate input, enforce slug uniqueness, and persist a new product. On success it MUST return HTTP 201 with the created product.

#### Scenario: Successful product creation
- **WHEN** `POST /api/admin/products` is called with a valid `name`
- **THEN** the system returns HTTP 201 with the newly created product including its generated `id` and `slug`

---

### Requirement: Update product modifies allowed fields
`PUT /api/admin/products/:id` SHALL update `name`, `slug`, `description`, `brand`, `status`, `mainImageUrl`, and `categoryId`. It MUST return HTTP 404 if the product does not exist. Status lifecycle rules and slug uniqueness MUST be enforced.

#### Scenario: Successful update
- **WHEN** `PUT /api/admin/products/:id` is called with valid fields
- **THEN** the system returns HTTP 200 with the updated product

#### Scenario: Update non-existent product
- **WHEN** `PUT /api/admin/products/:id` is called with a non-existent ID
- **THEN** the system returns HTTP 404 with `code: "PRODUCT_NOT_FOUND"`

---

### Requirement: Delete product performs a soft-delete
`DELETE /api/admin/products/:id` SHALL set `status = Inactive` on the product rather than removing the row. If the product does not exist, the system MUST return HTTP 404.

#### Scenario: Successful soft-delete
- **WHEN** `DELETE /api/admin/products/:id` is called with an existing product ID
- **THEN** the system sets `status = Inactive` and returns HTTP 200 with the updated product

#### Scenario: Delete non-existent product
- **WHEN** `DELETE /api/admin/products/:id` is called with a non-existent ID
- **THEN** the system returns HTTP 404 with `code: "PRODUCT_NOT_FOUND"`

---

### Requirement: API responses follow the standard envelope format
All product admin endpoints MUST return responses wrapped in the standard envelope: `{ success: true, data: ..., message: ... }` for success and `{ success: false, error: { message: ..., code: ... } }` for errors.

#### Scenario: Successful response structure
- **WHEN** any product admin endpoint returns a success response
- **THEN** the body contains `success: true` and a `data` field with the product or product array

#### Scenario: Error response structure
- **WHEN** any product admin endpoint returns an error
- **THEN** the body contains `success: false` and an `error` object with `message` and `code` fields
