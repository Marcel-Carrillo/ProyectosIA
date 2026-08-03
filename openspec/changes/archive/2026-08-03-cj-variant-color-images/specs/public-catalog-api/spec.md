## ADDED Requirements

### Requirement: Public product images include their color association
Each item in a public product response's `images[]` array SHALL include a `color` field (`string | null`). `color = null` indicates a shared/product-level image that applies regardless of the selected variant; a non-null value indicates the image depicts that specific color, using the same value vocabulary as the corresponding variant's `color` field.

#### Scenario: Image color is included in the product detail response
- **WHEN** a client requests `GET /api/public/products/:id` for a product with color-associated images
- **THEN** each item in the `images[]` array includes its `color` field, with `null` for shared/product-level images
