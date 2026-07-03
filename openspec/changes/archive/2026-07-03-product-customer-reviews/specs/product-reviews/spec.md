## ADDED Requirements

### Requirement: Only verified buyers may submit a product review
A customer SHALL be allowed to submit a review for a product only if their `Customer` account has at least one `CustomerOrderItem`, on an order with `paymentStatus` of `Paid`, referencing a `ProductVariant` that belongs to that product. Verification SHALL be enforced server-side and MUST NOT rely on client-supplied claims.

#### Scenario: Verified buyer is eligible to review
- **WHEN** an authenticated customer with a paid order containing a variant of product X requests to submit a review for product X
- **THEN** the system SHALL accept the review submission for processing

#### Scenario: Non-buyer is blocked from reviewing
- **WHEN** an authenticated customer with no paid order containing any variant of product X attempts to submit a review for product X
- **THEN** the system SHALL reject the request with a `403` authorization error and SHALL NOT create a review record

### Requirement: One review per customer per product
A customer SHALL be able to submit at most one review per product. The uniqueness constraint SHALL be enforced at the database level.

#### Scenario: Second review attempt for the same product is rejected
- **WHEN** a customer who has already submitted a review for product X attempts to submit another review for product X
- **THEN** the system SHALL reject the request with a `409` conflict error and SHALL NOT create a duplicate review record

### Requirement: Review rating and content validation
A review SHALL require an integer `rating` between 1 and 5 inclusive. `title` and `body` are optional; when provided, they SHALL be capped in length (`title` ≤ 150 characters, `body` ≤ 2000 characters) and stored as plain text.

#### Scenario: Rating outside valid range is rejected
- **WHEN** a customer submits a review with `rating` of 0 or 6
- **THEN** the system SHALL reject the request with a validation error

#### Scenario: Review without optional text is accepted
- **WHEN** a verified buyer submits a review with only a `rating` and no `title` or `body`
- **THEN** the system SHALL create the review successfully

### Requirement: New reviews require admin moderation before publication
Every newly created review SHALL have `status` set to `Pending`. A `Pending` or `Rejected` review SHALL NOT appear in any public read endpoint, in any product's rating summary, or in storefront structured data. Only an admin transitioning a review to `Approved` SHALL make it publicly visible.

#### Scenario: Pending review is invisible to the public
- **WHEN** a review has `status = Pending`
- **THEN** the public review list and rating summary for that product SHALL NOT include that review

#### Scenario: Admin approves a review
- **WHEN** an admin sets a `Pending` review's `status` to `Approved`
- **THEN** the review SHALL appear in the product's public review list and SHALL count toward its rating summary

#### Scenario: Admin rejects a review
- **WHEN** an admin sets a `Pending` review's `status` to `Rejected`
- **THEN** the review SHALL remain permanently excluded from all public read endpoints and structured data

### Requirement: Public rating summary reflects only approved reviews
The system SHALL expose, per product, an `averageRating` and `reviewCount` computed exclusively from `Approved` reviews. A product with zero `Approved` reviews SHALL report `reviewCount: 0` and `averageRating: null`.

#### Scenario: Summary excludes pending and rejected reviews
- **WHEN** a product has 2 `Approved` reviews, 1 `Pending` review, and 1 `Rejected` review
- **THEN** the public rating summary SHALL report `reviewCount: 2` and `averageRating` computed only from the 2 `Approved` reviews

#### Scenario: Product with no approved reviews reports empty summary
- **WHEN** a product has no `Approved` reviews
- **THEN** the public rating summary SHALL report `reviewCount: 0` and `averageRating: null`

### Requirement: Storefront structured data emits ratings only when real approved reviews exist
The storefront product detail page SHALL include `aggregateRating` and `review` in its `Product` JSON-LD only when the product has at least one `Approved` review. The values SHALL be computed server-side from `Approved` reviews only. The system SHALL NOT emit fabricated, placeholder, or estimated rating values.

#### Scenario: Product with approved reviews emits aggregateRating and review
- **WHEN** the product detail page renders for a product with at least one `Approved` review
- **THEN** the page's `Product` JSON-LD SHALL include an `aggregateRating` object with `ratingValue` and `reviewCount` matching the approved-reviews summary, and a `review` array containing the approved reviews

#### Scenario: Product with no approved reviews omits rating structured data
- **WHEN** the product detail page renders for a product with zero `Approved` reviews
- **THEN** the page's `Product` JSON-LD SHALL NOT include `aggregateRating` or `review`

### Requirement: Reviewer identity is exposed only as a display-name snapshot
Public review data SHALL expose the reviewer's identity only as a name snapshot captured at submission time. The reviewer's email address SHALL NOT be exposed through any customer-facing API or structured data.

#### Scenario: Public review omits reviewer email
- **WHEN** a customer-facing client retrieves an approved review
- **THEN** the response SHALL include the author's display-name snapshot and SHALL NOT include the reviewer's email address
