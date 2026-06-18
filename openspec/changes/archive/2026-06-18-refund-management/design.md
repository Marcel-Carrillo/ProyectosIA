## Context

The project currently has no `Refund` model in `backend/prisma/schema.prisma`. The `Refund` entity exists in `docs/data-model.md` §14 and a stub in `docs/api-spec.yml` (under `/refunds` without the admin prefix), but no backend implementation or functional frontend exists (`RefundsPage` shows "Coming soon").

Customer orders (`CustomerOrder`) already track `paymentStatus` with values `Pending`, `Authorized`, `Paid`, `Failed`, `Refunded`, and `PartiallyRefunded`, but no mechanism exists to transition into `PartiallyRefunded`/`Refunded` states. This change delivers that mechanism.

Dependencies: KAN-18 (customer order management) is delivered. KAN-25 (return requests) is not yet implemented — `returnRequestId` is treated as nullable with no FK constraint enforced until that model exists.

## Goals / Non-Goals

**Goals:**
- Introduce the `Refund` Prisma model with migration.
- Implement four admin endpoints under `/api/admin/refunds` following the existing DDD layered pattern.
- Enforce amount validation and state machine transitions server-side inside Prisma transactions.
- Synchronize `CustomerOrder.paymentStatus` on every refund create/status change.
- Replace the `RefundsPage` stub with a functional admin page.
- Update `docs/api-spec.yml` to reflect the correct admin path and all endpoints.

**Non-Goals:**
- Payment gateway integration (reference is manual/offline).
- Automatic refunds.
- Customer-facing refund history.
- Enforcing `returnRequestId` FK constraint (deferred until KAN-25 delivers the model).

## Decisions

### Decision: Validate amount and update paymentStatus inside a single Prisma transaction

**Rationale:** The constraint `amount ≤ totalAmount − Σ refunds[Completed, Processing]` is a read-then-write operation susceptible to race conditions if two admins submit concurrently. Wrapping the validation and insert in a single `prisma.$transaction` with a re-read of existing refunds inside the transaction eliminates the race. This matches the Prisma transaction pattern already used in `customer-order-management` service.

**Alternative considered:** Optimistic locking with a version field on `CustomerOrder`. Rejected because it requires a schema change to a frequently-read table and adds retry complexity for a low-frequency admin operation.

### Decision: returnRequestId stored nullable without DB-level FK constraint initially

**Rationale:** `ReturnRequest` does not exist in the schema yet (KAN-25). Adding the column as nullable `Int?` without a `@relation` annotation allows the MVP to be delivered without a blocking dependency. When KAN-25 lands it adds the model and the FK constraint in its own migration.

**Alternative considered:** Block KAN-20 until KAN-25 is delivered. Rejected because refunds are independent of returns — most refunds will be standalone (order cancellations, admin corrections).

### Decision: Follow existing DDD layered pattern (Controller → Service → Repository)

**Rationale:** All existing features use this pattern. Deviating would create inconsistency in the codebase and increased review friction. The `customer-order-management` change is the direct reference pattern.

**Files follow:** `domain/models/refund.ts`, `domain/repositories/refundRepository.ts`, `infrastructure/repositories/refundRepository.ts`, `application/services/refundService.ts`, `presentation/controllers/refundController.ts`, `routes/admin/refundRoutes.ts`.

### Decision: paymentStatus synchronization driven by refund service, not a separate event

**Rationale:** The project does not yet have an event bus or domain event system. Synchronous recalculation inside `refundService.ts` (within the same transaction) is simpler, auditable, and consistent with how other status syncs work (e.g., fulfillment status on shipment).

**Logic:** After insert/update, recalculate `Σ completedRefunds`. If `== totalAmount` → `Refunded`; if `> 0 && < totalAmount` → `PartiallyRefunded`; if `== 0` → leave `paymentStatus` unchanged (only applies on cancellation).

### Decision: API path moved from /refunds to /api/admin/refunds

**Rationale:** All admin operations are mounted under `/api/admin/`. The stub in `docs/api-spec.yml` used a root `/refunds` path inconsistent with the actual implementation pattern. The spec must be corrected before implementation begins.

## Risks / Trade-offs

- **[Risk] Missing GET/:id and PATCH/:id/status in api-spec.yml** → These two endpoints are absent from the current spec. Mitigation: update `docs/api-spec.yml` as the first documentation task before any backend implementation.
- **[Risk] Decimal precision in amount comparisons** → Using JavaScript floating-point math on Prisma `Decimal` fields can cause incorrect comparisons. Mitigation: use `Decimal.js` (bundled with Prisma client) for all arithmetic in `refundService.ts`.
- **[Risk] Refund created against an order that is not paid** → Validating `paymentStatus ∈ {Paid, PartiallyRefunded}` before creating a refund prevents logical inconsistency. Return `409 REFUND_ORDER_NOT_PAID`.
- **[Risk] returnRequestId references non-existent row** → Without a DB FK, orphaned references are possible. Mitigation: when `returnRequestId` is provided, the service performs a manual existence check and returns `404 RETURN_REQUEST_NOT_FOUND` if not found (once KAN-25 exists); for now, skip the check.

## Migration Plan

1. Update `docs/api-spec.yml` and `docs/data-model.md` (documentation first per base-standards §10).
2. Add `Refund` model to `backend/prisma/schema.prisma` and run `prisma migrate dev --name add-refund`.
3. Implement backend layers in order: domain model → repository → service → controller → routes.
4. Register routes in `backend/src/index.ts`.
5. Implement frontend: types → service → hooks → `RefundsPage` → `RefundDetailPage` → `RefundStatusControl`.
6. Add route in `frontend/src/App.tsx` and "Create Refund" button in `CustomerOrderDetailPage`.

**Rollback:** Migration can be reverted with `prisma migrate revert` (drops `Refund` table). No existing data is at risk; no existing endpoints change behavior.

## Open Questions

- Should `CustomerOrder.status` be updated to `Refunded` (customer-facing) when `paymentStatus` reaches `Refunded`, or is that a separate manual admin action? **Current assumption:** only `paymentStatus` is auto-synced in MVP; `status` transition to `Refunded` remains a manual admin action via the existing status endpoint.
- Once KAN-25 (`ReturnRequest`) is delivered, should the FK constraint be added in that migration or a separate one? **Recommendation:** include it in the KAN-25 migration.
