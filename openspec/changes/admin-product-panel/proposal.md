## Why

The backend already exposes a complete admin product CRUD at `/api/admin/products` (list, detail, create, update, soft-delete, plus nested variants and images), but the backoffice screens are still placeholders (`ProductsPage.tsx` and `ProductDetailPage.tsx` render "Coming soon"). Store administrators cannot manage the catalog from the UI today — the only way to create/edit products, manage variants, or publish a product is to call the API by hand. This change builds the real admin product panel so the catalog can be operated from the app, which in turn is what feeds the public storefront.

## What Changes

- **New admin product panel (frontend):** functional `ProductsPage` (list) and `ProductDetailPage` (detail/edit) wired to `/api/admin/products`, replacing the placeholders.
- **Product list:** server-side filtering by `status` and `categoryId`, text `search` (debounced), pagination, sorting by `name`/`createdAt`, status badges, thumbnail, and row actions (edit, soft-delete with confirmation).
- **Product create/edit:** form for `name`, `description`, `brand`, `categoryId`, `mainImageUrl`; `slug` shown read-only (backend auto-generates it).
- **Status lifecycle in the UI:** Draft → Active → Inactive/Archived, surfacing the backend business-rule guards as actionable errors (`PRODUCT_REQUIRES_ACTIVE_VARIANT` 422, `PRODUCT_ARCHIVED_CANNOT_REACTIVATE` 422, `PRODUCT_SLUG_CONFLICT` 409, `PRODUCT_NOT_FOUND` 404). The "Activate" action is proactively disabled when the product has no Active variant, with the 422 still handled as a safety net.
- **Variant management:** CRUD for `ProductVariant` (the sellable unit): `sku`, `size`, `color`, `publicPrice`, `compareAtPrice`, `stockPolicy`, `status`.
- **Image management:** CRUD for `ProductImage` (`url`, `altText`, `sortOrder`), reordering, and selecting the main image.
- **Dedicated admin service:** new `frontend/src/services/adminProductService.ts` hitting `/api/admin/products`. The public storefront `productService.ts` (now pointing to `/api/public/products`) is left untouched.
- Loading / error / empty states across all views.

## Capabilities

### New Capabilities
- `admin-product-panel`: Customer-facing-internal backoffice screens to manage the product catalog (list with filters/search/pagination/sort, create/edit, status lifecycle with business-rule guards, variant CRUD, image CRUD) consuming the existing `/api/admin/products` API.

### Modified Capabilities
<!-- None: the backend admin CRUD requirements (product-management, product-variant-management, product-image-management) are unchanged; this change consumes them from the UI. The frontend-skeleton placeholder for the product route is replaced by real behavior, but that is an implementation detail, not a spec-level requirement change. -->

## Impact

- **Domain concepts:** `Product`, `ProductVariant`, `Category`, `ProductImage`. `Supplier` data (`supplierCost`, `supplierId`, `supplierReference`) is explicitly **out of scope** (see Non-goals).
- **Behavior:** affects **internal** backoffice behavior (catalog administration). It does not change customer-facing storefront behavior directly, but governs what eventually becomes visible at `/api/public/products` (only `Active` products with an `Active` variant).
- **Supplier data exposure:** none. The admin panel must not introduce any channel that leaks supplier cost/references to the public surface; the backend already excludes those fields from its responses (`variantSelect`) and the public serializer enforces a customer-safe allow-list. No order lifecycle, fulfillment, payment, returns, or refund concerns are touched.
- **Frontend code:** new `adminProductService.ts`; rewrite `ProductsPage.tsx`, `ProductDetailPage.tsx`; new admin components (filters, product form, variant table, image manager, status badge); extend `types/product.ts` with write payload + API error types. The public storefront services/pages are NOT modified.
- **Backend code:** no changes required for the MVP. Two follow-ups flagged (out of scope): (1) exposing/editing supplier cost would require adding those fields to `variantSelect` and updating the tests that currently assert their absence; (2) confirming `/api/admin/*` authentication/authorization (no auth middleware observed).

## Non-goals

- Editing or displaying supplier data (`supplierCost`, `supplierId`, `supplierReference`) — deferred to a separate change; backend currently does not return these fields.
- Authentication/authorization for `/api/admin/*` (assumed handled elsewhere; flagged for confirmation, not built here).
- Any storefront/customer-facing UI changes.
- Bulk operations, CSV import/export, or supplier-order/fulfillment workflows.
- Premature automation (e.g., auto-publishing); the first version prioritizes manual admin control.
