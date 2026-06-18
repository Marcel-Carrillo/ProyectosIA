## Context

This is a full-stack admin CRUD for the `Supplier` entity, part of milestone M2 (Admin Operations) in a supplier-fulfilled women's fashion ecommerce. Verified current state of the repo:

- The `Supplier` Prisma model already exists (`backend/prisma/schema.prisma`): `id`, `name`, `contactName?`, `contactEmail?`, `contactPhone?`, `website?`, `notes?`, `status` (default `"Active"`), `createdAt`, `updatedAt`, relation `productVariants ProductVariant[]`. There is **no** `deletedAt` column.
- There is **no** backend supplier module yet (no repository/service/controller/routes). The delivered **product** module is the reference template: `domain/`, `application/services/productService.ts`, `application/validator.ts`, `infrastructure/repositories/productRepository.ts`, `presentation/controllers/productController.ts`, `routes/admin/productRoutes.ts`, registered in `routes/index.ts` and mounted in `index.ts`.
- Frontend `frontend/src/pages/SuppliersPage.tsx` and `frontend/src/services/supplierService.ts` already exist as **stubs** ("Coming soon" / methods throwing "Not implemented"). The `admin-product-panel` feature is the reference for admin UI patterns (shared `Pagination`, `StatusBadge`, debounced filters, URL-synced state, `fullscreen="sm-down"` modals, 44px tap targets, dedicated typed service).
- Backend error convention: typed error classes carrying `code` + `status` (e.g. `ProductNotFoundError` → `PRODUCT_NOT_FOUND`, 404). Standard envelope `{ success, data, message }` / `{ success: false, error: { message, code, details? } }`.
- `docs/api-spec.yml` contains a legacy `/suppliers` block (PUT, `page`/`limit`) that diverges from the delivered admin convention (`/api/admin/*`, PATCH, `page`/`pageSize`).

Constraint owners: backend-developer and frontend-developer agents; product-strategy-analyst defined the scope (admin-only, no fulfillment).

## Goals / Non-Goals

**Goals:**
- Admin CRUD for suppliers under `/api/admin/suppliers` (list with pagination/search/status filter, get, create, PATCH update, soft-delete via status), matching the product module's architecture, envelope, and error conventions.
- Implement the existing frontend stubs (`SuppliersPage`, `supplierService`) reusing `admin-product-panel` patterns.
- Preserve and test the invariant that supplier data is never exposed on customer-facing APIs.
- Align `docs/api-spec.yml` with the delivered admin convention.

**Non-Goals:**
- `SupplierOrder` / fulfillment flow (KAN-19), supplier credentials/automation, real auth/RBAC, managing variants or supplier cost fields from the supplier screen, any public supplier exposure.

## Decisions

### D1 — Soft-delete by `status`, never hard-delete
`DELETE /api/admin/suppliers/:id` sets `status = Inactive` (no row removal). **Why:** `Supplier` has no `deletedAt`, and suppliers are referenced by `ProductVariant` (and future `SupplierOrder`); hard-deleting would break referential integrity and historical data. Mirrors the `Category` soft-delete approach. **Alternative considered:** add a `deletedAt` column — rejected as out of scope (a schema change) and unnecessary given the `status` lifecycle.

### D2 — Status lifecycle `Active | Inactive | Blocked`
Three valid values per `data-model.md` (default `Active`). `Inactive` = soft-deleted/retired; `Blocked` = explicitly barred (distinct from deletion). For the MVP, transitions are unrestricted (any → any) to keep it manual and simple; the service centralizes status validation so a transition guard can be added later without API changes. **Alternative:** enforce a strict state machine now — deferred (premature for MVP per project principles).

### D3 — Follow the product module layering, do not invent a new pattern
New files: `domain/models/supplier.ts`, `domain/repositories/supplierRepository.ts` (interface + filter/result types), `infrastructure/repositories/supplierRepository.ts` (Prisma impl + typed errors), `application/services/supplierService.ts`, `validateSupplierData` in `application/validator.ts`, `presentation/controllers/supplierController.ts`, `routes/admin/supplierRoutes.ts` (registered in `routes/index.ts`, mounted in `index.ts`). **Why:** consistency, reviewability, and reuse of established error/envelope handling. **Alternative:** a thinner single-file CRUD — rejected; would diverge from the codebase's clean-layered convention (an approval-gated architectural choice).

### D4 — Admin convention over legacy spec: `/api/admin/suppliers`, PATCH, `page`/`pageSize`
Adopt the delivered admin convention and update `docs/api-spec.yml` to supersede the legacy `/suppliers` (PUT, `page`/`limit`) block. **Why:** one consistent admin contract across products, categories, and suppliers. **Alternative:** honor the legacy spec — rejected; it predates and conflicts with the shipped admin pattern.

### D5 — No public surface; reinforce existing isolation
No supplier route under `/api/public/*`. The public product serializer (`presentation/serializers/publicProduct.ts`) and the variant select in `productRepository.ts` already omit `supplierId`/`supplierReference`/`supplierCost`; this change adds regression tests asserting that and does not touch the serializer behavior.

### D6 — Reuse frontend admin building blocks
Implement the existing stubs rather than create parallel files. `supplierService` mirrors `adminProductService` (typed methods + `mapSupplierError`). `SuppliersPage` mirrors `ProductsPage` (responsive table≥md / card-list<md, URL-synced filters). Add `SupplierFormModal` and `frontend/src/types/supplier.ts`. Route `/suppliers` lives in the admin `Layout`, isolated from the storefront.

## Risks / Trade-offs

- **Supplier data leakage to public APIs (critical)** → No public supplier endpoint is created; keep the public product allow-list serializer intact; add tests asserting suppliers and `supplierCost`/`supplierReference`/`supplierId` are absent from every `/api/public/*` response.
- **Contract divergence with legacy `api-spec.yml`** → Update the spec to the admin convention in the same change; reuse existing `Supplier*` schemas where present.
- **Deactivating a supplier with linked variants** → Soft-delete by status only; variants and the catalog remain intact; no cascade.
- **Status semantics confusion (`Inactive` vs `Blocked`)** → Document both in the spec and surface them distinctly in the UI; do not treat `Blocked` as deletion.
- **Stub drift** → Implement the existing `SuppliersPage`/`supplierService` files in place to avoid duplicate dead code.

## Migration Plan

- No schema change expected. First task verifies `prisma migrate status` is up to date and the `Supplier` table matches `data-model.md`; only if a discrepancy is found is a migration created (with explicit note).
- Deploy is additive (new admin endpoints + implemented frontend page). Rollback = revert the feature branch; no data migration to undo since no schema/data change is introduced.

## Open Questions

- Should `Blocked` suppliers be selectable later by `SupplierOrder` (KAN-19)? Out of scope here; the `status` filter already allows excluding them. Defer to KAN-19.
- Is a strict status-transition guard desired now or later? Deferred to a future change (D2); service layer is structured to add it without breaking the API.
