# Context Session — admin-product-panel

## Goal
Build the admin product backoffice panel (frontend) against the EXISTING `/api/admin/products` CRUD. Frontend-only change.

## OpenSpec artifacts (read these)
- openspec/changes/admin-product-panel/proposal.md
- openspec/changes/admin-product-panel/design.md
- openspec/changes/admin-product-panel/specs/admin-product-panel/spec.md
- openspec/changes/admin-product-panel/tasks.md

## Key facts / constraints
- Backend admin CRUD already exists: `/api/admin/products` (list with status/categoryId/search/page/pageSize/sort/order; GET/:id; POST; PATCH/:id; DELETE/:id soft-delete) + nested `/:id/variants` and `/:id/images`. Envelope `{ success, data, message }`; list `data = { items, total, page, pageSize }`. Error codes: PRODUCT_REQUIRES_ACTIVE_VARIANT (422), PRODUCT_ARCHIVED_CANNOT_REACTIVATE (422), PRODUCT_SLUG_CONFLICT (409), PRODUCT_NOT_FOUND (404).
- `frontend/src/services/productService.ts` is the PUBLIC storefront service (→ `/api/public/products`, read-only). DO NOT modify/reuse it. Create a separate `adminProductService.ts`.
- Supplier fields (supplierId/supplierReference/supplierCost) are NOT returned by the admin API today and are out of scope. Never render them.
- Reusable bits: `frontend/src/components/ErrorAlert.tsx`, `LoadingSpinner.tsx`, `frontend/src/components/storefront/Pagination.tsx` (extract to shared), `frontend/src/types/product.ts` (Product/ProductVariant/ProductImage/ProductQueryParams/envelopes).
- Pages to rewrite (currently placeholders): `frontend/src/pages/ProductsPage.tsx`, `frontend/src/pages/ProductDetailPage.tsx`. Routes `/products`, `/products/:id` already wired in App.tsx under admin `Layout`.
- Stack: React 18 + TS + CRA + React Router 6 + React Bootstrap 5 + Axios. Standards: docs/frontend-standards.md.

## Workspace
- Branch: feature/admin-product-panel (already created, off master).
