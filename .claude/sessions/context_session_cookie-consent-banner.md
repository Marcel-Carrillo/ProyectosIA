# Cookie Consent Banner — Session Context

## Change
- Name: `cookie-consent-banner`
- Branch: `feature/cookie-consent-banner`
- Schema: spec-driven

## Artifacts
- Proposal: `openspec/changes/cookie-consent-banner/proposal.md`
- Spec: `openspec/changes/cookie-consent-banner/specs/cookie-consent/spec.md`
- Design: `openspec/changes/cookie-consent-banner/design.md`
- Tasks: `openspec/changes/cookie-consent-banner/tasks.md`

## Summary
Frontend-only GDPR/LSSI-CE cookie consent feature. No backend changes, no API changes, no Prisma changes.

## Key Design Decisions (from design.md)
- `localStorage` key: `mavile.cookieConsent` with schema: `{ version, timestamp, categories: { necessary, analytics, marketing } }`
- `CONSENT_VERSION = '1'` in `constants/cookieConsent.ts` — bump to re-prompt all users
- `CookieConsentProvider` wraps storefront subtree in `App.tsx` around the `<Route element={<StorefrontLayout />}>` block
- Banner: `position: fixed; bottom: 0` — non-blocking, no full-screen overlay
- Modal: `ReactDOM.createPortal` at `document.body`, `z-index: 200`
- Focus trap: native implementation, no new npm packages
- `reportWebVitals` in `index.tsx` gated behind `analytics` consent

## Files to Create
- `frontend/src/constants/cookieConsent.ts`
- `frontend/src/context/CookieConsentContext.tsx`
- `frontend/src/components/storefront/CookieConsentBanner.tsx`
- `frontend/src/components/storefront/CookiePreferencesModal.tsx`
- `frontend/src/i18n/locales/es/cookies.json`
- `frontend/src/i18n/locales/en/cookies.json`
- `frontend/src/context/__tests__/CookieConsentContext.test.tsx`
- `frontend/src/components/storefront/__tests__/CookieConsentBanner.test.tsx`
- `frontend/src/components/storefront/__tests__/CookiePreferencesModal.test.tsx`

## Files to Modify
- `frontend/src/App.tsx` — wrap storefront routes in CookieConsentProvider
- `frontend/src/components/storefront/StorefrontLayout.tsx` — mount CookieConsentBanner
- `frontend/src/components/storefront/StorefrontFooter.tsx` — add "Cookie settings" link
- `frontend/src/i18n/index.ts` — register cookies namespace
- `frontend/src/styles/storefront.css` — add cookie styles
- `frontend/src/index.tsx` — gate reportWebVitals
- `frontend/src/test-utils/renderWithI18n.tsx` — add cookies namespace
- `docs/frontend-standards.md` — Cookie Consent section
- `frontend/src/i18n/locales/es/pages.json` — update cookie placeholder
- `frontend/src/i18n/locales/en/pages.json` — update cookie placeholder
