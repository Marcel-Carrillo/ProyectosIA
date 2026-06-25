# Legal Pages

## Purpose

Defines the publicly accessible static legal pages of the storefront (Privacy Policy and Legal Notice), their bilingual content structure, and the routing/redirect behaviour of the `ContentPage` component.

## Requirements

### Requirement: Privacy Policy page is publicly accessible
The system SHALL render a static Privacy Policy page at `/pages/privacy` using the existing `ContentPage` component.

#### Scenario: Visitor navigates to privacy policy in Spanish
- **WHEN** a visitor navigates to `/pages/privacy` with locale `es`
- **THEN** the page renders with the Spanish title, intro, and all GDPR-required sections from `es/pages.json`

#### Scenario: Visitor navigates to privacy policy in English
- **WHEN** a visitor navigates to `/pages/privacy` with locale `en`
- **THEN** the page renders with the English title, intro, and all sections from `en/pages.json`

#### Scenario: Privacy slug is accepted by ContentPage
- **WHEN** `ContentPage` receives slug `privacy`
- **THEN** it does NOT redirect to `/catalog` and renders the page content

---

### Requirement: Legal Notice page is publicly accessible
The system SHALL render a static Legal Notice page at `/pages/legal` using the existing `ContentPage` component.

#### Scenario: Visitor navigates to legal notice in Spanish
- **WHEN** a visitor navigates to `/pages/legal` with locale `es`
- **THEN** the page renders with the Spanish title, intro, and all LSSI-CE-required sections from `es/pages.json`

#### Scenario: Visitor navigates to legal notice in English
- **WHEN** a visitor navigates to `/pages/legal` with locale `en`
- **THEN** the page renders with the English title, intro, and all sections from `en/pages.json`

#### Scenario: Legal slug is accepted by ContentPage
- **WHEN** `ContentPage` receives slug `legal`
- **THEN** it does NOT redirect to `/catalog` and renders the page content

---

### Requirement: Legal page content is bilingual and symmetric
Both `es/pages.json` and `en/pages.json` SHALL contain `privacy` and `legal` keys with identical structure (`eyebrow`, `title`, `intro`, `sections` array with `heading`/`body` per item).

#### Scenario: Key structure is symmetric across locales
- **WHEN** the i18n namespace `pages` is loaded for locale `es` or `en`
- **THEN** both locales expose `privacy.eyebrow`, `privacy.title`, `privacy.intro`, `privacy.sections`, `legal.eyebrow`, `legal.title`, `legal.intro`, `legal.sections`

#### Scenario: Language switcher updates legal page content
- **WHEN** a visitor is on `/pages/privacy` and switches language from ES to EN
- **THEN** the page content updates to the English version without a full page reload

---

### Requirement: Legal page content uses explicit placeholders for business data
Content sections that require real business data (company name, NIF, address, contact email) SHALL use explicit uppercase bracket placeholders (e.g. `[COMPANY NAME]`, `[NIF]`, `[ADDRESS]`, `[CONTACT EMAIL]`) until the business owner supplies the real values.

#### Scenario: Placeholder text is visible in development/staging
- **WHEN** the legal pages are rendered before real business data is supplied
- **THEN** placeholder strings in the form `[UPPERCASE TEXT]` are visible in the page content

---

### Requirement: Invalid slugs continue to redirect
`ContentPage` SHALL redirect to `/catalog` when the slug is not in `VALID_SLUGS`.

#### Scenario: Unknown slug redirects
- **WHEN** a visitor navigates to `/pages/unknown-slug`
- **THEN** the browser is redirected to `/catalog`
