## Context

The backend already provides the full admin product CRUD at `/api/admin/products` (list with `status/categoryId/search/page/pageSize/sort/order`, get-by-id, create, patch, soft-delete, plus nested `/:id/variants` and `/:id/images`), with the standard `{ success, data, message }` envelope and domain error codes (`PRODUCT_REQUIRES_ACTIVE_VARIANT`, `PRODUCT_ARCHIVED_CANNOT_REACTIVATE`, `PRODUCT_SLUG_CONFLICT`, `PRODUCT_NOT_FOUND`). The frontend admin pages (`ProductsPage.tsx`, `ProductDetailPage.tsx`) are placeholders.

This is a **frontend-only** change for the MVP. Stack: React + TypeScript (CRA), React Router v6, React Bootstrap, Axios. Patterns to follow: `docs/frontend-standards.md` and `ai-specs/agents/frontend-developer.md` — functional components with hooks, a service layer under `src/services/`, explicit loading/error states.

Key constraint from `docs/base-standards.md` §4: supplier cost and internal supplier data must never reach customer-facing surfaces. The backend already excludes those fields (`variantSelect`) and the public serializer enforces an allow-list; this change must not introduce a new leak path.

## Goals / Non-Goals

**Goals:**
- Replace the product admin placeholders with functional list + detail/edit screens against `/api/admin/products`.
- Manage status lifecycle, variants, and images, surfacing backend business-rule errors as actionable UI messages.
- Keep the public storefront read path (`productService` → `/api/public/products`) untouched.

**Non-Goals:**
- No backend changes for the MVP.
- No supplier-data display/edit (`supplierCost`, `supplierId`, `supplierReference`) — deferred; backend does not return them and tests assert their absence.
- No auth/authorization work (flagged for confirmation).
- No storefront/customer-facing UI changes.

## Decisions

### 1. Dedicated `adminProductService` (do not reuse the public `productService`)
Create `frontend/src/services/adminProductService.ts` targeting `/api/admin/products` with list/get/create/update/remove + nested variant/image methods. The existing `productService.ts` now serves the public storefront (`/api/public/products`, read-only) and MUST NOT be repurposed.
- **Why:** reusing `productService` would either break the storefront or mix admin/public concerns. A separate service keeps the surfaces independent and the public read path stable.
- **Alternative rejected:** a single service with a base-URL flag — rejected; conflates two contracts with different fields and auth expectations.

### 2. Centralized API-error → UI-message mapping
Map backend error codes to Spanish-facing messages in one helper (e.g. `mapProductError(code)`), used by the detail/edit and variant flows.
- **Why:** the status-lifecycle guards (`422`/`409`/`404`) are the core UX risk; one mapping avoids drift and ad-hoc error strings.

### 3. Proactive disable + safety-net for "Activate"
Disable the "Activate" action when the product has no `Active` variant (computed from the loaded variants), AND still handle `422 PRODUCT_REQUIRES_ACTIVE_VARIANT` if the server rejects.
- **Why:** best UX (prevent the dead-end) without trusting client state as the source of truth; the server stays authoritative.

### 4. Component breakdown (reuse before building)
- Pages: rewrite `ProductsPage.tsx` (list) and `ProductDetailPage.tsx` (detail/edit with sections for General / Variants / Images).
- New admin components under `src/components/admin/`: `ProductFilters`, `ProductFormModal` (or route `/products/new`), `VariantTable`, `ImageManager`, `StatusBadge`.
- Reuse/extract the existing storefront `Pagination` component into a shared location rather than duplicating it; reuse existing loading/error primitives if present.
- **Why:** consistent with the codebase and avoids duplicate pagination logic.

### 5. Types
Extend `src/types/product.ts` with write-payload types (`CreateProductInput`, `UpdateProductInput`, `CreateVariantInput`, `UpdateVariantInput`, `CreateImageInput`) and an API error type `{ success: false, error: { code, message } }`. Reuse existing `Product`, `ProductVariant`, `ProductImage`, `ProductQueryParams`, and the response envelopes.

## Risks / Trade-offs

- **Accidental supplier-data leak** → Mitigation: the panel renders only fields present in the admin response (which excludes supplier fields today); add a test asserting the admin panel/service never reads supplier fields, and keep the public serializer/test as the backstop.
- **Breaking the storefront by touching `productService`** → Mitigation: a separate `adminProductService`; do not modify storefront services/pages; verify storefront still loads.
- **Stale client state on status guards** → Mitigation: server remains authoritative (handle 422/409/404); refetch after mutations.
- **Pagination duplication** → Mitigation: extract a shared `Pagination` rather than copy.
- **`/api/admin/*` possibly unauthenticated** → Out of scope but flagged; the panel assumes an authenticated admin session. Recorded as a follow-up.
- **Supplier-cost follow-up** → Exposing it later requires backend `variantSelect` changes + updating tests that assert its absence; tracked as a separate change.

## Open Questions

- Should the admin list include a variant count / expanded category to avoid extra requests per row? (Default: use what the list endpoint returns; add only if needed.)
- Create via modal vs dedicated `/products/new` route? (Default: modal, to keep the list context; revisit if the form grows.)
