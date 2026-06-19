## Context

KAN-29 targets the **frontend-only** slice of customer order management (parent KAN-18). The backend admin API (`/api/admin/customer-orders*`) is live and verified (KAN-28). Core React pages and `OrderStatusControl` already exist from the archived `customer-order-management` change.

This change is **audit-first**: confirm what already passes, then implement only the gaps below.

## Goals / Non-Goals

**Goals**

- Close KAN-29 deliverables not yet satisfied: date-range filter, status timeline, mobile admin patterns, test coverage.
- Preserve supplier-data isolation and three independent status dimensions in the UI.
- Keep server-side pagination and existing URL-sync filter pattern.

**Non-Goals**

- Status history table or event-sourced timeline.
- Customer storefront changes.
- Large refactors of working list/detail/status components.

## Decisions

### 1. Audit before build

Run a file-level audit against `frontend/src/pages/CustomerOrdersPage.tsx`, `CustomerOrderDetailPage.tsx`, `components/admin/OrderStatusControl.tsx`, and `services/customerOrderService.ts`. Record PASS/gap per KAN-29 item in the step-3 report. Skip rewrite of passing areas.

### 2. Date-range filter requires backend coordination

`GET /api/admin/customer-orders` currently supports `status`, `paymentStatus`, `fulfillmentStatus`, `search`, `sort`, `order`, `page`, `pageSize` — **not** `createdFrom`/`createdTo`.

**Decision:** Add optional ISO date query params on the backend list endpoint (minimal Prisma `where.createdAt` filter) in the same change if audit confirms they are missing. Update `docs/api-spec.yml` accordingly. Frontend passes params via existing `customerOrderService.list()`.

**Alternative (only if user descopes):** ship frontend controls disabled/hidden until backend lands — not the default path.

### 3. Derived status timeline (no history model)

New `OrderStatusTimeline` component renders milestones from:

| Milestone | Source field |
|-----------|--------------|
| Created | `createdAt` |
| Paid | `paidAt` (if set) |
| Cancelled | `cancelledAt` (if set) |
| Last updated | `updatedAt` |

Include a caption: timeline shows key milestones, not every intermediate transition.

### 4. Reuse established admin patterns

- `Pagination`, `StatusBadge`, `OrderStatusControl` — keep as-is.
- Modals on detail page: add `fullscreen="sm-down"` (match `CustomerFormModal`, `ProductsPage`).
- Primary actions: apply `.admin-touch-btn` or equivalent 44px min-height on mobile breakpoints.

### 5. Testing strategy

| Layer | Scope |
|-------|--------|
| RTL | `CustomerOrdersPage.test.tsx`, `CustomerOrderDetailPage.test.tsx` — filters, search params, timeline, status PATCH, no supplier fields in DOM |
| Cypress | Extend `frontend/cypress/e2e/customer-orders.cy.ts` — date filter, responsive 360/768/1280, supplier-field absence |
| Service | Existing `customerOrderService.test.ts` — extend if new query params added |

Frontend-only DB verification: N/A for unit tests; E2E cleanup deletes test orders via Prisma script (existing pattern).

## Risks / Trade-offs

- **Timeline fidelity** — admins see milestones only, not full transition history. Mitigation: caption + future history model ticket.
- **Date filter timezone** — use date-only inputs; backend compares `createdAt` in UTC day bounds. Document in api-spec.
- **Dual Cypress files** — `customer-orders.cy.ts` and `customerOrders.cy.ts` exist; consolidate or extend the canonical one during apply.

## Migration Plan

No data migration. Deploy frontend (+ optional backend filter) behind existing admin auth. Rollback: revert PR.

## Open Questions

- None blocking — proceed with audit-first gap closure.
