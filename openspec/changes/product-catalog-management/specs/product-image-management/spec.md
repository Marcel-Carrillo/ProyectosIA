## ADDED Requirements

### Requirement: ProductImage entity has required and optional fields
The system SHALL model a `ProductImage` domain entity with the following fields: `id` (auto-incremented integer, primary key), `productId` (integer, required, foreign key referencing Product), `url` (string, required, max 500 characters), `altText` (string, optional, max 250 characters), `sortOrder` (integer, required, must be greater than or equal to 0, defaults to 0), `createdAt` (DateTime).

#### Scenario: Image created with required fields only
- **WHEN** `POST /api/admin/products/:productId/images` is called with only `url`
- **THEN** the image is persisted with `sortOrder = 0`, `altText = null`, and linked to the given product

#### Scenario: Image created with all fields
- **WHEN** `POST /api/admin/products/:productId/images` is called with `url`, `altText`, and `sortOrder`
- **THEN** all fields are persisted correctly on the image record

---

### Requirement: Image URL is required and has a maximum length
The system SHALL reject create or update requests where `url` is missing or exceeds 500 characters.

#### Scenario: Create with missing URL
- **WHEN** `POST /api/admin/products/:productId/images` is called without a `url` field
- **THEN** the system returns HTTP 422 with a validation error

#### Scenario: Create with URL exceeding max length
- **WHEN** `POST /api/admin/products/:productId/images` is called with a `url` longer than 500 characters
- **THEN** the system returns HTTP 422 with a validation error

---

### Requirement: Image must belong to an existing product
Creating an image for a non-existent product MUST fail.

#### Scenario: Create image for non-existent product
- **WHEN** `POST /api/admin/products/:productId/images` is called with a `productId` that does not exist
- **THEN** the system returns HTTP 404 with `code: "PRODUCT_NOT_FOUND"`

---

### Requirement: sortOrder must be a non-negative integer
The system SHALL reject create or update requests where `sortOrder` is negative.

#### Scenario: Create with negative sortOrder
- **WHEN** `POST /api/admin/products/:productId/images` is called with `sortOrder = -1`
- **THEN** the system returns HTTP 422 with a validation error

---

### Requirement: List images returns all images for a product ordered by sortOrder
`GET /api/admin/products/:productId/images` SHALL return all images for the given product, ordered by `sortOrder` ascending.

#### Scenario: List images for a product
- **WHEN** `GET /api/admin/products/:productId/images` is called with a valid product ID
- **THEN** the system returns HTTP 200 with all images for that product ordered by `sortOrder` ascending

#### Scenario: List images for non-existent product
- **WHEN** `GET /api/admin/products/:productId/images` is called with a non-existent product ID
- **THEN** the system returns HTTP 404 with `code: "PRODUCT_NOT_FOUND"`

---

### Requirement: Get image by ID returns image or 404
`GET /api/admin/products/:productId/images/:id` SHALL return the image record if it exists and belongs to the given product. If the image does not exist or does not belong to the product, the system MUST return HTTP 404.

#### Scenario: Image found
- **WHEN** `GET /api/admin/products/:productId/images/:id` is called with valid IDs
- **THEN** the system returns HTTP 200 with the image data

#### Scenario: Image not found
- **WHEN** `GET /api/admin/products/:productId/images/:id` is called with a non-existent image ID
- **THEN** the system returns HTTP 404 with `code: "IMAGE_NOT_FOUND"`

---

### Requirement: Add image to product returns the created record
`POST /api/admin/products/:productId/images` SHALL validate input and persist a new image linked to the product. On success it MUST return HTTP 201 with the created image.

#### Scenario: Successful image creation
- **WHEN** `POST /api/admin/products/:productId/images` is called with a valid `url`
- **THEN** the system returns HTTP 201 with the newly created image including its generated `id`

---

### Requirement: Update image modifies altText and sortOrder
`PUT /api/admin/products/:productId/images/:id` SHALL update `url`, `altText`, and `sortOrder`. It MUST return HTTP 404 if the image does not exist.

#### Scenario: Successful image update
- **WHEN** `PUT /api/admin/products/:productId/images/:id` is called with a new `altText` and `sortOrder`
- **THEN** the system returns HTTP 200 with the updated image

#### Scenario: Update non-existent image
- **WHEN** `PUT /api/admin/products/:productId/images/:id` is called with a non-existent image ID
- **THEN** the system returns HTTP 404 with `code: "IMAGE_NOT_FOUND"`

---

### Requirement: Remove image permanently deletes the record
`DELETE /api/admin/products/:productId/images/:id` SHALL permanently delete the image record. Images do not use soft-delete because they have no referential integrity requirements with order history. If the image does not exist, the system MUST return HTTP 404.

#### Scenario: Successful image removal
- **WHEN** `DELETE /api/admin/products/:productId/images/:id` is called with an existing image ID
- **THEN** the system permanently deletes the image and returns HTTP 200

#### Scenario: Remove non-existent image
- **WHEN** `DELETE /api/admin/products/:productId/images/:id` is called with a non-existent image ID
- **THEN** the system returns HTTP 404 with `code: "IMAGE_NOT_FOUND"`

---

### Requirement: API responses follow the standard envelope format
All product image admin endpoints MUST return responses wrapped in the standard envelope: `{ success: true, data: ..., message: ... }` for success and `{ success: false, error: { message: ..., code: ... } }` for errors.

#### Scenario: Successful response structure
- **WHEN** any image admin endpoint returns a success response
- **THEN** the body contains `success: true` and a `data` field with the image or image array

#### Scenario: Error response structure
- **WHEN** any image admin endpoint returns an error
- **THEN** the body contains `success: false` and an `error` object with `message` and `code` fields
