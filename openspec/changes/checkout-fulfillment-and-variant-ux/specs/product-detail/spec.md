## MODIFIED Requirements

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

## ADDED Requirements

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
