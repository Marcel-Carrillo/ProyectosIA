# Product Strategy Analyst — Storefront UI (Inditex-style)

## Executive summary
The request is a customer-facing storefront UI, not a restyle of the existing admin panel.
The current frontend is an internal admin skeleton (dark navbar "Admin", routes for
suppliers/customers/orders/shipments/refunds, "Coming soon" pages, services throwing
"Not implemented"). A public shopping surface does not exist yet. This is a net-new
customer-facing layer that consumes the existing public read endpoints
(`GET /products`, `GET /products/{id}`, `GET /categories`).

## Problem and user value
- Shoppers have no way to browse the catalog; the only UI is internal.
- Value: a clean, minimalist, fashion-forward catalog experience (Zara/Inditex aesthetic)
  that builds trust and drives discovery and conversion for a brand with no physical store.

## Target segments
- Primary: women 20–45, fashion-aware, mobile-first, used to Zara/Mango/H&M UX.
- Secondary: returning customers checking new arrivals.
- Internal (separate persona, already served): store admins — out of scope here.

## MVP scope recommendation
- In: public storefront shell (header/nav/footer), category navigation, product grid
  (listing + filters/sort/pagination/search), product detail (gallery, variant/size/color
  selection, price + compare-at), responsive design system (typography, neutral palette,
  whitespace), loading/empty/error states.
- Out (next phases): cart, checkout, customer accounts, wishlist, search-as-you-type,
  CMS-driven home content. No backend changes required for MVP.

## Fit with supplier-fulfilled model
- Fully compatible. Catalog browsing does not assume internal stock.
- Critical invariant: never surface supplierId/supplierReference/supplierCost. Already
  enforced at the Prisma select layer; the storefront must also avoid requesting/using
  any admin-only fields and must only show Active products.

## Assumptions and risks
- RISK: prompt says "Vite", but the project is Create React App (react-scripts 5.0.1).
  Migrating to Vite is a stack change requiring explicit approval (base-standards §12).
  Assumption for MVP: stay on CRA unless approved.
- RISK: introducing a heavy UI kit/Tailwind conflicts with the mandated React-Bootstrap
  stack. Recommend a lightweight custom design-token CSS layer over Bootstrap rather than
  swapping frameworks.
- RISK: admin and storefront share one app/routing; need clear separation of layouts.
- ASSUMPTION: product images and prices (variant publicPrice/compareAtPrice) are
  populated enough to render an attractive grid; otherwise placeholders needed.

## Success metrics
- Catalog page render < 2.5s LCP on mobile; product grid usable at 360px width.
- Bounce rate on listing, product-detail view rate, add-to-(future)-cart intent clicks.
- Accessibility: keyboard-navigable, alt text on all product images, AA contrast.

## Next steps
1. Confirm CRA-vs-Vite decision and UI styling approach (tokens over Bootstrap).
2. Define public storefront route namespace separate from `/admin`.
3. Implement design system + storefront shell, then listing, then detail.
