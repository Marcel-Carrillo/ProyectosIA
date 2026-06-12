## Context

The platform has a working backend foundation (infrastructure layer, error handler, health check) and a category management module. The `Category`, `Product`, `ProductVariant`, `ProductImage`, and `Supplier` entities are already fully modeled in `docs/data-model.md`. The Prisma schema does not yet contain `Product`, `ProductVariant`, or `ProductImage` models.

This design covers the backend implementation of the admin-facing product catalog: products, their variants, and their images. Customer-facing catalog browsing is explicitly out of scope.

## Goals / Non-Goals

**Goals:**

- Implement admin CRUD for `Product`, `ProductVariant`, and `ProductImage`
- Enforce the product status lifecycle (`Draft` → `Active` requires at least one active variant)
- Generate unique slugs automatically from the product name
- Expose `supplierCost`, `supplierReference`, and `supplierId` on write (admin) but never on read in any public-facing path
- Follow the existing layered architecture: router → controller → service → repository → Prisma
- Keep each capability isolated in its own domain folder

**Non-Goals:**

- Customer-facing public catalog endpoints (future change)
- Product search or filtering by full-text search (future change)
- Image file upload or CDN integration — URLs are stored as plain strings (same as `category.imageUrl`)
- Supplier management CRUD (suppliers already exist or must be seeded)
- Frontend admin UI for products

## Decisions

### Decision: Slug generation strategy

Auto-generate slug from `name` at create time using a standard kebab-case transform. If the generated slug collides, append a numeric suffix (`-2`, `-3`, …). Slug is writable on update to allow corrections.

**Why**: Consistent with the `Category.imageUrl` plain-string pattern. Keeps the product URL stable after creation without requiring admins to manage slugs manually.

**Alternatives considered**: Requiring slug as a required input field — rejected because it duplicates the name and creates friction; using a UUID-based slug — rejected because it produces ugly URLs.

### Decision: Supplier data write/read separation

`supplierId`, `supplierReference`, and `supplierCost` are accepted in admin create/update payloads but are always omitted from response bodies. A dedicated admin-only internal view (if needed in the future) would use a separate endpoint.

**Why**: The business rule is unambiguous — supplier cost must never be exposed to customers. Implementing the separation at the serialization layer (response DTO) rather than at the service layer avoids accidental leakage even if a new endpoint reuses the service.

**Alternatives considered**: Separate `ProductVariantPublic` vs `ProductVariantInternal` models — over-engineered for a single admin surface; omitting the fields in Prisma `select` — adds per-query complexity and is easy to forget.

### Decision: Separate routers per capability

`product-management`, `product-variant-management`, and `product-image-management` each have their own router mounted under `/api/admin/products`. Variant and image routes are nested: `/api/admin/products/:productId/variants` and `/api/admin/products/:productId/images`.

**Why**: Mirrors the existing `category` module pattern and keeps each domain file small and independently testable.

**Alternatives considered**: Single monolithic product router — harder to navigate and test; flat routes for variants (e.g., `/api/admin/variants/:id`) — loses the parent product context on write operations.

### Decision: Soft-delete for products and variants

Products are soft-deleted by setting `status = Inactive` (recoverable) or `status = Archived` (final). Variants are soft-deleted by setting `status = Inactive` or `status = Archived`. Records are never hard-deleted.

**Why**: Customer order items snapshot product and variant data at purchase time, but the foreign key reference (`productVariantId`) must remain valid for auditing. Hard-deletion would break referential integrity with historical orders.

**Alternatives considered**: Hard-delete with cascading nullification — rejected because order history must remain intact and traceable.

### Decision: At-least-one-variant gate for publishing

A product can only transition to `Active` if it has at least one variant with `status = Active`. This check lives in the product service, not in a database constraint.

**Why**: The business rule is expressed in terms of the application state (variant count), not a simple field constraint. A service-layer check is readable and testable without complex DB-level triggers.

## Risks / Trade-offs

- **Slug collision under concurrent writes** → Mitigation: Wrap slug uniqueness check + insert in a transaction with a retry loop (max 5 attempts with suffix increment). Prisma unique constraint is the final guard.
- **Supplier data leakage via future endpoints** → Mitigation: Response DTOs explicitly exclude supplier fields. Add a unit test asserting supplier fields are absent from variant response bodies.
- **compareAtPrice constraint** → compareAtPrice must be ≥ publicPrice if provided. Validated at the service layer. No DB-level check, which means a direct DB mutation could bypass it — acceptable for now, documented in the spec.
- **Large image lists** → No pagination for product images (typically < 20 per product). If products accumulate many images in the future, pagination can be added without breaking existing clients.

## Migration Plan

1. Add `Product`, `ProductVariant`, and `ProductImage` Prisma models matching `docs/data-model.md`
2. Run `prisma migrate dev` to generate and apply the migration
3. Implement repository, service, and controller layers per capability, in order: product → variant → image
4. Register routes in the Express app
5. Update `docs/api-spec.yml` with new admin endpoints
6. Confirm with integration tests (curl or Jest + Supertest)

**Rollback**: Drop the migration and remove the route registrations. No data dependencies exist at this stage (no product data in production yet).
