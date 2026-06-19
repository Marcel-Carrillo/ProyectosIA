# Tasks

> Frontend slice (Jira **KAN-29**, parent KAN-18). Structured per `docs/openspec-tasks-mandatory-steps.md`
> and `openspec/config.yaml`. Reports go under `openspec/changes/customer-order-management-frontend/reports/`.
>
> **Precondition:** Core admin customer-order UI exists from archived `customer-order-management`;
> backend API verified in KAN-28. This change is **audit-first** — build only confirmed gaps.
>
> **Agent workflow (MANDATORY):** during `/opsx:apply`, mark each sub-task `- [ ]` → `- [x]`
> in this file immediately when done. Verification steps are marked `[x]` only after tests pass AND
> the report file exists. Never delegate testing to the user.

## 0. Setup: Create Feature Branch (MANDATORY — FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to choose workspace isolation (current checkout vs Git worktree)
- [x] 0.2 Create and switch to feature branch `feature/KAN-29-customer-order-management-frontend` from `master`
- [x] 0.3 Verify branch creation: `git branch --show-current` and `git status`

## 1. Audit: Verify KAN-29 Deliverables Against Main Spec

- [x] 1.1 Confirm `frontend/src/pages/CustomerOrdersPage.tsx` — pagination, status/payment/fulfillment filters, search, URL sync, card/table dual render
- [x] 1.2 Confirm `frontend/src/pages/CustomerOrderDetailPage.tsx` — items, address snapshots, totals, `OrderStatusControl`, linked supplier orders/refunds/returns
- [x] 1.3 Confirm `frontend/src/components/admin/OrderStatusControl.tsx` — three independent status selects, single PATCH with changed fields only
- [x] 1.4 Confirm `frontend/src/services/customerOrderService.ts` and `frontend/src/types/customerOrder.ts` match `docs/api-spec.yml`
- [x] 1.5 Gap check: date-range filter (`createdFrom`/`createdTo`) on list UI and backend query params
- [x] 1.6 Gap check: `OrderStatusTimeline` on detail page (derived from `createdAt`, `paidAt`, `cancelledAt`, `updatedAt`)
- [x] 1.7 Gap check: `fullscreen="sm-down"` on detail modals; 44px tap targets on primary actions; 360px responsive
- [x] 1.8 Gap check: RTL page tests and Cypress coverage; no supplier fields rendered
- [x] 1.9 Record audit PASS/gap matrix in step 5 report; implement only gaps

## 2. Backend (conditional): Date-range list filter

> Skip if audit confirms `createdFrom`/`createdTo` already work end-to-end.

- [x] 2.1 Add optional `createdFrom`/`createdTo` to list query in `backend/src/infrastructure/repositories/customerOrderRepository.ts` (Prisma `createdAt` day bounds, UTC)
- [x] 2.2 Wire params through service, controller, and validator if needed
- [x] 2.3 Update `docs/api-spec.yml` `GET /api/admin/customer-orders` query parameters
- [x] 2.4 Add/adjust unit tests for date-range filtering in customer-order test suites

## 3. Frontend: Close KAN-29 gaps

- [x] 3.1 Add `createdFrom`/`createdTo` to `CustomerOrderQueryParams` in `frontend/src/types/customerOrder.ts`
- [x] 3.2 Add date-range inputs + URL sync on `frontend/src/pages/CustomerOrdersPage.tsx`; reset page to 1 on change; `data-testid="order-date-from"` / `order-date-to"`
- [x] 3.3 Create `frontend/src/components/admin/OrderStatusTimeline.tsx`; mount on `CustomerOrderDetailPage.tsx` with milestone caption
- [x] 3.4 Add `fullscreen="sm-down"` to refund/return modals on detail page; apply 44px min tap targets on primary buttons
- [x] 3.5 Verify 360px layout (no horizontal overflow) on list and detail

## 4. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 4.1 Run `cd frontend && npm test -- --watchAll=false --testPathPattern="customerOrder"`
- [x] 4.2 Create `frontend/src/pages/__tests__/CustomerOrdersPage.test.tsx` — list, filters, search, date params, empty/error states
- [x] 4.3 Create `frontend/src/pages/__tests__/CustomerOrderDetailPage.test.tsx` — items, timeline, status PATCH, no supplier fields in DOM
- [x] 4.4 Extend `customerOrderService.test.ts` if new query params added

## 5. Frontend: Run Unit Tests and Verify State (MANDATORY)

- [x] 5.1 Run targeted tests: `cd frontend && npm test -- --watchAll=false --testPathPattern="customerOrder|CustomerOrdersPage|CustomerOrderDetail"`
- [x] 5.2 Run full frontend unit suite: `cd frontend && npm test -- --watchAll=false`
- [x] 5.3 Run `cd frontend && npx tsc --noEmit` and ESLint on touched files
- [x] 5.4 Create report `openspec/changes/customer-order-management-frontend/reports/YYYY-MM-DD-step-5-unit-test-verification.md` (include audit matrix)
- [x] 5.5 Mark step complete only after all tests pass and report exists

## 6. Backend: Manual curl (conditional — if Step 2 executed)

- [x] 6.1 Ensure backend running; obtain admin token
- [x] 6.2 Test `GET /api/admin/customer-orders?createdFrom=...&createdTo=...` — verify filtered results
- [x] 6.3 Create report `openspec/changes/customer-order-management-frontend/reports/YYYY-MM-DD-step-6-curl-date-filter.md` (or note "skipped — no backend changes" in step 5 report)
- [x] 6.4 Mark complete only with evidence

## 7. Frontend: E2E Testing with Cypress (MANDATORY — AGENT MUST EXECUTE)

- [x] 7.1 Ensure backend + frontend dev servers running
- [x] 7.2 Extend `frontend/cypress/e2e/customer-orders.cy.ts` — list → search/filter → detail → status update; date filter if implemented; viewports 360/768/1280
- [x] 7.3 Assert no `supplierCost` / `supplierReference` in page HTML
- [ ] 7.4 Run `cd frontend && npx cypress run --spec cypress/e2e/customer-orders.cy.ts` — **BLOCKED:** Cypress 14.5.4 binary unzip fails on agent (see step 7 report)
- [x] 7.5 Create report `openspec/changes/customer-order-management-frontend/reports/YYYY-MM-DD-step-7-cypress-e2e.md`
- [ ] 7.6 Mark complete only after E2E passes and report exists

## 8. Update Technical Documentation (MANDATORY)

- [x] 8.1 Apply `ai-specs/skills/update-docs/SKILL.md`
- [x] 8.2 Add "Admin customer-order panel patterns" subsection to `docs/frontend-standards.md` (pages, timeline, testids, supplier isolation)
- [x] 8.3 Confirm `docs/api-spec.yml` updated if backend date params added

## 9. Commit and Create Pull Request (MANDATORY — LAST STEP)

- [ ] 9.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 9.2 Verify all tasks above are marked `[x]` and reports exist under `openspec/changes/customer-order-management-frontend/reports/`
- [ ] 9.3 Stage relevant files; exclude `.env`, `node_modules/`, `dist/`, `coverage/`
- [ ] 9.4 Create commit: `feat(KAN-29): close customer order admin UI gaps`
- [ ] 9.5 Push branch `feature/KAN-29-customer-order-management-frontend` to origin
- [ ] 9.6 Run `gh pr create` and report PR URL in chat
- [ ] 9.7 Transition Jira KAN-29 to **En revisión** after PR open (or **Finalizado** after merge)
