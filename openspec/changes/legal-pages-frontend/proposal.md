## Why

The Mavile storefront processes personal data (customer accounts, addresses, orders, Stripe payments) but lacks a Privacy Policy and a Legal Notice — both mandatory under GDPR and Spain's LSSI-CE. Publishing them removes a legal compliance risk, satisfies Stripe's requirement for visible policies, and signals legitimacy to prospective buyers.

## What Changes

- **New route `/pages/privacy`**: renders a static Privacy Policy page in ES and EN.
- **New route `/pages/legal`**: renders a static Legal Notice page in ES and EN.
- `ContentPage` component gains `'privacy'` and `'legal'` in `VALID_SLUGS` so both routes render instead of redirecting to `/catalog`.
- `es/pages.json` and `en/pages.json` gain symmetric `privacy` and `legal` keys with all required sections (GDPR-compliant for privacy; LSSI-CE-compliant for legal notice). Content uses explicit placeholders (`[COMPANY NAME]`, `[NIF]`, etc.) until the business owner supplies real data.
- `StorefrontFooter` gains two links to the new pages, localised via `t('footer.link.privacy')` and `t('footer.link.legal')`.
- `es/common.json` and `en/common.json` gain the footer link label keys.
- `docs/frontend-standards.md` updated to document the new slugs under "Static Content Pages".

**Non-goals (out of scope for this change):**
- Cookie banner / consent management (separate ticket).
- Backend or API changes — no new entities, endpoints, or migrations.
- Admin CMS for editing legal text — static i18n files are sufficient for MVP.
- Versioning of legal text or recording user acceptance.
- Any data-model or api-spec changes.

## Capabilities

### New Capabilities
- `legal-pages`: Static Privacy Policy and Legal Notice pages accessible via `/pages/privacy` and `/pages/legal`, bilingual (ES/EN), built on the existing `ContentPage` pattern.

### Modified Capabilities
- `storefront-shell`: Footer gains two legal links (`/pages/privacy`, `/pages/legal`) visible on every storefront page.
- `storefront-i18n`: `pages.json` (es/en) gains `privacy` and `legal` keys; `common.json` (es/en) gains `footer.link.privacy` and `footer.link.legal` keys.

## Impact

- **Frontend only**: `ContentPage.tsx`, `StorefrontFooter.tsx`, `es/pages.json`, `en/pages.json`, `es/common.json`, `en/common.json`.
- **Documentation**: `docs/frontend-standards.md` (static page slugs section).
- **No backend, API, database, or business-logic changes.**
- **Customer-facing**: two new public routes; no supplier data exposed; no PII collected by the pages themselves.
