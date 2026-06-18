## Why

Store administrators can manage catalog, suppliers, and customer orders (KAN-18), but they still cannot place the internal supplier orders that actually fulfill what customers bought. In a supplier-fulfilled model, **supplier orders** are the operational bridge between a paid customer order and supplier shipment — without them, fulfillment stalls at `PendingSupplierOrder` and operators must work outside the system. This change delivers manual supplier-order processing now as the core of M2 Admin Operations (KAN-19).

## What Changes

- Add Prisma models and migration for `SupplierOrder` and `SupplierOrderItem` per `docs/data-model.md`, with FKs to `CustomerOrder`, `CustomerOrderItem`, `Supplier`, and `ProductVariant`.
- Add admin-only REST endpoints under `/api/admin/supplier-orders`: paginated list (filters), get by id, manual create, and status update (`PATCH /:id/status`).
- Implement `POST /api/admin/customer-orders/:id/supplier-orders` to auto-generate one supplier order per supplier from a paid or processing customer order (grouped by variant `supplierId`), replacing the KAN-18 deferred 404.
- Implement the backend supplier-order module (domain, repository, service, validator, controller, routes) following the customer-order module architecture.
- Implement existing frontend stubs (`SupplierOrdersPage`, `SupplierOrderDetailPage`, `supplierOrderService`) with list/detail views, status control, and a "Generate supplier orders" action on customer order detail.
- Snapshot `supplierCost` and `supplierReference` at creation time; enforce supplier-order status transitions; update customer-order `fulfillmentStatus` as supplier orders progress.
- Ensure supplier-order endpoints exist only under `/api/admin/*`; never expose supplier orders or supplier costs on `/api/public/*`.
- Update `docs/api-spec.yml` to migrate legacy `/supplier-orders*` and `/customer-orders/{id}/supplier-orders` paths to the `/api/admin/*` namespace.

## Capabilities

### New Capabilities

- `supplier-order-management`: Admin list/filter/search, detail, manual create, auto-generate from customer order, and status-transition management for supplier orders and line items — with cost/reference snapshotting, validated transitions, customer-order fulfillment side-effects, and strict admin-only access.

### Modified Capabilities

- `customer-order-management`: Implement supplier-order generation (`POST /api/admin/customer-orders/:id/supplier-orders`) and expose linked supplier orders on customer order detail; remove the deferred-404 behavior from KAN-18.

## Non-goals

- Shipment management UI or APIs (KAN-22).
- Automated supplier API integration, EDI, or credential-based supplier portals.
- Returns, refunds, or customer self-service order history.
- Real authentication / RBAC (admin scope enforced by route namespace only, consistent with existing admin panel).
- Exposing `supplierCost`, `supplierReference`, or internal notes on any `/api/public/*` route.

## Impact

- **Affected domain concepts**: `SupplierOrder`, `SupplierOrderItem`; relationships to `CustomerOrder`, `CustomerOrderItem`, `Supplier`, `ProductVariant`; customer-order `fulfillmentStatus` transitions (`PendingSupplierOrder` → `SupplierOrderPlaced` → `PartiallyFulfilled` / `Fulfilled` / `Blocked`).
- **Surface**: Internal admin operations only. **No** direct customer-facing behavior changes.
- **Order lifecycle**: Introduces supplier-order status management separate from customer order `status`, `paymentStatus`, and `fulfillmentStatus`; generation and status updates drive fulfillment recomputation on the parent customer order.
- **Supplier data exposure**: `supplierCost` and `supplierReferenceSnapshot` are admin-internal only; customer-order responses remain free of supplier-internal fields.
- **Code**: New backend supplier-order module; extension of customer-order routes/service for generation; implemented frontend pages, `supplierOrderService`, and customer-order detail integration.
- **Docs**: `docs/api-spec.yml` updated (admin namespace); `docs/data-model.md` referenced as source of truth.
