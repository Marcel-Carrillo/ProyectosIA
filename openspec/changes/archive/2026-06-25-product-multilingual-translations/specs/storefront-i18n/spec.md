## MODIFIED Requirements

### Requirement: Product API requests include Accept-Language from current i18n language
All product service calls from the storefront (`productService.getAll`, `productService.getById`, and any related catalog or search fetch) SHALL include an `Accept-Language` header whose value is the current `i18n.language` (e.g., `es` or `en`). This SHALL be implemented as a shared Axios request interceptor so it applies uniformly without per-call changes. The locale is read from `i18next`; the storage key is `mavile.lang` and supported values are `en` and `es`.

#### Scenario: Storefront sends Accept-Language on product list fetch
- **WHEN** the catalog page fetches products while `i18n.language` is `es`
- **THEN** the HTTP request SHALL include `Accept-Language: es`

#### Scenario: Storefront sends Accept-Language on product detail fetch
- **WHEN** the product detail page fetches a product while `i18n.language` is `en`
- **THEN** the HTTP request SHALL include `Accept-Language: en`

### Requirement: Product data re-fetches on language change
Product list and product detail pages SHALL subscribe to the `i18next` `languageChanged` event (or use the current language as a `useEffect` dependency) and re-fetch product data when the language changes. This ensures that switching the interface language updates product names and descriptions live without a full page reload.

#### Scenario: User switches language on catalog page
- **WHEN** a user changes the interface language from EN to ES while on the catalog page
- **THEN** the catalog SHALL re-fetch products and display Spanish names and descriptions

#### Scenario: User switches language on product detail page
- **WHEN** a user changes the interface language from EN to ES while on the product detail page
- **THEN** the page SHALL re-fetch the product and display the Spanish name and description

#### Scenario: Language switch shows English fallback when ES translation missing
- **WHEN** a user switches to ES but the product has no ES translation
- **THEN** the page SHALL display the English name and description (server-resolved fallback) without error

### Requirement: Accept-Language interceptor pattern is documented
The pattern of injecting `Accept-Language` from `i18n.language` via an Axios interceptor SHALL be documented in `docs/frontend-standards.md` as the standard approach for locale-aware API calls.

#### Scenario: Frontend standards document includes interceptor pattern
- **WHEN** a developer reads `docs/frontend-standards.md`
- **THEN** they SHALL find a section describing how to add `Accept-Language` via an Axios request interceptor for locale-aware service calls
