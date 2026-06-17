## ADDED Requirements

### Requirement: Storefront catalog reads only the public API
The storefront SHALL obtain all catalog data exclusively from our own public API (`/api/public/...`). The product service SHALL read from `GET /api/public/products` (and `/api/public/products/:slug` for detail) and the category service SHALL read from `GET /api/public/categories`. The storefront MUST NOT call the EscuelaJS external API (`api.escuelajs.co`) at runtime, and SHALL NOT depend on `/api/admin/...` routes for customer-facing data.

#### Scenario: Catalog page loads products from the public API
- **WHEN** a user opens `/catalog` with the backend and database running
- **THEN** the page fetches products from `/api/public/products` and renders the real imported products with category filtering, search, and sorting working against our own API

#### Scenario: No external or admin calls at runtime
- **WHEN** the storefront is used in the browser
- **THEN** no network request is made to `api.escuelajs.co`, and customer-facing catalog data is not fetched from `/api/admin/...`
