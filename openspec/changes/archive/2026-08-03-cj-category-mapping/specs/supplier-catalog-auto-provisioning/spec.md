## MODIFIED Requirements

### Requirement: Auto-promote synced items into Draft products
After a successful catalog sync, the system SHALL automatically promote staged catalog items that have not yet been promoted into real product and product variant records, so they are visible in the admin Products panel without requiring an admin to trigger promotion manually. Promoted products SHALL default to a non-public (Draft) status. Auto-promotion SHALL resolve each item's category using the same CJ-taxonomy resolution and fallback order defined in `cj-catalog-promotion` (CJ category resolved via `fetchCategories()` and the item's stored `CjCatalogItem.categoryId`, auto-creating a local `Category` when no mapping exists yet, falling back to the configured `CJ_DEFAULT_CATEGORY_ID` only when CJ resolution is not possible) instead of always assigning a fixed category to every item.

#### Scenario: Newly synced items are auto-promoted with their real CJ category
- **WHEN** the catalog sync completes and staging items exist with a successful sync status and no linked product variant yet
- **THEN** the system SHALL promote those items into `Product`/`ProductVariant` records, assigning each resulting product to the category resolved from its CJ taxonomy (creating the local `Category` if it does not exist yet) and applying the existing default markup pricing rule, with the resulting product status set to `Draft`

#### Scenario: Already-promoted items are not re-promoted
- **WHEN** a staging catalog item is already linked to an existing product variant
- **THEN** the system SHALL NOT create a duplicate product or product variant for that item on subsequent runs

#### Scenario: CJ category resolution fails and no fallback default category is configured
- **WHEN** a staged item's CJ category cannot be resolved (no `CjCatalogItem.categoryId`, or the CJ categories API is unavailable) and the configured default category for auto-promotion does not exist or is not configured
- **THEN** the system SHALL skip auto-promotion for that item on this run, SHALL leave it unpromoted, and SHALL log the failure, while the earlier sync results remain persisted and other resolvable items in the same run SHALL still be promoted

#### Scenario: CJ category resolution fails but the fallback default category is available
- **WHEN** a staged item's CJ category cannot be resolved, but `CJ_DEFAULT_CATEGORY_ID` is configured and references an existing `Category`
- **THEN** the system SHALL still promote the item, assigning it to the fallback default category instead of skipping it

#### Scenario: A single item's price cannot be resolved
- **WHEN** one or more staged items among an otherwise-promotable batch cannot resolve a valid price (for example, a zero-cost item with no default markup applicable)
- **THEN** the system SHALL still promote every other item in that batch, SHALL leave only the unresolvable item(s) unpromoted for a later run, and SHALL log which items were excluded and why

#### Scenario: Auto-promoted product requires manual activation
- **WHEN** a product has been auto-promoted by this job
- **THEN** the product SHALL remain in `Draft` status and SHALL NOT be visible through any customer-facing storefront route until an admin explicitly activates it
