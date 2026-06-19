## Context

KAN-28 scopes **backend only** for customer order management. The module already exists on `master`:

- Prisma: `CustomerOrder`, `CustomerOrderItem` with address snapshots, three status fields, `orderNumber`, totals, currency.
- Layered module: domain model + repository interface, Prisma repository, `CustomerOrderService`, validator rules, controller, routes mounted at `/api/admin/customer-orders`.
- Endpoints: `GET /` (list + filters), `GET /:id`, `POST /`, `PATCH /:id/status` (updates any combination of `status`, `paymentStatus`, `fulfillmentStatus` in one request body).
- Tests: validator, service, controller, repository, and route isolation suites.

Parent feature KAN-18 was archived at `openspec/changes/archive/2026-06-18-customer-order-management/`. Main requirements live at `openspec/specs/customer-order-management/spec.md`.

## Goals / Non-Goals

**Goals:**

- Confirm KAN-28 deliverables match the main spec and Jira acceptance criteria.
- Run mandatory verification (unit + curl + reports) and produce evidence for Jira close-out.
- Patch only blocking gaps (missing test, doc drift, incorrect error code).

**Non-Goals:**

- Re-implementing modules that already pass audit.
- Frontend (KAN-29), integration E2E (KAN-30), supplier-order generation (KAN-19).

## Decisions

### D1 — Verification-first apply, not greenfield build

**Resolution:** `/opsx:apply` for this change is an audit + verification workflow. Implementation tasks are conditional ("fix if audit fails"). **Why:** code already merged; duplicating work risks regressions.

### D2 — Single `PATCH /:id/status` for all three status dimensions

Jira lists separate update operations; the implemented API uses one endpoint with a body containing one or more of `status`, `paymentStatus`, `fulfillmentStatus`. **Resolution:** Accept as compliant — matches main spec and reduces surface area. Document in audit report.

### D3 — `POST /:id/supplier-orders` is out of scope

The route exists on `customerOrderRoutes.ts` but belongs to KAN-19. **Resolution:** Audit notes presence; do not modify unless broken.

### D4 — Supplier-data isolation via repository select

Continue using explicit Prisma selects that omit supplier fields. Regression test: `customerOrderIsolation.test.ts`.

### D5 — Branch naming

Use `feature/KAN-28-customer-order-management-backend` per Jira ticket. Worktree optional per `using-git-worktrees` skill.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Jira still open despite merged code | This change exists to close the loop with verification evidence |
| Audit finds doc/API drift | Fix in minimal PR; update `docs/api-spec.yml` only if needed |
| Accidental scope creep into KAN-19/29 | Tasks explicitly exclude supplier-order gen and frontend |

## Migration Plan

No database migration expected. If audit finds schema drift vs `docs/data-model.md`, add migration only with explicit gap report.

## Open Questions

- None blocking — proceed with verification apply.
