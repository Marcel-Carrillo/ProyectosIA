# Context Session: customer-order-management-frontend (KAN-29)

## Jira & branch

- **Ticket:** KAN-29 (parent KAN-18)
- **Branch:** `feature/KAN-29-customer-order-management-frontend`
- **Scope:** Frontend admin UI gaps + minimal backend date-filter support

## OpenSpec artifacts

| Artifact | Path |
|----------|------|
| Proposal | `openspec/changes/customer-order-management-frontend/proposal.md` |
| Design | `openspec/changes/customer-order-management-frontend/design.md` |
| Spec | `openspec/changes/customer-order-management-frontend/specs/customer-order-management/spec.md` |
| Tasks | `openspec/changes/customer-order-management-frontend/tasks.md` |

## Precondition

Core admin customer-order UI exists from archived `customer-order-management`. Backend API verified in KAN-28. This change is **audit-first** — implement only confirmed gaps.

## Gaps to close

1. Date-range filter (`createdFrom`/`createdTo`) — backend list API + `CustomerOrdersPage` UI
2. `OrderStatusTimeline` on detail page (derived from `createdAt`, `paidAt`, `cancelledAt`, `updatedAt`)
3. Mobile admin patterns: `fullscreen="sm-down"` modals, `admin-touch-btn` (44px)
4. RTL page tests + Cypress E2E extension
5. Docs: `docs/api-spec.yml`, `docs/frontend-standards.md`

## Planning outputs (required before implementation)

- Backend plan: `.claude/doc/customer-order-management-frontend/backend.md`
- Frontend plan: `.claude/doc/customer-order-management-frontend/frontend.md`

## Standards to follow

- `docs/frontend-standards.md` — admin patterns, ESLint/testing-library rules
- `docs/backend-standards.md` — DDD layers, test + lint standards
- `docs/api-spec.yml` — admin customer-orders endpoints
- `docs/openspec-tasks-mandatory-steps.md` — verification + reports

## Business rules

- Never expose `supplierCost`, `supplierReference`, or internal supplier data in customer-order admin views
- Three independent status dimensions: `status`, `paymentStatus`, `fulfillmentStatus`
