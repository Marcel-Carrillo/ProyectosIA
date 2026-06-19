## Context

KAN-30 is the **Integration** subtask of KAN-18 (customer order management). Backend (KAN-28) and frontend (KAN-29) were delivered in separate feature branches and verified individually. The full-stack module exists on `master` (originally via archived `customer-order-management`, PR #21) with KAN-29 frontend gaps closed in PR #30 — except the Cypress headless run (KAN-29 tasks 7.4/7.6), which requires both servers and a real DB.

Main requirements: `openspec/specs/customer-order-management/spec.md`.

Jira KAN-30 steps: merge backend + frontend branches, run full test suites, verify supplier-cost isolation and three-status separation, commit + PR, then archive parent change and close KAN-18.

## Goals / Non-Goals

**Goals:**

- Certify the merged customer-order admin experience end-to-end (API + UI + DB).
- Unblock and pass Cypress E2E (`customer-orders.cy.ts`) and Playwright MCP smoke flow.
- Produce mandatory verification reports (unit, curl, E2E) under `openspec/changes/customer-order-management-integration/reports/`.
- Align `docs/api-spec.yml` with actual responses; mark legacy paths superseded.
- Run adversarial review; fix only blocking/major defects found.
- Open integration PR; transition KAN-30 to **En revisión**.

**Non-Goals:**

- New product behavior, schema changes, or new endpoints (unless audit reveals a blocker).
- Supplier-order generation E2E (KAN-19).
- Order status history model.
- Refund/return execution flows (only verify entry-point button visibility rules).

## Decisions

### D1 — Verification-first apply, not greenfield build

**Resolution:** `/opsx:apply` is an audit + full-stack verification workflow. Code changes are conditional ("fix if verification fails"). **Why:** KAN-28/KAN-29 already delivered the module; duplicating work risks regressions.

**Alternative considered:** Re-implement integration from scratch — rejected as wasteful.

### D2 — Branch strategy: integration branch from master

**Resolution:** Create `feature/KAN-30-customer-order-management-integration` from `master`. If KAN-28/KAN-29 branches are not yet merged, merge them into the integration branch first (per Jira). **Why:** Jira explicitly lists merge of `feature/customer-order-management-backend` + `feature/customer-order-management-frontend`.

**Alternative considered:** Continue on KAN-29 branch — rejected; integration deserves its own ticket-scoped branch.

### D3 — Dual E2E: Cypress headless + Playwright MCP

**Resolution:** Run Cypress headless as the CI-equivalent gate (unblocks KAN-29 7.4/7.6). Run Playwright MCP for responsive viewport checks and agent-executable smoke documentation. **Why:** Project mandates both in `docs/openspec-tasks-mandatory-steps.md`; Cypress is the regression spec already written.

### D4 — Supplier isolation as hard gate

**Resolution:** Assert absence of `supplierId`, `supplierReference`, `supplierCost` in every curl response body and in rendered DOM (Cypress + Playwright). Fail the change if any leak is found. **Why:** Highest-stakes security/business rule for customer-order surfaces.

### D5 — DB cleanup after every mutating test

**Resolution:** All curl POST/create and E2E order creation must delete the created order and verify row counts match baseline. **Why:** Prevents polluted dev DB and flaky subsequent runs.

### D6 — Minimal source edits

**Resolution:** Touch `backend/src/**` or `frontend/src/**` only when verification surfaces a defect. Cypress fixes (auth seed, `findBy*` waits) are allowed in `frontend/cypress/e2e/customer-orders.cy.ts`. **Why:** Integration scope is certification, not feature expansion.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| KAN-29 Cypress binary/install failure | Diagnose root cause in E2E report; retry `npx cypress install`; use `cy.request` for setup to reduce flakiness |
| Backend/frontend branch drift from master | Audit merge conflicts early in step 1; prefer master as source of truth |
| E2E leaves orphan orders | Explicit delete in Cypress `after` hook + post-test count check |
| API spec drift (legacy `/customer-orders*` paths) | Step 8 aligns admin block; mark legacy paths `deprecated: true` |
| Accidental scope creep into KAN-19 | Tasks exclude supplier-order generation E2E |

## Migration Plan

No database migration expected. Deploy path: merge integration PR to `master` → run `/opsx:archive customer-order-management-integration` → transition KAN-30 to **Finalizado** and KAN-18 per Jira workflow.

Rollback: revert integration PR if E2E or supplier-isolation gate fails post-merge.

## Open Questions

- Whether KAN-28/KAN-29 branches are already on `master` — apply agent confirms at step 1 and skips merge if unnecessary.
