## MODIFIED Requirements

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
