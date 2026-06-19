## Context

The project has a documented `ReturnRequest` entity in `docs/data-model.md` §13 but no corresponding Prisma model, database table, service, or real UI. The frontend route `return-requests` is already registered in `App.tsx:102` but points to stub components that throw `Not implemented`. `Refund.returnRequestId` exists as a nullable `Int?` column with no FK constraint — `data-model.md` §14 explicitly notes this deferral to KAN-25. The admin API spec currently defines `/return-requests` as a top-level unauthenticated route, which is inconsistent with all peer features (`refunds`, `shipments`) that mount under `adminRouter` at `/api/admin/...`.

This change is the foundational backend+frontend vertical slice that materializes the `ReturnRequest` entity and closes all deferred gaps before downstream features (e.g. refund linkage) depend on a real FK.

## Goals / Non-Goals

**Goals:**

- Create the `ReturnRequest` Prisma model, migration, and indexes aligned with `docs/data-model.md` §13.
- Wire `Refund.returnRequestId` as a real optional FK relation to `ReturnRequest` (safe migration — field remains nullable, no backfill).
- Implement the admin CRUD-light API (`list`, `create`, `getById`, `updateStatus`) under `/api/admin/return-requests` with `requireAdminAuth`.
- Enforce a strict, explicit state machine with per-transition timestamp fields.
- Replace `returnRequestService.ts` and `ReturnRequestsPage.tsx` stubs with real implementations following the vertical-slice pattern of the `refunds`/`shipments` features.
- Add `ReturnRequestDetailPage`, `ReturnRequestStatusControl`, and a per-item "Create return" action in `CustomerOrderDetailPage`.
- Correct and extend `docs/api-spec.yml` and `docs/data-model.md` to reflect the new entity and FK.

**Non-Goals:**

- Customer self-service return portal (storefront).
- Return shipping label generation.
- Automatic `Refund` creation when a return reaches `Received`.
- Multi-unit partial returns (no `quantity` field in MVP).
- Uniqueness guard preventing multiple active `ReturnRequest` records for the same item.

## Decisions

### Decision 1: Follow the `refunds`/`shipments` vertical-slice pattern exactly

**Chosen:** Mirror the file structure, naming conventions, and layer separation of `refundService.ts` / `refundRepository.ts` / `returnRequestController.ts` / `returnRequestRoutes.ts`.

**Rationale:** Consistency reduces cognitive overhead. The pattern is already proven in this codebase for admin lifecycle features. Diverging would create an outlier that future contributors have to learn separately.

**Alternative considered:** Combine controller + service into a single file for simplicity. Rejected because it breaks the layered architecture and makes testing harder.

---

### Decision 2: Mount under `adminRouter` at `/api/admin/return-requests`

**Chosen:** `adminRouter.use('/return-requests', returnRequestAdminRoutes)` in `backend/src/index.ts`, identical to refunds and shipments.

**Rationale:** The current `api-spec.yml` definition of `/return-requests` as a top-level unauthenticated route is a documentation error — all admin features must require auth and live under `/api/admin/`. Correcting the spec here avoids shipping a security gap.

**Alternative considered:** Keep the public path and add auth separately. Rejected because it breaks the established URL structure and makes the auth boundary ambiguous.

---

### Decision 3: `Refunded` state is set by a PATCH call but is only meaningful when driven by KAN-20

**Chosen:** The `PATCH /:id/status` endpoint accepts `Refunded` as a valid transition from `Received` (required for completeness of the state machine API). However, in MVP the admin UI does not expose a "Mark as Refunded" button — the transition is reserved for KAN-20's refund-completion logic.

**Rationale:** Keeping the transition valid in the API avoids a breaking change when KAN-20 integrates. Hiding it from the UI prevents premature admin use that would bypass proper refund accounting.

**Alternative considered:** Make `Refunded` unreachable via the admin API until KAN-20 is ready. Rejected because it would require a follow-up API change and a migration later.

---

### Decision 4: Wire `Refund.returnRequestId` FK in the same migration

**Chosen:** The Prisma migration adds the `ReturnRequest` table first, then adds the FK constraint on `Refund.returnRequestId` in the same migration file.

**Rationale:** Closing the deferral as part of this change is the explicit intent of KAN-25. The field is nullable so no backfill is needed; the constraint only applies to new non-null values, making it safe to apply over existing dev/seed data.

**Alternative considered:** Separate migration for the FK. Unnecessary complexity for a nullable column with no existing non-null data in dev.

---

### Decision 5: Validate item-belongs-to-order inside a `prisma.$transaction`

**Chosen:** The `create` service method atomically validates (1) order exists and is not cancelled, (2) item exists, (3) item belongs to the order — all in a single transaction before inserting.

**Rationale:** Prevents race conditions between validation and insert. Mirrors the pattern used in `refundService.ts` for balance validation.

## Risks / Trade-offs

- **[Risk] Duplicate return requests on same item** → No uniqueness constraint in MVP. Mitigation: documented as a known limitation; a `UNIQUE` index on `(customerOrderItemId, status)` filtered to active states can be added later without a breaking change.

- **[Risk] `Refunded` state reachable via API before KAN-20** → Mitigation: admin UI hides the action; API still validates the transition is from `Received` only.

- **[Risk] Existing Prisma client cache** → After migration, `prisma generate` must be run before building. Mitigation: included as an explicit task step.

- **[Risk] `api-spec.yml` route correction is a breaking change on paper** → The old `/return-requests` route was never implemented (stub only), so there are no real consumers. The correction is safe.

## Migration Plan

1. Add `model ReturnRequest` to `schema.prisma` with all fields, relations, and indexes.
2. Update `Refund` model to add the `returnRequest ReturnRequest? @relation(...)` field.
3. Run `prisma migrate dev --name add_return_request` — generates SQL for the new table, indexes, and the FK constraint on `Refund.returnRequestId`.
4. Run `prisma generate` to rebuild the Prisma client.
5. Implement backend layers in order: domain model → repository interface → Prisma repository → service → validator → controller → serializer → routes → index mount.
6. Implement frontend layers: types → service → hook → pages → components → `App.tsx` route for detail page.
7. Update `docs/api-spec.yml` and `docs/data-model.md`.

**Rollback:** Drop the `return_requests` table and revert the FK on `Refund.return_request_id` to a plain nullable integer column. No data loss risk since the feature is additive.

## Open Questions

_(None remaining — all decisions confirmed via the enrichment phase and Functional Analysis above.)_
