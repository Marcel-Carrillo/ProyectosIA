# Product Detail

## Purpose

Defines the public storefront product detail page (`/products/:slug`): full product information, ordered image gallery, size/color variant selector, compare-at pricing, and loading/error states. Only `Active` products are accessible, and supplier cost fields are never exposed.

## Requirements

### Requirement: Product detail page fetches and displays full product information
The system SHALL render a `/products/:slug` page that fetches the full product record from `GET /products/:id` (resolved by slug) and displays the product name, brand, and description. Only products with `status = Active` SHALL be accessible via the storefront; navigating to an inactive or non-existent product SHALL show a 404/not-found state.

#### Scenario: Active product page loads successfully
- **WHEN** a user navigates to `/products/:slug` for an existing active product
- **THEN** the page fetches the product, displays name, brand, and description, and renders the image gallery and variant selector

#### Scenario: Non-existent product shows a not-found state
- **WHEN** a user navigates to `/products/:slug` for a slug that does not match any product
- **THEN** the page displays a "Product not found" message and does not crash

#### Scenario: Inactive or archived product is not accessible
- **WHEN** a user navigates to `/products/:slug` for a product with `status != Active`
- **THEN** the page displays a "Product not found" state, as if the product does not exist

---

### Requirement: Product detail page displays an ordered image gallery
The system SHALL render a product image gallery using the product's `images[]` array ordered by `sortOrder` ascending. The gallery SHALL display a main large image and thumbnail strip for navigation. Each image SHALL use its `altText` as the `alt` attribute; if `altText` is empty, a descriptive fallback SHALL be used. If the product has no images, a neutral placeholder image SHALL be shown.

#### Scenario: Gallery renders images in sortOrder
- **WHEN** a product has multiple images with different `sortOrder` values
- **THEN** the gallery displays images in ascending `sortOrder` order

#### Scenario: Clicking a thumbnail updates the main image
- **WHEN** the user clicks a thumbnail in the gallery strip
- **THEN** the main large image updates to show the selected image

#### Scenario: Image alt text is set correctly
- **WHEN** a gallery image has a non-empty `altText`
- **THEN** the rendered `<img>` element has `alt` set to that `altText`

#### Scenario: Placeholder is shown when product has no images
- **WHEN** a product has an empty `images[]` array and no `mainImageUrl`
- **THEN** the gallery renders a neutral placeholder image without layout breakage

---

### Requirement: Product detail page includes a variant selector for size and color
The system SHALL render a variant selector that allows the user to choose a variant by `size` and/or `color` (when those attributes are present on the product's variants). The selector SHALL visually indicate which combinations are available and which are unavailable. A combination SHALL be considered available only when a non-deleted (`deletedAt = null`), `Active` variant exists for that size/color pair AND that variant's stock (per `product-variant-management`) is greater than zero. Only available combinations SHALL be selectable; unavailable combinations SHALL be disabled and non-interactive regardless of whether the reason is a missing variant or zero stock.

#### Scenario: Size options are rendered from variants
- **WHEN** the product has variants with distinct `size` values
- **THEN** the selector renders one size option per distinct size value

#### Scenario: Color options are rendered from variants
- **WHEN** the product has variants with distinct `color` values
- **THEN** the selector renders one color option per distinct color value

#### Scenario: Combination with no matching variant is disabled
- **WHEN** a specific size+color combination has no corresponding non-deleted, active variant
- **THEN** that combination's option is rendered as disabled/greyed-out and cannot be selected

#### Scenario: Combination with zero stock is disabled after selecting the size
- **WHEN** a product has sizes S/M/L and 3 colors, and the S size has a non-deleted active variant for only 2 of the 3 colors with stock greater than zero (the third color's S variant has zero stock)
- **THEN** after the user selects size S, the color option with zero stock for size S is rendered as disabled/greyed-out and cannot be selected, while the other two colors remain selectable

#### Scenario: Selecting a variant updates the displayed price
- **WHEN** the user selects a specific size+color combination that is available
- **THEN** the displayed price updates to reflect the `publicPrice` (and `compareAtPrice` if present) of the matching variant

---

### Requirement: Selecting a color changes only the main gallery image

The system SHALL keep the thumbnail strip showing all of the product's `images[]` (ordered by `sortOrder`) regardless of the currently selected color. Selecting a color SHALL only change which image is shown as the main/hero image: the main image SHALL switch to the first image whose color association matches the selected color, if one exists; otherwise the main image SHALL remain unchanged. The thumbnail strip's item count and order SHALL NOT change when the selected color changes.

#### Scenario: Thumbnail strip is unaffected by color selection

- **WHEN** a user on the product detail page selects a color that has associated photos
- **THEN** the thumbnail strip continues to display the same full set of images, in the same order, as before the color was selected

#### Scenario: Main image follows the selected color

- **WHEN** a user selects a color that has at least one associated photo
- **THEN** the main/hero image updates to show the first photo associated with that color

#### Scenario: Main image is unchanged when the selected color has no dedicated photo

- **WHEN** a user selects a color with no photo specifically associated with it
- **THEN** the main image remains whatever it was before the selection, and no thumbnail is hidden or removed

#### Scenario: Clicking a thumbnail still overrides the main image directly

- **WHEN** a user clicks a specific thumbnail in the strip, regardless of the currently selected color
- **THEN** the main image updates to that clicked thumbnail's image, per the existing "Clicking a thumbnail updates the main image" behavior

---

### Requirement: Product detail page displays pricing with compare-at support
The system SHALL display the price of the currently selected (or default) variant. The `publicPrice` SHALL always be shown. If the variant's `compareAtPrice` is greater than its `publicPrice`, the `compareAtPrice` SHALL be displayed with a strikethrough beside the `publicPrice`. Supplier cost fields (`supplierId`, `supplierReference`, `supplierCost`) SHALL NEVER be rendered or requested.

#### Scenario: Single price is shown when no compare-at price exists
- **WHEN** the selected variant has no `compareAtPrice` (or `compareAtPrice` ≤ `publicPrice`)
- **THEN** only the `publicPrice` is displayed without strikethrough

#### Scenario: Both prices are shown when compare-at is present
- **WHEN** the selected variant has `compareAtPrice > publicPrice`
- **THEN** `publicPrice` is displayed prominently and `compareAtPrice` is displayed with a strikethrough

#### Scenario: Supplier cost data is never exposed
- **WHEN** the product detail page renders any variant data
- **THEN** `supplierId`, `supplierReference`, and `supplierCost` fields are not present in any rendered output

---

### Requirement: Product detail page displays loading and error states
The product detail page SHALL display a loading state while the product is being fetched. If the API call fails for any reason other than a 404, a user-friendly error message SHALL be displayed.

#### Scenario: Loading skeleton is shown while fetching
- **WHEN** the product detail page is loading
- **THEN** a loading skeleton or spinner is displayed in place of the gallery and product info

#### Scenario: Error message is shown on API failure
- **WHEN** the `GET /products/:id` call fails with a non-404 error
- **THEN** a user-friendly error message is displayed and the page does not crash
