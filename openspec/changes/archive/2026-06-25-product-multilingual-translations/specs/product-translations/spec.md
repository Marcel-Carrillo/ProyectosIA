## ADDED Requirements

### Requirement: Product translation storage
The system SHALL store per-locale name and description for each product in a `ProductTranslation` entity. Each translation row is uniquely identified by `(productId, locale)`. Supported locales are `en` and `es`. The `source` field SHALL record how the translation was created: `manual` (admin-authored), `import` (seeded from the base `Product` fields), or `machine` (auto-translated).

Fields: `id` (PK), `productId` (FK → Product, cascade delete), `locale` (varchar 5), `name` (varchar 150, required), `description` (varchar 2000, optional), `source` (varchar 20, default `manual`), `createdAt`, `updatedAt`.

Constraints: `@@unique([productId, locale])`, `@@index([productId])`.

#### Scenario: Creating a translation for a product
- **WHEN** an admin submits a `PUT /api/admin/products/:id/translations/:locale` request with a valid name
- **THEN** the system SHALL upsert the translation row and return 200 with the saved translation

#### Scenario: Locale uniqueness enforced
- **WHEN** an admin submits a second translation for the same product and locale
- **THEN** the system SHALL update the existing row (upsert), not create a duplicate

#### Scenario: Cascade delete
- **WHEN** a product is deleted
- **THEN** all its `ProductTranslation` rows SHALL be deleted automatically via the cascade constraint

### Requirement: Locale resolution with deterministic fallback
The system SHALL resolve product `name` and `description` for any public read via a single centralized helper. The fallback chain is: (1) translation for the requested locale → (2) translation for `en` → (3) `Product.name` / `Product.description`. The returned value SHALL never be empty for `name`.

Locale normalization: strip region tags (`es-ES` → `es`, `en-US` → `en`); unsupported locales fall back to `en`. Only `en` and `es` are supported in this version.

#### Scenario: Exact locale match
- **WHEN** a request arrives with `Accept-Language: es` and an `es` translation exists
- **THEN** the system SHALL return the `es` translation's name and description

#### Scenario: Fallback to English translation
- **WHEN** a request arrives with `Accept-Language: es` and no `es` translation exists but an `en` translation does
- **THEN** the system SHALL return the `en` translation's name and description

#### Scenario: Fallback to Product fields
- **WHEN** a request arrives for a product with no translations at all
- **THEN** the system SHALL return `Product.name` and `Product.description` as the fallback

#### Scenario: Region-stripped locale normalization
- **WHEN** a request arrives with `Accept-Language: es-419`
- **THEN** the system SHALL normalize to `es` and resolve accordingly

#### Scenario: Unknown locale defaults to English
- **WHEN** a request arrives with `Accept-Language: fr`
- **THEN** the system SHALL resolve as if the locale were `en`

### Requirement: Translation backfill script
The system SHALL provide an idempotent, resumable script (`backend/scripts/backfillProductTranslations.ts`) that:
1. Upserts an `en` translation from `Product.name`/`description` for every existing product (source = `import`).
2. For products lacking an `es` translation, calls a free machine-translation service (LibreTranslate) and upserts the result (source = `machine`).
3. Enforces the 150-char limit on translated `name`; truncates or skips-and-logs if exceeded.
4. Emits a structured summary (EN seeded, ES translated, skipped, failed) at completion.
5. Is safe to re-run; already-existing rows are not overwritten.

#### Scenario: EN translation already exists
- **WHEN** the script runs and a product already has an `en` translation
- **THEN** the script SHALL skip that product's EN upsert and leave the existing row unchanged

#### Scenario: Machine translation failure
- **WHEN** the translation service returns an error for a product
- **THEN** the script SHALL log the failure, skip that product's ES translation, and continue processing remaining products

#### Scenario: Translated name exceeds 150 characters
- **WHEN** the machine-translated ES name exceeds 150 characters
- **THEN** the script SHALL truncate to 150 characters, log a warning, and save the truncated value
