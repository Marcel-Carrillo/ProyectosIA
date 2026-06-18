# Unit Test & DB Verification Report

**Change:** supplier-management  
**Step:** 11 (sections 10–11 of tasks.md)  
**Date:** 2026-06-17

---

## Database Baseline (pre-test)

| Table | Count |
|---|---|
| Supplier | 0 |
| Product | 29 |
| ProductVariant | 33 |

All tests use in-memory mocks (Jest) — no DB writes occur during the unit suite.

---

## Backend Test Suite

**Command:** `npx jest --passWithNoTests` (from `backend/`)

| Metric | Result |
|---|---|
| Test Suites | 21 passed, 21 total |
| Tests | 195 passed, 195 total |
| Time | ~3.8 s |
| TypeScript (`tsc --noEmit`) | Clean |

**New supplier test files (52 tests):**
- `validator.supplier.test.ts` — 19 cases (name required, length limits, email format, status enum)
- `supplierService.test.ts` — 17 cases (create, update, soft-delete, not-found, validation errors)
- `supplierController.test.ts` — 14 cases (all routes, envelope, error mapping, parseIdParam)
- `supplierIsolation.test.ts` — 3 cases (no supplier fields in public product payloads)

**Pre-existing suites (no regressions):**
- productRoutes, categoryRoutes, productService, validator, productRepository, storefront, and all other suites remain green.

---

## Frontend Test Suite

**Command:** `CI=true npx react-scripts test --watchAll=false` (from `frontend/`)

| Metric | Result |
|---|---|
| Test Suites | 15 passed, 15 total |
| Tests | 72 passed, 72 total |
| Time | ~3.3 s |
| TypeScript (`tsc --noEmit`) | Clean |

**New/modified supplier test files (17 tests):**
- `StatusBadge.test.tsx` — extended with `Blocked → bg-danger` case
- `SuppliersPage.test.tsx` — 9 RTL tests (list, empty, error, filter, search debounce, reset, create modal, deactivate success, deactivate failure)
- `SupplierFormModal.test.tsx` — 8 RTL tests (validation, create, API error mapping, edit pre-population, status select visibility, save button disabled while saving)

**Fix applied to SuppliersPage.test.tsx:**  
Auto-mock of `supplierService` also mocked `extractSupplierErrorMessage`, causing `setDeactivateError(undefined)` and hiding the error Alert. Fixed by switching to a partial mock with `jest.requireActual` to preserve real helper functions.

---

## Database State (post-test)

| Table | Count |
|---|---|
| Supplier | 0 |
| Product | 29 |
| ProductVariant | 33 |

**Result: DB unchanged.** All tests use mocks; no persistent side effects.

---

## Summary

All 267 tests (195 backend + 72 frontend) pass. TypeScript is clean on both layers. No regressions detected in storefront, product, or category modules.
