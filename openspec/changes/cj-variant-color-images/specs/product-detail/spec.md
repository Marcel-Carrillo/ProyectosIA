## MODIFIED Requirements

### Requirement: Product detail page displays an ordered image gallery
The system SHALL render a product image gallery using the product's `images[]` array ordered by `sortOrder` ascending. The gallery SHALL display a main large image and thumbnail strip for navigation. Each image SHALL use its `altText` as the `alt` attribute; if `altText` is empty, a descriptive fallback SHALL be used. If the product has no images, a neutral placeholder image SHALL be shown.

When the product has a selected variant with a `color`, the gallery SHALL display only the images whose `color` matches the selected color plus any images with `color = null` (shared/product-level). If this filtered set is empty — the selected color has no color-specific images — the gallery SHALL fall back to displaying the full unfiltered `images[]` array rather than rendering an empty gallery. Products with no color selection (no variant selector, or no color selected) SHALL display the full unfiltered `images[]` array. Changing the selected color SHALL reset the active thumbnail to the first image in the newly filtered set.

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

#### Scenario: Selecting a color filters the gallery to that color's images
- **WHEN** the user selects a color on a product whose images include color-specific entries for that color
- **THEN** the gallery displays only the images matching that color plus any shared (`color = null`) images, and resets the active thumbnail to the first matching image

#### Scenario: Selected color has no color-specific images
- **WHEN** the user selects a color for which no image has a matching `color` value
- **THEN** the gallery falls back to displaying the full unfiltered `images[]` array instead of showing an empty gallery

#### Scenario: Single-color or single-variant products are unaffected
- **WHEN** a product has no color variant selector, or all images share `color = null`
- **THEN** the gallery displays the full `images[]` array exactly as it did before color association existed
