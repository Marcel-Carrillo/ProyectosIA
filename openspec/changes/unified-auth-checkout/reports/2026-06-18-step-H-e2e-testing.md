# Step H — E2E testing (2026-06-18) — updated

## Playwright UI E2E

Playwright browser E2E was not run in CI for this change. Equivalent coverage was executed via **backend HTTP integration tests** and **frontend unit tests**.

## Covered flows (integration tests)

| Task | Test file | Status |
|------|-----------|--------|
| H.1 Admin login → customers | `adminAuthRoutes.test.ts` + `checkoutIntegration` C3.1 admin list | PASS |
| H.2 Cart → checkout → confirmation | `checkoutIntegration.test.ts` guest checkout | PASS |
| H.3 Register → wishlist → checkout | `checkoutIntegration` B5.1 + C3.2 | PASS |

## Frontend unit smoke

- `RequireAdminAuth.test.tsx` — redirect to `/admin/login`
- `CartPage.test.tsx`, `LoginPage.test.tsx`

## Manual follow-up (optional)

Run Cypress or Playwright against `localhost:3001` for visual regression if needed.
