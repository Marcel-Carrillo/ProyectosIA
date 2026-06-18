## Context

This is a full-stack admin capability for `SupplierOrder` and `SupplierOrderItem`, part of milestone M2 (Admin Operations) in a supplier-fulfilled women's fashion ecommerce. Verified current state:

- `CustomerOrder` / `CustomerOrderItem` exist (KAN-18) with three independent status fields and `fulfillmentStatus` values including `PendingSupplierOrder` and `SupplierOrderPlaced`.
- `Supplier` and `ProductVariant` (with `supplierId`, `supplierCost`, `supplierReference`) exist from prior catalog/supplier work.
- **No** `SupplierOrder` / `SupplierOrderItem` Prisma models yet — a migration is required.
- Frontend `SupplierOrdersPage.tsx`, `SupplierOrderDetailPage.tsx` exist as **stubs** ("Coming soon"). Routes `/supplier-orders` and `/supplier-orders/:id` are wired in admin `Layout`.
- `docs/api-spec.yml` defines legacy non-namespaced `/supplier-orders*` and `/customer-orders/{id}/supplier-orders` paths that predate the `/api/admin/*` convention.
- Backend reference modules: `customerOrder`, `supplier`, `product` (layering, envelope, typed errors).
- KAN-18 explicitly deferred `POST .../supplier-orders` to this change.

Constraint owners: backend-developer and frontend-developer agents; product-strategy-analyst scoped this as admin-only with manual status control.

## Goals / Non-Goals

**Goals:**

- Admin CRUD-lite for supplier orders under `/api/admin/supplier-orders` (list with pagination/filters, get, manual create, status update), matching established module architecture.
- Auto-generate supplier orders from customer orders via `POST /api/admin/customer-orders/:id/supplier-orders`, grouped one order per supplier.
- Snapshot `supplierCost` and `supplierReference` at creation; validate supplier-order status transitions; set lifecycle timestamps (`requestedAt`, `confirmedAt`, `shippedAt`, `deliveredAt`).
- Recompute customer-order `fulfillmentStatus` when supplier orders are generated or status changes.
- Implement existing frontend stubs with list + detail + `SupplierOrderStatusControl`; add "Generate supplier orders" on customer order detail.
- Migrate `docs/api-spec.yml` to the admin namespace; keep supplier costs admin-internal only.

**Non-Goals:**

- Shipment entity management (KAN-22), returns/refunds UIs, storefront checkout, payment gateway integration, real auth/RBAC, automated supplier API integration.

## Decisions

### D1 — Admin namespace: `/api/admin/supplier-orders`

Mount list/detail/create/status under `/api/admin/supplier-orders`; mount generation under `/api/admin/customer-orders/:id/supplier-orders`. **Why:** consistent with products/suppliers/customers/customer-orders. **Alternative:** keep legacy `/supplier-orders` — rejected.

### D2 — One supplier order per supplier on auto-generation

Group customer order items by `productVariant.supplierId`; create one `SupplierOrder` per distinct supplier in a single transaction. **Why:** matches `docs/data-model.md` and real-world supplier-fulfilled workflow. **Alternative:** single supplier order for all items — rejected when multiple suppliers exist.

### D3 — Idempotent generation

If supplier orders already exist for a customer order + supplier combination covering the same items, skip creation and return existing records. **Why:** safe retries from admin UI without duplicate supplier POs.

### D4 — Eligibility gate: Paid or Processing only

Reject generation/create when customer order `status` is not `Paid` or `Processing`, or when `status = Cancelled`. **Why:** `docs/data-model.md` validation rule.

### D5 — Follow customer-order module layering

New files mirror existing patterns: `domain/models/supplierOrder.ts`, `domain/repositories/supplierOrderRepository.ts`, `infrastructure/repositories/supplierOrderRepository.ts`, `application/services/supplierOrderService.ts`, validator additions, `presentation/controllers/supplierOrderController.ts`, `routes/admin/supplierOrderRoutes.ts`. Extend `customerOrderService` / `customerOrderRoutes` for generation endpoint. **Why:** consistency and reviewability.

### D6 — Transactional header + items create

Supplier order header and all line items persist in a single Prisma transaction; generation of multiple supplier orders also runs in one transaction. **Why:** partial supplier orders are invalid.

### D7 — `supplierOrderNumber` generation server-side

Generate unique human-readable numbers (e.g. `SPO-000001`) in the service layer. **Why:** prevents client collisions.

### D8 — Fulfillment side-effects on customer order

- On successful generation: set `fulfillmentStatus = SupplierOrderPlaced` (if was `PendingSupplierOrder` or `NotStarted`).
- On supplier-order status update: recompute parent `fulfillmentStatus` — all `Delivered` → `Fulfilled`; any `Blocked`/`OutOfStock`/`Cancelled` without delivery → `Blocked`; partial progress → `PartiallyFulfilled`.
- Never auto-change customer `status` or `paymentStatus` from supplier-order flows. **Why:** separate lifecycles per business rules.

### D9 — Supplier cost stays admin-internal

`supplierCost` and `supplierReferenceSnapshot` appear on supplier-order admin responses only. Customer-order serializers remain unchanged (no supplier fields). **Why:** critical business rule.

### D10 — Reuse frontend admin building blocks

Implement existing stub pages in place. Reuse `Pagination`, `StatusBadge`, URL-synced filters, and admin.css patterns from `CustomerOrdersPage`. Add `SupplierOrderStatusControl` for status transitions with optional tracking fields.

## Risks / Trade-offs

- **Duplicate supplier orders** → Idempotent generation keyed by customer order + supplier + item coverage; 409 on manual duplicate if same items already linked.
- **Fulfillment conflation** → Supplier-order status updates only touch customer `fulfillmentStatus`, never `status`/`paymentStatus`.
- **Supplier cost leak** → Explicit selects; regression test asserting customer-order responses omit supplier fields; no public routes.
- **Blocked supplier selection** → Reject create/generate when supplier `status = Blocked`; allow `Inactive` with warning in UI only.
- **Legacy api-spec divergence** → Update spec in same change; supersede `/supplier-orders` block.

## Migration Plan

- Add Prisma migration `add_supplier_order_and_items` with `SupplierOrder` + `SupplierOrderItem` models, enums as strings, FKs, indexes on `customerOrderId`, `supplierId`, `status`, `createdAt`, unique `supplierOrderNumber`.
- Deploy is additive (new tables + admin endpoints + implemented frontend). Rollback = revert feature branch; drop migration if not yet merged to production.

## Open Questions

- Strict transition matrix vs permissive MVP for supplier-order status? **Recommendation:** enforce forward-only transitions with explicit allowed edges; allow `Cancelled` from `Draft` or `Requested` only.
- Should manual create allow `status` other than `Draft`? **Recommendation:** always start at `Draft`; admin advances via PATCH.
