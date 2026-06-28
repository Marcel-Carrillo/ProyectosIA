## Purpose

Provide GDPR/CCPA-compliant cookie consent management for the storefront. Visitors must be able to accept, reject, or customise cookie categories before any non-essential scripts are initialised. Consent decisions are persisted in `localStorage` with a versioned schema, rehydrated on every page load, and exposed through a React context so that any component or script can gate non-essential behaviour behind the appropriate category.

## Requirements

### Requirement: Banner visibility on first visit
The system SHALL display the cookie consent banner to visitors who have no valid stored consent decision. A valid decision is defined as a `localStorage` entry with a matching `CONSENT_VERSION` and a `timestamp` no older than the configured expiry (365 days). The banner SHALL NOT be displayed when a valid decision already exists.

#### Scenario: First-time visitor sees the banner
- **WHEN** a visitor loads any storefront page and no valid consent entry exists in `localStorage`
- **THEN** the cookie consent banner is rendered at the bottom of the viewport without blocking page scrolling or interaction

#### Scenario: Returning visitor with valid consent does not see the banner
- **WHEN** a visitor loads any storefront page and a valid consent entry exists in `localStorage`
- **THEN** the banner is not rendered

#### Scenario: Banner reappears after consent version bump
- **WHEN** `CONSENT_VERSION` is incremented and a visitor loads a storefront page
- **THEN** the banner is displayed regardless of any previously stored decision

#### Scenario: Banner reappears after consent expiry
- **WHEN** a visitor loads a storefront page and the stored consent `timestamp` is older than 365 days
- **THEN** the banner is displayed

---

### Requirement: Accept all cookies action
The system SHALL provide an "Accept all" action in the banner that grants consent for all cookie categories (Necessary, Analytics, Marketing) and persists the decision to `localStorage`.

#### Scenario: Visitor accepts all cookies
- **WHEN** the visitor clicks "Accept all" in the banner
- **THEN** consent is stored with `{ necessary: true, analytics: true, marketing: true }`, the `timestamp` is set to the current time, the `version` matches `CONSENT_VERSION`, and the banner is dismissed

---

### Requirement: Reject all non-essential cookies action
The system SHALL provide a "Reject all" action in the banner that is visually equal in prominence to "Accept all" and grants consent only for Necessary cookies.

#### Scenario: Visitor rejects non-essential cookies
- **WHEN** the visitor clicks "Reject all" in the banner
- **THEN** consent is stored with `{ necessary: true, analytics: false, marketing: false }` and the banner is dismissed

---

### Requirement: Cookie preferences modal
The system SHALL provide a "Customize" action that opens a focus-trapped modal listing each cookie category with a description and a toggle. The Necessary category toggle SHALL be locked in the enabled state and not interactable.

#### Scenario: Visitor opens the preferences modal
- **WHEN** the visitor clicks "Customize" in the banner
- **THEN** the preferences modal opens with three categories (Necessary, Analytics, Marketing); the Necessary toggle is checked and disabled; Analytics and Marketing toggles are unchecked by default on first open

#### Scenario: Visitor saves custom preferences
- **WHEN** the visitor enables Analytics, leaves Marketing off, and clicks "Save preferences"
- **THEN** consent is stored with `{ necessary: true, analytics: true, marketing: false }` and the modal closes

#### Scenario: Modal accept all
- **WHEN** the visitor clicks "Accept all" inside the modal
- **THEN** consent is stored with `{ necessary: true, analytics: true, marketing: true }` and the modal closes

#### Scenario: Modal reject all
- **WHEN** the visitor clicks "Reject all" inside the modal
- **THEN** consent is stored with `{ necessary: true, analytics: false, marketing: false }` and the modal closes

#### Scenario: Modal focus trap
- **WHEN** the preferences modal is open and the visitor presses Tab or Shift+Tab
- **THEN** keyboard focus remains within the modal

#### Scenario: Modal closes on Escape key
- **WHEN** the preferences modal is open and the visitor presses Escape
- **THEN** the modal closes without saving any changes

---

### Requirement: Footer "Cookie settings" entry
The system SHALL include a "Cookie settings" link in `StorefrontFooter` that opens the preferences modal with current consent state pre-populated, regardless of whether the banner is visible.

#### Scenario: Returning visitor manages cookie settings from footer
- **WHEN** a visitor with a stored consent decision clicks "Cookie settings" in the footer
- **THEN** the preferences modal opens with toggles reflecting the previously stored category values

---

### Requirement: Consent context and hook
The system SHALL expose a `CookieConsentProvider` and a `useCookieConsent` hook that returns the current consent state and a function to update it. Any component or future script that loads non-essential resources SHALL read from this hook before initialising.

#### Scenario: Hook returns current consent on mount
- **WHEN** a component calls `useCookieConsent()`
- **THEN** it receives `{ necessary: true, analytics: boolean, marketing: boolean }` reflecting the stored decision (or all-false for non-necessary categories if no decision exists)

#### Scenario: Consent state updates after user action
- **WHEN** the visitor saves preferences in the modal
- **THEN** all consumers of `useCookieConsent()` receive the updated consent object without a page reload

---

### Requirement: Non-essential script gating
The system SHALL ensure that no non-essential script initialises before the visitor has granted the relevant consent category. The existing `reportWebVitals` call in `index.tsx` SHALL be gated behind `analytics` consent.

#### Scenario: Analytics script gated behind consent
- **WHEN** the visitor has not yet granted analytics consent
- **THEN** `reportWebVitals` is not called and no analytics data is sent

#### Scenario: Analytics script activates after consent granted
- **WHEN** the visitor grants analytics consent (via Accept all or Save preferences with Analytics enabled)
- **THEN** `reportWebVitals` is called

---

### Requirement: Consent persistence schema
The system SHALL store consent in `localStorage` under the key `mavile.cookieConsent` using the following schema:

```json
{
  "version": "<CONSENT_VERSION>",
  "timestamp": "<ISO 8601 string>",
  "categories": {
    "necessary": true,
    "analytics": false,
    "marketing": false
  }
}
```

#### Scenario: Consent entry is written correctly after Accept all
- **WHEN** the visitor clicks "Accept all"
- **THEN** `localStorage.getItem('mavile.cookieConsent')` parses to an object with `version === CONSENT_VERSION`, a valid ISO timestamp, and `categories === { necessary: true, analytics: true, marketing: true }`

---

### Requirement: Internationalisation
All banner and modal copy SHALL be served through the `cookies` i18n namespace registered in `frontend/src/i18n/index.ts`. The namespace SHALL have locale files for `es` and `en`. No hardcoded strings are allowed in the components.

#### Scenario: Banner renders in Spanish when locale is Spanish
- **WHEN** the active i18n locale is `es`
- **THEN** the banner and modal display copy from `frontend/src/i18n/locales/es/cookies.json`

#### Scenario: Banner renders in English when locale is English
- **WHEN** the active i18n locale is `en`
- **THEN** the banner and modal display copy from `frontend/src/i18n/locales/en/cookies.json`

---

### Requirement: Accessibility
The banner SHALL have `role="region"` and `aria-label` for screen readers. The preferences modal SHALL have `role="dialog"`, `aria-modal="true"`, and an accessible label. Focus SHALL be moved into the modal on open and restored to the trigger element on close. All interactive elements SHALL be keyboard-operable with visible focus indicators.

#### Scenario: Screen reader announces the banner
- **WHEN** the banner mounts
- **THEN** an `aria-live` region or `role="alert"` announces its presence

#### Scenario: Focus is managed in the modal
- **WHEN** the preferences modal opens
- **THEN** focus moves to the first focusable element inside the modal

#### Scenario: Focus is restored after modal closes
- **WHEN** the preferences modal closes
- **THEN** focus returns to the element that triggered the modal

---

### Requirement: Reduced motion support
Banner and modal entry/exit animations SHALL be suppressed when the visitor's OS preference is `prefers-reduced-motion: reduce`.

#### Scenario: No animation when prefers-reduced-motion is set
- **WHEN** the visitor has `prefers-reduced-motion: reduce` set
- **THEN** the banner and modal appear and disappear without transitions or animations
