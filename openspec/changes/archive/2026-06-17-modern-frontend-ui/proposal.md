## Why

The platform has a functioning backend and admin panel but no customer-facing storefront. Prospective shoppers have no way to browse or evaluate products. This change delivers the first public shopping surface — a minimalist, editorial UI inspired by Zara/Inditex — so the store can start generating real customer traffic and conversions.

## What Changes

- **New public storefront** under `/` (separate layout from the existing admin panel at `/admin/*`), with sticky header, category navigation, and footer.
- **Product catalog page** (`/catalog`) with a responsive product grid, category filter, text search, sort controls, and pagination — consuming the existing `GET /products` endpoint with `status=Active` filter.
- **Product detail page** (`/products/:slug`) with an ordered image gallery, variant selector (size/color), pricing display (public price + compare-at strikethrough), and a reserve/buy CTA placeholder — consuming the existing `GET /products/:id` endpoint.
- **Storefront design system**: a CSS design-token layer (neutral palette, minimalist type scale, generous whitespace) applied over the existing React-Bootstrap setup. No UI framework replacement.
- Implementation of `productService.getAll()`, `productService.getById()`, and `categoryService.getAll()` in the existing frontend service files (currently `throw new Error('Not implemented')`).

## Non-goals

- Cart, checkout, payment, or order placement (future phase).
- Customer accounts, wishlist, or order history.
- Live/instant search (a filter+submit pattern is sufficient for MVP).
- CMS-managed homepage.
- Migration to Vite or replacement of React-Bootstrap (stack changes require explicit approval per base-standards §12).
- Any backend or API changes.

## Capabilities

### New Capabilities

- `storefront-shell`: Minimalist public layout with sticky header (brand wordmark, category nav, search/cart affordances), clean footer, and responsive scaffold. Isolates storefront routes from admin routes.
- `product-catalog`: Customer-facing product listing with responsive grid, category filtering, text search, sort, and pagination. Renders product cards (image, name, brand, price). Displays only `Active` products.
- `product-detail`: Customer-facing product detail page with ordered image gallery, variant selector (size/color), pricing (publicPrice + compareAtPrice), and stock/availability feedback per variant.

### Modified Capabilities

*(none — no existing requirement-level specs are changing)*

## Impact

- **Frontend**: new components in `frontend/src/components/storefront/`, new pages in `frontend/src/pages/storefront/`, new `frontend/src/styles/` folder (design tokens), updates to `App.tsx` routing and `productService.ts` / `categoryService.ts`.
- **Backend/API**: no changes — consumes existing `GET /products`, `GET /products/:id`, `GET /categories`.
- **Admin panel**: no functional changes; existing admin layout and routes remain intact.
- **Security**: storefront must never expose supplier cost fields (`supplierId`, `supplierReference`, `supplierCost`); these are already excluded at the Prisma select level.
- **Customer-facing behavior**: entirely new surface — first public interface for shoppers.
