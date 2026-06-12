## Context

The ecommerce backend currently has no category structure. Products are a flat list with no organizational hierarchy. Administrators need to group products into categories (e.g., Dresses, Accessories, Shoes) before the product management feature can fully leverage them. This change adds the `Category` entity end-to-end following the established DDD layered architecture.

Current state: `prisma/schema.prisma` has no `Category` model. `src/domain/models/index.ts` lists `Category` as a planned entity but has no implementation. No category routes, services, or repositories exist.

## Goals / Non-Goals

**Goals:**
- Implement `Category` entity with full CRUD via REST API
- Enforce name uniqueness at DB and application level
- Support optional parent-child category hierarchy via self-referencing `parentId`
- Soft-delete via status transition to `Inactive` (preserves referential integrity with future `Product` relations)
- Follow the existing DDD layer structure and test coverage standards (≥90%)

**Non-Goals:**
- Customer-facing category browsing or navigation menus
- Category-to-product assignment (deferred to product management feature)
- Image upload or CDN integration for `imageUrl`
- Pagination or sorting on the list endpoint (simple list sufficient at this stage)

## Decisions

### 1. Soft-delete over hard-delete
**Decision:** `DELETE /categories/:id` sets `status = Inactive` rather than removing the row.  
**Rationale:** Future `Product` entities will reference categories by FK. Deleting a category row would require cascading deletes or constraint errors. Soft-delete avoids breaking future product references while still removing the category from active listings.  
**Alternative considered:** Hard-delete with ON DELETE SET NULL on the Product FK. Rejected because it silently orphans products, which is harder to audit.

### 2. Self-referencing hierarchy via `parentId` (nullable FK)
**Decision:** `Category` has an optional `parentId` referencing its own table.  
**Rationale:** Supports two-level category trees (e.g., Clothing → Dresses) without introducing a separate `CategoryHierarchy` join table. Simple enough for the current catalog scale.  
**Alternative considered:** Nested sets or closure table for deep hierarchies. Rejected as over-engineering for a fashion catalog that rarely exceeds 2 levels.

### 3. Repository implementation in infrastructure layer (not inline in service)
**Decision:** Introduce `backend/src/infrastructure/repositories/categoryRepository.ts` as the Prisma implementation of `ICategoryRepository`.  
**Rationale:** Consistent with the repository pattern already established for the project (described in `docs/backend-standards.md`). Keeps Prisma logic out of the service layer and enables mock injection in unit tests.

### 4. Routes under `/categories` (not `/api/admin/categories`)
**Decision:** Use `/categories` for now rather than the `/api/admin/` prefix.  
**Rationale:** The project's route prefixing strategy (`/api/admin/`, `/api/public/`) will be applied uniformly when authentication and role-based access are implemented. Adding the prefix now without auth guards creates false security. This decision should be revisited when auth is added.

### 5. Validation via shared `validator.ts` (adding `validateCategoryData`)
**Decision:** Add a dedicated `validateCategoryData(data)` function to the existing `src/application/validator.ts`.  
**Rationale:** Consistent with the existing `validateRequiredFields` pattern. Avoids scattering validation logic into the service or controller layer.

## Risks / Trade-offs

- **No auth guard on write endpoints** → Any client can create/update/delete categories until authentication is implemented. Mitigation: clearly mark endpoints as admin-only in API spec comments; add auth middleware when auth feature is implemented.
- **`parentId` cycles are not enforced at DB level** → A category could be set as its own parent or create circular chains. Mitigation: application-level check in `CategoryService.update()` to reject self-referencing `parentId`.
- **Soft-delete means `findAll` must always filter by status** → If a consumer forgets to filter, inactive categories leak into results. Mitigation: `CategoryService.findAll()` defaults to `status: Active`; only an explicit flag exposes inactive categories.

## Migration Plan

1. Add `Category` model to `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name create_category_catalog`
3. Deploy application changes alongside migration
4. No data migration required (table is new)
5. **Rollback**: `npx prisma migrate revert` or drop the `categories` table; no existing data is affected

## Open Questions

- Should subcategories be allowed to have their own subcategories (depth > 2)? Currently allowed by the model but not validated. Defer decision until product management reveals real catalog depth requirements.
- Will `imageUrl` be a free-form URL or managed by a media upload service? No decision needed now — store as plain string until media management is scoped.
