# Step F — Unit tests and DB verification (2026-06-18)

## Commands

- Backend: `npm test` (30 suites, 232 tests) — **PASS**
- Backend: `npx tsc --noEmit` — **PASS**
- Frontend: `CI=true npm test -- --watchAll=false` (22 suites, 107 tests) — **PASS**
- Frontend: `npx tsc --noEmit` — **PASS**
- Prisma: `npx prisma migrate dev --name unified_auth_checkout` — applied
- Seeds: `npx ts-node prisma/seedAdmin.ts`, `npx ts-node prisma/seedCoupons.ts`

## Database

- Migration `20260618121029_unified_auth_checkout` adds AdminUser, CustomerAccount, wishlist, coupon tables.
- Admin user seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Coupon `WELCOME10` seeded (10% off).

## Notes

- `index.ts` skips `app.listen()` when `NODE_ENV=test` to allow supertest integration tests.
