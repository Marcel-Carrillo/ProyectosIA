# Unit Test Report — frontend-i18n-multilanguage

**Date:** 2026-06-21  
**Tool:** react-scripts test (Jest + React Testing Library)

## Results

| Metric | Value |
|--------|-------|
| Test Suites | 31 passed / 31 total |
| Tests | 138 passed / 138 total |
| Failures | 0 |
| Duration | ~8s |

## Changes to test files

- `src/App.test.tsx` — changed `getByLabelText('Mavile home')` to `getByRole('banner')` (language-agnostic)
- `src/components/storefront/Pagination.test.tsx` — migrated to `renderWithI18n` (lng: 'en') to maintain English assertions
- `src/pages/storefront/__tests__/CartPage.test.tsx` — migrated to `renderWithI18n` (lng: 'en')
- `src/pages/storefront/__tests__/LoginPage.test.tsx` — migrated to `renderWithI18n` (lng: 'en')

## New files

- `src/test-utils/renderWithI18n.tsx` — wraps render with `I18nextProvider` using isolated i18n instance; accepts `lng` option ('es' | 'en', default 'en')
