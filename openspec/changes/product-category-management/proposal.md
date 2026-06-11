## Why

The product catalog requires a category system to organize items by type (e.g., dresses, accessories, shoes) so that administrators can structure the catalog and customers can browse products by category. Without categories, all products appear in a flat unstructured list, which limits discoverability as the catalog grows.

## What Changes

- New `Category` domain entity with hierarchical support (optional parent-child relationship) and `Active`/`Inactive` status lifecycle
- New Prisma `Category` model and database migration (`create_category_catalog`)
- New `ICategoryRepository` interface and Prisma repository implementation
- New `CategoryService` with full CRUD and business rules (name uniqueness, soft-delete)
- New `CategoryController` and `categoryRoutes` wired into the Express router
- New validation function `validateCategoryData()` added to the shared application validator
- REST API endpoints: `GET /categories`, `GET /categories/:id`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id`

## Capabilities

### New Capabilities
- `category-management`: Full CRUD for product categories including hierarchy support, status lifecycle (Active/Inactive), and REST API endpoints for admin use

### Modified Capabilities
- `application-validator`: New requirement to validate category input data (`name` required, `status` enum constraint, `parentId` optional integer)

## Impact

- **Backend**: New files in domain, application, infrastructure, presentation, and routes layers; `prisma/schema.prisma` updated with `Category` model; existing `src/routes/index.ts` updated to register category routes
- **Database**: New `categories` table via Prisma migration
- **API**: 5 new REST endpoints under `/categories`
- **Customer-facing behavior**: Not directly affected in this change — category endpoints are admin-oriented; customer-facing product browsing by category is out of scope for this change
- **Supplier data exposure**: Not affected — categories contain no supplier cost or fulfillment information
- **Order lifecycle**: Not affected

## Non-goals

- Customer-facing category browsing or filtering on product listing pages (future change)
- Category-to-product assignment endpoint (handled when product management feature is implemented)
- Category image upload or CDN integration
- Storefront navigation or menu management driven by categories
