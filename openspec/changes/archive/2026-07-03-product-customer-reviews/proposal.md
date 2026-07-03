## Why

Google Search Console flags `mavile.es` under "Datos estructurados de Fragmentos de productos" with missing `aggregateRating` and `review` fields. No review/rating system exists anywhere in the codebase today (confirmed: no `Review`/`Rating` model in `schema.prisma`), so these fields cannot be filled — and must not be filled with fabricated or placeholder data, which Google's structured-data policy treats as a violation that can jeopardize rich-result eligibility for the whole domain. The only compliant path is a real review system: verified buyers rate/review products they purchased, reviews are moderated before publication, and structured data reflects only genuine, approved reviews. This also improves on-page trust/conversion for an apparel store where fit/quality uncertainty is a purchase blocker.

## What Changes

- Add a `Review` entity (`backend/prisma/schema.prisma`) with `rating` (1–5), optional `title`/`body`, `status` (`Pending`/`Approved`/`Rejected`), moderation audit fields, and a snapshot author display name. One review per customer per product (`@@unique([customerId, productId])`).
- Enforce server-side purchase verification: only a customer with a paid `CustomerOrder` containing a `CustomerOrderItem` for a variant of the target product may submit a review for it.
- Add a moderation workflow: new reviews are created `Pending`; only an admin transitioning a review to `Approved` makes it visible on public read endpoints and eligible for structured data. `Rejected` reviews are never published.
- Add public read endpoints: review list + rating summary (average, count, distribution) per product, returning only `Approved` reviews; embed a compact `reviewSummary` in the existing product-detail response.
- Add authenticated customer endpoints: eligibility check, submit review, list own reviews.
- Add admin endpoints: moderation queue, approve/reject, delete.
- Update `ProductPage.tsx` to emit `aggregateRating` and `review` in the storefront Product JSON-LD **only** when the product has at least one `Approved` review; omit both properties entirely otherwise. Values are computed server-side from Approved reviews only — never fabricated.
- Add a storefront reviews UI section (list, average/distribution, write form for eligible logged-in buyers, empty state for products with none).

Non-breaking, additive change. No **BREAKING** changes to existing entities or endpoints.

## Capabilities

### New Capabilities
- `product-reviews`: verified-buyer product reviews with 1–5 star ratings, admin moderation before publication, public read access to approved reviews and rating summaries, and conditional emission of `aggregateRating`/`review` in storefront structured data.

### Modified Capabilities
(none — no existing spec's requirements change; this introduces a new capability)

## Impact

- **Affected code**: `backend/prisma/schema.prisma` (+migration), new `backend/src/domain/models/review.ts`, new `backend/src/domain/repositories/reviewRepository.ts` + infrastructure implementation, new `backend/src/application/services/reviewService.ts`, new `backend/src/presentation/controllers/reviewController.ts` (+ admin variant), route wiring in `backend/src/routes/public/productRoutes.ts`, `backend/src/routes/public/accountRoutes.ts`, new `backend/src/routes/admin/reviewRoutes.ts`; `frontend/src/pages/storefront/ProductPage.tsx`, new `frontend/src/components/storefront/ProductReviews.tsx` + `ReviewForm.tsx`, `frontend/src/types/product.ts`, new `frontend/src/services/reviewService.ts`.
- **Affected APIs**: new `GET /api/public/products/:id/reviews`, `GET/POST /api/public/account/reviews`, `GET /api/public/account/products/:productId/review-eligibility`, `GET /api/admin/reviews`, `PATCH /api/admin/reviews/:id/status`, `DELETE /api/admin/reviews/:id`; existing `GET /api/public/products/:id` response gains an optional `reviewSummary` field.
- **Customer-facing vs internal**: affects both. Customer-facing: PDP review list/summary/write-form, richer Google search snippets. Internal: new admin moderation queue.
- **Supplier data exposure**: none — reviews reference `Product`/`CustomerOrderItem`/`Customer` only; no supplier fields are read or exposed.
- **Order lifecycle**: read-only dependency on `CustomerOrder`/`CustomerOrderItem` for purchase verification (queries `paymentStatus = Paid`); does not modify order, payment, fulfillment, shipment, return, or refund status in any way.
- **Dependencies**: none beyond existing Prisma/Express/React stack.

## Non-goals

- Auto-publishing reviews without moderation (rejected per Google's anti-fake-review policy risk; pre-publication approval is required in this MVP).
- Allowing any logged-in customer (not just verified buyers) to review a product.
- Review editing after submission, helpful/upvote counts, photo/video reviews, merchant replies to reviews, or incentivized-review request emails — all deferred to future iterations.
- Per-variant reviews — reviews are product-level; the purchased variant is used only for eligibility verification.
- Auto-translation of review text.
