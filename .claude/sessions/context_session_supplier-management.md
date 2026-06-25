# Context Session — supplier-management (Jira KAN-14)

## Change artifacts (read these)
- Proposal: `openspec/changes/supplier-management/proposal.md`
- Design:   `openspec/changes/supplier-management/design.md`
- Specs:    `openspec/changes/supplier-management/specs/supplier-management/spec.md`
- Tasks:    `openspec/changes/supplier-management/tasks.md`

## Summary
Full-stack admin CRUD for the `Supplier` entity (milestone M2, supplier-fulfilled ecommerce).
Admin-only endpoints under `/api/admin/suppliers` + implement the existing frontend stubs
`SuppliersPage.tsx` / `supplierService.ts`. No public surface. Suppliers never exposed on
`/api/public/*`.

## Verified repo facts
- `Supplier` Prisma model already exists (no `deletedAt`); migrations up to date. No schema change expected.
- Reference template = the delivered product module (backend) and admin-product-panel (frontend).
- Backend layering: domain/ application/services + application/validator.ts / infrastructure/repositories /
  presentation/controllers / routes/admin + routes/index.ts + index.ts. Typed error classes carry code+status
  (e.g. ProductNotFoundError -> PRODUCT_NOT_FOUND, 404). Standard envelope { success, data, message }.
- Frontend: CRA + TS + React Router + Bootstrap. SuppliersPage.tsx and supplierService.ts exist as STUBS.
  admin-product-panel patterns: shared Pagination, StatusBadge, debounced filters, URL-synced state,
  fullscreen="sm-down" modals, 44px tap targets, dedicated typed admin service.

## Key decisions (from design.md)
- Soft-delete = set status=Inactive (never hard-delete). Status lifecycle Active|Inactive|Blocked, default Active.
- Adopt admin convention: /api/admin/suppliers, PATCH, page/pageSize. Update docs/api-spec.yml (supersede legacy /suppliers).
- Reinforce supplier-data isolation; add regression tests asserting no supplier fields in /api/public/*.

## Out of scope
SupplierOrder/fulfillment (KAN-19), supplier credentials/automation, real auth/RBAC, managing variants from supplier screen.
