## Context

The Mavile storefront is a CRA 5.0.1 app (React 19, TypeScript, React Router 6, React Bootstrap) with no existing i18n infrastructure. All static UI text is hardcoded as string literals inside JSX. There are two isolated route trees: the customer storefront (`StorefrontLayout`) and the admin panel (`Layout`). The separation already exists in `App.tsx` via React Router route grouping, which makes it straightforward to scope i18n exclusively to the storefront tree.

The admin panel is an internal tool used by the store operator and must remain Spanish-only with no language switcher. The storefront must support Spanish (default) and English, selectable via flag icons in the header.

## Goals / Non-Goals

**Goals:**
- Introduce `react-i18next` + `i18next` as the i18n library for the storefront.
- Provide ES and EN locale JSON files covering all static UI text in the storefront.
- Add a `LanguageSwitcher` (🇪🇸/🇬🇧) component in `StorefrontHeader`.
- Persist language preference in `localStorage`; default to Spanish.
- Sync `document.documentElement.lang` with the active language.
- Align `PriceTag` and date formatters to use the active locale (`es-ES` / `en-GB`).
- Keep admin panel hardcoded in Spanish — no i18n provider, no switcher.

**Non-Goals:**
- Translating dynamic API content (product names, descriptions, category names).
- Translating transactional emails.
- URL-based locale routing (`/es/`, `/en/`).
- Adding a third language.
- Migrating CRA to Vite or changing the testing framework.

## Decisions

### Decision 1: Library — `react-i18next` + `i18next`

**Chosen:** `react-i18next` + `i18next`.

**Why:** Industry standard for React i18n. Provides `useTranslation` hook, namespace support, interpolation, pluralization, and `localStorage` persistence with `i18next-browser-languagedetector`. Tree-shaking friendly; only the loaded namespaces are bundled. React Testing Library integration is well-documented.

**Alternatives considered:**
- **Custom Context + JSON dictionaries**: Zero dependencies, but requires implementing namespace lookup, fallback, and persistence manually. Not worth the maintenance overhead for a two-language setup that may grow.
- **react-intl (FormatJS)**: Solid option but heavier API (MessageDescriptors, provider pattern). `react-i18next` is more ergonomic with hooks and has better CRA compatibility.

**Installation note:** Use `--legacy-peer-deps` flag (same as Stripe packages) due to React 19 peer dependency constraints in CRA.

```bash
npm install i18next react-i18next i18next-browser-languagedetector --legacy-peer-deps
```

### Decision 2: Initialization scope — global init, storefront-scoped switcher

**Chosen:** Initialize i18next once in `frontend/src/i18n/index.ts`, imported at the top of `frontend/src/index.tsx` before the React tree mounts. The `LanguageSwitcher` component lives only in `StorefrontHeader`. Admin components never call `useTranslation`, so their hardcoded Spanish strings are unaffected by the active i18n language.

**Why:** i18next is a singleton; initializing it globally avoids complex lazy-loading coordination. Because admin components never call `t()`, they are immune to language changes regardless of the global singleton state. The `LanguageSwitcher` is only rendered in the storefront header, so admin users never see it.

**Alternative considered:** Lazy-init i18n only when entering the storefront route tree via a React context. More complex, requires a custom i18n Provider wrapping only `StorefrontLayout`, and risks flash of untranslated text on initial load. Not worth the complexity for a two-language MVP.

### Decision 3: Locale file structure — namespaced JSON per language

**Chosen:**
```
frontend/src/i18n/
├── index.ts
└── locales/
    ├── es/
    │   ├── common.json      # buttons, nav, header, footer, loading, errors
    │   ├── auth.json        # login, register, forgot/reset password, 2FA
    │   ├── catalog.json     # catalog page, filters, pagination, empty states
    │   ├── product.json     # product detail, gallery, variant selector
    │   ├── cart.json        # cart page
    │   ├── checkout.json    # checkout form, payment form, confirmation
    │   └── account.json     # profile, orders, order detail, wishlist
    └── en/
        └── (same structure)
```

**Why:** Namespaces allow lazy-loading individual bundles in the future and keep key lists manageable. The `common` namespace covers shared UI elements (buttons, nav labels, loading/error states) used across all storefront pages; domain namespaces group page-specific strings.

**Alternative considered:** Single `translation.json` per language. Simpler upfront but results in a large monolithic file and makes it harder to identify untranslated sections or lazy-load in future.

### Decision 4: Language persistence — `i18next-browser-languagedetector`

**Chosen:** Use `i18next-browser-languagedetector` with `localStorage` as the detection order (`localStorage`, then `navigator`), falling back to `es`.

**Why:** The detector handles reading and writing `localStorage` automatically on language change, removing the need for manual `useEffect` wiring for persistence. The `navigator` fallback lets English-language browsers default to English for first-time visitors, which is a reasonable UX improvement.

**Alternative considered:** Manual `localStorage` read/write in a custom hook. Works but duplicates what the detector already provides.

### Decision 5: `html lang` sync — `useEffect` in a root storefront effect

**Chosen:** A `useEffect` in `StorefrontLayout` (or a top-level `I18nSync` component) that runs on `i18n.language` change and sets `document.documentElement.lang`.

**Why:** Minimal footprint — one effect in one component that is always mounted while the storefront is active. `StorefrontLayout` is the root wrapper for all storefront routes, so it is always mounted.

### Decision 6: Locale-aware formatting — pass locale to `Intl` in `PriceTag`

**Chosen:** `PriceTag.tsx` reads the active language from `i18n.language` (via `useTranslation` or `i18next` singleton) and passes the corresponding locale string (`es-ES` / `en-GB`) to `Intl.NumberFormat`. Same approach for any date formatting.

**Why:** `PriceTag` already uses `Intl.NumberFormat`; swapping the locale string is a one-line change. No third-party date library is needed for the few date display cases in the storefront (order history dates).

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Flash of untranslated text (FOTT) on first load | Initialize i18next synchronously before React renders (import in `index.tsx` before `ReactDOM.createRoot`). Locale JSONs are bundled (not lazy-loaded), so they are available immediately. |
| Missing translation keys show raw key strings | Configure i18next `fallbackLng: 'es'` and `saveMissing: false`. In development, enable `missingKeyHandler` to warn to console. |
| Large number of literal replacements increases PR size and merge risk | Implement namespace by namespace (auth first, then catalog, etc.) in incremental subtasks; each is independently testable. |
| Test wrappers for existing storefront tests need i18n provider | Add a `renderWithI18n` test utility that wraps with i18next `I18nextProvider` using the real `es` locale. Update all storefront component tests. |
| `react-i18next` peer dep warning under React 19 + CRA | Install with `--legacy-peer-deps` (same pattern used for Stripe). No runtime impact. |
| Admin text accidentally translated if someone adds `useTranslation` to an admin component | Lint rule or code review gate: `useTranslation` is banned in `components/admin/**` and `pages/admin/**`. Document in `frontend-standards.md`. |
| `i18next-browser-languagedetector` may default to browser language instead of Spanish for Spanish users | Configure detector order: `['localStorage', 'navigator']` with `fallbackLng: 'es'`. On first visit without storage, `navigator` will detect `es` for Spanish browsers. |

## Migration Plan

1. Install packages (`i18next`, `react-i18next`, `i18next-browser-languagedetector`) with `--legacy-peer-deps`.
2. Create `frontend/src/i18n/index.ts` with initialization (both languages, `fallbackLng: 'es'`, detector config).
3. Create locale JSON files (`es/*.json`, `en/*.json`) for all namespaces — start with `common` and `auth`, then `catalog`, `product`, `cart`, `checkout`, `account`.
4. Import i18n init in `frontend/src/index.tsx` before `ReactDOM.createRoot`.
5. Create `LanguageSwitcher.tsx` component; mount in `StorefrontHeader`.
6. Add `I18nSync` effect in `StorefrontLayout` for `html lang`.
7. Migrate `PriceTag` to use locale-aware `Intl.NumberFormat`.
8. Replace hardcoded strings in storefront components/pages namespace by namespace.
9. Update test wrappers to include i18n provider; update snapshot tests if any.
10. Add `LanguageSwitcher` unit test and `storefront-i18n.cy.ts` Cypress spec.
11. Update `docs/frontend-standards.md` with i18n conventions.

**Rollback:** The feature is entirely additive in the first steps (init + locale files + LanguageSwitcher). If string replacement introduces regressions, individual namespace PRs can be reverted independently. The i18n library itself can be removed without affecting backend or data.

## Open Questions

- **Default for first-time English-browser visitors**: Should the detector honor `navigator.language` (English users default to English), or always default to Spanish? Current proposal: respect `navigator` as second priority. Confirm with product owner.
- **Key naming convention**: Dot-notation (`auth.login.title`) vs. flat (`auth_login_title`)? Proposal: dot-notation with `keySeparator: '.'`. Confirm before populating locale files to avoid a global rename.
