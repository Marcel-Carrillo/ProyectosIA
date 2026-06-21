## ADDED Requirements

### Requirement: Language switcher in storefront header
The storefront header SHALL display a language switcher with two flag icons — Spanish (🇪🇸) and English (🇬🇧) — allowing the customer to toggle the UI language between `es` and `en` at any time without a page reload. Each flag button SHALL include an `aria-label` with the language name in that language (e.g., "Español", "English") and a visible active state indicator for the currently selected language.

#### Scenario: Default language is Spanish
- **WHEN** a new visitor opens the storefront for the first time with no stored preference
- **THEN** the UI renders in Spanish and the Spanish flag is shown as active

#### Scenario: Customer switches to English
- **WHEN** the customer clicks the English flag in the header
- **THEN** all static UI text in the storefront changes to English immediately without a page reload and the English flag is shown as active

#### Scenario: Customer switches back to Spanish
- **WHEN** the customer clicks the Spanish flag after the UI is in English
- **THEN** all static UI text reverts to Spanish immediately and the Spanish flag is shown as active

#### Scenario: Language preference persists across sessions
- **WHEN** the customer selects English and then closes and reopens the browser
- **THEN** the storefront loads in English without requiring the customer to switch again

#### Scenario: Admin panel is unaffected
- **WHEN** an admin user navigates to any admin route
- **THEN** the admin UI displays only in Spanish with no language switcher visible

---

### Requirement: Full static UI translation for storefront
All static user-facing text in the customer storefront SHALL be externalized into locale JSON files (namespaces: `common`, `auth`, `catalog`, `product`, `cart`, `checkout`, `account`) and rendered via the active language. No hardcoded UI strings SHALL remain in any storefront component or page. The fallback language is Spanish; any missing key SHALL fall back to the Spanish value.

#### Scenario: Catalog page in English
- **WHEN** the active language is English and the customer visits the catalog page
- **THEN** all labels, buttons, filters, pagination controls, empty-state messages, and loading states display in English

#### Scenario: Checkout page in Spanish
- **WHEN** the active language is Spanish and the customer visits the checkout page
- **THEN** all form labels, field placeholders, validation messages, and action buttons display in Spanish

#### Scenario: Auth forms respect active language
- **WHEN** the customer lands on the login, register, forgot password, or reset password page
- **THEN** all form labels, placeholders, error messages, and buttons reflect the currently active language

#### Scenario: Account pages respect active language
- **WHEN** the customer navigates to account profile, order history, order detail, or wishlist
- **THEN** all section titles, table headers, action labels, and status labels display in the active language

#### Scenario: Fallback for missing key
- **WHEN** a translation key exists in Spanish but is missing in the English locale file
- **THEN** the Spanish value is displayed instead of an empty string or raw key

---

### Requirement: Locale-aware number and date formatting
The storefront SHALL format prices and dates using the locale matching the active language: `es-ES` for Spanish and `en-GB` for English. The currency (EUR) SHALL not change; only the formatting of separators and symbol position changes.

#### Scenario: Price formatted in Spanish locale
- **WHEN** the active language is Spanish and a product price is displayed
- **THEN** the price renders using Spanish number formatting (e.g., "29,99 €")

#### Scenario: Price formatted in English locale
- **WHEN** the active language is English and a product price is displayed
- **THEN** the price renders using English/GB number formatting (e.g., "€29.99")

#### Scenario: Date formatted according to active locale
- **WHEN** the active language is English and an order date is displayed in account order history
- **THEN** the date format follows `en-GB` conventions (e.g., "21/06/2026" or the locale default)

---

### Requirement: html lang attribute synchronization
The `<html lang>` attribute SHALL be updated to reflect the active language (`es` or `en`) whenever the language changes, including on initial load.

#### Scenario: lang attribute set on load
- **WHEN** the storefront loads with Spanish as the active language
- **THEN** `document.documentElement.lang` equals `"es"`

#### Scenario: lang attribute updated on language switch
- **WHEN** the customer switches from Spanish to English
- **THEN** `document.documentElement.lang` changes to `"en"` immediately

---

### Requirement: i18n library scoped to storefront
The i18n initialization and locale bundles SHALL be loaded only for the storefront routing tree and SHALL NOT be loaded or applied to admin routes. The admin panel SHALL remain Spanish-only without importing or instantiating the i18n library.

#### Scenario: i18n not loaded in admin
- **WHEN** an admin user navigates to any route under `/admin`
- **THEN** no i18n provider or language switcher is initialized or rendered in the admin tree

#### Scenario: Storefront i18n initialized before first render
- **WHEN** the storefront application loads
- **THEN** i18next is initialized with the persisted or default language before any storefront component renders, preventing a flash of untranslated text
