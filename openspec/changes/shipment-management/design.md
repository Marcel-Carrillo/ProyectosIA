## Context

Customer orders (KAN-18) and supplier orders (KAN-19) are already implemented. The fulfillment loop is incomplete: there is no way to record that a supplier shipped the product to the customer or to track its delivery state. `ShipmentsPage` shows "Coming soon" and `shipmentService.ts` throws "Not implemented".

The `Shipment` entity is documented in `docs/data-model.md` §12 and sketched in `docs/api-spec.yml`, but **does not exist in `backend/prisma/schema.prisma`**. The spec also declares the wrong path (`/shipments` instead of `/api/admin/shipments`) and is missing `GET /:id` and `PATCH /:id/status` endpoints.

Pattern to follow: the KAN-19 (supplier-order-management) and KAN-20 (refund-management) implementations establish the standard layering, state-machine approach, response envelope, and error-code conventions for this feature.

## Goals / Non-Goals

**Goals:**
- Add the `Shipment` Prisma model with migration, back-relations on `CustomerOrder` and `SupplierOrder`.
- Implement admin API `/api/admin/shipments` (list, create, get by id, update status) behind `requireAdminAuth`.
- Enforce the status state machine and auto-set `shippedAt`/`deliveredAt` on transition.
- Replace `ShipmentsPage` stub and `shipmentService` stub with full implementations.
- Correct `docs/api-spec.yml` route and fill missing endpoint schemas.
- Document the tracking-field relationship between `SupplierOrder` and `Shipment`.

**Non-Goals:**
- Carrier API integration (tracking webhooks, label generation).
- Customer-facing shipment tracking portal or email notifications.
- Automatic recalculation of `CustomerOrder.fulfillmentStatus` on shipment events.
- Bidirectional sync between `SupplierOrder.trackingNumber/trackingUrl` and `Shipment`.

## Decisions

### D1 — Shipment vs SupplierOrder tracking fields: complementary, not synchronized

**Decision:** `SupplierOrder.trackingNumber/trackingUrl/shippedAt/deliveredAt` represent the supplier→carrier handoff at the procurement level. `Shipment` is the source of truth for customer-delivery tracking. The two are complementary: when creating a shipment from a supplier order, pre-fill the shipment fields from the supplier order's header tracking data, but do not keep them in sync.

**Why not sync?** Bidirectional sync introduces write conflicts (two entities trying to own the same truth) and adds complexity with no MVP benefit. The admin can update each record independently. Future automation can introduce sync later.

**Why not collapse into one entity?** A supplier order can have multiple line items shipped in separate batches. Keeping `Shipment` as a separate entity with an optional `supplierOrderId` allows multiple shipments per order and also supports future direct-from-warehouse shipments that have no supplier order.

### D2 — Status stored as String (not DB enum)

**Decision:** `Shipment.status` is a `String` in Prisma with application-layer validation, consistent with `SupplierOrder.status` and `Refund.status`.

**Why not a DB enum?** Adding new states in the future requires a Prisma migration + data migration. String field with service-layer enum validation makes state additions cheaper. Prisma also handles DB enums poorly across migration rollbacks.

### D3 — State machine in service layer only

**Decision:** The allowed transitions are enforced exclusively in `shipmentService.ts`, mirroring `supplierOrderService` and `refundService`. No triggers or DB-level constraints.

**Transitions:**
```
Pending    → Shipped | Failed | Returned
Shipped    → InTransit | Delivered | Failed | Returned
InTransit  → Delivered | Failed | Returned
Terminal states: Delivered, Failed, Returned
```

`shippedAt` is set automatically when entering `Shipped`; `deliveredAt` is set automatically when entering `Delivered`.

### D4 — Separate status-update endpoint

**Decision:** `PATCH /api/admin/shipments/:id/status` for state transitions (body: `{ status }`); `PATCH /api/admin/shipments/:id` would be general field updates if needed later. This mirrors the `PATCH /api/admin/supplier-orders/:id/status` pattern and signals to callers that status changes carry side effects (timestamps, validation).

### D5 — Layered architecture follows existing DDD pattern

Backend files:
- `domain/models/shipment.ts` — domain type
- `domain/repositories/shipmentRepository.ts` — interface + filter/error types
- `infrastructure/repositories/shipmentRepository.ts` — Prisma implementation
- `application/services/shipmentService.ts` — orchestration, validation, state machine
- `application/validator.ts` — add `validateShipmentCreateData`, `validateShipmentStatusUpdate`
- `presentation/controllers/shipmentController.ts`
- `presentation/serializers/` — shipment serializer
- `routes/admin/shipmentRoutes.ts`
- Mount under `adminRouter` in `routes/index.ts` and `index.ts`

## Risks / Trade-offs

- **[Risk] `CustomerOrder` and `SupplierOrder` schema changes** — adding `shipments Shipment[]` back-relations requires a Prisma migration that touches both models. Since both models already have data in production, the migration must be additive only (no column removal or type change). Mitigation: the relation field is added as a nullable FK on `Shipment.supplierOrderId` and a required FK on `Shipment.customerOrderId`; existing rows are unaffected.

- **[Risk] `api-spec.yml` path correction** — changing `/shipments` to `/api/admin/shipments` fixes a doc bug but may mislead any consumer who read the spec before the fix. Mitigation: document the correction in the spec commit message; no actual running code depends on the wrong path yet.

- **[Risk] Partial tracking data** — if a supplier order has no `trackingNumber`, pre-filling produces an empty shipment. Mitigation: all tracking fields (`carrier`, `trackingNumber`, `trackingUrl`) are optional on `Shipment`; the admin fills them in manually.

- **[Trade-off] No `fulfillmentStatus` auto-update** — delivering a shipment does not automatically update `CustomerOrder.fulfillmentStatus`. This is intentional for MVP (manual control first), but means the admin must update both records. Noted as a follow-up item.

## Migration Plan

1. Add `Shipment` model to `prisma/schema.prisma` + `shipments Shipment[]` back-relations on `CustomerOrder` and `SupplierOrder`.
2. Run `prisma migrate dev --name add-shipment-model`.
3. Implement backend layers (domain → infra → service → controller → routes → mount).
4. Implement frontend (`shipmentService.ts`, `ShipmentsPage.tsx`, `ShipmentDetailPage.tsx`, routing).
5. Correct `docs/api-spec.yml` and update `docs/data-model.md`.
6. Run full test suite; manual curl test for all 4 endpoints; Playwright E2E for UI flows.

Rollback: the migration is purely additive. Rollback can drop the `Shipment` table and remove the back-relation columns without affecting existing data.

## Open Questions

- Should `CustomerOrder.fulfillmentStatus` be auto-updated when a shipment reaches `Delivered`? → Deferred; document as follow-up KAN ticket.
- Should there be a max number of shipments per customer order? → No constraint in MVP; follow natural business flow.
