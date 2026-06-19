# Frontend Implementation Plan: customer-order-management-frontend (KAN-29)

Context: `.claude/sessions/context_session_customer-order-management-frontend.md`

## Overview

Audit-first gap closure for admin customer orders. Reuse existing `CustomerOrdersPage`, `CustomerOrderDetailPage`, `OrderStatusControl`. Build only missing pieces.

**Do not rewrite passing list/detail/status components.**

---

## File 1: `frontend/src/types/customerOrder.ts` — MODIFY

Add to `CustomerOrderQueryParams`:

```typescript
createdFrom?: string;
createdTo?: string;
```

---

## File 2: `frontend/src/pages/CustomerOrdersPage.tsx` — MODIFY

- Date inputs with `data-testid="order-date-from"` / `order-date-to"`.
- URL sync via search params; reset page to 1 on filter change.
- Pass `createdFrom` / `createdTo` to `customerOrderService.list()`.

---

## File 3: `frontend/src/components/admin/OrderStatusTimeline.tsx` — CREATE

Milestones: Created (`createdAt`), Paid (`paidAt`), Cancelled (`cancelledAt`), Last updated (`updatedAt`). `data-testid="order-status-timeline"`.

---

## File 4: `frontend/src/pages/CustomerOrderDetailPage.tsx` — MODIFY

- Mount `OrderStatusTimeline`.
- Refund/return modals: `fullscreen="sm-down"`.
- Primary buttons: `admin-touch-btn` class.

---

## File 5: `frontend/src/components/admin/OrderStatusControl.tsx` — MODIFY

Apply `admin-touch-btn` on save button.

---

## File 6: Tests — CREATE / EXTEND

| File | Coverage |
|------|----------|
| `frontend/src/pages/__tests__/CustomerOrdersPage.test.tsx` | List, date params, empty/error |
| `frontend/src/pages/__tests__/CustomerOrderDetailPage.test.tsx` | Items, timeline, no supplier fields |
| `frontend/src/services/__tests__/customerOrderService.test.ts` | Date query params |
| `frontend/cypress/e2e/customer-orders.cy.ts` | E2E workflow, viewports, supplier absence |

### ESLint / RTL rules (MANDATORY — CI runs `npx eslint src --ext .ts,.tsx`)

**Use `findBy*` for async assertions — never `waitFor` + `getBy*`:**

```typescript
// ✅ Correct (passes testing-library/prefer-find-by)
expect(await screen.findByTestId('order-link-1')).toBeInTheDocument();
expect(await screen.findByText(/unable to load/i)).toBeInTheDocument();

// ❌ Wrong (fails CI frontend-quality)
await waitFor(() => expect(screen.getByTestId('order-link-1')).toBeInTheDocument());
```

**Debounce / fake timers:** keep `waitFor` only when asserting mock call counts after `jest.advanceTimersByTime` — not for DOM presence.

**Reference tests:** `ProductsPage.test.tsx`, `customer-management` plans in `.claude/doc/customer-management/frontend.md`.

Run before PR:

```bash
cd frontend
npx eslint src --ext .ts,.tsx
npx tsc --noEmit
npm test -- --watchAll=false --testPathPattern="customerOrder|CustomerOrdersPage|CustomerOrderDetail"
```

---

## File 7: `docs/frontend-standards.md` — MODIFY

Add "Admin customer-order panel patterns" subsection (pages, timeline, testids, supplier isolation).

---

## Verification

- Unit: 129/129 frontend suite green.
- Report: `openspec/changes/customer-order-management-frontend/reports/2026-06-19-step-5-unit-test-verification.md`
