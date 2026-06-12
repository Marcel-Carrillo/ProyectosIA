## Why

The platform has no way to manage its product catalog over HTTP. Domain models, repositories, and services for Products, ProductVariants, and ProductImages already exist as WIP code but are unreachable — there are no controllers, routes, or a database migration. Admins cannot onboard products or make them available for sale until this presentation layer is wired up and the schema is persisted.

## What Changes

- Run the Prisma migration for `Product`, `ProductVariant`, and `ProductImage` models (schema already authored).
- Introduce admin CRUD endpoints under `/api/admin/products` for Products, nested Variants, and nested Images.
- Enforce existing business rules at the API boundary: status lifecycle (`Draft → Active → Inactive/Archived`), slug auto-generation with collision retry, ≥1 active variant required to activate a product, soft-delete for products/variants, hard-delete for images.
- **Supplier fields (`supplierId`, `supplierReference`, `supplierCost`) must never appear in any API response** — exclusion enforced at the Prisma `select` level and verified by an explicit automated test.
- Map domain and infrastructure errors (`ProductNotFoundError`, `ProductRequiresActiveVariantError`, `ProductArchivedCannotReactivateError`, `VariantNotFoundError`, `VariantSkuConflictError`, `ImageNotFoundError`, etc.) to appropriate HTTP status codes and structured error codes in the global error handler.
- Add unit/controller tests covering happy paths, lifecycle transitions, validation errors, slug collision, and the supplier-leak assertion.
- Update `docs/data-model.md` with product entities, fields, and lifecycle rules.
- Update `docs/api-spec.yml` with all new endpoints, request/response schemas, and error codes.

## Non-goals

- Public/customer-facing catalog endpoints (`/api/public/products`) — deferred to a future change.
- Admin authentication/authorization implementation — assumed placeholder middleware; real auth is a separate change.
- Image upload or file storage pipeline — only URL references are managed here.
- Stock quantity tracking, multi-supplier per variant, bulk import, or search indexing.
- Supplier cost visibility even for internal admin use — if needed, that requires a separate, explicitly-authorized change.

## Capabilities

### New Capabilities

- `product-management`: Admin CRUD for the Product aggregate — create (Draft, slug auto-gen), read (list with filters + pagination, get by id), update (fields + status lifecycle transitions), soft-delete. Includes slug collision retry logic and `ProductArchivedCannotReactivateError` / `ProductRequiresActiveVariantError` enforcement.
- `product-variant-management`: Admin CRUD for ProductVariants nested under a product — SKU uniqueness, public price required, compare-at price validation, supplier-field exclusion at all read operations, soft-delete. Scoped to parent product ownership.
- `product-image-management`: Admin CRUD for ProductImages nested under a product — URL-based references, sort order, hard-delete. Scoped to parent product ownership.

### Modified Capabilities

- `category-management`: Category model gains a `products Product[]` relation in the Prisma schema (added via migration). No change to category CRUD behavior or existing category spec requirements — the relation is additive only.

## Impact

- **Database:** New migration creates `products`, `product_variants`, `product_images` tables with indexes (`slug` unique, `sku` unique, non-unique on `categoryId`, `Product.status`, `ProductVariant.productId`/`status`, `ProductImage.productId`+`sortOrder`).
- **Backend — new files:**
  - `backend/src/presentation/controllers/productController.ts`
  - `backend/src/presentation/controllers/productVariantController.ts`
  - `backend/src/presentation/controllers/productImageController.ts`
  - `backend/src/routes/admin/productRoutes.ts`
- **Backend — modified files:**
  - `backend/src/presentation/controllers/index.ts` — export new controllers
  - `backend/src/routes/index.ts` — register `/api/admin/products` block
  - `backend/src/middleware/errorHandler.ts` — map new domain error classes
- **WIP files finalized:** `productService.ts`, `productVariantService.ts`, `productImageService.ts` and all repository implementations confirmed complete.
- **Docs:** `docs/data-model.md`, `docs/api-spec.yml`.
- **No customer-facing API surface changes** — all new endpoints are under `/api/admin/`.
- **Supplier data exposure risk:** explicitly mitigated at select level (already coded) and verified by test.
