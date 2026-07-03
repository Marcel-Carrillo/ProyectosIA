## Context

`mavile.es` has no review/rating capability today. `ProductPage.tsx` already builds a `Product` JSON-LD block (name, image, description, brand, sku, offers with `hasMerchantReturnPolicy`/`shippingDetails`); this change adds `aggregateRating`/`review` to that same block, gated on real, moderated data. The existing `Refund` model (`schema.prisma`) already establishes the project's status-transition pattern (`Pending`-style string status + admin audit fields), which this design reuses rather than introducing a new pattern. Customer auth (`requireCustomerAuth`) and the `Customer`/`CustomerOrder`/`CustomerOrderItem` domain already exist and are read-only dependencies here.

This is a cross-cutting change (new Prisma entity, new domain/service/repository/controller layers, new public+admin routes, new frontend components, and a JSON-LD change with a real product/security decision — who may write a review), so a design doc is warranted per the schema's inclusion criteria.

## Goals / Non-Goals

**Goals:**
- Let a verified buyer (real paid purchase of the product) submit exactly one rating (1–5) + optional text review per product.
- Require admin moderation (`Pending` → `Approved`/`Rejected`) before a review is visible anywhere customer-facing, including structured data.
- Expose read-only average rating + review list per product to the storefront, and embed a summary in the product-detail response so `ProductPage.tsx` has the data at first render.
- Emit `aggregateRating`/`review` in Product JSON-LD only when ≥1 `Approved` review exists, computed server-side from Approved reviews only.

**Non-Goals:**
- Auto-publish/post-moderation flows.
- Reviews from non-verified-buyer customers.
- Per-variant reviews, review editing, helpful votes, photo/video reviews, merchant replies, incentivized-review emails, auto-translation.
- Any change to order, payment, fulfillment, shipment, return, or refund status models.

## Decisions

- **Purchase verification is strict and server-enforced.** A review may only be created if the caller's `Customer` has a `CustomerOrderItem` (via `CustomerOrder`) referencing a `ProductVariant` of the target product, on an order with `paymentStatus = "Paid"`. Alternative considered: allow any logged-in customer to review (rejected — this is exactly the pattern Google's anti-fake-review policy targets, and it would undermine the trust value the feature exists to create).
- **Pre-publication moderation, not auto-publish + post-moderation.** New reviews start `Pending` and are invisible to all public reads and JSON-LD until an admin sets `Approved`. Alternative considered: auto-publish immediately for lower friction (rejected — given this feature is a direct response to a Google structured-data compliance notice, publishing unmoderated content risks the exact policy violation this change exists to avoid).
- **Reviews are product-level, not variant-level.** Matches how Google's Product/Review markup and shopper mental model both work; the purchased variant is recorded (`customerOrderItemId`) only to prove eligibility, never surfaced as "the reviewed variant." Consistent with the product-level (not variant-level) scope already chosen for `gtin` in the sibling `product-gtin-identifier` change.
- **Status modeled as a `String` column with an application-level union (`"Pending" | "Approved" | "Rejected"`), not a Prisma enum.** Matches the existing convention used by `Refund`/`ReturnRequest` in `schema.prisma`, avoiding a new pattern in the codebase for no functional benefit.
- **One review per customer per product**, enforced via `@@unique([customerId, productId])` at the database level (not just application logic), so a race condition can't create duplicates.
- **`reviewSummary` (average, count) is embedded in the existing `GET /api/public/products/:id` response** rather than requiring a second client request, so the PDP has everything needed for both the visible UI and the JSON-LD at first render. The separate `GET /api/public/products/:id/reviews` endpoint serves the full paginated list and distribution breakdown.
- **Server computes `averageRating`/`reviewCount` from `Approved` reviews via a database aggregate query**, not client-side or cached-and-drifting values — avoids the summary ever disagreeing with the actual approved set.
- **Author identity is a name snapshot (`authorNameSnapshot`, e.g. "María C.") captured at write time**, not a live join to the customer profile. Avoids exposing the reviewer's email or full name and avoids published reviews silently changing if the customer later edits their profile name.
- **XSS/JSON-LD safety**: review `title`/`body` are length-capped, stored as plain text (no HTML), and rendered through the same `<script>`-escaping mechanism already used in `Seo.tsx` (`JSON.stringify(block).replace(/</g, '\\u003c')`) — no new escaping mechanism needed, this change reuses it.

## Risks / Trade-offs

- **[Risk] Moderation queue becomes a bottleneck, delaying legitimate reviews from ever reaching structured data.** → Mitigation: admin moderation endpoints are simple list/approve/reject (no extra workflow steps), matching the low-friction pattern already used for `Refund` status transitions; queue size can be surfaced to admins for follow-up outside this change's scope.
- **[Risk] A customer whose order is later refunded/cancelled keeps a published review.** → Mitigation: eligibility is checked at submission time only (matches the MVP's manual, non-automated fulfillment philosophy per base-standards §4/§17); revoking reviews on refund is explicitly out of scope and can be a follow-up if it becomes a real problem.
- **[Risk] Free-text review content could still break JSON-LD serialization or carry unwanted markup if the escaping mechanism is bypassed.** → Mitigation: reuse the existing, already-tested `Seo.tsx` escaping path rather than writing new serialization logic; add explicit test coverage for a review body containing `</script>` and `<` characters.
- **[Trade-off] Product-level reviews are a simplification** (a size-specific complaint reads as a general product complaint). Accepted for MVP consistent with how Google's own Product review markup works; documented as a non-goal.
- **[Risk] Purchase-verification query (join across `CustomerOrder` → `CustomerOrderItem` → `ProductVariant` → `Product`) could be slow at scale without the right index.** → Mitigation: reuse existing FK indexes on `CustomerOrderItem`/`CustomerOrder`; add `@@index([productId, status])` on `Review` for the read path, which is the higher-traffic path.

## Migration Plan

1. Add `Review` model + relations via Prisma migration (`prisma migrate dev --name add_review`) — purely additive, no existing table altered.
2. Ship backend (domain/repository/service/controllers/routes) and run its full test suite before any frontend wiring.
3. Ship frontend (`ProductReviews.tsx`, `ReviewForm.tsx`, JSON-LD emission) in the same PR/deploy; both sides are additive — a product with zero reviews behaves identically to today (no visible UI change, no JSON-LD change) until real approved reviews exist.
4. No backfill needed — the feature launches with zero reviews and accumulates real ones organically; do not seed fixture/demo reviews into a production-facing environment.
5. Rollback: dropping the `Review` table/migration is safe and fully reversible since no other entity has a required (non-nullable) foreign key into it.
6. Post-deploy verification: submit a review as a verified buyer test account → confirm it's `Pending` and invisible on the PDP/JSON-LD → approve it as admin → confirm it appears on the PDP and in JSON-LD (Google Rich Results Test) → confirm an unpurchased customer is rejected with `403`.

## Open Questions

- None blocking. The two decisions flagged during requirement enrichment (strict purchase verification, pre-publication moderation) are resolved above using the enrichment's own recommended defaults, consistent with prioritizing Google policy compliance — the explicit driver for this change — over lower-friction alternatives.
