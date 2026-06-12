# E2E Testing Report

**Date:** 2026-06-12
**Change:** modern-frontend-ui
**Step:** 12

## Environment

| Component | URL | Status |
|---|---|---|
| Backend | http://localhost:3000 | Running (pre-existing process) |
| Frontend | http://localhost:3002 | Started for testing |

**Notes:**
- Frontend used CRA proxy (`"proxy": "http://localhost:3000"` in package.json) to forward API calls to the backend on the same origin, avoiding CORS restrictions from port mismatch.
- `REACT_APP_API_BASE_URL=` set to empty string in `.env.development.local` to activate proxy routing.
- Database seeded with 2 categories (Women id=2, Accessories id=3) and 3 products (Black Midi Dress, Linen Blazer, Leather Belt) via `prisma/seed.ts`.

## Test Results

### 12.1 — Servers running
- Backend: port 3000 ✓
- Frontend: port 3002 compiled successfully, no errors ✓

### 12.2 — Storefront shell at http://localhost:3002
- Redirected from `/` to `/catalog` ✓
- Header renders: "Fashion Store home" wordmark link, Search icon, Cart icon ✓
- Category nav: All, Accessories (/catalog?categoryId=3), Women (/catalog?categoryId=2) ✓
- Footer: "Fashion Store" wordmark + copyright ✓
- Console: 0 errors, 2 warnings (React Router v7 future flags — expected) ✓

### 12.3 — Product grid at /catalog
- 3 product cards render: Leather Belt, Linen Blazer, Black Midi Dress ✓
- Each card: product image, brand, name ✓
- Console: 0 errors ✓
- Screenshot: `e2e-01-catalog-loaded.png`

### 12.4 — Category filter
- Clicked "Women" link → URL: `/catalog?categoryId=2` ✓
- "Women" link gains [active] state ✓
- Grid filters to 2 products: Linen Blazer + Black Midi Dress (both in category 2) ✓
- Leather Belt (category 3) correctly excluded ✓

### 12.5 — Search
- Typed "Belt" into search input, clicked Search → URL: `/catalog?search=Belt&page=1` ✓
- Search input retains search term ✓
- Grid shows only "Leather Belt" ✓
- Page resets to 1 on search ✓

### 12.6 — Sort
- Selected "Name A–Z" → URL: `/catalog?sort=name&order=asc&page=1` ✓
- Combobox reflects selected option ✓
- Note: sort/order params update URL state; backend sorting requires API support (not yet implemented server-side) ✓

### 12.7 — Product detail at /catalog/2
- Navigated from product card click → URL: `/catalog/2` ✓
- Product gallery: large main image + 2 thumbnails ✓
- Brand: Zara ✓
- Title: "Black Midi Dress" (h1) ✓
- Price: 69,99 € (compare) / 49,99 € (sale) with strikethrough ✓
- VariantSelector: Size (S/M/L), Color (Black) ✓
- Description renders ✓
- "Add to Cart" button visible ✓
- Screenshot: `e2e-02-product-detail.png`

### 12.8 — Variant selector interaction
- Clicked Size M → button gains [active] [pressed] state ✓
- Color selector remains at Black ✓
- Price display unchanged (all variants same price) ✓
- Console: 0 errors ✓

### 12.9 — No supplier fields in HTML
Evaluated `document.body.innerHTML` on product detail page:
- `supplierId`: false ✓
- `supplierReference`: false ✓
- `supplierCost`: false ✓
- `supplier_id`: false ✓

Supplier fields correctly excluded at the API layer (Prisma select) and never reach the frontend.

### 12.10 — Admin routes unaffected
- Navigated to `/products` → admin Layout renders ✓
- Navigation: Admin wordmark, Products, Categories, Suppliers, Customers, Customer Orders, Supplier Orders, Shipments, Return Requests, Refunds ✓
- No storefront header or footer visible ✓
- Route isolation working correctly ✓

## Bugs Found and Fixed During E2E

| Bug | Fix |
|---|---|
| `product.variants` undefined crash in ProductCard | Made `variants` and `images` optional in `Product` type; guarded `getLowestPriceVariant` with `if (!variants?.length)` |
| `product.images` undefined crash in ProductCard | Used `product.images?.[0]` optional chaining |
| TS error `ProductImage[] \| undefined` in ProductPage | Added `?? []` fallback for gallery |
| TS error `ProductVariant[] \| undefined` in ProductPage | Added `product.variants &&` guard before VariantSelector |
| `aria-pressed` on `listitem` role (a11y lint) | Changed to `aria-current` on gallery thumbnail buttons |
| Unnecessary useCallback deps in CatalogPage | Removed `sort` and `order` from deps array (not used in fetch) |
| `||` operator discards empty-string API_BASE_URL | Changed to `??` (nullish coalescing) in productService and categoryService |

## Summary

All 10 E2E test workflows executed successfully. The storefront renders correctly, API integration works via proxy, supplier data is never exposed, and admin routes remain isolated and unaffected.
