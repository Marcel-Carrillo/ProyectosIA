# Step 8 — Unit Test Verification

**Date:** 2026-06-25  
**Change:** legal-pages-frontend  
**Status:** PASS

## Targeted Tests (ContentPage + StorefrontFooter)

| Suite | Tests | Result |
|-------|-------|--------|
| ContentPage.test.tsx | 5 | PASS |
| StorefrontFooter.test.tsx | 4 | PASS |
| **Targeted total** | **9** | **PASS** |

Runtime: 2.254 s

### Targeted test scenarios

| Test | Result |
|------|--------|
| ContentPage — `privacy` slug renders page title and section heading (ES) | PASS |
| ContentPage — `legal` slug renders page title and section heading (ES) | PASS |
| ContentPage — `privacy` slug renders English content (EN) | PASS |
| ContentPage — `legal` slug renders English content (EN) | PASS |
| ContentPage — unknown slug redirects to `/catalog` | PASS |
| StorefrontFooter — renders `/pages/privacy` link with label "Política de privacidad" (ES) | PASS |
| StorefrontFooter — renders `/pages/legal` link with label "Aviso legal" (ES) | PASS |
| StorefrontFooter — renders `/pages/privacy` link with label "Privacy Policy" (EN) | PASS |
| StorefrontFooter — renders `/pages/legal` link with label "Legal Notice" (EN) | PASS |

## Full Suite

| Metric | Value |
|--------|-------|
| Test suites | 37 passed, 0 failed |
| Tests | 159 passed, 0 failed |
| Snapshots | 0 |
| Runtime | 9.571 s |

No regressions introduced.

## Notable fixes applied in this step

- Fixed `package.json` Jest `moduleNameMapper`: mapped `react-router-dom` and `react-router` to their CJS `main.js` entry points (previously pointing to ESM `index.js` or non-existent `dist/development/index.js`). This unblocked all tests that use `MemoryRouter` (pre-existing issue affecting the whole suite).
- Added `pages` namespace to `renderWithI18n.tsx` test utility so `ContentPage` tests can resolve real strings.

## DB State

Not applicable — frontend-only change.
