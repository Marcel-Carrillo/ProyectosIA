## Why

Store administrators need a reliable admin UI to triage and progress customer orders. The core `CustomerOrdersPage` / `CustomerOrderDetailPage` flow was delivered with the archived `customer-order-management` change (KAN-18), and the backend API was verified in KAN-28. Jira **KAN-29** closes the remaining operational gaps so admins can filter by date range, see order milestones at a glance, and use the panel comfortably on mobile — without ever exposing supplier-internal data.

## What Changes

- **Audit** existing frontend customer-order pages against the main spec and KAN-29 deliverables; implement only confirmed gaps.
- **Date-range filter** on the orders list (`createdFrom` / `createdTo`), including minimal backend query-param support on `GET /api/admin/customer-orders` if not already present.
- **Status timeline** on order detail — derived from `createdAt`, `paidAt`, `cancelledAt`, `updatedAt` (no new history table in this change).
- **Mobile polish**: `fullscreen="sm-down"` on detail modals; 44px minimum tap targets on primary actions (match other admin pages).
- **Test coverage**: RTL page tests for list and detail; extend Cypress E2E for filters, timeline, responsive viewports, and supplier-field absence.
- Update `docs/frontend-standards.md` with admin customer-order panel patterns when gaps are closed.

## Capabilities

### New Capabilities

<!-- None — behavior extends existing customer-order-management capability -->

### Modified Capabilities

- `customer-order-management`: Add admin UI requirements for date-range list filtering, derived status timeline on detail, mobile admin patterns, and test coverage obligations.

## Non-goals

- Full order status audit log / `CustomerOrderStatusHistory` model (fast-follow).
- Customer self-service order UI changes (`AccountOrdersPage`).
- Supplier-order generation UI changes beyond existing links (KAN-19 scope).
- Payment provider integration or automated webhooks.
- Rebuilding list/detail/status controls that already meet the main spec.

## Impact

- **Affected domain concepts**: `CustomerOrder` (read-only UI); optional `createdFrom`/`createdTo` query filters on admin list API.
- **Surface**: Internal admin operations only. No customer-facing behavior changes.
- **Supplier data exposure**: Reinforced — UI and tests must never render `supplierCost`, `supplierReference`, or supplier notes.
- **Code**: `frontend/src/pages/CustomerOrdersPage.tsx`, `CustomerOrderDetailPage.tsx`, new `OrderStatusTimeline.tsx`, `customerOrderService.ts`, `types/customerOrder.ts`; possible small backend list-filter addition in `customerOrderRepository` + `docs/api-spec.yml`.
- **Docs**: `docs/frontend-standards.md`; `docs/api-spec.yml` if date filters are added.
