# Storefront Shell

## Purpose

Defines the public storefront layout shell — an isolated layout (sticky header, category navigation, minimal footer) separate from the admin panel, styled with Inditex-inspired design tokens and responsive from 360px to desktop.

## Requirements

### Requirement: Storefront has an isolated layout separate from the admin panel
The system SHALL render storefront pages (`/`, `/catalog`, `/products/:slug`) inside a `StorefrontLayout` component that is completely independent of the existing admin `Layout` component. The admin panel layout SHALL NOT be rendered on storefront routes, and the storefront layout SHALL NOT be rendered on admin routes.

#### Scenario: Visiting a storefront route renders the storefront layout
- **WHEN** a user navigates to `/catalog`
- **THEN** the page renders the `StorefrontLayout` (storefront header + footer), not the admin navbar or admin layout

#### Scenario: Visiting an admin route renders the admin layout
- **WHEN** a user navigates to an admin-panel route (e.g., `/products` admin page)
- **THEN** the page renders the existing admin `Layout`, not the storefront header or footer

---

### Requirement: Storefront header is sticky and minimalist
The system SHALL render a sticky top header on all storefront pages containing: the brand wordmark/logo, a category navigation bar, and placeholder affordances for search and cart (icons only, non-functional in MVP). The header background SHALL be white or near-white with sufficient contrast. The header SHALL remain visible when the user scrolls down.

#### Scenario: Header is visible at page top
- **WHEN** a storefront page loads
- **THEN** the header is rendered at the top of the page with the brand wordmark and category nav visible

#### Scenario: Header remains visible on scroll
- **WHEN** the user scrolls down past the viewport height on a catalog page
- **THEN** the header is still visible at the top of the viewport (sticky behavior)

#### Scenario: Header search affordance is present
- **WHEN** a storefront page loads
- **THEN** a search icon is visible in the header; clicking it does not throw an error (MVP: no-op or focus the catalog search)

---

### Requirement: Category navigation displays all active categories
The header category nav SHALL fetch and display all active categories from `GET /categories`. Each category SHALL be a clickable link that navigates to the catalog page filtered by that category. A "All" or "Shop" link SHALL navigate to the catalog with no category filter.

#### Scenario: Categories load and display in the nav
- **WHEN** the storefront header mounts
- **THEN** category names fetched from the API are rendered as navigation links

#### Scenario: Clicking a category navigates to the filtered catalog
- **WHEN** a user clicks a category link in the header nav
- **THEN** the browser navigates to `/catalog?categoryId=<id>` and the catalog page filters by that category

#### Scenario: Clicking "All" shows the full catalog
- **WHEN** a user clicks the "All" or "Shop" link in the header nav
- **THEN** the browser navigates to `/catalog` with no category filter

#### Scenario: Category nav handles fetch failure gracefully
- **WHEN** the categories API call fails
- **THEN** the nav does not crash; it renders without category links or with a silent fallback (no blocking error shown in header)

---

### Requirement: Storefront footer is minimal and present on all storefront pages
The system SHALL render a footer on all storefront pages with at minimum: the brand name/wordmark, and a copyright line. The footer SHALL NOT appear on admin routes.

#### Scenario: Footer renders on storefront pages
- **WHEN** a user visits any storefront page
- **THEN** the footer is visible at the bottom of the page content

#### Scenario: Footer does not render on admin pages
- **WHEN** a user visits an admin-panel route
- **THEN** no storefront footer is rendered

---

### Requirement: Storefront applies design tokens for Inditex-inspired aesthetics
The system SHALL load a CSS design-token file (`tokens.css`) that defines CSS custom properties for the storefront design system: neutral color palette, minimalist sans-serif type scale, and generous whitespace scale. These tokens SHALL be applied across all storefront components. The existing Bootstrap CSS SHALL remain loaded; tokens extend rather than replace it.

#### Scenario: Design tokens are applied on storefront pages
- **WHEN** any storefront page renders
- **THEN** the page uses the neutral color palette and minimalist type scale defined by the design tokens (white/off-white backgrounds, near-black text, generous padding)

#### Scenario: Admin panel is visually unaffected
- **WHEN** an admin page renders
- **THEN** the visual appearance of admin components is unchanged from before this change was introduced

---

### Requirement: Storefront is responsive from 360px to desktop
All storefront layout components SHALL be responsive, adapting from a single-column mobile layout (360px minimum) to a multi-column desktop layout. The header navigation SHALL collapse to a burger/hamburger menu or horizontal scroll on small screens.

#### Scenario: Header adapts to mobile viewport
- **WHEN** the viewport width is 360px
- **THEN** the header renders without horizontal overflow; category nav is collapsed or scrollable

#### Scenario: Layout is readable on desktop
- **WHEN** the viewport width is 1280px
- **THEN** the header shows full category nav; content area is constrained to a readable max-width with centered margins
