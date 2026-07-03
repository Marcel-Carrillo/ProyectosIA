# Context Session: product-customer-reviews

## Change location
`openspec/changes/product-customer-reviews/` (proposal.md, design.md, specs/product-reviews/spec.md, tasks.md)

## Summary
Add a real, verified-buyer product review/rating system to close the "aggregateRating"/"review" gap flagged by Google Search Console. No review system exists in the codebase today (confirmed: no `Review` model in `schema.prisma`). Only a customer with a paid order containing the target product may submit exactly one review per product; new reviews start `Pending` and are invisible everywhere customer-facing (including structured data) until an admin sets them `Approved`. Structured data (`aggregateRating`/`review` in the storefront Product JSON-LD) is emitted only from real Approved reviews — never fabricated.

## Key business rules (see specs/product-reviews/spec.md for full scenarios)
1. Only verified buyers (paid `CustomerOrder` containing a `CustomerOrderItem` for a variant of the product) may submit a review for that product.
2. One review per customer per product — DB-level `@@unique([customerId, productId])`.
3. Rating integer 1-5 required; `title` (≤150 chars) and `body` (≤2000 chars) optional, plain text only.
4. New reviews are `Pending`; only `Approved` reviews are visible on any public read endpoint, in the product's rating summary, or in structured data. `Rejected` reviews are permanently excluded.
5. Public rating summary (`averageRating`, `reviewCount`) computed server-side from `Approved` reviews only; `reviewCount: 0` / `averageRating: null` when none.
6. Storefront JSON-LD emits `aggregateRating`/`review` only when ≥1 Approved review exists; omitted entirely otherwise.
7. Reviewer identity exposed only as a name snapshot (e.g. "María C."), captured at write time; email never exposed.

## Key design decisions (see design.md for full rationale)
- Reviews are product-level, not variant-level; `customerOrderItemId` recorded only for eligibility proof.
- `status` modeled as `String` (not Prisma enum), matching the `Refund`/`ReturnRequest` convention already in `schema.prisma` — **use `Refund`'s status-transition pattern as the closest existing analog** for the moderation service/controller shape.
- No auto-publish; strict purchase verification. Both decisions already resolved — do not re-litigate.
- `reviewSummary: { averageRating, reviewCount }` embedded directly in the existing `GET /api/public/products/:id` response (via the public product serializer / assembler), not a second round trip. The separate `GET /api/public/products/:id/reviews` endpoint serves the full paginated list + distribution.
- Review free-text flows through the *existing* `Seo.tsx` JSON-LD escaping (`.replace(/</g, '\\u003c')`) — no new escaping mechanism needed.
- Author display name snapshot, not a live join — avoid exposing customer email or full profile.

## Sibling change already implemented (reference pattern)
`product-gtin-identifier` (PR #64, on `feature/product-gtin-identifier`, not yet merged to `develop`) added a `gtin` field to `Product` end-to-end. It's a smaller, simpler pattern (single nullable field) and less directly useful as a template here than `Refund`'s status-transition pattern, but its `ProductPage.tsx` JSON-LD conditional-spread style (`...(condition ? {...} : {})`) is exactly the pattern to reuse for `aggregateRating`/`review`. **Important**: since this branch was created from `develop` (which does NOT yet have the gtin commit), `ProductPage.tsx`/`Product` type/etc. on this branch do NOT have the `gtin`/`brand`/`hasMerchantReturnPolicy`/`shippingDetails` JSON-LD blocks that exist on the gtin branch — read the actual current file content on THIS branch, don't assume it matches what was described in the gtin session.

## Full requirements
See `openspec/changes/product-customer-reviews/tasks.md` for the complete, ordered task list. Sections 1-9 are implementation (backend schema/domain/repo/service/validator/controllers/routes, frontend types/service/components/JSON-LD); sections 10-15 are mandatory verification/docs/PR steps handled by the parent session, not the planning agents.

## Ask of the planning agents
Produce a per-file implementation plan (exact edits/new-file contents, not just descriptions) for every file listed in the relevant tasks sections. Do not implement — only plan. Save the plan to `.claude/doc/product-customer-reviews/<backend|frontend>.md`.
