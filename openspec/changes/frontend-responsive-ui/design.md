## Context

The platform has a public storefront (`/catalog`, `/catalog/:id`) with token-based CSS in `frontend/src/styles/storefront.css` (grid already adapts 2/3/4 columns at 768px and 1200px) and an admin product panel (`/products`, `/products/:id`) built with React Bootstrap 5.3. Admin list/detail use `Table responsive` (horizontal scroll only) and multi-column filter rows that are cramped at 360px. Viewport meta is already set in `frontend/public/index.html`.

This is a **frontend-only**, presentation-layer change. Stack unchanged: CRA, React 18, TypeScript, React Bootstrap, Axios. Patterns: `docs/frontend-standards.md`, `ai-specs/agents/frontend-developer.md`.

Supplier data must never appear on customer-facing surfaces (`docs/base-standards.md` §4). Admin variant cards must not introduce supplier fields.

## Goals / Non-Goals

**Goals:**
- Deliver usable, thumb-friendly UX at **360px (mobile baseline)**, **768px (tablet, Bootstrap `md`)**, and **≥992px (desktop, Bootstrap `lg`)** on all catalog-related screens.
- Enforce **44×44px minimum touch targets** on mobile for interactive controls.
- Eliminate **horizontal page scroll** at 360px on storefront and admin catalog routes.
- Preserve desktop layouts (≥992px) with no visual regression.

**Non-Goals:**
- Backend/API changes, new dependencies, stack migration.
- Sticky mobile CTA, off-canvas filters, virtualization, touch drag-reorder for images.
- Responsive work on admin placeholder pages (Categories, Orders, etc.) beyond verifying navbar collapse.

## Decisions

### 1. Standardize breakpoints on existing conventions
Use **360px** as the design baseline (test viewport), **768px** (`md`) for tablet, **992px** (`lg`) for desktop table layouts. Storefront keeps existing `768`/`1200` grid queries; new rules use `max-width: 575.98px` or Bootstrap `sm-down` utilities where appropriate.
- **Why:** aligns with Bootstrap 5 defaults and existing `storefront.css` media queries.
- **Alternative rejected:** custom breakpoint scale (e.g. 640/1024) — would diverge from Bootstrap admin components.

### 2. CSS-first responsiveness; minimal JS layout switching
Prefer media queries and Bootstrap grid classes over `window.matchMedia` hooks.
- **Why:** lower complexity, better performance, easier to test.
- **Exception:** admin table→card views require conditional rendering in React (`useMediaQuery` hook or duplicate markup with `d-none d-md-block` / `d-md-none`) — use Bootstrap display utilities where possible to avoid JS.

### 3. Admin table→card pattern below `md`
For `ProductsPage` and `VariantTable`, render a **stacked card/list** below `md` and keep the full table at `≥md`.
- **Why:** horizontal scroll on 8-column variant tables is unacceptable on phones.
- **Card fields (products list):** thumbnail, name, status badge, category, Edit/Delete actions (hide slug on mobile).
- **Card fields (variants):** SKU, size, color, public price, compare-at, stock policy, status, Edit/Delete. Never show supplier fields.

### 4. Centralize storefront responsive rules in `storefront.css`
Move inline styles from `CatalogPage.tsx` and `ProductPage.tsx` (search/sort controls, PDP grid) into named classes (e.g. `.storefront-controls__search`, `.storefront-pdp-grid`).
- **Why:** inline styles cannot use media queries cleanly; matches existing token architecture.
- **Alternative rejected:** CSS-in-JS library — stack change not approved.

### 5. Optional `admin.css` for shared admin responsive patterns
Create `frontend/src/styles/admin.css` for card-list and tap-target helpers; import in `index.tsx` after Bootstrap.
- **Why:** keeps admin pages readable without scattering one-off styles.
- **Alternative:** colocate styles in components — acceptable for small diffs; prefer `admin.css` if patterns repeat.

### 6. Modals: `fullscreen="sm-down"`
Apply React Bootstrap `Modal` prop `fullscreen="sm-down"` on `ProductFormModal`, variant create/edit modal, and confirm/delete modals.
- **Why:** native mobile form UX without custom drawer components.

### 7. Testing strategy
- **RTL:** update tests that assert table row counts to also assert card view renders at mobile breakpoints (mock `matchMedia` or test both markup branches via `data-testid`).
- **Cypress:** add/extend specs with `cy.viewport(360, 740)`, `(768, 1024)`, `(1280, 800)`; assert no `document.documentElement.scrollWidth > clientWidth` overflow on key routes.
- **Manual matrix:** DevTools device toolbar for the four routes.

## Risks / Trade-offs

- **Desktop regression** → Mitigation: gate mobile rules behind `max-width` / `d-md-none`; verify ≥1280px screenshots in E2E report.
- **Duplicate markup (table + cards)** → Mitigation: extract row/card subcomponents sharing the same action handlers; keep DRY on data mapping.
- **RTL tests brittle after markup split** → Mitigation: stable `data-testid` on card containers (`product-card-row`, `variant-card`).
- **44px targets may shift desktop density slightly** → Mitigation: apply min-height/min-width only in `@media (max-width: 575.98px)`.
- **Cypress binary install issues in CI/sandbox** → Mitigation: API-orchestrated smoke script fallback (as in `admin-product-panel`); document in E2E report.

## Migration Plan

1. Implement CSS and component changes on `feature/frontend-responsive-ui`.
2. Run unit tests, Cypress/viewport E2E, manual viewport matrix.
3. Merge PR; no deployment migration — static frontend assets only.
4. Rollback: revert PR; no data migration.

## Open Questions

- Should product list mobile cards show slug? **Default: hide** to save space.
- Sticky mobile "Add to Cart" on PDP? **Deferred** per Non-goals; revisit if conversion metrics warrant it.
