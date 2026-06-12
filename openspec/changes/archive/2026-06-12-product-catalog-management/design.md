## Context

The product catalog domain has a complete DDD backend stack already coded as WIP: domain models (`product.ts`, `productVariant.ts`, `productImage.ts`), repository interfaces, Prisma-backed implementations, and three service classes. The Prisma schema has the three models defined but no migration has been run.

What is missing is exclusively the **presentation layer** (controllers + routes), the **database migration**, and the corresponding **tests and documentation updates**. This design covers those gaps only — it does not redesign the existing domain/application/infrastructure layers.

Reference implementation pattern: `categoryController.ts` / `categoryRoutes.ts` / `categoryService.ts`.

## Goals / Non-Goals

**Goals:**
- Wire the existing service/repository/domain stack up to HTTP via Express controllers and routes.
- Run the Prisma migration to create the three tables.
- Guarantee supplier field exclusion is enforced and tested.
- Map domain errors to HTTP responses in the central error handler.
- Keep controllers thin — all business logic stays in services.

**Non-Goals:**
- Redesigning domain models, services, or repositories — they are treated as correct.
- Implementing admin authentication — a placeholder guard is assumed; real auth is a separate change.
- Public/customer catalog endpoints.
- Image file upload or storage; only URL references are stored.

## Decisions

### 1. Thin controllers, logic stays in services

**Decision:** Controllers only extract request data, call service methods, and return `{ success, data, message }`. All validation, lifecycle checks, and error throwing happen in services and repositories.

**Rationale:** Mirrors the established `categoryController` pattern. Keeps controllers trivially testable and prevents business logic from fragmenting across layers.

**Alternative considered:** Fat controllers that inline some validation. Rejected — would duplicate logic already in services and make future changes harder.

---

### 2. Supplier field exclusion at the repository select level

**Decision:** `variantSelect` Prisma select constant is defined in the variant repository and excludes `supplierId`, `supplierReference`, and `supplierCost` from every read query (`findMany`, `findFirst`, `findUnique`, `update`, `create ... select`). Controllers and DTOs do not need to filter these fields.

**Rationale:** Defense-in-depth at the lowest possible layer. If a new controller or serializer is added, the exclusion is automatic. A test asserts no response body in the full request path contains these field names.

**Alternative considered:** DTO serializer stripping fields at the controller level. Rejected — relies on developer discipline at every future entry point; a single omission causes a data leak.

---

### 3. Nested routes via Express sub-routers

**Decision:** `productRoutes.ts` creates a main product router plus two nested sub-routers for `/variants` and `/images`, mounted on `/:id/variants` and `/:id/images` respectively. The product id is forwarded via `{ mergeParams: true }`.

**Rationale:** Keeps route ownership in a single file, mirrors the resource nesting in the URL scheme, and avoids duplicating product-id extraction in every variant/image controller.

---

### 4. Soft-delete for products and variants; hard-delete for images

**Decision:** `DELETE /products/:id` and `DELETE /products/:id/variants/:variantId` set `deletedAt` and return `204`. `DELETE /products/:id/images/:imageId` performs a Prisma `delete` and returns `204`.

**Rationale:** Products and variants will be referenced by future customer order-item snapshots; soft-deleting preserves referential integrity. Images have no FK in order history and accumulate storage cost; hard-delete is safe and appropriate.

---

### 5. Slug auto-generation in the service layer

**Decision:** `productService.createProduct` calls `generateSlug(name)` to produce a kebab-case slug, then `resolveUniqueSlug(baseSlug, repo)` retries with numeric suffixes up to 5 attempts. If all 5 are taken, a `ProductSlugConflictError` (409) is thrown.

**Rationale:** The slug is derived from user input but is not directly user-controlled in the create flow — keeping this logic in the service prevents a controller from forgetting to generate it.

---

### 6. Decimal serialization via explicit `.toNumber()` mapping

**Decision:** Repository read methods map `publicPrice` and `compareAtPrice` (Prisma `Decimal`) to `number` using `.toNumber()` before returning the domain model. The JSON envelope never contains a raw `Decimal` object.

**Rationale:** Prisma's `Decimal` type does not JSON-serialize predictably; leaving it to `JSON.stringify` produces `{}` or string representations depending on the driver version. Explicit mapping at the repository boundary makes serialization deterministic.

---

### 7. Domain error classes mapped in the central error handler

**Decision:** `errorHandler.ts` gains `instanceof` checks for `ProductNotFoundError`, `ProductRequiresActiveVariantError`, `ProductArchivedCannotReactivateError`, `ProductSlugConflictError`, `VariantNotFoundError`, `VariantSkuConflictError`, `VariantComparePriceInvalidError`, `ImageNotFoundError`.

HTTP mappings:
| Error class | Status | code |
|---|---|---|
| `ProductNotFoundError` / `VariantNotFoundError` / `ImageNotFoundError` | 404 | `PRODUCT_NOT_FOUND` / `VARIANT_NOT_FOUND` / `IMAGE_NOT_FOUND` |
| `ProductRequiresActiveVariantError` | 422 | `PRODUCT_REQUIRES_ACTIVE_VARIANT` |
| `ProductArchivedCannotReactivateError` | 422 | `PRODUCT_ARCHIVED_CANNOT_REACTIVATE` |
| `ProductSlugConflictError` / `VariantSkuConflictError` | 409 | `PRODUCT_SLUG_CONFLICT` / `VARIANT_SKU_CONFLICT` |
| `VariantComparePriceInvalidError` | 422 | `VARIANT_COMPARE_PRICE_INVALID` |

**Rationale:** Centralizing HTTP mapping keeps controllers free of try/catch noise and ensures consistent error envelope format (`{ success: false, error: { message, code } }`).

## Risks / Trade-offs

**[Supplier field leak]** → A future developer adds an `include: { variants: true }` query without using `variantSelect`, bypassing the protection. **Mitigation:** Test that asserts no response body from any product/variant endpoint contains `supplierId`, `supplierReference`, or `supplierCost`. Test must run in CI.

**[Slug exhaustion edge case]** → After 5 collision retries, a 409 is returned. In practice this is extremely unlikely for product names but theoretically possible. **Mitigation:** The error is clean and documented; the admin can choose a different name. Accepted trade-off.

**[Decimal precision drift]** → Using `.toNumber()` on large Decimal values can introduce floating-point imprecision (e.g., values beyond 15 significant digits). **Mitigation:** Product prices in fashion ecommerce are well within safe `number` range (≤ 9999.99); `.toNumber()` is safe here. If precision requirements grow, revisit with string serialization.

**[Archived products in order history]** → Future order snapshots will reference soft-deleted or archived products. **Mitigation:** Soft-delete ensures the row exists; snapshot denormalization (separate story) is the long-term solution. No action needed here.

**[Migration on production data]** → The schema has no live data yet (product tables do not exist). **Mitigation:** This is a purely additive migration; zero risk of data loss.

## Migration Plan

1. Ensure Docker / PostgreSQL is running locally.
2. Run `npx prisma migrate dev --name add-product-catalog` from `backend/`.
3. Verify migration file created under `backend/prisma/migrations/`.
4. Register routes in `backend/src/routes/index.ts` (replace the FUTURE placeholder comment).
5. Run `npm test` to confirm suite passes.
6. No rollback complexity — tables can be dropped via `prisma migrate reset` in dev if needed.

## Open Questions

- Should product status transitions use the generic `PATCH /:id` body or a dedicated `PATCH /:id/status` endpoint? *(Current plan: generic PATCH handles all field updates including status.)*
- Confirm `pageSize` default for list endpoints. *(Current plan: 20.)*
- Should list responses optionally embed variant count or image count? *(Current plan: no embedding; separate nested endpoints for detail.)*
