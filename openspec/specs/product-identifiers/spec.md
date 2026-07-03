## Purpose

Products may carry an optional international trade item identifier (GTIN/EAN/UPC) so that Merchant/Search structured data can identify listings unambiguously. The identifier is modeled at the `Product` level, is never fabricated by the system, is public catalog data (not subject to supplier-data exposure restrictions), and can optionally be populated automatically from supplier feed imports when the source provides a valid value.

## Requirements

### Requirement: Product may have an optional GTIN
The `Product` entity SHALL support an optional `gtin` field (`string | null`) representing an international trade item identifier (GTIN/EAN/UPC). The field is not required for a product to be created, updated, or published.

#### Scenario: Product created without a GTIN
- **WHEN** an administrator creates a product without providing a `gtin`
- **THEN** the product SHALL be created successfully with `gtin` stored as `null`

#### Scenario: Product created with a valid GTIN
- **WHEN** an administrator creates a product with `gtin` set to a 13-digit numeric string
- **THEN** the product SHALL be created successfully with `gtin` stored exactly as provided, preserving any leading zeros

### Requirement: GTIN format validation
The system SHALL validate `gtin` when provided as a non-empty value: it MUST contain only digits and its length MUST be 8, 12, 13, or 14 characters. An empty string SHALL be normalized to `null` rather than treated as an invalid value.

#### Scenario: GTIN with invalid characters is rejected
- **WHEN** an administrator submits `gtin` containing non-digit characters (e.g. `"12345ABC9012"`)
- **THEN** the system SHALL reject the request with a validation error and SHALL NOT persist the product/update

#### Scenario: GTIN with invalid length is rejected
- **WHEN** an administrator submits a numeric `gtin` with a length other than 8, 12, 13, or 14 digits
- **THEN** the system SHALL reject the request with a validation error

#### Scenario: Empty GTIN string normalizes to null
- **WHEN** an administrator submits `gtin` as an empty string
- **THEN** the system SHALL store `gtin` as `null` rather than rejecting the request

### Requirement: Public API exposes GTIN
The public product API (`PublicProduct`) SHALL include the `gtin` field (nullable) for every product, using the same value stored on the `Product` entity. GTIN is public catalog data and is not subject to supplier-data exposure restrictions.

#### Scenario: Public API returns GTIN when present
- **WHEN** a customer-facing client requests a product that has a non-null `gtin`
- **THEN** the public API response SHALL include that `gtin` value

#### Scenario: Public API returns null GTIN when absent
- **WHEN** a customer-facing client requests a product that has no `gtin`
- **THEN** the public API response SHALL include `gtin: null`

### Requirement: Supplier feed import maps GTIN when available
When importing products from a supplier feed, the system SHALL map a source EAN/barcode field to `gtin` if present and valid according to the GTIN format rule. If the source field is absent or fails validation, the system SHALL set `gtin` to `null` and SHALL NOT fail the import for that reason alone. The system SHALL NOT fabricate a GTIN value when the source does not provide one.

#### Scenario: Supplier feed product with a valid EAN maps to GTIN
- **WHEN** a supplier feed entry includes a valid 13-digit EAN/barcode field
- **THEN** the imported product SHALL have `gtin` set to that value

#### Scenario: Supplier feed product without an EAN maps to null GTIN
- **WHEN** a supplier feed entry has no EAN/barcode field
- **THEN** the imported product SHALL have `gtin` set to `null`, and the import SHALL succeed

#### Scenario: Supplier feed product with an invalid EAN maps to null GTIN
- **WHEN** a supplier feed entry includes an EAN/barcode field that fails GTIN format validation
- **THEN** the imported product SHALL have `gtin` set to `null` rather than the invalid value, and the import SHALL succeed

### Requirement: Storefront structured data emits GTIN when present
The storefront product detail page SHALL include the product's GTIN in its `Product` JSON-LD structured data when `gtin` is non-null, using the `gtin13` property for 13-digit values and the generic `gtin` property for other valid lengths (8, 12, 14). When `gtin` is `null`, the structured data SHALL omit the property entirely rather than emitting an empty or fabricated value.

#### Scenario: Product with a 13-digit GTIN emits gtin13 in structured data
- **WHEN** the product detail page renders for a product with a 13-digit `gtin`
- **THEN** the page's `Product` JSON-LD SHALL include a `gtin13` property with that value

#### Scenario: Product with an 8, 12, or 14-digit GTIN emits generic gtin in structured data
- **WHEN** the product detail page renders for a product with an 8, 12, or 14-digit `gtin`
- **THEN** the page's `Product` JSON-LD SHALL include a `gtin` property with that value

#### Scenario: Product without a GTIN omits the property from structured data
- **WHEN** the product detail page renders for a product with `gtin` set to `null`
- **THEN** the page's `Product` JSON-LD SHALL NOT include `gtin` or `gtin13`
