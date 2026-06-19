# Tasks

> Backend-only slice (Jira **KAN-28**, parent KAN-18). Structured per `docs/openspec-tasks-mandatory-steps.md`
> and `openspec/config.yaml`. Reports go under `openspec/changes/customer-order-management-backend/reports/`.
>
> **Precondition:** Customer order backend module already exists on `master` (delivered via archived
> `customer-order-management`). This change is **verification-first** — implementation tasks apply only if audit finds gaps.
>
> **Agent workflow (MANDATORY):** during `/opsx:apply`, mark each sub-task `- [ ]` → `- [x]`
> in this file immediately when done. Verification steps are marked `[x]` only after tests pass AND
> the report file exists. Never delegate testing to the user.

## 0. Setup: Create Feature Branch (MANDATORY — FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to choose workspace isolation (current checkout vs Git worktree)
- [x] 0.2 Create and switch to feature branch `feature/KAN-28-customer-order-management-backend` from `master`
- [x] 0.3 Verify branch creation: `git branch --show-current` and `git status`

## 1. Audit: Verify KAN-28 Deliverables Against Main Spec

- [x] 1.1 Confirm Prisma models `CustomerOrder` and `CustomerOrderItem` in `backend/prisma/schema.prisma` match `docs/data-model.md` (three status fields, snapshots, totals, indexes, FKs)
- [x] 1.2 Confirm layered module files exist: `domain/models/customerOrder.ts`, `domain/repositories/customerOrderRepository.ts`, `infrastructure/repositories/customerOrderRepository.ts`, `application/services/customerOrderService.ts`, `presentation/controllers/customerOrderController.ts`, `routes/admin/customerOrderRoutes.ts`
- [x] 1.3 Confirm routes mounted in `backend/src/index.ts` at `/api/admin/customer-orders` with `requireAdminAuth`
- [x] 1.4 Confirm endpoints: `GET /`, `GET /:id`, `POST /`, `PATCH /:id/status` — document that single status endpoint updates `status`, `paymentStatus`, and/or `fulfillmentStatus` (compliant with main spec)
- [x] 1.5 Confirm validator enforces: paid order cannot return to `PendingPayment`; cancelled order cannot advance `fulfillmentStatus`
- [x] 1.6 Confirm repository selects omit supplier fields; note `POST /:id/supplier-orders` as KAN-19 (out of scope)
- [x] 1.7 If any gap found, fix minimally before continuing; otherwise record "audit PASS — no code changes" in step 8 report

## 2. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 2.1 Run targeted tests: `cd backend && npx jest --testPathPattern="customerOrder" --watchAll=false`
- [x] 2.2 Review `backend/src/**/__tests__/` for customer-order tests; update only if audit revealed gaps
- [x] 2.3 Confirm supplier-isolation regression test passes (`customerOrderIsolation.test.ts`)

## 3. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 3.1 Capture pre-test baseline: `CustomerOrder` and `CustomerOrderItem` row counts
- [x] 3.2 Run targeted unit tests: `cd backend && npx jest --testPathPattern="customerOrder" --watchAll=false`
- [x] 3.3 Run full backend suite: `cd backend && npm test -- --watchAll=false`
- [x] 3.4 Verify post-test database state matches pre-test baseline
- [x] 3.5 Create report `openspec/changes/customer-order-management-backend/reports/YYYY-MM-DD-step-3-unit-test-and-db-verification.md`
- [x] 3.6 Mark step complete only after all tests pass and report exists

## 4. Backend: Manual Endpoint Testing with curl (MANDATORY — AGENT MUST EXECUTE)

- [x] 4.1 Ensure backend is running (`cd backend && npm run dev`)
- [x] 4.2 Obtain admin bearer token (login via `POST /api/admin/auth/login` or use test helper)
- [x] 4.3 Test `GET /api/admin/customer-orders` — verify `200` with paginated envelope
- [x] 4.4 Test `GET /api/admin/customer-orders/:id` with a known id — verify `200` with items and no supplier fields
- [x] 4.5 Test `POST /api/admin/customer-orders` with valid payload — verify `201`, snapshots, and `orderNumber`; capture created id
- [x] 4.6 Test `PATCH /api/admin/customer-orders/:id/status` with `{ "paymentStatus": "Paid" }` — verify `200`
- [x] 4.7 Test `PATCH /api/admin/customer-orders/:id/status` with invalid transition (paid → `PendingPayment`) — verify `422`
- [x] 4.8 Test `GET /api/admin/customer-orders` without auth — verify `401`
- [x] 4.9 Restore database: delete test order created in 4.5 if applicable
- [x] 4.10 Create report `openspec/changes/customer-order-management-backend/reports/YYYY-MM-DD-step-4-curl-endpoint-testing.md`
- [x] 4.11 Mark step complete only after all curl tests pass and report exists

## 5. Update Technical Documentation (MANDATORY)

- [x] 5.1 Review `docs/api-spec.yml` `/api/admin/customer-orders*` paths — update only if audit found drift
- [x] 5.2 Review `docs/data-model.md` CustomerOrder section — update only if audit found drift
- [x] 5.3 If no doc changes needed, note "no drift" in step 3 report

## 6. Commit and Create Pull Request (MANDATORY — LAST STEP)

- [x] 6.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [x] 6.2 Verify all tasks above are marked `[x]` and reports exist under `openspec/changes/customer-order-management-backend/reports/`
- [x] 6.3 Stage relevant files (OpenSpec artifacts, reports, any gap fixes); exclude `.env`, `node_modules/`, `dist/`, `coverage/`
- [x] 6.4 Create commit: `chore(KAN-28): verify customer order backend API delivery`
- [x] 6.5 Push branch `feature/KAN-28-customer-order-management-backend` to origin
- [x] 6.6 Run `gh pr create` and report PR URL in chat
- [x] 6.7 Transition Jira KAN-28 to **Finalizado** after PR merge (or document in PR if merge pending)
