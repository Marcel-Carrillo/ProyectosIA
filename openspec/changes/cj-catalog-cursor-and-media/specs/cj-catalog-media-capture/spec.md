## ADDED Requirements

### Requirement: Promoted products receive a main image
When any item in a promoted group has an available product-level or variant-level image, the system SHALL set the product's main image from that data and SHALL create a corresponding product image record. A product-level image takes priority; if none exists but a variant-level image does, the first variant-level image found becomes the main image instead — a product must never end up with captured image records but a main image left unset.

#### Scenario: Product image is available at promotion time
- **WHEN** a staged catalog item whose underlying supplier data includes a product image is promoted for the first time
- **THEN** the resulting product SHALL have its main image set to that product image and SHALL have at least one associated product image record

#### Scenario: Only a variant-level image is available
- **WHEN** a staged catalog item's underlying supplier data has no product-level image but does have a variant-level image, and is promoted for the first time
- **THEN** the resulting product SHALL have its main image set to that variant-level image, not left unset

#### Scenario: No image is available at all
- **WHEN** a staged catalog item whose underlying supplier data has neither a product-level nor a variant-level image is promoted
- **THEN** the resulting product SHALL be created successfully without a main image, and promotion SHALL NOT fail because of the missing image

### Requirement: Variant-specific images are captured when they differ from the product image
When a promoted variant's underlying supplier data includes an image distinct from its parent product's main image, the system SHALL create an additional product image record for that variant's image.

#### Scenario: A variant has a distinct image (e.g. a different color)
- **WHEN** a variant being promoted has supplier-provided image data different from its product's main image
- **THEN** the system SHALL create an additional product image record for that variant's image

#### Scenario: A variant's image matches the product's main image
- **WHEN** a variant being promoted has supplier-provided image data identical to its product's main image
- **THEN** the system SHALL NOT create a duplicate product image record for that variant

#### Scenario: A variant with its own distinct image joins an already-existing product
- **WHEN** a new variant is promoted into a product that already exists from a prior partial promotion, and that variant has supplier-provided image data
- **THEN** the system SHALL NOT attempt image capture for that variant — image capture only applies the first time a product is created from a promotion, not when later variants join an already-existing product

### Requirement: Image capture applies to both manual and automatic promotion
Image capture during promotion SHALL apply identically whether a catalog item is promoted manually by an administrator or automatically by the scheduled auto-provisioning job.

#### Scenario: Automatic promotion captures images the same way manual promotion does
- **WHEN** the scheduled auto-provisioning job promotes newly synced catalog items
- **THEN** the resulting products SHALL have images captured under the same rules as a manual promotion

### Requirement: Re-promotion does not duplicate images
Promoting an already-promoted catalog item again SHALL NOT create additional product image records.

#### Scenario: An already-linked item is included in a promotion request again
- **WHEN** a catalog item that is already linked to an existing product variant is included in a subsequent promotion request
- **THEN** the system SHALL NOT create any new product image records for that item

### Requirement: Only public-safe data is copied during image capture
Image capture SHALL only copy supplier data intended for public display (image URLs, product/variant names). Supplier cost and other internal supplier data SHALL continue to never be exposed through any public-facing field.

#### Scenario: Promotion completes without exposing supplier cost
- **WHEN** a product is promoted with image capture enabled
- **THEN** no public-facing field of the resulting product or its images SHALL contain supplier cost or other internal supplier data

### Requirement: Already-promoted products can be backfilled with images
The system SHALL provide a way to retroactively populate images for products that were promoted before image capture existed, using already-stored supplier data without making new external API calls.

#### Scenario: Backfill runs against existing promoted products
- **WHEN** the backfill is run against products that were promoted without images
- **THEN** each eligible product SHALL have its main image and product image records populated from already-stored supplier data, with no external API calls made

#### Scenario: Backfill is re-run after already completing
- **WHEN** the backfill is run again after products already have images
- **THEN** the system SHALL NOT create duplicate product image records for those products

#### Scenario: Backfill encounters a product with no available image data
- **WHEN** a promoted product's stored supplier data has no image available
- **THEN** the backfill SHALL leave that product without an image and SHALL continue processing the remaining products
