## MODIFIED Requirements

### Requirement: Variant-specific images are captured when they differ from the product image
When a promoted variant's underlying supplier data includes an image distinct from its parent product's main image, the system SHALL create an additional product image record for that variant's image, and SHALL associate that image record with the variant's derived `color`. The product-level main image record SHALL always be associated with `color = null` (shared/product-level). Deduplication of variant images SHALL be scoped per `(url, color)` pair: two variants of different colors SHALL never be deduplicated into a single image record even if they coincidentally shared a URL, while multiple same-color variants sharing the same image URL SHALL still produce only one image record for that color.

#### Scenario: A variant has a distinct image (e.g. a different color)
- **WHEN** a variant being promoted has supplier-provided image data different from its product's main image
- **THEN** the system SHALL create an additional product image record for that variant's image, with `color` set to that variant's derived color

#### Scenario: A variant's image matches the product's main image
- **WHEN** a variant being promoted has supplier-provided image data identical to its product's main image
- **THEN** the system SHALL NOT create a duplicate product image record for that variant

#### Scenario: A variant with its own distinct image joins an already-existing product
- **WHEN** a new variant is promoted into a product that already exists from a prior partial promotion, and that variant has supplier-provided image data
- **THEN** the system SHALL NOT attempt image capture for that variant — image capture only applies the first time a product is created from a promotion, not when later variants join an already-existing product

#### Scenario: Two different colors coincidentally share an image URL
- **WHEN** two variants of different derived colors both reference the same image URL in their supplier data
- **THEN** the system SHALL create a separate product image record for each color, not deduplicate them into one

#### Scenario: The product-level image is always color-independent
- **WHEN** a product's main image is captured from product-level supplier data
- **THEN** the resulting product image record SHALL have `color = null`

## ADDED Requirements

### Requirement: Already-captured product images can be backfilled with their color association
The system SHALL provide a way to retroactively populate the `color` field on already-persisted product image records for products that were promoted before image-color association existed, re-deriving the association from already-stored supplier data (`rawPayload`) without making new external API calls. The backfill SHALL be idempotent and SHALL NOT create, delete, or otherwise modify existing image records other than setting their `color` field.

#### Scenario: Backfill assigns color to already-captured images
- **WHEN** the color backfill is run against products whose images were captured before color association existed
- **THEN** each image record that can be matched to its source variant's derived color SHALL have its `color` field set, with no new external API calls made

#### Scenario: Backfill is re-run after already completing
- **WHEN** the color backfill is run again after images already have their color set
- **THEN** the system SHALL report zero changes and SHALL NOT modify any image record

#### Scenario: An image cannot be matched to a derivable color
- **WHEN** an already-captured image's source supplier data has no derivable color (e.g. it is the product-level image, or the variant's color cannot be determined)
- **THEN** the backfill SHALL leave that image's `color` as `null` and SHALL continue processing the remaining images
