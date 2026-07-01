## Purpose

Provide the technical SEO foundation for the storefront (`frontend/`, React CRA, client-side rendered) so public catalog and content pages are indexable and well-represented in search engines and social link previews, while non-public (admin, account, checkout, auth) routes are excluded from indexing. This capability covers per-route metadata, Open Graph/Twitter metadata, structured data, `noindex` coverage, `robots.txt` crawl directives, a dynamic sitemap, and descriptive image alt text.

## Requirements

### Requirement: Per-page metadata on public storefront routes
The storefront SHALL render a distinct `<title>`, meta description, and canonical URL for each public route (`/catalog`, `/catalog/:id`, `/pages/:slug`), replacing the single static title/description shared by all routes today.

#### Scenario: Catalog page renders category-aware title
- **WHEN** a visitor loads `/catalog` without a category filter
- **THEN** the page SHALL render a `<title>` of the form "Shop All | Mavile" and a `<link rel="canonical">` pointing to `{SITE_URL}/catalog`

#### Scenario: Product detail page renders product-specific metadata
- **WHEN** a visitor loads `/catalog/:id` for an `Active` product
- **THEN** the page SHALL render a `<title>` containing the product name, a meta description derived from the product description (truncated to ~155 characters), and a canonical URL of `{SITE_URL}/catalog/:id`

#### Scenario: Static content page renders slug-specific metadata
- **WHEN** a visitor loads `/pages/:slug` for one of the supported slugs (`shipping`, `returns`, `size-guide`, `contact`, `our-story`, `materials`, `sustainability`, `press`, `privacy`, `legal`)
- **THEN** the page SHALL render a `<title>` and meta description specific to that slug and a canonical URL of `{SITE_URL}/pages/:slug`

### Requirement: Open Graph and Twitter Card metadata on shareable pages
Product detail and static content pages SHALL render Open Graph (`og:title`, `og:description`, `og:image`, `og:type`, `og:url`) and Twitter Card (`twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`) meta tags so link previews on social/messaging platforms show accurate, page-specific content instead of the current generic "Mavile" preview.

#### Scenario: Product link shared externally shows product-specific preview
- **WHEN** a link to `/catalog/:id` is shared on a platform that reads Open Graph tags
- **THEN** the preview SHALL show the product name, a description, and the product's primary image rather than a generic site-wide preview

### Requirement: Structured data on product detail page
The product detail page SHALL emit `Product` JSON-LD structured data (name, image, description, sku, `offers.price`, `offers.priceCurrency`, `offers.availability`) and `BreadcrumbList` JSON-LD (Home → Category → Product), enabling rich results eligibility in search engines.

#### Scenario: Product page includes valid Product structured data
- **WHEN** a visitor loads `/catalog/:id` for an `Active` product with at least one `Active` variant
- **THEN** the page SHALL include a `<script type="application/ld+json">` block with `@type: "Product"` containing name, image, description, sku, and offer price/currency/availability derived from the product and its variants

#### Scenario: Product page includes breadcrumb structured data
- **WHEN** a visitor loads `/catalog/:id` for a product assigned to a category
- **THEN** the page SHALL include a `<script type="application/ld+json">` block with `@type: "BreadcrumbList"` listing Home, the product's category, and the product name in order

### Requirement: Non-public routes are excluded from search indexing
Every non-public storefront route SHALL render a `<meta name="robots" content="noindex, nofollow">` tag: `/admin/login`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/cart`, `/checkout`, `/order-confirmation/:orderNumber`, `/account`, `/account/profile`, `/account/orders`, `/account/orders/:id`, `/account/wishlist`, `/account/security/2fa`, and every admin back-office route (`/products`, `/products/:id`, `/categories`, `/suppliers`, `/customers`, `/customer-orders`, `/customer-orders/:id`, `/supplier-orders`, `/supplier-orders/:id`, `/shipments`, `/shipments/:id`, `/return-requests`, `/return-requests/:id`, `/refunds`, `/refunds/:id`). This SHALL NOT affect route accessibility, authentication, or functional behavior — only search-engine indexing.

#### Scenario: Admin product list page is marked noindex
- **WHEN** an authenticated admin loads `/products`
- **THEN** the page SHALL render `<meta name="robots" content="noindex, nofollow">` while remaining fully functional for the admin user

#### Scenario: Customer checkout page is marked noindex
- **WHEN** a customer loads `/checkout`
- **THEN** the page SHALL render `<meta name="robots" content="noindex, nofollow">` while the checkout flow SHALL continue to function normally

### Requirement: Crawl directives and sitemap reference in robots.txt
`frontend/public/robots.txt` SHALL disallow every non-public route listed above and SHALL declare a `Sitemap:` directive pointing to the sitemap endpoint, replacing the current unrestricted configuration.

#### Scenario: robots.txt blocks admin and account paths
- **WHEN** a crawler requests `/robots.txt`
- **THEN** the response SHALL include `Disallow` rules covering all admin back-office paths and all customer account/checkout/auth paths, and a `Sitemap:` line referencing the sitemap URL

### Requirement: Dynamic sitemap of public content
The system SHALL expose a public, unauthenticated endpoint that generates an XML sitemap listing the public storefront routes (`/catalog`, one entry per `Active`-status product at `/catalog/:id`, one entry per category, and one entry per static content-page slug), with `<lastmod>` derived from each entity's `updatedAt`. The sitemap response SHALL NOT include any supplier-related field (`supplierId`, `supplierReference`, `supplierCost`) or any other data not already exposed by existing public product/category endpoints.

#### Scenario: Sitemap includes only active products
- **WHEN** the sitemap endpoint is requested
- **THEN** the response SHALL be valid XML containing a `<url>` entry for `/catalog`, one entry per `Active`-status product, one entry per category, and one entry per supported content-page slug, and SHALL NOT include products with `Draft`, `Inactive`, or `Archived` status

#### Scenario: Sitemap response contains no supplier data
- **WHEN** the sitemap endpoint is requested
- **THEN** the response body SHALL NOT contain `supplierId`, `supplierReference`, `supplierCost`, or any other supplier-internal field

### Requirement: Product images have descriptive alt text
Product images rendered on the product listing (catalog grid) and product detail (gallery) pages SHALL include an `alt` attribute populated from the image's `altText` field, falling back to the product name when `altText` is empty.

#### Scenario: Product card image has alt text
- **WHEN** the catalog grid renders a product card for a product whose primary image has a non-empty `altText`
- **THEN** the rendered `<img>` SHALL have its `alt` attribute set to that `altText` value

#### Scenario: Product gallery image falls back to product name
- **WHEN** the product detail gallery renders an image with an empty `altText`
- **THEN** the rendered `<img>` SHALL have its `alt` attribute set to the product name
