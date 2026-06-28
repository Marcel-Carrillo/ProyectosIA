## 0. Setup: Create Feature Branch (MANDATORY — FIRST STEP)

- [x] 0.1 Read `ai-specs/skills/using-git-worktrees/SKILL.md` and decide on workspace isolation strategy
- [x] 0.2 Create feature branch `feature/cookie-consent-banner` from `develop`
- [x] 0.3 Verify branch creation and current branch status

## 1. Constants and Types

- [x] 1.1 Create `frontend/src/constants/cookieConsent.ts` with `CONSENT_VERSION`, `CONSENT_STORAGE_KEY`, `CONSENT_EXPIRY_DAYS`, and `CookieCategory` type definitions
- [x] 1.2 Define `ConsentState` and `CookieConsentContextValue` TypeScript interfaces in the same file

## 2. Cookie Consent Context and Hook

- [x] 2.1 Create `frontend/src/context/CookieConsentContext.tsx` with `CookieConsentProvider` that reads from `localStorage` on mount (with try/catch guard for private browsing)
- [x] 2.2 Implement `useCookieConsent` hook that exposes `{ consent, saveConsent, openPreferences, closePreferences, isPreferencesOpen }`
- [x] 2.3 Implement `isConsentValid()` helper that checks `version === CONSENT_VERSION` and `timestamp` not older than `CONSENT_EXPIRY_DAYS`
- [x] 2.4 Implement `saveConsent()` that writes to `localStorage` and updates context state atomically
- [x] 2.5 Wrap the storefront subtree in `App.tsx` with `<CookieConsentProvider>`

## 3. i18n — cookies namespace

- [x] 3.1 Create `frontend/src/i18n/locales/es/cookies.json` with banner message, action labels (Aceptar todo, Rechazar todo, Personalizar), modal title, category names/descriptions, and footer link label
- [x] 3.2 Create `frontend/src/i18n/locales/en/cookies.json` with equivalent English copy
- [x] 3.3 Register the `cookies` namespace in `frontend/src/i18n/index.ts`

## 4. Cookie Consent Banner Component

- [x] 4.1 Create `frontend/src/components/storefront/CookieConsentBanner.tsx` that renders only when `!isConsentValid()` and no prior decision exists
- [x] 4.2 Implement "Accept all", "Reject all", "Customize" actions using `useCookieConsent`
- [x] 4.3 Use `role="region"` + `aria-label` and an `aria-live="polite"` announcement on mount
- [x] 4.4 Apply `prefers-reduced-motion` guard to entry animation via CSS class
- [x] 4.5 Mount the banner inside `StorefrontLayout.tsx` below `<main>`

## 5. Cookie Preferences Modal Component

- [x] 5.1 Create `frontend/src/components/storefront/CookiePreferencesModal.tsx` rendered via `ReactDOM.createPortal` at `document.body`
- [x] 5.2 Implement three category rows: Necessary (toggle locked on), Analytics, Marketing — each with name, description, and a toggle
- [x] 5.3 Add "Save preferences", "Accept all", "Reject all" actions calling `saveConsent()` with the appropriate payload
- [x] 5.4 Implement focus trap: on open, move focus to first focusable element; Tab/Shift+Tab cycle within modal; Escape closes without saving
- [x] 5.5 Add `role="dialog"`, `aria-modal="true"`, and accessible `aria-labelledby` pointing to the modal title
- [x] 5.6 Restore focus to the trigger element on close
- [x] 5.7 Pre-populate toggles with current consent values when opened from the footer

## 6. Footer Integration

- [x] 6.1 Add "Cookie settings" button/link to `StorefrontFooter.tsx` that calls `openPreferences()` from `useCookieConsent`
- [x] 6.2 Wire i18n key from `cookies` namespace for the footer label

## 7. CSS Styles

- [x] 7.1 Add `storefront-cookie__banner` styles to `storefront.css`: `position: fixed; bottom: 0; left: 0; right: 0`, soft shadow/scrim, brand palette, rounded top corners, responsive padding
- [x] 7.2 Add `storefront-cookie__modal` styles: full-screen scrim overlay (`z-index: 200`), centered card, rounded corners, brand typography
- [x] 7.3 Add `storefront-cookie__toggle` styles matching the brand aesthetic (pill-shaped, brand accent color for on state)
- [x] 7.4 Add `storefront-cookie__category` row styles (name, description, toggle aligned)
- [x] 7.5 Add `@media (prefers-reduced-motion: reduce)` overrides to suppress all banner/modal transitions

## 8. Gate reportWebVitals Behind Analytics Consent

- [x] 8.1 In `frontend/src/index.tsx`, read the stored consent from `localStorage` on app bootstrap
- [x] 8.2 Call `reportWebVitals` only when `analytics` consent is `true`
- [x] 8.3 Subscribe to consent context updates so that granting analytics consent after mount also triggers `reportWebVitals`

## 9. Unit Tests

- [x] 9.1 Create `frontend/src/context/__tests__/CookieConsentContext.test.tsx`: test `isConsentValid` with valid, expired, and version-mismatched entries; test `saveConsent` writes correct shape to `localStorage`; test hook re-render on consent update
- [x] 9.2 Create `frontend/src/components/storefront/__tests__/CookieConsentBanner.test.tsx`: render when no consent; not render when valid consent exists; "Accept all" calls saveConsent with all-true; "Reject all" calls saveConsent with analytics/marketing false; "Customize" opens modal
- [x] 9.3 Create `frontend/src/components/storefront/__tests__/CookiePreferencesModal.test.tsx`: renders with correct initial toggle states; Necessary toggle is disabled; "Save preferences" saves custom selection; Escape key closes without saving; focus moves to first focusable element on open

## 10. Run Unit Tests and Verify State (MANDATORY)

- [x] 10.1 Run targeted tests: `cd frontend && npm test -- --testPathPattern="CookieConsent|cookieConsent" --watchAll=false`
- [x] 10.2 Run the full frontend test suite: `npm test -- --watchAll=false`
- [x] 10.3 Verify no regressions in pre-existing tests
- [x] 10.4 Create report `openspec/changes/cookie-consent-banner/reports/2026-06-28-step-10-unit-test-and-db-verification.md`
- [x] 10.5 Mark step complete only after tests pass and report exists

## 11. E2E Testing with Playwright MCP (MANDATORY — AGENT MUST EXECUTE)

- [x] 11.1 Ensure frontend (`http://localhost:3001`) and backend (`http://localhost:3000`) are running
- [x] 11.2 Navigate to `http://localhost:3001/catalog` with a clean `localStorage` and verify the banner appears
- [x] 11.3 Click "Accept all" and verify banner is dismissed; verify `localStorage` entry has `analytics: true, marketing: true`
- [x] 11.4 Reload page and verify banner does NOT reappear
- [x] 11.5 Open "Cookie settings" from the footer; verify modal opens with toggles pre-populated (all on)
- [x] 11.6 Clear `localStorage`, reload, click "Customize", toggle Analytics off, click "Save preferences"; verify `analytics: false` in storage and modal closes
- [x] 11.7 Clear `localStorage`, reload, click "Reject all"; verify `analytics: false, marketing: false` in storage
- [x] 11.8 Verify keyboard navigation: Tab cycles through banner actions; Escape closes modal without saving
- [x] 11.9 Restore `localStorage` to clean state after all E2E tests
- [x] 11.10 Create report `openspec/changes/cookie-consent-banner/reports/2026-06-28-step-11-e2e-testing.md`
- [x] 11.11 Mark step complete only after all workflows pass and report exists

## 12. Update Technical Documentation (MANDATORY)

- [x] 12.1 Update `docs/frontend-standards.md`: add a "Cookie Consent" section documenting the `CookieConsentProvider`, `useCookieConsent` hook, `cookies` i18n namespace, and the mandatory convention that non-essential scripts must call `useCookieConsent()` before initialising
- [x] 12.2 Update the privacy policy copy in `frontend/src/i18n/locales/es/pages.json` and `en/pages.json` to replace the "próximamente" cookie management placeholder with a reference to the now-available "Ajustes de cookies / Cookie settings" control

## 13. Commit and Create Pull Request (MANDATORY — LAST STEP)

- [x] 13.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [x] 13.2 Verify all tasks are `[x]` and reports exist under `openspec/changes/cookie-consent-banner/reports/`
- [x] 13.3 Stage all relevant files (exclude `.env`, `node_modules`, `dist`, `coverage`)
- [x] 13.4 Create commit: `feat(storefront): add GDPR-compliant cookie consent banner and preferences modal`
- [x] 13.5 Push branch `feature/cookie-consent-banner` to remote origin
- [x] 13.6 Create Pull Request with `gh pr create` — PR #48 merged to develop
