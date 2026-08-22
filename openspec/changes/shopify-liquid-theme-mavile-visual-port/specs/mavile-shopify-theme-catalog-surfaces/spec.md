## ADDED Requirements

### Requirement: Collection grid and product card

Collection templates SHALL render products in a 1 / 2 / 3 column grid at the Mavile breakpoints, with numbered pagination. Each card SHALL use a 3:4 media frame, optional hover image swap, two-line name clamp, uppercase vendor, and tabular price with compare-at strikethrough when present.

#### Scenario: Collection listing from a nav handle

- **WHEN** a shopper opens `/collections/women` (or the equivalent localized path)
- **THEN** only products in that Shopify collection are listed and cards use the Mavile card treatment

#### Scenario: Empty collection

- **WHEN** a collection has zero products
- **THEN** the grid is omitted and an empty-state message from locales is shown

### Requirement: Product detail gallery and variant pills

The product template SHALL show breadcrumb, media gallery, pill-style option selectors, price, and add to cart. Selecting a colour SHALL change the hero image only; the thumbnail strip SHALL keep the full sorted media set. Unavailable option combinations SHALL be disabled. Add to cart SHALL use the Shopify Ajax Cart API. Copy SHALL NOT promise warehouse delivery from `variant.available`.

#### Scenario: Colour changes hero only

- **WHEN** a shopper selects a colour option that has a featured media item
- **THEN** the main gallery image updates and the thumbnail strip still lists all product media

#### Scenario: Unavailable combination is not selectable

- **WHEN** a size and colour combination has no available variant
- **THEN** that control is disabled and add to cart is not enabled for that combination

#### Scenario: Add to cart uses Shopify cart

- **WHEN** a shopper adds an available variant
- **THEN** `POST` to the Shopify cart add endpoint succeeds and the cart count updates without calling any Mavile API

### Requirement: Sort and filters stay on Shopify

Collection sort and filters SHALL use Shopify `sort_by` and storefront filters. The theme SHALL NOT call `GET /api/public/products`.

#### Scenario: Sort newest

- **WHEN** a shopper chooses newest sort on a collection
- **THEN** the URL includes Shopify `sort_by` and the listed order matches that sort
