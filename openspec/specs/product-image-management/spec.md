# Product Image Management

## Purpose

Provides admin operations for managing image URL references associated with a product, including ordered listing and hard-delete semantics.

## Requirements

### Requirement: Admin can add an image to a product
The system SHALL allow an admin to add an image URL reference to a product. The `url` field is required. The `sortOrder` field SHALL default to `0`. The `altText` field is optional.

#### Scenario: Successful image creation
- **WHEN** admin sends `POST /api/admin/products/:id/images` with a valid `url`
- **THEN** system creates the image linked to the product and returns `201` with the image in the standard envelope

#### Scenario: Missing required url
- **WHEN** admin sends `POST /api/admin/products/:id/images` without `url`
- **THEN** system returns `400` with a validation error

#### Scenario: Parent product not found
- **WHEN** admin sends `POST /api/admin/products/:id/images` with a non-existent product id
- **THEN** system returns `404` with error code `PRODUCT_NOT_FOUND`

---

### Requirement: Admin can list images for a product
The system SHALL return all images belonging to a given product, ordered by `sortOrder` ascending.

#### Scenario: Successful list
- **WHEN** admin sends `GET /api/admin/products/:id/images` with a valid product id
- **THEN** system returns `200` with the list of images ordered by `sortOrder`

#### Scenario: List for non-existent product
- **WHEN** admin sends `GET /api/admin/products/:id/images` with a non-existent product id
- **THEN** system returns `404` with error code `PRODUCT_NOT_FOUND`

---

### Requirement: Admin can update an image
The system SHALL allow updating `url`, `altText`, and `sortOrder` for an image via `PATCH /api/admin/products/:id/images/:imageId`. All fields are optional.

#### Scenario: Successful image update
- **WHEN** admin sends valid optional fields to `PATCH /api/admin/products/:id/images/:imageId`
- **THEN** system updates only the provided fields and returns `200` with the updated image

#### Scenario: Update non-existent image
- **WHEN** admin sends a non-existent `imageId`
- **THEN** system returns `404` with error code `IMAGE_NOT_FOUND`

---

### Requirement: Admin can hard-delete an image
The system SHALL permanently delete an image record when `DELETE /api/admin/products/:id/images/:imageId` is called. This is a hard-delete and cannot be undone.

#### Scenario: Successful hard-delete
- **WHEN** admin sends `DELETE /api/admin/products/:id/images/:imageId` with a valid id
- **THEN** system permanently deletes the image record and returns `204`

#### Scenario: Delete non-existent image
- **WHEN** admin sends a non-existent `imageId`
- **THEN** system returns `404` with error code `IMAGE_NOT_FOUND`
