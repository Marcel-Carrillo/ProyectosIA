## ADDED Requirements

### Requirement: Storefront shell matches Mavile layout

The theme layout SHALL render a sticky translucent header with centered Mavile logo, a category nav row, a language switcher, cart access, a main content area, and a multi-column footer. Header and footer menus SHALL come from Shopify link lists, not hardcoded category ids.

#### Scenario: Header and footer on every storefront template

- **WHEN** a shopper opens home, a collection, a product, cart, search, or a content page
- **THEN** the page includes the Mavile header and footer chrome

#### Scenario: Nav driven by Admin menu

- **WHEN** `main-menu` contains All plus Women, Men, Accessories, and Shoes collection links
- **THEN** the header nav lists those items in menu order and highlights the active collection from the current path

### Requirement: ES default and EN subfolder

The storefront SHALL use Spanish as the default locale at the URL root and English at the `/en` prefix via Shopify Markets. The language switcher SHALL use Spain and UK flag controls and SHALL preserve the current path when switching locale.

#### Scenario: Switch language keeps the product

- **WHEN** a shopper on `/products/{handle}` selects English
- **THEN** the browser navigates to the English equivalent path for that product and chrome strings come from `locales/en.json`

#### Scenario: No hardcoded copy in Liquid

- **WHEN** Theme Check or a grep runs on `shopify/theme/**/*.liquid`
- **THEN** visible customer strings resolve through the `t` filter or Shopify resource content, not hardcoded Spanish or English sentences

### Requirement: Hero slideshow with reduced motion

The home (or catalog landing) hero SHALL rotate slides with configurable motion presets, scrim, and progress indicators. When `prefers-reduced-motion: reduce` is set, slides SHALL remain static (no Ken Burns animation or auto-rotation).

#### Scenario: Reduced motion disables hero motion

- **WHEN** a shopper with reduced-motion preference loads the home template
- **THEN** the hero does not auto-rotate and does not apply zoom or pan animation

### Requirement: Content, search, 404, and password gate

Editorial pages SHALL use Shopify Pages with the Mavile content rhythm. Legal documents SHALL use Shopify Policies. Search and 404 SHALL use the Mavile visual language. Until cutover, the shop SHALL be password-protected or emit `noindex` so the development catalog is not indexed.

#### Scenario: Contact form uses Shopify

- **WHEN** a shopper submits the contact page form with valid fields
- **THEN** Shopify accepts the `{% form 'contact' %}` post and no request is sent to a Mavile `/api/` URL

#### Scenario: Pre-launch isolation

- **WHEN** the development store is viewed by an unauthenticated internet crawler configuration used in QA
- **THEN** the storefront is blocked by the password page or sends `noindex`
