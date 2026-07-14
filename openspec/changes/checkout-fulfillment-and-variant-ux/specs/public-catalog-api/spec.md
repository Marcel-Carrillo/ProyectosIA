## MODIFIED Requirements

### Requirement: Public responses never expose supplier or internal data
The system SHALL serialize all `/api/public/...` responses so they NEVER include `supplierId`, `supplierReference`, `supplierCost`, `shippingCostEstimate`, `deletedAt`, or any internal/fulfillment notes. Public product responses SHALL expose only customer-safe fields: product `id`, `name`, `slug`, `description`, `brand`, `mainImageUrl`, `category { id, name, slug }`, `images[]`, and `variants[] { id, sku, size, color, publicPrice, compareAtPrice, status, stockQuantity }`. Only `Active` variants SHALL be included. `stockQuantity` SHALL be the sole basis for any availability signal exposed to customers; the raw `CjCatalogItem` record and any other supplier-internal stock source SHALL NOT be exposed.

#### Scenario: Supplier fields are absent from public responses
- **WHEN** a client receives any `/api/public/products` response
- **THEN** no field named `supplierId`, `supplierReference`, `supplierCost`, `shippingCostEstimate`, `deletedAt`, or internal note is present anywhere in the payload

#### Scenario: Only active variants are exposed
- **WHEN** a product has both active and inactive/out-of-stock variants
- **THEN** the public response includes only the `Active` variants

#### Scenario: Public variant responses include stockQuantity
- **WHEN** a client requests `GET /api/public/products/:id` for a product with variants
- **THEN** each item in `variants[]` includes a `stockQuantity` field with the variant's current supplier-synced stock
