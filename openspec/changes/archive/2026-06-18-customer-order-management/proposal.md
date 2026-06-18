## Why

Store administrators can manage catalog, suppliers, and customers (KAN-17), but they still cannot view or operate on what customers have actually bought. In a supplier-fulfilled model, the **customer order** is the source-of-truth commercial record; without admin order management, operators cannot answer basic questions (who bought what, is it paid, is fulfillment progressing?) and cannot later drive supplier-order workflows. This change delivers that internal operations capability now as the foundation for M2 Admin Operations.

## What Changes

- Add Prisma models and migration for `CustomerOrder` and `CustomerOrderItem` per `docs/data-model.md`, with FKs to `Customer` and `ProductVariant`.
- Add admin-only REST endpoints under `/api/admin/customer-orders`: paginated list (filters + search), get by id, create (with product/variant snapshots and server-side totals), and status update (`PATCH /:id/status`) for the **three independent** status fields (`status`, `paymentStatus`, `fulfillmentStatus`).
- Implement the backend customer-order module (domain, repository, service, validator, controller, routes) following the product/supplier/customer module architecture.
- Implement the existing frontend stubs (`CustomerOrdersPage`, `CustomerOrderDetailPage`, `customerOrderService`) with list/detail views and separate status controls.
- Enforce snapshot immutability at creation time and business rules (e.g. paid orders cannot return to `PendingPayment`; cancelled orders cannot advance fulfillment).
- Ensure customer-order responses never include supplier-internal fields (`supplierId`, `supplierReference`, `supplierCost`).
- Update `docs/api-spec.yml` to migrate legacy `/customer-orders*` paths to the `/api/admin/customer-orders*` admin namespace.

## Capabilities

### New Capabilities

- `customer-order-management`: Admin list/search/filter, detail, create, and status-transition management for customer orders and line items — with snapshot integrity, three independent status models, validated transitions, and strict supplier-data isolation.

### Modified Capabilities

<!-- None. No existing openspec/specs entry for customer orders. -->

## Non-goals

- Generating supplier orders from a customer order (`POST .../supplier-orders`) — deferred to KAN-19; model FK relationships only.
- Returns, refunds, and shipments admin UIs (separate entities/tickets).
- Customer self-service order history or storefront checkout (KAN-21).
- Payment provider integration or automated payment webhooks (payment status is admin-managed in MVP).
- Real authentication / RBAC (admin scope enforced by route namespace only, consistent with existing admin panel).

## Impact

- **Affected domain concepts**: `CustomerOrder`, `CustomerOrderItem`; relationships to `Customer`, `ProductVariant`; future `SupplierOrder` seam via `fulfillmentStatus = PendingSupplierOrder`.
- **Surface**: Internal admin operations only. **No** direct customer-facing behavior changes.
- **Order lifecycle**: Introduces independent `status`, `paymentStatus`, and `fulfillmentStatus` management; does not mix supplier-order, shipment, return, or refund status.
- **Supplier data exposure**: Reinforced — customer-order serializers must never include supplier-internal fields.
- **Code**: New backend customer-order module; implemented frontend pages and `customerOrderService`; new `OrderStatusControl` component.
- **Docs**: `docs/api-spec.yml` updated (admin namespace); `docs/data-model.md` referenced as source of truth (clarifications only if needed during implementation).
