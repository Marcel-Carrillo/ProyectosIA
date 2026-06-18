## Context

This is a full-stack admin capability for `CustomerOrder` and `CustomerOrderItem`, part of milestone M2 (Admin Operations) in a supplier-fulfilled women's fashion ecommerce. Verified current state:

- `Customer` and `CustomerAddress` exist (KAN-17). `Product`, `ProductVariant`, `Supplier`, and catalog modules are implemented.
- **No** `CustomerOrder` / `CustomerOrderItem` Prisma models yet — a migration is required.
- Frontend `CustomerOrdersPage.tsx`, `CustomerOrderDetailPage.tsx`, and `customerOrderService.ts` exist as **stubs** ("Coming soon" / not implemented). Routes `/customer-orders` and `/customer-orders/:id` are wired in the admin `Layout`.
- `docs/api-spec.yml` defines legacy non-namespaced `/customer-orders*` paths that predate the `/api/admin/*` convention.
- Backend reference modules: `product`, `supplier`, `customer` (layering, envelope, typed errors).

Constraint owners: backend-developer and frontend-developer agents; product-strategy-analyst scoped this as admin-only with manual status control.

## Goals / Non-Goals

**Goals:**

- Admin CRUD-lite for customer orders under `/api/admin/customer-orders` (list with pagination/filters/search, get, create with snapshots, status update), matching established module architecture.
- Three **independent** status fields (`status`, `paymentStatus`, `fulfillmentStatus`) with server-side transition validation.
- Snapshot product/variant/SKU/price at order creation; compute monetary totals server-side using `Decimal`.
- Implement existing frontend stubs with list + detail + `OrderStatusControl` for the three status dimensions.
- Migrate `docs/api-spec.yml` to the admin namespace; never expose supplier-internal fields on customer-order responses.

**Non-Goals:**

- Supplier-order generation (KAN-19), returns/refunds/shipments UIs, storefront checkout, payment gateway integration, real auth/RBAC.

## Decisions

### D1 — Admin namespace: `/api/admin/customer-orders`

Mount all endpoints under `/api/admin/customer-orders`, consistent with products/suppliers/customers. **Why:** single admin contract. **Alternative:** keep legacy `/customer-orders` — rejected; conflicts with shipped convention.

### D2 — Three independent status models, never conflated

`status` (customer-facing order), `paymentStatus`, and `fulfillmentStatus` are stored and updated independently via `PATCH /:id/status`. Each field has its own enum and transition rules. **Why:** `docs/data-model.md` and project principles require separate lifecycles. **Alternative:** single combined status — rejected.

### D3 — Snapshots at creation, immutable on read

On `POST`, resolve each `productVariantId`, copy `productNameSnapshot`, `variantSnapshot`, `skuSnapshot`, and `unitPrice` from the variant's `publicPrice`; compute line `totalPrice` and order totals server-side. Snapshots are never recomputed from live catalog on read. **Why:** order history integrity when catalog changes.

### D4 — Follow product/supplier/customer module layering

New files mirror existing patterns: `domain/models/customerOrder.ts`, `domain/repositories/customerOrderRepository.ts`, `infrastructure/repositories/customerOrderRepository.ts`, `application/services/customerOrderService.ts`, validator additions, `presentation/controllers/customerOrderController.ts`, `routes/admin/customerOrderRoutes.ts`. **Why:** consistency and reviewability.

### D5 — Transactional order + items create

Order header and all line items persist in a single Prisma transaction. **Why:** partial orders are invalid; financial integrity.

### D6 — `orderNumber` generation server-side

Generate unique human-readable numbers (e.g. `ORD-000001`) in the service layer. **Why:** prevents client collisions and enforces uniqueness.

### D7 — Supplier-data isolation in repository select

Explicit `customerOrderSelect` / item select omits any join to supplier fields. Add regression tests asserting `supplierId`, `supplierReference`, and `supplierCost` never appear in responses. **Why:** critical business rule even on admin surfaces.

### D8 — Reuse frontend admin building blocks

Implement existing stub pages in place. Reuse `Pagination`, `StatusBadge`, URL-synced filters, and admin.css responsive patterns from `ProductsPage` / `CustomersPage`. Add `OrderStatusControl` for the three status dimensions.

### D9 — Defer supplier-order generation endpoint

Model `fulfillmentStatus` values including `PendingSupplierOrder` but do **not** implement `POST /:id/supplier-orders`. **Why:** KAN-19 scope; keeps FK seam ready.

## Risks / Trade-offs

- **Status conflation (critical)** → Three separate fields, separate UI controls, separate validator transition helpers; never auto-mirror fulfillment from order status.
- **Snapshot drift** → Snapshot only at create; immutable thereafter; tests assert values survive catalog price changes.
- **Monetary correctness** → `Decimal` in Prisma/service; reject client-supplied totals; validate `quantity > 0`, amounts `>= 0`.
- **Legacy api-spec divergence** → Update spec in same change; supersede `/customer-orders` block.
- **Stub drift** → Implement existing page/service files, do not create parallel duplicates.

## Migration Plan

- Add Prisma migration `add_customer_order_and_items` with `CustomerOrder` + `CustomerOrderItem` models, enums as strings, indexes on `customerId`, `status`, `paymentStatus`, `fulfillmentStatus`, `createdAt`, unique `orderNumber`.
- Deploy is additive (new tables + admin endpoints + implemented frontend). Rollback = revert feature branch; drop migration if not yet merged to production.

## Open Questions

- Should invalid status transitions be strictly blocked (422) or partially applied? **Recommendation:** reject entire PATCH if any provided field violates transition rules (atomic update).
- Strict transition matrix vs permissive MVP? **Recommendation:** enforce critical rules from data model (paid → not PendingPayment; cancelled → no fulfillment advance); allow other transitions manually for MVP.
