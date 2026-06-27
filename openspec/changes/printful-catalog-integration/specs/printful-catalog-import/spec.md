## ADDED Requirements

### Requirement: Printful client authenticates with Bearer token

The system SHALL authenticate all requests to the Printful REST API using a Bearer token sourced from the `PRINTFUL_API_KEY` environment variable. The API key MUST NOT appear in logs, error messages, or API responses.

#### Scenario: Valid API key present

- **WHEN** `PRINTFUL_API_KEY` is set in the environment
- **THEN** all Printful API requests include `Authorization: Bearer <PRINTFUL_API_KEY>` header

#### Scenario: API key missing at startup

- **WHEN** `PRINTFUL_API_KEY` is not set in a non-test environment
- **THEN** the application startup SHALL fail with a descriptive error naming the missing variable

---

### Requirement: Importer fetches sync products with pagination

The system SHALL fetch all sync products from `GET /sync/products` using offset-based pagination, respecting Printful's rate limit of approximately 120 requests per minute. When `PRINTFUL_IMPORT_LIMIT` is set, the importer SHALL stop after that many products.

#### Scenario: Catalog with multiple pages

- **WHEN** the Printful store has more products than the page size
- **THEN** the importer SHALL fetch all pages sequentially until no more results are returned

#### Scenario: Import limit applied

- **WHEN** `PRINTFUL_IMPORT_LIMIT=10` is set
- **THEN** the importer SHALL process at most 10 sync products regardless of catalog size

#### Scenario: Rate limit response (429)

- **WHEN** Printful returns HTTP 429
- **THEN** the importer SHALL wait with exponential backoff and retry the request

---

### Requirement: Importer fetches sync variant detail per product

For each sync product, the system SHALL call `GET /sync/products/{id}` to retrieve `sync_variants` with `retail_price`, `sync_variant_id`, `variant_id`, and variant options (size, color). Products without at least one importable sync variant SHALL be skipped and counted as `skipped`.

#### Scenario: Product with valid variants

- **WHEN** a sync product has one or more sync variants with non-zero `retail_price`
- **THEN** the importer SHALL create one `ProductVariant` per sync variant

#### Scenario: Product with no valid variants

- **WHEN** a sync product has no sync variants or all have zero/missing price
- **THEN** the importer SHALL skip the product and increment the `skipped` counter

---

### Requirement: Mapper applies price markup

The system SHALL set `ProductVariant.publicPrice = retail_price × PRINTFUL_PRICE_MARKUP`. The `supplierCost` SHALL be stored as `retail_price` (Printful's cost to the store). `publicPrice` and `supplierCost` are always different fields. `supplierCost` MUST NOT be exposed through customer-facing APIs.

#### Scenario: Markup applied at import

- **WHEN** a sync variant has `retail_price = 15.00` and `PRINTFUL_PRICE_MARKUP = 1.6`
- **THEN** `ProductVariant.publicPrice = 24.00` and `ProductVariant.supplierCost = 15.00`

#### Scenario: Default markup used when env var absent

- **WHEN** `PRINTFUL_PRICE_MARKUP` is not set
- **THEN** the importer SHALL apply a default markup (e.g., 1.6) and log the assumption

---

### Requirement: Mapper sets variant identity fields

The system SHALL assign:
- `sku = "PF-{sync_variant_id}"` (unique, stable, collision-free with EJS SKUs)
- `supplierReference = sync_variant_id` (string representation)
- `stockPolicy = "SupplierManaged"`
- `status = "Active"`
- `size` and `color` derived from the variant's `options` array (by `type: "size"` / `type: "color"`)

#### Scenario: Variant with size and color options

- **WHEN** a sync variant has options `[{type: "size", value: "M"}, {type: "color", value: "Black"}]`
- **THEN** `ProductVariant.size = "M"` and `ProductVariant.color = "Black"`

#### Scenario: Variant with missing color option

- **WHEN** a sync variant has no color option
- **THEN** `ProductVariant.color = null`

---

### Requirement: Importer upserts Supplier "Printful" idempotently

The system SHALL ensure exactly one `Supplier` record exists with `name = "Printful"` before importing any products. If the record already exists, it SHALL be updated (not duplicated). All imported `ProductVariant` records SHALL reference this supplier via `supplierId`.

#### Scenario: First import run

- **WHEN** no Supplier named "Printful" exists
- **THEN** the importer SHALL create one with `status = "Active"` and `website = "https://www.printful.com"`

#### Scenario: Subsequent import run

- **WHEN** a Supplier named "Printful" already exists
- **THEN** the importer SHALL update it (upsert) without creating a duplicate

---

### Requirement: Importer upserts products idempotently by slug

The system SHALL upsert `Product` records using `slug` as the unique key. If a product with the same slug already exists, it SHALL be updated in place (name, description, images, variants replaced). Running the importer twice SHALL NOT create duplicate products.

#### Scenario: New product slug

- **WHEN** no Product with the derived slug exists
- **THEN** the importer SHALL create the Product with its variants and images

#### Scenario: Existing product slug

- **WHEN** a Product with the same slug already exists
- **THEN** the importer SHALL update the product and replace its variants and images

---

### Requirement: Importer upserts Category by name

The system SHALL upsert `Category` records using the Printful product type as the category name. Category `imageUrl` and `status = "Active"` SHALL be set on create or update.

#### Scenario: Category already exists

- **WHEN** a Category with the same name exists
- **THEN** the importer SHALL update `imageUrl` and `status` without duplicating

---

### Requirement: Importer reports results

The system SHALL return and log a result object `{ fetched: number, imported: number, skipped: number }` at the end of each import run.

#### Scenario: Successful import run

- **WHEN** the import completes
- **THEN** the result object is logged with structured fields: `fetched`, `imported`, `skipped`

#### Scenario: Skipped product logged

- **WHEN** a product is skipped (no valid variants, missing required fields)
- **THEN** the skip reason is logged at `info` level with the product id

---

### Requirement: Import is gated by PRINTFUL_IMPORT env var

The system SHALL only execute the Printful catalog import when `PRINTFUL_IMPORT=true` is set, mirroring the existing `ESCUELAJS_IMPORT` gate. Running `seed.ts` without this flag SHALL NOT trigger any Printful API calls.

#### Scenario: Import gate disabled

- **WHEN** `PRINTFUL_IMPORT` is not set or is not `"true"`
- **THEN** the seed/import script SHALL skip Printful import and log a message

#### Scenario: Import gate enabled

- **WHEN** `PRINTFUL_IMPORT=true`
- **THEN** the importer SHALL run and process sync products
