## ADDED Requirements

### Requirement: Storefront catalog is usable on mobile and tablet viewports
The public catalog (`/catalog`) SHALL remain fully functional at mobile (360px baseline), tablet (768px), and desktop (≥992px) widths. Search, sort, category navigation, product grid, and pagination SHALL be operable without horizontal page scrolling. Interactive controls on mobile SHALL have a minimum touch target of 44×44 CSS pixels.

#### Scenario: Catalog controls stack on mobile
- **WHEN** the viewport width is ≤575px
- **THEN** the search input and sort control stack to full width and remain submittable/changeable without overlapping

#### Scenario: No horizontal page scroll on catalog
- **WHEN** a user loads `/catalog` at 360px width
- **THEN** the page content fits within the viewport without horizontal scrolling of the document

#### Scenario: Header icons meet touch target minimum on mobile
- **WHEN** the viewport width is ≤575px
- **THEN** storefront header icon buttons (search, cart affordances) expose at least a 44×44px tap area

#### Scenario: Product grid remains responsive
- **WHEN** the viewport is mobile, tablet, or desktop
- **THEN** the product grid displays 2 columns on mobile, 3 on tablet, and 4 on large desktop per existing breakpoint rules

---

### Requirement: Storefront product detail is usable on mobile and tablet viewports
The product detail page (`/catalog/:id` or equivalent public PDP route) SHALL present gallery, variant selector, and pricing in a single-column layout below 768px and a two-column layout at ≥768px. Variant selection buttons and gallery thumbnails SHALL meet the 44×44px touch target minimum on mobile.

#### Scenario: PDP single column on mobile
- **WHEN** the viewport width is <768px
- **THEN** the product gallery and product info stack vertically (gallery above info)

#### Scenario: PDP two columns on tablet and desktop
- **WHEN** the viewport width is ≥768px
- **THEN** the gallery and product info display side by side

#### Scenario: Variant buttons are thumb-friendly on mobile
- **WHEN** the viewport width is ≤575px
- **THEN** size/color variant buttons have at least 44×44px tap area

#### Scenario: No horizontal page scroll on product detail
- **WHEN** a user loads a product detail page at 360px width
- **THEN** the page content fits within the viewport without horizontal scrolling of the document

---

### Requirement: Admin product filters reflow for mobile and tablet
The admin product list filters (`ProductFilters`) SHALL reflow to a mobile-first layout: search, status, and category controls full-width on extra-small viewports; sort and order may share a row two-up; reset action full-width. At `md` and above, filters SHALL retain the multi-column desktop layout.

#### Scenario: Filters stack on phone
- **WHEN** the viewport width is <768px
- **THEN** search, status, and category filter fields each occupy full row width

#### Scenario: Filters usable on tablet
- **WHEN** the viewport width is ≥768px
- **THEN** filters display in a multi-column layout without overlapping labels or controls

---

### Requirement: Admin product list presents a mobile-friendly view below md
The admin products page (`/products`) SHALL show a stacked card/list presentation below the Bootstrap `md` breakpoint (each card: thumbnail, name, status badge, category, edit/delete actions). At `md` and above, the full table view SHALL remain available. Action buttons SHALL meet the 44×44px touch target on mobile.

#### Scenario: Card list on mobile
- **WHEN** the viewport width is <768px and products exist
- **THEN** each product is shown as a card with thumbnail, name, status, category, and row actions (slug MAY be omitted on mobile)

#### Scenario: Table on tablet and desktop
- **WHEN** the viewport width is ≥768px
- **THEN** the product table with columns (thumbnail, name, slug, status, category, actions) is displayed

#### Scenario: No horizontal page scroll on admin list
- **WHEN** an admin opens `/products` at 360px width
- **THEN** the page fits within the viewport without horizontal document scrolling

---

### Requirement: Admin variant management presents a mobile-friendly view below md
The variant table on the product detail page SHALL render each variant as a stacked card below `md` (SKU, size, color, public price, compare-at price, stock policy, status, edit/delete). Supplier fields (`supplierId`, `supplierReference`, `supplierCost`) SHALL NOT appear in the card or table views. At `md` and above, the full variant table SHALL remain.

#### Scenario: Variant cards on mobile
- **WHEN** the viewport width is <768px and the product has variants
- **THEN** each variant is displayed as an individual card with editable actions accessible without horizontal page scroll

#### Scenario: Variant table on tablet and desktop
- **WHEN** the viewport width is ≥768px
- **THEN** variants are displayed in the tabular layout

#### Scenario: Supplier fields never shown in variant UI
- **WHEN** variant cards or the variant table are rendered
- **THEN** no supplier cost, supplier ID, or supplier reference field is displayed

---

### Requirement: Admin modals and image manager are mobile-friendly
Create/edit/delete modals for products and variants SHALL use `fullscreen="sm-down"` so forms are usable on phones. The image manager add-image form SHALL stack full-width on extra-small viewports; image cards SHALL remain at least 2-up on mobile (`xs={6}`) with tap-friendly action buttons.

#### Scenario: Product create modal fullscreen on phone
- **WHEN** the admin opens the create-product modal at ≤575px width
- **THEN** the modal occupies the full viewport height and width (`sm-down` fullscreen)

#### Scenario: Image manager stacks on mobile
- **WHEN** the viewport width is <768px
- **THEN** the add-image URL/alt/sort fields and submit button stack vertically at full width

---

### Requirement: Desktop layouts are preserved
Responsive changes SHALL NOT alter the visual layout or information density of storefront or admin catalog screens at ≥992px width beyond minor tap-target padding that does not change column structure.

#### Scenario: Desktop catalog unchanged
- **WHEN** the viewport width is ≥1280px
- **THEN** the catalog grid displays 4 columns and controls remain on a single row as before

#### Scenario: Desktop admin table unchanged
- **WHEN** the viewport width is ≥992px
- **THEN** the admin product list and variant table use the full tabular layout with the same columns as before this change
