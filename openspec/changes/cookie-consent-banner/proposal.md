## Why

The storefront has no cookie consent mechanism despite the existing privacy policy (`/pages/privacy`) already referencing RGPD/LSSI-CE obligations and promising a cookie management control. This is both a legal gap (EU ePrivacy Directive / LSSI-CE) and a brand-trust gap for a fashion ecommerce targeting Spanish-speaking customers. No analytics or marketing scripts currently fire, but the stubbed `reportWebVitals` call in `index.tsx` and any future tracking integrations must be gated behind user consent before they can be activated.

## What Changes

- Add a non-blocking cookie consent banner anchored to the bottom of the storefront viewport, visible on first visit and after consent expiry or policy version bump.
- Add a cookie preferences modal with three categories: **Necessary** (always on, locked), **Analytics** (opt-in), **Marketing** (opt-in). Actions: Accept all / Reject all / Save preferences.
- Add a `CookieConsentProvider` context and `useCookieConsent` hook that persists the decision to `localStorage` (versioned + timestamped) and exposes consent state to any future non-essential script.
- Add a "Cookie settings" link in `StorefrontFooter` that reopens the preferences modal.
- Add a `cookies` i18n namespace (es/en) for all banner and modal copy.
- Gate the stubbed `reportWebVitals` call in `index.tsx` behind `analytics` consent.
- Update `docs/frontend-standards.md` with the consent component pattern and the convention that non-essential scripts must check `useCookieConsent` before initialising.

## Capabilities

### New Capabilities

- `cookie-consent`: Cookie consent banner, preferences modal, `CookieConsentProvider`/`useCookieConsent` hook, `localStorage` persistence with versioning and expiry, "Cookie settings" footer entry, and i18n namespace. Frontend-only — no backend endpoints or database changes.

### Modified Capabilities

*(none — no existing spec requirements change)*

## Impact

- **Customer-facing:** new banner and modal UI on every storefront page; footer gains a "Cookie settings" action.
- **Internal / admin:** none.
- **APIs / data model:** none — frontend-only feature; no `api-spec.yml` or `data-model.md` changes.
- **Supplier fulfillment / order lifecycle:** none.
- **Dependencies:** no new npm packages required (vanilla React context, `localStorage`, `ResizeObserver`-style patterns already in the codebase).
- **Files created:** `CookieConsentBanner.tsx`, `CookiePreferencesModal.tsx`, `CookieConsentContext.tsx`, `constants/cookieConsent.ts`, `i18n/locales/es/cookies.json`, `i18n/locales/en/cookies.json`, unit test files.
- **Files modified:** `StorefrontLayout.tsx`, `StorefrontFooter.tsx`, `i18n/index.ts`, `storefront.css`, `index.tsx`, `docs/frontend-standards.md`.

## Non-goals

- Server-side consent audit log or `ConsentLog` entity.
- Standalone cookie policy page with a full cookie inventory table (the existing privacy page covers the legal text for MVP).
- Real analytics or marketing vendor integration (out of scope until consent is in place).
- IAB TCF / Consent Management Platform (CMP) compliance.
- Cross-device consent sync.
