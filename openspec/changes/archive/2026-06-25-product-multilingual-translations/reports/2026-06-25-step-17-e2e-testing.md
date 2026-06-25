# Step 17 — E2E testing (Playwright)

**Date:** 2026-06-25  
**Status:** PASS

## Environment

- Docker stack: `docker compose up -d` (db, backend :3000, frontend :3001)
- Spec: `e2e/product-translations.spec.ts`
- Command: `npx playwright test e2e/product-translations.spec.ts`

## Results

| Step | Description | Result |
|------|-------------|--------|
| 17.1 | Frontend + backend running, DB seeded | PASS |
| 17.2 | Catalog loads with EN product names | PASS |
| 17.3 | Language toggle ES → Spanish product names | PASS |
| 17.4 | Toggle back EN → English names | PASS |
| 17.5 | Product detail ES switch without full reload | PASS |
| 17.6 | Admin edit form EN/ES fields pre-populated | PASS |
| 17.7 | Edit ES name, save, verify storefront, restore | PASS |

**Playwright:** 1 passed (2.3s)

## Notes

- Language switcher clicks use programmatic `button[aria-label]` click to avoid webpack dev overlay intercepting pointer events.
- Admin login via `page.request.post('/api/admin/auth/login')` (refresh cookie); backend restart required if rate-limited (429).
- Fixed `UpdateProductInput.translations` type so admin save compiles in Docker frontend build.
