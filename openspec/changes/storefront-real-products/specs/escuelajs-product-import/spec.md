## ADDED Requirements

### Requirement: Import command fetches and persists EscuelaJS products
The system SHALL provide a command `npm run import:products` that fetches products from `GET https://api.escuelajs.co/api/v1/products`, transforms each product into our domain model (`Category`, `Product`, `ProductVariant`, `ProductImage`), and persists them in PostgreSQL. The external EscuelaJS API SHALL only be used at import time and MUST NOT be called by the application at request runtime.

#### Scenario: Successful import populates the catalog
- **WHEN** a developer runs `npm run import:products` with the database available
- **THEN** the command fetches products from the EscuelaJS API, persists them, and prints a summary `{ fetched, imported, skipped }`

#### Scenario: External API failure is reported clearly
- **WHEN** the EscuelaJS API returns a non-OK HTTP status during import
- **THEN** the command fails with a clear error message and a non-zero exit code, leaving the database unchanged for the failed batch

### Requirement: Imported products map to our domain model
The system SHALL map each EscuelaJS product so that the product name, slug, and description come from the source, a `ProductVariant` is created with `sku=EJS-<sourceId>`, `publicPrice=<source price>`, `stockPolicy=SupplierManaged`, and `status=Active`, the EscuelaJS category is upserted as a `Category`, and all source image URLs are stored as `ProductImage` records ordered by their position. Imported products SHALL have `status=Active`.

#### Scenario: Product is created with an active variant and images
- **WHEN** an importable EscuelaJS product is processed
- **THEN** the system persists a `Product` with `status=Active`, one `ProductVariant` with `sku=EJS-<id>`, `stockPolicy=SupplierManaged`, `status=Active`, and one `ProductImage` per source image ordered by `sortOrder`

#### Scenario: Category is upserted from the source
- **WHEN** a product references an EscuelaJS category not yet present in our database
- **THEN** the system creates the corresponding `Category` (and reuses it for subsequent products in the same category)

### Requirement: Import filters out test and invalid data
The system SHALL skip EscuelaJS products that are test fixtures or invalid: products whose title or slug is empty, whose title starts with `test_`, whose slug starts with `test-`, whose category name starts with `test_`, that have no images, or whose price is not a finite number greater than zero.

#### Scenario: Test product is skipped
- **WHEN** a source product has a title starting with `test_` or no images or a price `<= 0`
- **THEN** the importer does not persist it and counts it under `skipped`

### Requirement: Import is idempotent
The system SHALL make re-running the import idempotent: products SHALL be upserted by `slug` and categories by `name`, so running `npm run import:products` multiple times does not create duplicate products, variants, or categories. The number of imported products SHALL be limited by the `ESCUELAJS_IMPORT_LIMIT` environment variable (default 40).

#### Scenario: Re-running the import does not duplicate data
- **WHEN** `npm run import:products` is run a second time over the same source data
- **THEN** existing products are updated in place (matched by `slug`) and no duplicate `Product`, `ProductVariant`, or `Category` rows are created

#### Scenario: Import limit is respected
- **WHEN** `ESCUELAJS_IMPORT_LIMIT` is set to N
- **THEN** the importer processes at most the first N fetched products
