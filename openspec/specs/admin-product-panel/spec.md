# Admin Product Panel

## Purpose

Defines the frontend admin product management panel: list with filters/search/pagination/sorting, create/edit forms, status-lifecycle controls with business-rule guards, variant and image management, all backed by a dedicated `adminProductService` against `/api/admin/products` that never leaks supplier data into customer-facing surfaces.

## Requirements

### Requirement: Admin can list products with filters, search, pagination and sorting
The admin product panel SHALL list products from `GET /api/admin/products`, supporting filtering by `status` and `categoryId`, free-text `search` (debounced), pagination (`page`, `pageSize`), and sorting by `name` or `createdAt` (`asc`/`desc`). Each row SHALL show the thumbnail (`mainImageUrl`), `name`, `slug`, a status badge, and category, with row actions to edit and to soft-delete. Active filters SHALL be reflected in the URL query string so the view is shareable and survives reload.

#### Scenario: List renders products from the admin API
- **WHEN** an admin opens the products panel
- **THEN** the system fetches `GET /api/admin/products` and renders the returned `items` in a table with status badges and pagination derived from `total`/`pageSize`

#### Scenario: Filtering and search
- **WHEN** the admin selects a status, picks a category, or types a search term
- **THEN** the list re-queries `/api/admin/products` with the matching `status`/`categoryId`/`search` params, resets to page 1, and updates the URL query string

#### Scenario: Empty result
- **WHEN** no products match the current filters
- **THEN** the panel shows an empty-state message instead of an empty table

#### Scenario: Load error
- **WHEN** the admin API request fails
- **THEN** the panel shows an error message and does not crash

### Requirement: Admin can create and edit products
The admin panel SHALL allow creating a product (`POST /api/admin/products`) and editing an existing one (`PATCH /api/admin/products/:id`) through a form for `name`, `description`, `brand`, `categoryId`, and `mainImageUrl`. The `slug` SHALL be displayed read-only because the backend auto-generates it. On success the panel SHALL show confirmation and reflect the change; on validation failure it SHALL show the error without losing the entered data.

#### Scenario: Create a product
- **WHEN** the admin submits the new-product form with a valid `name`
- **THEN** the panel calls `POST /api/admin/products`, receives `201`, and shows the created product (status defaults to `Draft`)

#### Scenario: Edit a product
- **WHEN** the admin saves changes on the detail screen
- **THEN** the panel calls `PATCH /api/admin/products/:id` and shows the updated values on success

#### Scenario: Validation error on missing name
- **WHEN** the admin submits without a `name`
- **THEN** the panel shows the `400` validation error inline and keeps the form populated

### Requirement: Admin can manage the product status lifecycle with business-rule guards
The admin panel SHALL let an admin move a product through the status lifecycle (Draft → Active → Inactive/Archived) and SHALL translate the backend business-rule errors into actionable messages. The "Activate" action SHALL be proactively disabled when the product has no `Active` variant, and the panel SHALL still handle the corresponding `422` as a safety net.

#### Scenario: Cannot activate without an active variant
- **WHEN** the admin tries to activate a product that has no `Active` variant
- **THEN** the "Activate" action is disabled, and if attempted the `422 PRODUCT_REQUIRES_ACTIVE_VARIANT` is shown as "requires at least one active variant"

#### Scenario: Cannot reactivate an archived product
- **WHEN** the admin tries to change the status of an `Archived` product
- **THEN** the panel shows the `422 PRODUCT_ARCHIVED_CANNOT_REACTIVATE` message

#### Scenario: Slug conflict surfaced
- **WHEN** creating/editing returns `409 PRODUCT_SLUG_CONFLICT`
- **THEN** the panel shows a message asking the admin to adjust the name

#### Scenario: Product no longer exists
- **WHEN** an action returns `404 PRODUCT_NOT_FOUND`
- **THEN** the panel shows a "product no longer exists" message and returns to the list

### Requirement: Admin can manage product variants
The admin panel SHALL provide CRUD for `ProductVariant` (the sellable unit) under a product, editing `sku`, `size`, `color`, `publicPrice`, `compareAtPrice`, `stockPolicy`, and `status`, via the nested `/api/admin/products/:id/variants` endpoints.

#### Scenario: Add an active variant
- **WHEN** the admin adds a variant with `status=Active`
- **THEN** the panel calls `POST /api/admin/products/:id/variants`, shows the new variant, and the product becomes eligible for activation

#### Scenario: Edit and delete variants
- **WHEN** the admin edits or deletes a variant
- **THEN** the panel calls the matching `PATCH`/`DELETE` nested endpoint and reflects the result

### Requirement: Admin can manage product images
The admin panel SHALL provide CRUD for `ProductImage` (`url`, `altText`, `sortOrder`) via `/api/admin/products/:id/images`, allow reordering by `sortOrder`, and allow selecting which image is the product's main image (`mainImageUrl`).

#### Scenario: Add, reorder and remove images
- **WHEN** the admin adds an image, changes its `sortOrder`, or removes it
- **THEN** the panel calls the matching nested image endpoint and the gallery reflects the new order

### Requirement: Admin panel uses a dedicated admin service and never leaks supplier data
The admin panel SHALL use a dedicated `adminProductService` targeting `/api/admin/products` and SHALL NOT modify or reuse the public storefront `productService` (which targets `/api/public/products`). The panel SHALL only render fields returned by the admin API; it MUST NOT introduce any path that exposes supplier cost or internal supplier data to customer-facing surfaces.

#### Scenario: Public storefront stays intact
- **WHEN** the admin panel is added
- **THEN** the storefront `productService` and storefront pages remain unchanged and keep reading `/api/public/products`

#### Scenario: No supplier data in the panel
- **WHEN** the admin panel renders products and variants
- **THEN** it displays only fields present in the admin API response (which today excludes `supplierId`, `supplierReference`, `supplierCost`)
