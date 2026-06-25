## MODIFIED Requirements

### Requirement: Product create persists translations
`ProductService.createProduct` SHALL accept an optional `translations` array alongside the existing product fields. Each entry SHALL be validated (`locale` ∈ {`en`,`es`}; `name` ≤ 150 chars; `description` ≤ 2000 chars) before persistence. Valid translations SHALL be created atomically with the product in the same transaction. The `source` field SHALL default to `manual` for admin-authored translations.

#### Scenario: Product created with two locale translations
- **WHEN** `createProduct` is called with `translations: [{locale: "en", name: "..."}, {locale: "es", name: "..."}]`
- **THEN** the product and both translation rows SHALL be created in the same DB transaction

#### Scenario: Translation validation fails on create
- **WHEN** `createProduct` is called with a translation whose `name` exceeds 150 characters
- **THEN** the system SHALL return a `ValidationError` and not persist any row

### Requirement: Product update upserts translations
`ProductService.updateProduct` SHALL accept an optional `translations` array. Provided translations SHALL be upserted by `(productId, locale)`; locales not included in the array SHALL be left unchanged. Validation rules are identical to create.

#### Scenario: Update adds a missing ES translation
- **WHEN** `updateProduct` is called on a product that has only an `en` translation, with `translations: [{locale: "es", name: "..."}]`
- **THEN** the `es` row SHALL be created; the `en` row SHALL remain unchanged

#### Scenario: Update overwrites an existing translation
- **WHEN** `updateProduct` is called with an `es` translation whose `name` differs from the stored value
- **THEN** the `es` row SHALL be updated with the new name

### Requirement: Product read responses include full translations array for admin
When the admin service fetches a product or a product list, the returned domain object SHALL include a `translations` field with all `ProductTranslation` rows for that product. This allows the admin controller to serialize them in the response for form pre-population.

#### Scenario: Admin fetch includes translations
- **WHEN** `getProductById` is called from an admin context
- **THEN** the returned object SHALL include a `translations` array with all locale rows

### Requirement: Product soft-delete cascades to translations
When a product is soft-deleted (setting `deletedAt`), its `ProductTranslation` rows SHALL remain in the database (they are not orphaned). When a product is hard-deleted, the cascade constraint on `productId` SHALL delete all translation rows automatically.

#### Scenario: Soft-deleted product keeps translations
- **WHEN** a product's `deletedAt` is set
- **THEN** its `ProductTranslation` rows SHALL remain accessible to admins for recovery scenarios

#### Scenario: Hard-deleted product removes translations
- **WHEN** a product row is hard-deleted from the database
- **THEN** all `ProductTranslation` rows for that product SHALL be removed via cascade
