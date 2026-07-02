# Supplier Feed Sample Import

## Purpose

Defines the dev-only `npm run import:supplier-feed` command (run from `backend/`), which loads a supplier-feed-shaped fixture (`backend/prisma/fixtures/supplier-feed.sample.json`) into the local catalog without images, so developers can exercise the "Draft product pending completion" admin workflow against realistic supplier data. The command cleans existing catalog and order history before loading the fixture, keeps supplier cost/reference data internal-only, and is hard-blocked outside local development.

## Requirements

### Requirement: Dev command loads a supplier-feed-shaped sample without images
The system SHALL provide a command `npm run import:supplier-feed` (run from `backend/`) that reads a local fixture file (`backend/prisma/fixtures/supplier-feed.sample.json`) shaped like a supplier catalog API response, and persists it into `Supplier`, `Category`, `Product`, and `ProductVariant` records. The command MUST NOT create any `ProductImage` records, even when the fixture contains an `images` field, and MUST NOT require the source product to have images to be importable (unlike the EscuelaJS importer's `isImportableEscuelaJsProduct` guard).

#### Scenario: Successful load populates the catalog without images
- **WHEN** a developer runs `npm run import:supplier-feed` with the local database available
- **THEN** the command reads the fixture, persists `Supplier`, `Category`, `Product`, and `ProductVariant` records, creates zero `ProductImage` records, and prints a summary `{ suppliersUpserted, categoriesUpserted, productsCreated, variantsCreated, imagesCreated: 0 }`

#### Scenario: Fixture is malformed
- **WHEN** the fixture file is missing or fails JSON/schema validation
- **THEN** the command fails with a clear error message and a non-zero exit code, leaving the database unchanged

### Requirement: Imported products are created in Draft status pending completion
The system SHALL map each fixture product to a `Product` with `status=Draft` and `mainImageUrl=null`, and at least one `ProductVariant` with `stockPolicy=SupplierManaged` and `status=Active`, so that the product is visible in the admin panel as incomplete (per `PRODUCT_REQUIRES_ACTIVE_VARIANT`, it cannot become `Active` until an operator completes it, which for imported products means adding at least one image and reviewing pricing before activating).

#### Scenario: Imported product requires admin completion before activation
- **WHEN** a fixture product is imported
- **THEN** the system persists a `Product` with `status=Draft`, `mainImageUrl=null`, one or more `ProductVariant` rows with `status=Active`, and the product remains `Draft` until an administrator explicitly activates it through the existing admin product flow

#### Scenario: Category is upserted from the fixture
- **WHEN** a fixture product references a category not yet present in the database
- **THEN** the system creates the corresponding `Category` by name and reuses it for subsequent fixture products in the same category

### Requirement: Supplier cost and reference are stored as internal-only fields
The system SHALL map the fixture's supplier metadata (`supplierCost`, and a supplier reference such as `externalRef`) onto the `ProductVariant` fields `supplierId`, `supplierReference`, and `supplierCost`, upserting the referenced `Supplier` by name. These fields SHALL remain internal-only and MUST NOT be exposed by any `/api/public/*` or `/api/admin/*` response, per the existing `variantSelect` protection.

#### Scenario: Supplier is upserted from the fixture
- **WHEN** a fixture product references a supplier name not yet present in the database
- **THEN** the system creates the corresponding `Supplier` with `status=Active` and reuses it for subsequent fixture products from the same supplier

#### Scenario: Supplier fields never leak through the API
- **WHEN** an imported variant is fetched through any public or admin API endpoint
- **THEN** the response does not include `supplierId`, `supplierReference`, or `supplierCost`

### Requirement: Command cleans the local catalog and order history before loading the fixture
The system SHALL, before loading the fixture, delete existing `StripeWebhookEvent`, `CouponRedemption`, `Refund`, `ReturnRequest`, `Shipment`, `SupplierOrderItem`, `SupplierOrder`, `CustomerOrderItem`, `CustomerOrder`, `WishlistItem`, `ProductImage`, `ProductVariant`, and `Product` rows from the local database (in that FK-safe order), while preserving `Category`, `Supplier`, `AdminUser`, `Customer`/`CustomerAccount`, and `Coupon` definitions. This clean step SHALL run as part of `npm run import:supplier-feed` so each run starts from a known, repeatable baseline, even when the local database already has order/shipment/return/refund/wishlist history referencing existing product variants.

#### Scenario: Clean step removes catalog and order data but preserves accounts and coupon definitions
- **WHEN** `npm run import:supplier-feed` runs against a local database that already contains products, variants, images, customer orders referencing those variants, an admin user, customer accounts, and coupon definitions
- **THEN** all `Product`, `ProductVariant`, `ProductImage`, `CustomerOrder` (and its items), `SupplierOrder` (and its items), `Shipment`, `ReturnRequest`, `Refund`, `WishlistItem`, `CouponRedemption`, and `StripeWebhookEvent` rows are removed before the fixture is loaded, with no foreign-key violation, while the admin user, customer accounts, and coupon definitions remain unchanged

### Requirement: Command is hard-blocked outside local development
The system SHALL refuse to run the clean-and-load command unless `NODE_ENV !== 'production'` AND the resolved `DATABASE_URL` host is a local/dev host (e.g. `localhost`, `127.0.0.1`, or the Docker Compose service name). The command SHALL exit with a non-zero code and a clear error message when either condition is not met, and SHALL NOT delete or modify any data in that case.

#### Scenario: Command refuses to run against a non-local database
- **WHEN** `DATABASE_URL` points at a host that is not `localhost`, `127.0.0.1`, or the local Docker Compose database service
- **THEN** the command exits with a non-zero code, prints a clear error, and makes no changes to the database

#### Scenario: Command refuses to run when NODE_ENV is production
- **WHEN** `NODE_ENV=production`
- **THEN** the command exits with a non-zero code, prints a clear error, and makes no changes to the database
