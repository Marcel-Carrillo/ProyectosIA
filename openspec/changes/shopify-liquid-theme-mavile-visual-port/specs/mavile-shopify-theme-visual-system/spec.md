## ADDED Requirements

### Requirement: Mavile design tokens in the theme

The theme SHALL load a token stylesheet whose CSS custom property names and values match `frontend/src/styles/tokens.css` for palette, type scale, weights, spacing, radii, and motion curves. Merchant colour overrides SHALL be applied only as a `:root` override after that stylesheet. The theme SHALL self-host an Inter latin subset (`woff2`) with `font-display: swap` and SHALL NOT request Google Fonts.

#### Scenario: Token names match the React storefront

- **WHEN** a reviewer diffs `shopify/theme/assets/mavile-tokens.css` against `frontend/src/styles/tokens.css`
- **THEN** every `--color-*`, `--font-*`, `--spacing-*`, `--radius-*`, and `--transition-*` name and default value matches

#### Scenario: No Google Fonts network request

- **WHEN** the home template is loaded in a browser with an empty cache
- **THEN** the network log contains no request to `fonts.googleapis.com` or `fonts.gstatic.com`

### Requirement: Brand assets without supplier data

The theme SHALL use Mavile logo, icon, and favicon from theme assets or Shopify Files. The theme SHALL NOT output supplier cost, supplier reference, supplier credentials, or any metafield whose namespace is used for supplier or cost data.

#### Scenario: Product card omits cost

- **WHEN** a collection product card is rendered
- **THEN** the HTML contains price and compare-at price only, and contains no supplier cost or supplier reference text
