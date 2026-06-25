## ADDED Requirements

### Requirement: pages.json contains privacy and legal keys
Both `es/pages.json` and `en/pages.json` SHALL contain top-level `privacy` and `legal` objects with the same structure used by existing slugs: `eyebrow`, `title`, `intro`, and a `sections` array where each item has `heading` and `body`.

#### Scenario: ES pages.json has privacy and legal keys
- **WHEN** the i18n namespace `pages` is loaded for locale `es`
- **THEN** the keys `privacy.title`, `privacy.intro`, `privacy.sections`, `legal.title`, `legal.intro`, `legal.sections` are all present and non-empty strings/arrays

#### Scenario: EN pages.json has privacy and legal keys
- **WHEN** the i18n namespace `pages` is loaded for locale `en`
- **THEN** the keys `privacy.title`, `privacy.intro`, `privacy.sections`, `legal.title`, `legal.intro`, `legal.sections` are all present and non-empty strings/arrays

#### Scenario: Both locales are symmetric in structure
- **WHEN** `es/pages.json` and `en/pages.json` are compared
- **THEN** both expose exactly the same top-level keys and nested key structure for `privacy` and `legal`

### Requirement: common.json contains footer legal link labels
Both `es/common.json` and `en/common.json` SHALL contain `footer.link.privacy` and `footer.link.legal` keys used by `StorefrontFooter`.

#### Scenario: ES common.json has footer legal keys
- **WHEN** the i18n namespace `common` is loaded for locale `es`
- **THEN** `footer.link.privacy` resolves to a non-empty Spanish string

#### Scenario: EN common.json has footer legal keys
- **WHEN** the i18n namespace `common` is loaded for locale `en`
- **THEN** `footer.link.privacy` resolves to a non-empty English string
