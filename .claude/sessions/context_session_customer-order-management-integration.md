# Session: customer-order-management-integration (KAN-30)

## Jira

- **Ticket:** KAN-30 (Integration subtask of KAN-18)
- **Parent:** KAN-18 Customer order management
- **Siblings:** KAN-28 (backend, merged), KAN-29 (frontend, merged via PR #30)

## OpenSpec artifacts

- [proposal](../../openspec/changes/customer-order-management-integration/proposal.md)
- [design](../../openspec/changes/customer-order-management-integration/design.md)
- [specs](../../openspec/changes/customer-order-management-integration/specs/customer-order-management/spec.md)
- [tasks](../../openspec/changes/customer-order-management-integration/tasks.md)

## Scope summary

Verification-first integration change: certify full-stack customer order admin (API + UI) end-to-end. Unblock KAN-29 Cypress 7.4/7.6. No new features unless audit finds blockers.

## Branch

`feature/KAN-30-customer-order-management-integration` from `master`

## Plans

- Backend: `.claude/doc/customer-order-management-integration/backend.md`
- Frontend: `.claude/doc/customer-order-management-integration/frontend.md`

## Key verification gates

- Supplier fields absent in all API responses and DOM
- Three independent status dimensions
- curl + Cypress + Playwright E2E
- Reports under `openspec/changes/customer-order-management-integration/reports/`
