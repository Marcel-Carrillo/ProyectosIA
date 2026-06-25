## ADDED Requirements

### Requirement: Footer displays legal links
The storefront footer SHALL display a "Privacy Policy" link and a "Legal Notice" link visible on every storefront page.

#### Scenario: Footer legal links are rendered in Spanish
- **WHEN** the storefront is rendered with locale `es`
- **THEN** the footer bottom bar contains links labelled with the `footer.link.privacy` and `footer.link.legal` keys pointing to `/pages/privacy` and `/pages/legal` respectively

#### Scenario: Footer legal links are rendered in English
- **WHEN** the storefront is rendered with locale `en`
- **THEN** the footer bottom bar contains links labelled with the `footer.link.privacy` and `footer.link.legal` keys pointing to `/pages/privacy` and `/pages/legal` respectively

#### Scenario: Footer legal links navigate to correct pages
- **WHEN** a visitor clicks the "Privacy Policy" footer link
- **THEN** they are taken to `/pages/privacy`
- **WHEN** a visitor clicks the "Legal Notice" footer link
- **THEN** they are taken to `/pages/legal`
