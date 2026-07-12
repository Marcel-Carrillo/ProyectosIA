## MODIFIED Requirements

### Requirement: Admin can add an image to a product
The system SHALL allow an admin to add an image URL reference to a product. The `url` field is required. The `sortOrder` field SHALL default to `0`. The `altText` field is optional. The `color` field is optional (nullable string); when provided, it associates the image with a specific variant color, matching the same color vocabulary as `ProductVariant.color`.

#### Scenario: Successful image creation
- **WHEN** admin sends `POST /api/admin/products/:id/images` with a valid `url`
- **THEN** system creates the image linked to the product and returns `201` with the image in the standard envelope

#### Scenario: Successful image creation with color
- **WHEN** admin sends `POST /api/admin/products/:id/images` with a valid `url` and a `color` value
- **THEN** system creates the image with that `color` set and returns `201` with the image in the standard envelope

#### Scenario: Missing required url
- **WHEN** admin sends `POST /api/admin/products/:id/images` without `url`
- **THEN** system returns `400` with a validation error

#### Scenario: Parent product not found
- **WHEN** admin sends `POST /api/admin/products/:id/images` with a non-existent product id
- **THEN** system returns `404` with error code `PRODUCT_NOT_FOUND`

---

### Requirement: Admin can list images for a product
The system SHALL return all images belonging to a given product, ordered by `sortOrder` ascending. Each returned image SHALL include its `color` field (`null` when the image is not associated with a specific color).

#### Scenario: Successful list
- **WHEN** admin sends `GET /api/admin/products/:id/images` with a valid product id
- **THEN** system returns `200` with the list of images ordered by `sortOrder`, each including its `color` field

#### Scenario: List for non-existent product
- **WHEN** admin sends `GET /api/admin/products/:id/images` with a non-existent product id
- **THEN** system returns `404` with error code `PRODUCT_NOT_FOUND`

---

### Requirement: Admin can update an image
The system SHALL allow updating `url`, `altText`, `sortOrder`, and `color` for an image via `PATCH /api/admin/products/:id/images/:imageId`. All fields are optional.

#### Scenario: Successful image update
- **WHEN** admin sends valid optional fields to `PATCH /api/admin/products/:id/images/:imageId`
- **THEN** system updates only the provided fields and returns `200` with the updated image

#### Scenario: Successful color update
- **WHEN** admin sends `{ "color": "Black" }` to `PATCH /api/admin/products/:id/images/:imageId`
- **THEN** system updates only the `color` field and returns `200` with the updated image

#### Scenario: Update non-existent image
- **WHEN** admin sends a non-existent `imageId`
- **THEN** system returns `404` with error code `IMAGE_NOT_FOUND`
