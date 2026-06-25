## Why

Mavile's storefront UI is already bilingual (ES/EN via i18next), but product names and descriptions are stored monolingually in English. A Spanish-speaking shopper switches the interface language and still sees all product content in English, breaking the localized experience at the highest-purchase-intent moment. As the catalog grows with supplier-provided products, both languages must be first-class data.

## What Changes

- Add a new `ProductTranslation` entity to store `name` and `description` per locale (`en`, `es`) for each product.
- `Product.name` and `Product.description` remain as the canonical English fallback (no column removal or renaming).
- Public product list and detail endpoints resolve `name`/`description` from `Accept-Language`, falling back to English when no translation exists.
- Admin create/update endpoints accept a `translations` array (per-locale name and description); dedicated sub-routes allow upsert and delete per locale.
- Admin read responses include the full `translations` array so forms can pre-populate all locales.
- The React storefront sends `Accept-Language` from `i18n.language` on every product request and re-fetches product data on language change so content switches live.
- The admin `ProductFormModal` gains per-locale name/description fields (ES/EN tabs).
- A one-off backfill script seeds `en` translations from existing `Product` rows and machine-translates `es` via LibreTranslate, marking each row with a `source` field (`import` / `machine`) for quality tracking.
- All public responses include `Vary: Accept-Language` to prevent incorrect language caching.

**Non-goals (deferred):**
- Localizing `brand`, `slug`, image `altText`, or category names.
- More than two locales (`en`, `es`).
- Localized full-text search (public search continues to match `Product.name` in English).
- Translation approval/workflow states or auto-translate-on-save inside the admin UI.
- Supplier integration changes (suppliers will provide both languages in the future, but no integration is built now).

## Capabilities

### New Capabilities

- `product-translations`: Stores per-locale name and description for products. Implements locale resolution with deterministic fallback (requested locale → `en` → `Product.name`/`description`). Exposes admin authoring endpoints and a backfill/import script.

### Modified Capabilities

- `product-catalog`: Public list and detail endpoints become locale-aware (`Accept-Language` header, `Vary` response header, localized name/description in DTO).
- `public-catalog-api`: Accept-Language parameter added to public product reads; Vary header documented; admin product create/update schemas gain optional `translations` array.
- `product-management`: Admin create and update operations accept and persist per-locale translations; admin read responses include the full translations array.
- `admin-product-panel`: Product form gains per-locale name/description inputs; frontend sends `Accept-Language` from current i18n language and re-fetches on language change.
- `storefront-i18n`: Establishes the `Accept-Language` interceptor pattern and re-fetch-on-language-change convention for all product data fetches.

## Impact

**Backend:**
- New `ProductTranslation` Prisma model and migration.
- New domain model, repository interface, and Prisma repository implementation.
- Locale resolution helper used by all product read paths.
- `serializePublicProduct` gains a `locale` argument; allow-list unchanged; supplier fields remain excluded.
- Eager `include` of translations in product list and detail queries (single query, no N+1).
- New admin sub-routes: `GET/PUT/DELETE /api/admin/products/:id/translations/:locale`.
- One-off backfill script in `backend/scripts/`.

**Frontend:**
- Axios request interceptor injects `Accept-Language: i18n.language` on product service calls.
- Product list and detail pages re-fetch when `i18n.language` changes.
- `ProductFormModal` gains ES/EN translation tab inputs.
- Updated TypeScript types: `ProductTranslation`, `CreateProductInput.translations`, `UpdateProductInput.translations`.

**APIs:**
- `GET /api/public/products`, `GET /api/public/products/:id`: new `Accept-Language` parameter, `Vary: Accept-Language` header, localized fields in response.
- `POST /api/admin/products`, `PATCH /api/admin/products/:id`: optional `translations` array in request body.
- `GET /api/admin/products`, `GET /api/admin/products/:id`: include `translations` array in response.
- New: `GET /api/admin/products/:id/translations`, `PUT /api/admin/products/:id/translations/:locale`, `DELETE /api/admin/products/:id/translations/:locale`.

**Documentation:**
- `docs/data-model.md`: add `ProductTranslation` entity.
- `docs/api-spec.yml`: update public and admin product schemas.
- `docs/development_guide.md`: backfill script usage and env vars.
- `docs/frontend-standards.md`: Accept-Language interceptor and re-fetch-on-language-change pattern.
