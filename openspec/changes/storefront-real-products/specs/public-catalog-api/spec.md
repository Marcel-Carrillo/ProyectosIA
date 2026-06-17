## ADDED Requirements

### Requirement: Public product listing endpoint
The system SHALL expose `GET /api/public/products` for customer-facing clients. The endpoint SHALL accept the query parameters `categoryId`, `search`, `page`, `pageSize`, `sort` (`name` or `createdAt`), and `order` (`asc` or `desc`). The endpoint SHALL always restrict results to products with `status=Active` (ignoring any client-supplied status), and SHALL return results paginated in the standard response envelope `{ success, data, message }` where `data` contains `{ items, total, page, pageSize }`.

#### Scenario: Listing returns only active products
- **WHEN** a client requests `GET /api/public/products`
- **THEN** the system returns `200` with only `Active` products in the paginated envelope, regardless of any `status` query parameter sent by the client

#### Scenario: Filtering, search, and sorting
- **WHEN** a client requests `GET /api/public/products?categoryId=3&search=dress&sort=name&order=asc&page=1&pageSize=20`
- **THEN** the system returns active products in category 3 matching the search term, sorted by name ascending, paginated

#### Scenario: Pagination size is bounded
- **WHEN** a client requests a `pageSize` greater than the allowed maximum (100)
- **THEN** the system clamps the page size to the maximum instead of returning an unbounded result set

### Requirement: Public product detail endpoint
The system SHALL expose `GET /api/public/products/:id` (numeric product id) returning a single active product with its active variants and its images ordered by `sortOrder`, in the standard response envelope. Requesting a non-existent or non-active product SHALL return `404`, and a non-numeric id SHALL return `400`.

#### Scenario: Detail of an active product
- **WHEN** a client requests `GET /api/public/products/:id` for an existing active product
- **THEN** the system returns `200` with the product, its active variants, and ordered images

#### Scenario: Detail of a missing product
- **WHEN** a client requests `GET /api/public/products/:id` for an id that does not exist or is not active
- **THEN** the system returns `404`

### Requirement: Public responses never expose supplier or internal data
The system SHALL serialize all `/api/public/...` responses so they NEVER include `supplierId`, `supplierReference`, `supplierCost`, `deletedAt`, or any internal/fulfillment notes. Public product responses SHALL expose only customer-safe fields: product `id`, `name`, `slug`, `description`, `brand`, `mainImageUrl`, `category { id, name, slug }`, `images[]`, and `variants[] { id, sku, size, color, publicPrice, compareAtPrice, status }`. Only `Active` variants SHALL be included.

#### Scenario: Supplier fields are absent from public responses
- **WHEN** a client receives any `/api/public/products` response
- **THEN** no field named `supplierId`, `supplierReference`, `supplierCost`, `deletedAt`, or internal note is present anywhere in the payload

#### Scenario: Only active variants are exposed
- **WHEN** a product has both active and inactive/out-of-stock variants
- **THEN** the public response includes only the `Active` variants

### Requirement: Public categories endpoint
The system SHALL expose `GET /api/public/categories` returning the categories available to the storefront in the standard response envelope, without exposing any internal or supplier-related data.

#### Scenario: Listing categories for the storefront
- **WHEN** a client requests `GET /api/public/categories`
- **THEN** the system returns `200` with the list of categories in the standard envelope

### Requirement: Admin routes remain separate from public routes
The system SHALL keep `/api/admin/...` routes unchanged and independent from the new `/api/public/...` routes, preserving the separation between backoffice and customer-facing surfaces.

#### Scenario: Admin endpoints are unaffected
- **WHEN** the public catalog API is added
- **THEN** existing `/api/admin/products` endpoints continue to behave as before
