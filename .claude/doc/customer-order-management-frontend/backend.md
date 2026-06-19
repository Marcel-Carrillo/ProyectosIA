# Backend Implementation Plan: customer-order-management-frontend (KAN-29)

Context: `.claude/sessions/context_session_customer-order-management-frontend.md`

## Overview

Minimal backend slice: add optional `createdFrom` / `createdTo` query params to `GET /api/admin/customer-orders`. Frontend date-range filter depends on this. No schema migration.

**Affected layers:** Domain repository interface → Infrastructure repository → Controller → API spec → tests.

---

## File 1: `backend/src/domain/repositories/customerOrderRepository.ts` — MODIFY

Add to `CustomerOrderListFilters`:

```typescript
createdFrom?: string;
createdTo?: string;
```

---

## File 2: `backend/src/infrastructure/repositories/customerOrderRepository.ts` — MODIFY

- Add UTC day-bound helpers for inclusive date-only filters.
- When `createdFrom` / `createdTo` present, add Prisma `where.createdAt` gte/lte.

---

## File 3: `backend/src/presentation/controllers/customerOrderController.ts` — MODIFY

Pass `createdFrom` and `createdTo` from `req.query` into list filters.

---

## File 4: `docs/api-spec.yml` — MODIFY

Document optional `createdFrom` and `createdTo` (ISO date `YYYY-MM-DD`) on `GET /api/admin/customer-orders`.

---

## File 5: Tests — CREATE / EXTEND

| File | Coverage |
|------|----------|
| `backend/src/infrastructure/repositories/__tests__/customerOrderRepository.dateFilter.test.ts` | Prisma `where.createdAt` bounds |
| `backend/src/presentation/controllers/__tests__/customerOrderController.test.ts` | Query param forwarding |

### Lint / CI requirements (MANDATORY before PR)

Run from `backend/`:

```bash
npm run lint
npm test -- --testPathPattern=customerOrder --watchAll=false
```

- Prefix intentionally unused params with `_` (ESLint `@typescript-eslint/no-unused-vars`).
- No `any` in new code unless unavoidable (warn-level rule).
- Mirror existing test file structure: `jest.mock()` at top, `beforeEach(() => jest.clearAllMocks())`.

---

## Verification

- curl: `GET /api/admin/customer-orders?createdFrom=2026-06-01&createdTo=2026-06-30` → 200 with filtered envelope.
- Report: `openspec/changes/customer-order-management-frontend/reports/2026-06-19-step-6-curl-date-filter.md`
