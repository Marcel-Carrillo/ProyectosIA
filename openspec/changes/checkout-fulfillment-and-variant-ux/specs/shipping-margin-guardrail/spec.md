## ADDED Requirements

### Requirement: Customer-facing shipping is always free

The system SHALL continue to charge `0` shipping to the customer on every checkout path (`checkout-mvp`); this change SHALL NOT introduce any customer-facing shipping fee. The margin guardrail defined by this capability is an admin-only pricing check and SHALL NOT alter checkout totals.

#### Scenario: Checkout total never includes a shipping charge

- **WHEN** a buyer completes checkout for any order, regardless of the margin guardrail's warnings for any item in the order
- **THEN** the order total includes `0` shipping cost to the customer

### Requirement: Admin can view a per-variant margin breakdown

The system SHALL expose, on the admin variant read endpoints (`GET /api/admin/products/:id/variants`, `GET /api/admin/products/:id/variants/:variantId`), a margin breakdown computed as: `publicPrice` (existing field), `supplierCost` (existing field), `shippingCostEstimate` (new, decimal, nullable), and a derived `netMargin = publicPrice - supplierCost - shippingCostEstimate`. When `shippingCostEstimate` is null, `netMargin` SHALL be computed using `0` for the shipping component and the response SHALL indicate the estimate is missing. This breakdown SHALL only appear on `/api/admin/*` responses and SHALL NEVER appear on any `/api/public/*` response, per the existing supplier-cost isolation rule in `product-variant-management`.

#### Scenario: Margin breakdown is computed for a variant with a shipping estimate

- **WHEN** an admin retrieves a variant with `publicPrice = 29.99`, `supplierCost = 8.50`, and `shippingCostEstimate = 4.00`
- **THEN** the response includes `netMargin = 17.49` alongside the three input fields

#### Scenario: Missing shipping estimate is flagged

- **WHEN** an admin retrieves a variant with no `shippingCostEstimate` set
- **THEN** the response indicates the shipping estimate is missing and computes `netMargin` using `0` as the shipping component

#### Scenario: Margin fields never appear on public responses

- **WHEN** a client requests any `/api/public/products` or `/api/public/products/:id` response
- **THEN** the payload contains no `shippingCostEstimate` or `netMargin` field

### Requirement: Admin can refresh the provider shipping estimate for a variant

The system SHALL expose `POST /api/admin/products/:id/variants/:variantId/freight-estimate` accepting an optional `destinationCountry` (defaulting to the store's configured default destination). The system SHALL call the existing CJ Dropshipping freight-calculation client (`cjClient.calculateFreight`) for the variant's linked `CjCatalogItem` and destination, select the lowest returned price as the new `shippingCostEstimate`, persist it, and return the updated margin breakdown. A variant with no linked `CjCatalogItem` SHALL return `422` with error code `CJ_ITEM_NOT_MAPPED`. This endpoint SHALL NOT be called on public or hot storefront render paths; estimates are refreshed only through this explicit admin action or a periodic background refresh.

#### Scenario: Refresh persists a new shipping estimate

- **WHEN** an admin calls `POST /api/admin/products/:id/variants/:variantId/freight-estimate` for a variant linked to a `CjCatalogItem`
- **THEN** the system persists the lowest quoted freight price as `shippingCostEstimate` and returns the updated margin breakdown

#### Scenario: Refresh rejected for an unmapped variant

- **WHEN** an admin calls the freight-estimate endpoint for a variant with no linked `CjCatalogItem`
- **THEN** the system returns `422` with error code `CJ_ITEM_NOT_MAPPED` and does not modify `shippingCostEstimate`

### Requirement: Admin can read and update the automation/pricing settings that drive the guardrail

The system SHALL expose `GET /api/admin/settings/automation` and `PATCH /api/admin/settings/automation`, returning and accepting `targetMargin` (decimal, money value), `defaultFreightDestinationCountry` (ISO 3166-1 alpha-2), and `carrierAllowList` (array of carrier names, empty meaning no restriction — see `fulfillment-automation`). These settings SHALL be stored server-side (not requiring a redeploy to change) and SHALL be read by the margin-warning computation and by the freight-estimate/auto-logistics-selection logic. A settings row SHALL be lazily created with documented defaults on first read if none exists yet.

#### Scenario: Admin reads current automation/pricing settings

- **WHEN** an admin requests `GET /api/admin/settings/automation`
- **THEN** the system returns `200` with `targetMargin`, `defaultFreightDestinationCountry`, and `carrierAllowList`, creating a default row first if none existed

#### Scenario: Admin updates the target margin

- **WHEN** an admin submits `PATCH /api/admin/settings/automation` with a new `targetMargin`
- **THEN** the system persists the new value and subsequent margin-warning computations use it immediately, with no redeploy required

### Requirement: Admin sees a warning when the public price does not cover cost, shipping, and target margin

The system SHALL compare each variant's `netMargin` against a store-configured `targetMargin` (a percentage or fixed amount, admin-configurable, defaulting to a documented value). When `netMargin` is below `targetMargin`, or when `netMargin` is negative, the admin variant list and detail views SHALL display a visible warning badge on that variant.

#### Scenario: Warning shown when margin is below target

- **WHEN** an admin views a variant whose `netMargin` is below the configured `targetMargin`
- **THEN** the admin UI displays a warning badge on that variant

#### Scenario: Warning shown when margin is negative

- **WHEN** an admin views a variant whose `publicPrice` is less than `supplierCost + shippingCostEstimate`
- **THEN** the admin UI displays a warning badge indicating the variant is sold at a loss

#### Scenario: No warning when margin meets target

- **WHEN** an admin views a variant whose `netMargin` meets or exceeds the configured `targetMargin`
- **THEN** no warning badge is displayed for that variant
