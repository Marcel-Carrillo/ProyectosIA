## ADDED Requirements

### Requirement: ProductVariant entity has required and optional fields
The system SHALL model a `ProductVariant` domain entity with the following fields: `id` (auto-incremented integer, primary key), `productId` (integer, required, foreign key referencing Product), `sku` (string, required, unique, max 100 characters), `size` (string, optional, max 50 characters), `color` (string, optional, max 50 characters), `publicPrice` (decimal, required, greater than 0), `compareAtPrice` (decimal, optional, must be greater than or equal to `publicPrice` if provided), `supplierId` (integer, optional, foreign key referencing Supplier), `supplierReference` (string, optional, max 150 characters), `supplierCost` (decimal, optional, must be greater than or equal to 0 if provided), `stockPolicy` (string, one of `SupplierManaged`, `InternalStock`, `Hybrid`, required), `status` (string, one of `Active`, `Inactive`, `OutOfStock`, `Archived`, defaults to `Active`), `createdAt` (DateTime), `updatedAt` (DateTime).

#### Scenario: Variant created with required fields only
- **WHEN** `POST /api/admin/products/:productId/variants` is called with `sku`, `publicPrice`, and `stockPolicy`
- **THEN** the variant is persisted with `status = Active`, all optional fields null, and linked to the given product

#### Scenario: Variant created with all fields
- **WHEN** `POST /api/admin/products/:productId/variants` is called with all fields including `supplierId`, `supplierReference`, `supplierCost`, `size`, `color`, `compareAtPrice`
- **THEN** all fields are persisted correctly on the variant record

---

### Requirement: Variant SKU must be unique
The system SHALL enforce that no two variants share the same `sku`, regardless of which product they belong to.

#### Scenario: Duplicate SKU on create
- **WHEN** `POST /api/admin/products/:productId/variants` is called with a `sku` already used by another variant
- **THEN** the system returns HTTP 409 with `code: "VARIANT_SKU_ALREADY_EXISTS"`

#### Scenario: Duplicate SKU on update
- **WHEN** `PUT /api/admin/products/:productId/variants/:id` is called with a `sku` already used by a different variant
- **THEN** the system returns HTTP 409 with `code: "VARIANT_SKU_ALREADY_EXISTS"`

---

### Requirement: Variant public price must be greater than zero
The system SHALL reject any create or update where `publicPrice` is zero or negative.

#### Scenario: Create with zero price
- **WHEN** `POST /api/admin/products/:productId/variants` is called with `publicPrice = 0`
- **THEN** the system returns HTTP 422 with a validation error

#### Scenario: Create with negative price
- **WHEN** `POST /api/admin/products/:productId/variants` is called with `publicPrice = -5`
- **THEN** the system returns HTTP 422 with a validation error

---

### Requirement: compareAtPrice must be greater than or equal to publicPrice
If `compareAtPrice` is provided, it MUST be greater than or equal to `publicPrice`.

#### Scenario: compareAtPrice equal to publicPrice
- **WHEN** `POST /api/admin/products/:productId/variants` is called with `compareAtPrice = 50` and `publicPrice = 50`
- **THEN** the variant is created successfully

#### Scenario: compareAtPrice less than publicPrice
- **WHEN** `POST /api/admin/products/:productId/variants` is called with `compareAtPrice = 30` and `publicPrice = 50`
- **THEN** the system returns HTTP 422 with `code: "VARIANT_COMPARE_PRICE_INVALID"`

---

### Requirement: Supplier data is accepted on write but never exposed in responses
`supplierId`, `supplierReference`, and `supplierCost` are accepted in create and update request bodies. These fields MUST NOT appear in any variant response body from any endpoint.

#### Scenario: Supplier fields accepted on create
- **WHEN** `POST /api/admin/products/:productId/variants` is called with `supplierId`, `supplierReference`, and `supplierCost`
- **THEN** the variant is persisted with those values and HTTP 201 is returned

#### Scenario: Supplier fields absent from response
- **WHEN** any variant endpoint returns a variant object
- **THEN** the response body does not contain `supplierId`, `supplierReference`, or `supplierCost`

---

### Requirement: stockPolicy must be a valid value
The system SHALL reject any create or update where `stockPolicy` is not one of `SupplierManaged`, `InternalStock`, or `Hybrid`.

#### Scenario: Invalid stockPolicy on create
- **WHEN** `POST /api/admin/products/:productId/variants` is called with `stockPolicy = "Unknown"`
- **THEN** the system returns HTTP 422 with a validation error

---

### Requirement: Variant must belong to an existing product
Creating a variant for a non-existent product MUST fail.

#### Scenario: Create variant for non-existent product
- **WHEN** `POST /api/admin/products/:productId/variants` is called with a `productId` that does not exist
- **THEN** the system returns HTTP 404 with `code: "PRODUCT_NOT_FOUND"`

---

### Requirement: List variants returns all variants for a product
`GET /api/admin/products/:productId/variants` SHALL return all variants for the given product regardless of status.

#### Scenario: List variants for a product
- **WHEN** `GET /api/admin/products/:productId/variants` is called with a valid product ID
- **THEN** the system returns HTTP 200 with all variants for that product

#### Scenario: List variants for non-existent product
- **WHEN** `GET /api/admin/products/:productId/variants` is called with a non-existent product ID
- **THEN** the system returns HTTP 404 with `code: "PRODUCT_NOT_FOUND"`

---

### Requirement: Get variant by ID returns variant or 404
`GET /api/admin/products/:productId/variants/:id` SHALL return the variant record if it exists and belongs to the given product. If the variant does not exist or does not belong to the product, the system MUST return HTTP 404.

#### Scenario: Variant found
- **WHEN** `GET /api/admin/products/:productId/variants/:id` is called with valid IDs
- **THEN** the system returns HTTP 200 with the variant data (supplier fields excluded)

#### Scenario: Variant not found
- **WHEN** `GET /api/admin/products/:productId/variants/:id` is called with a non-existent variant ID
- **THEN** the system returns HTTP 404 with `code: "VARIANT_NOT_FOUND"`

---

### Requirement: Update variant modifies allowed fields
`PUT /api/admin/products/:productId/variants/:id` SHALL update all variant fields including supplier fields. It MUST return HTTP 404 if the variant does not exist. SKU uniqueness and price constraints MUST be enforced.

#### Scenario: Successful variant update
- **WHEN** `PUT /api/admin/products/:productId/variants/:id` is called with valid fields
- **THEN** the system returns HTTP 200 with the updated variant (supplier fields excluded from response)

#### Scenario: Update non-existent variant
- **WHEN** `PUT /api/admin/products/:productId/variants/:id` is called with a non-existent variant ID
- **THEN** the system returns HTTP 404 with `code: "VARIANT_NOT_FOUND"`

---

### Requirement: Delete variant performs a soft-delete
`DELETE /api/admin/products/:productId/variants/:id` SHALL set `status = Inactive` on the variant rather than removing the row. If the variant does not exist, the system MUST return HTTP 404.

#### Scenario: Successful variant soft-delete
- **WHEN** `DELETE /api/admin/products/:productId/variants/:id` is called with an existing variant ID
- **THEN** the system sets `status = Inactive` and returns HTTP 200 with the updated variant

#### Scenario: Delete non-existent variant
- **WHEN** `DELETE /api/admin/products/:productId/variants/:id` is called with a non-existent variant ID
- **THEN** the system returns HTTP 404 with `code: "VARIANT_NOT_FOUND"`

---

### Requirement: API responses follow the standard envelope format
All variant admin endpoints MUST return responses wrapped in the standard envelope: `{ success: true, data: ..., message: ... }` for success and `{ success: false, error: { message: ..., code: ... } }` for errors.

#### Scenario: Successful response structure
- **WHEN** any variant admin endpoint returns a success response
- **THEN** the body contains `success: true` and a `data` field with the variant or variant array

#### Scenario: Error response structure
- **WHEN** any variant admin endpoint returns an error
- **THEN** the body contains `success: false` and an `error` object with `message` and `code` fields
