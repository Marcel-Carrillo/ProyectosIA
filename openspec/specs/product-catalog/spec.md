# Product Catalog

## Purpose

Defines the public storefront catalog page (`/catalog`): a responsive product grid with category filtering, text search, sorting, pagination, and loading/empty/error states. Only `Active` products are shown.

## Requirements

### Requirement: Catalog page displays a responsive product grid
The system SHALL render a `/catalog` page that shows a grid of product cards. The grid SHALL be responsive: 1 column on mobile (≤576px), 2 columns on tablet (577–991px), 3 columns on large screens (992–1279px), and 4 columns on desktop (≥1280px). Only products with `status = Active` SHALL be shown.

#### Scenario: Catalog renders a grid of active products
- **WHEN** a user visits `/catalog`
- **THEN** the page fetches products with `status=Active` and renders them in a responsive grid

#### Scenario: Grid adapts to viewport
- **WHEN** the viewport is mobile width (≤576px)
- **THEN** product cards stack in a single column

#### Scenario: Grid adapts to desktop viewport
- **WHEN** the viewport is desktop width (≥1280px)
- **THEN** product cards are displayed 4 per row

---

### Requirement: Product card displays image, name, brand, and pricing
Each product card in the grid SHALL display: the product's main image (using `mainImageUrl` or the first image in `images[]`), the product name, the brand, and the lowest variant `publicPrice`. If any variant has a `compareAtPrice` higher than `publicPrice`, the `compareAtPrice` SHALL be shown with a strikethrough alongside the `publicPrice`.

#### Scenario: Card shows product image, name and price
- **WHEN** a product card is rendered for a product with at least one variant
- **THEN** the card displays the product image (or a placeholder if none), the product name, the brand name, and the lowest public price

#### Scenario: Card shows compare-at price when present
- **WHEN** a product has a variant with `compareAtPrice > publicPrice`
- **THEN** the card shows both prices: `compareAtPrice` crossed out and `publicPrice` highlighted

#### Scenario: Card shows a placeholder image when no image is available
- **WHEN** a product has no `mainImageUrl` and no images in `images[]`
- **THEN** the card renders a neutral placeholder silhouette image without breaking layout

#### Scenario: Clicking a product card navigates to the product detail page
- **WHEN** a user clicks on a product card
- **THEN** the browser navigates to `/products/:slug` for that product

---

### Requirement: Catalog supports filtering by category
The catalog page SHALL allow filtering products by category via a `categoryId` query parameter. When a `categoryId` is present in the URL, only products belonging to that category SHALL be displayed. Removing the filter shows all active products.

#### Scenario: Category filter is applied from URL param
- **WHEN** the user visits `/catalog?categoryId=3`
- **THEN** the page fetches products with `categoryId=3&status=Active` and renders only those products

#### Scenario: No category filter shows all active products
- **WHEN** the user visits `/catalog` without a `categoryId` param
- **THEN** the page fetches all active products across all categories

#### Scenario: Category filter highlights active category in nav
- **WHEN** the catalog page is loaded with `?categoryId=<id>`
- **THEN** the corresponding category link in the storefront header nav is visually highlighted as active

---

### Requirement: Catalog supports text search by product name
The catalog page SHALL provide a text search input. When the user submits a search term, the page fetches products whose name contains the term (case-insensitive) by passing `search=<term>` to `GET /products`. The search term SHALL be persisted in the URL as a `search` query parameter.

#### Scenario: Submitting a search term filters products
- **WHEN** the user types "dress" in the search input and submits
- **THEN** the page navigates to `/catalog?search=dress` and displays only products whose name contains "dress"

#### Scenario: Clearing the search shows all active products
- **WHEN** the user clears the search input and submits an empty term
- **THEN** the `search` param is removed from the URL and all active products are shown

#### Scenario: Search term is preserved on page reload
- **WHEN** the user reloads the page at `/catalog?search=dress`
- **THEN** the search input shows "dress" and the filtered products are displayed

---

### Requirement: Catalog supports sorting products
The catalog page SHALL provide a sort control allowing the user to sort products by: name (A–Z), name (Z–A), newest first (`createdAt` descending), and oldest first (`createdAt` ascending). The selected sort order SHALL be persisted in the URL as `sort` and `order` query parameters.

#### Scenario: Sorting by name A–Z
- **WHEN** the user selects "Name A–Z" from the sort control
- **THEN** the URL updates to include `sort=name&order=asc` and products are re-fetched in that order

#### Scenario: Sorting by newest first
- **WHEN** the user selects "Newest" from the sort control
- **THEN** the URL updates to include `sort=createdAt&order=desc` and products are re-fetched in that order

---

### Requirement: Catalog paginates results
The catalog page SHALL display products in pages of 20 items. Pagination controls SHALL allow navigating to previous/next pages and to specific page numbers. The current page SHALL be persisted in the URL as a `page` query parameter. Changing any filter or sort SHALL reset to page 1.

#### Scenario: Default page size is 20
- **WHEN** the user visits `/catalog` with no `page` param
- **THEN** the first page of up to 20 active products is fetched (`page=1&limit=20`)

#### Scenario: Navigating to the next page
- **WHEN** the user clicks "Next" on the pagination control
- **THEN** the URL updates to `page=2` and the next 20 products are fetched

#### Scenario: Changing a filter resets to page 1
- **WHEN** the user changes the category filter while on page 3
- **THEN** the URL updates with the new `categoryId` and resets `page` to 1

#### Scenario: Pagination is not shown when results fit in one page
- **WHEN** fewer than 20 products match the current filter
- **THEN** pagination controls are not rendered

---

### Requirement: Catalog displays loading, empty, and error states
The catalog page SHALL display a loading state while products are being fetched. If no products match the current filters, an empty-state message SHALL be shown. If the API call fails, a user-friendly error message SHALL be displayed.

#### Scenario: Loading state is shown during fetch
- **WHEN** the catalog page is loading products
- **THEN** loading skeletons or a spinner is displayed in the grid area

#### Scenario: Empty state is shown when no products match
- **WHEN** the API returns an empty product list for the current filters
- **THEN** a message such as "No products found" is displayed and the grid is empty

#### Scenario: Error state is shown on API failure
- **WHEN** the `GET /products` API call fails
- **THEN** a user-friendly error message is displayed and the page does not crash

---

### Requirement: Public product list is locale-aware
The `GET /api/public/products` endpoint SHALL accept an `Accept-Language` request header. It SHALL resolve each product's `name` and `description` using the locale resolution helper (requested locale → `en` translation → `Product` fields). Translations SHALL be loaded via a single eager Prisma `include` — no per-row additional queries. The response SHALL include a `Vary: Accept-Language` header. The public DTO shape (`name`, `description` as plain strings) remains unchanged. Supplier fields (`supplierId`, `supplierReference`, `supplierCost`) SHALL remain excluded from all public responses.

#### Scenario: Spanish catalog list
- **WHEN** a client sends `GET /api/public/products` with `Accept-Language: es`
- **THEN** the response SHALL contain each product's `name` and `description` in Spanish (or English fallback) and include `Vary: Accept-Language`

#### Scenario: English catalog list (default)
- **WHEN** a client sends `GET /api/public/products` with no `Accept-Language` header
- **THEN** the response SHALL resolve to English and include `Vary: Accept-Language`

#### Scenario: No N+1 on product list
- **WHEN** the endpoint fetches a list of products
- **THEN** translations SHALL be loaded in the same query via `include`, not via per-product additional queries

#### Scenario: Supplier fields excluded from localized response
- **WHEN** a client requests the product list in any locale
- **THEN** the response SHALL NOT include `supplierId`, `supplierReference`, `supplierCost`, or any other internal/supplier field

### Requirement: Public product detail is locale-aware
The `GET /api/public/products/:id` endpoint SHALL behave identically to the list endpoint with respect to locale resolution, the `Vary` header, eager loading, and supplier field exclusion.

#### Scenario: Spanish product detail
- **WHEN** a client sends `GET /api/public/products/:id` with `Accept-Language: es`
- **THEN** the response SHALL contain the Spanish name and description (or English fallback) and include `Vary: Accept-Language`

#### Scenario: Fallback on missing ES translation in detail
- **WHEN** a client requests a product detail in `es` but no `es` translation exists
- **THEN** the response SHALL return the English name and description without error

### Requirement: Localized search limitation is documented
Public product search SHALL continue to match `Product.name` (English) only. Localized search is out of scope for this change. This limitation SHALL be documented in `docs/api-spec.yml` and in `docs/development_guide.md`.

#### Scenario: Search with ES locale returns EN-matched results
- **WHEN** a client searches with `Accept-Language: es` and a Spanish keyword
- **THEN** the system SHALL match against the English `Product.name` only and return results (which may be empty if the EN name does not contain the keyword)
