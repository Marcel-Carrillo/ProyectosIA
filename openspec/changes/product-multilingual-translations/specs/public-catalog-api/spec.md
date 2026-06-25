## MODIFIED Requirements

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
