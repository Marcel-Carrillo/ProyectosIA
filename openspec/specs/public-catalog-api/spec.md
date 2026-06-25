# Public Catalog API

## Purpose

Defines the customer-facing read-only catalog API (`/api/public/...`): product listing, product detail, and categories. Responses always restrict to `Active` data and never expose supplier or internal fields. Admin routes remain separate and unchanged.

## Requirements

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

### Requirement: Accept-Language parameter on public product endpoints
`GET /api/public/products` and `GET /api/public/products/:id` SHALL accept an optional `Accept-Language` header. The header value SHALL be normalized (strip region tag, default to `en` for unsupported locales). Supported values are `es` and `en`. Both endpoints SHALL return a `Vary: Accept-Language` response header so HTTP caches key responses per language.

#### Scenario: Valid Accept-Language header processed
- **WHEN** the header `Accept-Language: es` is sent
- **THEN** the server SHALL resolve Spanish translations and respond with `Vary: Accept-Language`

#### Scenario: Missing Accept-Language defaults to English
- **WHEN** no `Accept-Language` header is sent
- **THEN** the server SHALL resolve English content and respond with `Vary: Accept-Language`

#### Scenario: Unsupported locale defaults to English
- **WHEN** `Accept-Language: de` is sent
- **THEN** the server SHALL resolve English content without error

### Requirement: Admin product create accepts translations payload
`POST /api/admin/products` SHALL accept an optional `translations` array in the request body. Each item SHALL have `locale` (one of `en`, `es`), `name` (string, max 150 chars, required), and `description` (string, max 2000 chars, optional). Invalid locales or oversized fields SHALL return HTTP 422 with a descriptive error.

#### Scenario: Create product with ES and EN translations
- **WHEN** an admin posts a new product with a `translations` array containing `es` and `en` entries
- **THEN** the system SHALL persist the product and both translation rows and return 201

#### Scenario: Invalid locale rejected
- **WHEN** an admin posts a `translations` array with `locale: "fr"`
- **THEN** the system SHALL return HTTP 422 with error code `TRANSLATION_LOCALE_INVALID`

### Requirement: Admin product update accepts translations payload
`PATCH /api/admin/products/:id` SHALL accept an optional `translations` array following the same schema as the create endpoint. Provided translations SHALL be upserted by `(productId, locale)`; omitted locales SHALL be left unchanged.

#### Scenario: Partial translation update
- **WHEN** an admin patches a product with only an `es` translation
- **THEN** the system SHALL upsert the `es` row and leave any existing `en` row unchanged

### Requirement: Admin product read responses include translations array
`GET /api/admin/products` and `GET /api/admin/products/:id` SHALL include a `translations` array in the response body. Each item SHALL include `locale`, `name`, `description`, and `source`. This allows admin forms to pre-populate all locale fields.

#### Scenario: Admin reads product with translations
- **WHEN** an admin fetches a product that has `en` and `es` translations
- **THEN** the response SHALL include a `translations` array with both rows

### Requirement: Dedicated translation sub-routes on admin products
The admin API SHALL expose the following sub-routes:
- `GET /api/admin/products/:id/translations` — returns all translations for the product.
- `PUT /api/admin/products/:id/translations/:locale` — upserts the translation for `locale`.
- `DELETE /api/admin/products/:id/translations/:locale` — deletes the translation for `locale`.

`locale` must be `en` or `es`; other values return HTTP 422.

#### Scenario: Upsert a single locale translation
- **WHEN** `PUT /api/admin/products/5/translations/es` is called with a valid body
- **THEN** the system SHALL upsert the `es` translation for product 5 and return 200

#### Scenario: Delete a locale translation
- **WHEN** `DELETE /api/admin/products/5/translations/es` is called
- **THEN** the system SHALL delete the `es` translation row and return 204

#### Scenario: Delete non-existent translation returns 404
- **WHEN** `DELETE /api/admin/products/5/translations/es` is called but no `es` row exists
- **THEN** the system SHALL return HTTP 404
