## Why

The platform has categories, infrastructure, and a frontend skeleton in place, but no way to create or manage the products that will be sold. Without product catalog management, administrators cannot populate the store, and the order flow cannot reference any sellable items.

## What Changes

- Admin API endpoints for creating, listing, reading, updating, and soft-deleting `Product` records
- Admin API endpoints for managing `ProductVariant` records within a product (pricing, SKU, size, color, supplier linkage, stock policy)
- Admin API endpoints for managing `ProductImage` records (add, reorder, remove images for a product)
- Slug auto-generation from the product name, with uniqueness enforcement
- Product status lifecycle: `Draft` → `Active` → `Inactive` / `Archived`
- A product must have at least one active variant before it can be published as `Active`
- Supplier cost and supplier credentials are internal-only; they are accepted on write but never returned in customer-facing responses
- Soft-delete for products (status set to `Inactive` or `Archived`) to preserve referential integrity with order history

## Capabilities

### New Capabilities

- `product-management`: Admin CRUD for `Product` — create, list, get by ID, update, and soft-delete products; slug generation and status lifecycle enforcement
- `product-variant-management`: Admin CRUD for `ProductVariant` — create, list, get, update, and soft-delete variants within a product; pricing rules, SKU uniqueness, stock policy, and supplier linkage (internal data never exposed publicly)
- `product-image-management`: Admin management of `ProductImage` — add images to a product, update alt text and sort order, remove images

### Modified Capabilities

<!-- No existing capabilities have requirement-level changes in this change -->

## Impact

- **Backend**: New Prisma models (`Product`, `ProductVariant`, `ProductImage`) and migrations; new admin routes under `/api/admin/products`; new service, repository, and domain layers for each entity
- **API spec**: New admin endpoints added to `docs/api-spec.yml`
- **Data model**: `docs/data-model.md` already documents these entities; implementation must match those definitions
- **Frontend**: Out of scope for this change — admin UI for product catalog is a separate future change
- **Customer-facing APIs**: No customer-facing product endpoints in this change; those belong to a future public catalog browsing capability
- **Supplier data exposure**: `supplierCost`, `supplierReference`, and `supplierId` are writable by admin but must never appear in any public or customer-facing response
- **Order lifecycle**: Not affected — products and variants are prerequisites for ordering, but order flows are not changed here
