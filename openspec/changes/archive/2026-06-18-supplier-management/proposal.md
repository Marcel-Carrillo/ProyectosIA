## Why

In the supplier-fulfilled business model, store administrators must process customer orders by placing supplier orders in the background. That entire fulfillment chain (KAN-19 `SupplierOrder`) depends on having a maintained master record of suppliers, but today the `Supplier` table can only be edited directly in the database — there is no admin surface to create, list, edit, or deactivate suppliers. This change delivers that admin CRUD now so the operations backlog (M2) is unblocked.

## What Changes

- Add admin-only REST endpoints under `/api/admin/suppliers`: paginated list (search by name, filter by status), get by id, create, partial update (PATCH), and soft-delete (deactivate via `status`).
- Implement the backend supplier module (domain model, repository, service, validator, controller, routes) following the existing product module architecture. The `Supplier` Prisma model already exists — this change starts from migration verification, not schema design.
- Implement the frontend `SuppliersPage` and `supplierService` (currently stubs) reusing the `admin-product-panel` patterns: list with debounced search, status filter, URL-synced query state, create/edit modal (`fullscreen="sm-down"`), status lifecycle controls, and a soft-delete confirmation.
- Enforce supplier data isolation: no supplier endpoint is added under `/api/public/*`, and the existing public product serializer that already omits `supplierId`/`supplierReference`/`supplierCost` is preserved (with regression tests).
- Update `docs/api-spec.yml` to document `/api/admin/suppliers` and align it with the delivered admin convention (PATCH, `page`/`pageSize`), superseding the legacy `/suppliers` (PUT, `page`/`limit`) block.

## Capabilities

### New Capabilities
- `supplier-management`: Admin CRUD for suppliers — list/search/filter, get, create, update, and status-based soft-delete — with validation, the standard response envelope, typed error codes, and a strict invariant that supplier data is never exposed on customer-facing APIs.

### Modified Capabilities
<!-- None. Public catalog serialization already excludes supplier fields; this change adds tests asserting that invariant but does not change its requirements. -->

## Non-goals

- Supplier order processing and the fulfillment flow (`SupplierOrder` / `SupplierOrderItem`) — that is KAN-19, a separate change.
- Supplier API credentials or automated supplier integrations.
- Real authentication / role-based access control (admin scope is enforced by route namespace only, consistent with the rest of the admin panel today).
- Managing a product's variants or supplier cost/reference fields from the supplier screen.
- Any customer-facing supplier exposure.

## Impact

- **Affected domain concepts**: `Supplier` (CRUD), and the `Supplier ↔ ProductVariant` relationship (referential integrity preserved via soft-delete by status; never hard-delete).
- **Surface**: Internal supplier fulfillment / admin operations only. **No** customer-facing behavior changes.
- **Supplier data exposure**: Reinforced — adds explicit tests that suppliers and `supplierCost`/`supplierReference`/`supplierId` never appear in `/api/public/*` responses.
- **Order/fulfillment/payment/returns/refunds lifecycle**: Not affected by this change.
- **Code**: New backend supplier module (`backend/src/domain`, `application`, `infrastructure`, `presentation`, `routes/admin/supplierRoutes.ts`, registered in `routes/index.ts` + `index.ts`); implemented `frontend/src/pages/SuppliersPage.tsx`, `frontend/src/services/supplierService.ts`, `frontend/src/types/supplier.ts`, and a `SupplierFormModal`.
- **Docs**: `docs/api-spec.yml` updated; `docs/data-model.md` unchanged (no schema change expected).
