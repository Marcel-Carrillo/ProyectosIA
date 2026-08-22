## ADDED Requirements

### Requirement: Custom banner drives Customer Privacy API

The theme SHALL show the Mavile cookie banner and preferences modal and SHALL call `Shopify.customerPrivacy.setTrackingConsent` with analytics and marketing mapped to Shopify consent categories. Shopify’s built-in cookie banner SHALL be disabled in Admin for this shop. Reject SHALL be as prominent as accept. No analytics or marketing script SHALL load before consent.

#### Scenario: Reject blocks tracking scripts

- **WHEN** a first-visit shopper chooses reject on the banner
- **THEN** the network log shows no analytics or marketing third-party script after that choice

#### Scenario: Accept records consent

- **WHEN** a shopper accepts analytics and marketing in the preferences modal
- **THEN** Customer Privacy API consent for those categories is recorded and allowed scripts may load

#### Scenario: Banner in both locales

- **WHEN** a shopper opens the storefront in Spanish and in English
- **THEN** banner and modal copy come from theme locales and both locales offer reject and accept
