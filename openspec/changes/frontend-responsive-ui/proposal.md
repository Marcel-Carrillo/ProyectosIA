## Why

Fashion ecommerce is mobile-first: most shoppers browse and evaluate products on phones and tablets. The public storefront has partial responsive CSS (product grid breakpoints) but catalog controls, header tap targets, and the product-detail layout still degrade on small viewports. The admin product panel was built desktop-first — filters, wide tables, and modals are awkward on phones, slowing catalog operators who need quick edits on the go. This change makes both surfaces fully usable at 360px (mobile), 768px (tablet), and desktop without altering backend behavior.

## What Changes

- **Storefront responsive polish:** 44×44px minimum tap targets on header icons and variant buttons; catalog search/sort controls stack full-width on mobile; product-detail grid collapses to single column below 768px; inline styles migrated to `storefront.css` for maintainable breakpoints.
- **Admin responsive layouts:** `ProductFilters` reflows to mobile-first single column; `ProductsPage` shows a stacked card list below `md` instead of a horizontally scrolling 8-column table; `VariantTable` renders per-variant cards below `md`; `ImageManager` add-form stacks on `xs`.
- **Admin modal ergonomics:** create/edit/delete modals use React Bootstrap `fullscreen="sm-down"` for comfortable mobile forms.
- **Optional shared admin CSS:** `frontend/src/styles/admin.css` for table→card patterns (imported after Bootstrap).
- **Testing:** extend RTL tests for new markup; Cypress viewport tests at 360px, 768px, and ≥1280px for storefront and admin catalog flows.
- **Documentation:** add responsive breakpoints and tap-target conventions to `docs/frontend-standards.md`.

## Non-goals

- No backend, API, database, or data-model changes.
- No new UI framework, Vite migration, or design-system rewrite.
- No sticky mobile "Add to Cart" bar, off-canvas filter drawer, or PWA/offline support (defer).
- No supplier-data display or editing; supplier fields remain excluded from all surfaces.
- No changes to order lifecycle, fulfillment, payment, returns, or refunds.

## Capabilities

### New Capabilities

- `frontend-responsive-ui`: Responsive layout and touch-target requirements for the public storefront (`/catalog`, product detail) and admin product panel (`/products`, product detail), covering breakpoints, table→card patterns, modal sizing, and accessibility at 360px / 768px / desktop.

### Modified Capabilities

<!-- None: this adds presentation-layer responsive requirements without changing existing backend or API spec behavior. Storefront and admin functional requirements (CRUD, filters, lifecycle) stay the same; only layout/UX at smaller viewports changes. -->

## Impact

- **Domain concepts:** `Product`, `ProductVariant`, `ProductImage`, `Category` — presentation only; no entity or validation changes.
- **Customer-facing behavior:** improved mobile/tablet browsing, filtering, product-detail gallery/variant selection, and navigation ergonomics on the public storefront.
- **Internal behavior:** improved mobile/tablet usability for catalog administration (list, filters, variant/image management).
- **Supplier data exposure:** none. Responsive cards and forms must continue to render only customer-safe / admin-safe fields; no supplier cost or reference fields are introduced.
- **Order lifecycle / fulfillment / payment / returns / refunds:** not affected.
- **Frontend code:** `frontend/src/styles/storefront.css`, optional `admin.css`; storefront pages/components (`CatalogPage`, `ProductPage`, `StorefrontHeader`, `ProductGallery`); admin pages/components (`ProductsPage`, `ProductDetailPage`, `ProductFilters`, `VariantTable`, `ImageManager`, `ProductFormModal`); Cypress specs; RTL tests.
- **Backend code:** no changes.
