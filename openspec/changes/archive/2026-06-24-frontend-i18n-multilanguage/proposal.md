## Why

The Mavile storefront currently has no internationalization infrastructure and all customer-facing UI text is hardcoded in a single language. Adding a language switcher (Spanish / English) in the storefront header removes a barrier for non-Spanish-speaking shoppers and directly improves conversion across the purchase funnel without requiring any backend changes.

## What Changes

- Add `react-i18next` + `i18next` to the frontend package as the i18n library.
- Create `frontend/src/i18n/index.ts` to initialize i18next with `es` (default) and `en` locales, persisting the selected language in `localStorage`.
- Create locale JSON dictionaries under `frontend/src/i18n/locales/es/` and `frontend/src/i18n/locales/en/` covering all static UI text in the storefront (namespaces: `common`, `auth`, `catalog`, `product`, `cart`, `checkout`, `account`).
- Create `LanguageSwitcher` component (🇪🇸 / 🇬🇧 flags with `aria-label`) and mount it in `StorefrontHeader`.
- Replace all hardcoded strings in storefront components and pages with `t()` calls.
- Align `PriceTag` and any date formatters to use the active locale (`es-ES` / `en-GB`).
- Synchronize `document.documentElement.lang` with the active language.
- **Admin panel is excluded**: no selector, no translation effort, remains Spanish-only.
- **No backend changes**: dynamic catalog content (product names, descriptions from the API) is out of scope for this change.

## Capabilities

### New Capabilities

- `storefront-i18n`: Internationalization infrastructure and ES/EN language switcher for the customer-facing storefront. Covers all static UI text across header, auth, catalog, cart, checkout, and account flows.

### Modified Capabilities

- `storefront-header`: The header gains a `LanguageSwitcher` component; no requirement-level behavior change beyond the new UI control.

## Impact

- **Frontend only**: all changes are confined to `frontend/src/`.
- New npm dependencies: `i18next`, `react-i18next` (and their type packages).
- Components modified: `StorefrontHeader`, `StorefrontFooter`, `CategoryNav`, `PriceTag`, all storefront pages and auth components (see design for full list).
- Components **not** modified: any file under `components/admin/`, `pages/admin/`, `components/Layout.tsx` (admin layout).
- No API, database, or backend changes.
- No breaking changes to existing routes, props, or API contracts.
- Test wrappers for storefront components must be updated to provide the i18n provider/init.

## Non-goals

- Translating dynamic catalog content (product names, descriptions, category names) fetched from the backend — requires a separate backend-level i18n effort.
- Translating transactional emails or supplier-facing content.
- Adding a language selector or Spanish translations to the admin panel.
- URL-based locale routing (e.g., `/es/`, `/en/`) — not needed without SSR.
- Adding additional languages beyond Spanish and English.
