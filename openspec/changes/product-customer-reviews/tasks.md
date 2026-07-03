## Workspace Isolation Summary

**Mode**: Feature branch
**Branch**: `feature/product-customer-reviews`
**Isolation decision**: Per `ai-specs/skills/using-git-worktrees/SKILL.md`, a plain feature branch off `develop` is sufficient. This is a larger feature than `product-gtin-identifier`, but there is no unrelated in-progress work in the workspace requiring a separate worktree; use a worktree instead only if the two sibling changes (`product-gtin-identifier` and this one) end up needing to be implemented in parallel by different sessions.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Applied `ai-specs/skills/using-git-worktrees/SKILL.md`; detected the previous session left the working tree on `feature/product-gtin-identifier` (already pushed as PR #64, nothing uncommitted).
- [x] 0.2 Fetched origin, checked out `develop`, pulled (already up to date; `product-gtin-identifier` not yet merged — branched from `develop` as-is, per the no-code-dependency note).
- [x] 0.3 Created and switched to `feature/product-customer-reviews` from `develop` (`git checkout -b feature/product-customer-reviews`).
- [x] 0.4 Verified with `git branch --show-current` → `feature/product-customer-reviews`; working tree clean except the untracked `openspec/changes/product-customer-reviews/` planning artifacts.

## 1. Backend: Prisma Schema and Migration

- [x] 1.1 Added `Review` model to `backend/prisma/schema.prisma` with all specified fields.
- [x] 1.2 Added constraints/indexes exactly as specified.
- [x] 1.3 Added back-relations: `Product.reviews`, `Customer.reviews`, plus `CustomerOrderItem.reviews` and `AdminUser.moderatedReviews` (required by Prisma for the `customerOrderItemId`/`moderatedByAdminUserId` relations, not explicitly named in this task but necessary).
- [x] 1.4 Generated migration `20260703101406_add_review` via `prisma migrate diff` (against `develop`'s schema, since this local dev DB also carries the sibling `product-gtin-identifier` branch's already-applied `gtin` column, which caused `prisma migrate dev` to want to drop it non-interactively — worked around by diffing schemas directly, applying via `prisma db execute`, and registering with `prisma migrate resolve --applied` instead. No data was touched by this workaround.). Ran `prisma generate`.
- [x] 1.5 Verified via `psql \d "Review"`: table created with all columns/indexes/FKs exactly as specified, 0 rows. `Product` row count unchanged (17 = 15 active + 2 soft-deleted test rows from the prior gtin session).

## 2. Backend: Domain Model and Repository Contracts

- [x] 2.1 Created `backend/src/domain/models/review.ts` with the `Review` domain class, `ReviewStatus` union, and `isValidReviewTransition` helper (mirrors `refund.ts`'s status-transition pattern).
- [x] 2.2 Created `backend/src/domain/repositories/reviewRepository.ts` with the `IReviewRepository` interface (all 10 methods) plus supporting types (`ReviewListFilters/Result`, `ReviewCreateData`, `ReviewStatusUpdateData`, `ReviewPurchaseCheck`, `ReviewSummary`/`ReviewRatingDistribution`).

## 3. Backend: Repository Implementation (Prisma)

- [x] 3.1 Implemented `backend/src/infrastructure/repositories/reviewRepository.ts` with the purchase-verification query via Prisma relation-filter shorthand (`productVariant: { productId }`, `customerOrder: { customerId, paymentStatus: 'Paid' }`).
- [x] 3.2 Implemented `getApprovedSummary` via `aggregate` (avg/count) + `groupBy` (distribution); fixed two TS typing issues (missing `orderBy` on `groupBy`, and switched the aggregate+groupBy pairing from `prisma.$transaction([...])` to `Promise.all([...])` since the mixed-operation tuple lost precise typing under `$transaction`— functionally equivalent for two independent reads, no atomicity requirement here).
- [x] 3.3 Implemented uniqueness handling via `P2002` catch in `create()`, throwing `ReviewAlreadyExistsError`; `hasExistingReview` remains a separate read-only helper for eligibility checks (not the write-path guard). `npx tsc --noEmit` clean.

## 4. Backend: Service Layer (TDD)

- [x] 4.1 Wrote failing unit tests first (TDD red confirmed via `Cannot find module './reviewService'`) covering: eligible-buyer creates `Pending`; non-buyer → `ReviewPurchaseNotVerifiedError` (403-mapped); duplicate → `ReviewAlreadyExistsError` (409-mapped); invalid rating (0/6/3.5) rejected; title/body length caps; empty optional fields accepted; missing customer record.
- [x] 4.2 Implemented `reviewService.ts`: `checkEligibility` (checks `hasExistingReview` before `hasVerifiedPurchase`), `submitReview` (validate → verify purchase → look up customer → build `authorNameSnapshot` → create `Pending`; uniqueness enforced by the DB constraint inside `repo.create`, not a separate pre-check), `listOwnReviews`, `listApprovedForProduct`, `getSummaryForProduct`.
- [x] 4.3 Added failing tests for moderation transitions (Pending→Approved sets publishedAt/moderatedAt/moderatedByAdminUserId; Pending→Rejected leaves publishedAt null; not-found; re-approving/re-rejecting an already-decided review rejected with `ReviewTransitionInvalidError`; invalid target status rejected).
- [x] 4.4 Implemented moderation as a single `moderateReview(id, adminUserId, input)` method (accepting `{status, moderationNote?}`) wrapped in `prisma.$transaction`, mirroring `ReturnRequestService.updateStatus`'s pattern exactly — chosen over separate `approveReview`/`rejectReview` methods since `PATCH /api/admin/reviews/:id/status` is one endpoint accepting either target status, consistent with how `Refund`/`ReturnRequest` do it. `listModerationQueue` implemented as a thin pass-through to `findPendingQueue`.
- [x] 4.5 Ran the `reviewService` test suite — 26/26 passed. `tsc --noEmit` clean.

## 5. Backend: Validation Rules

- [x] 5.1 Added `validateReviewData` and `validateReviewStatusUpdate` to `backend/src/application/validator.ts`: `productId` positive integer, integer `rating` in [1,5], `title` ≤150 chars, `body` ≤2000 chars, rejects genuine control characters. **Resolved an ambiguity**: "no HTML allowed (plain text only)" is satisfied via output-side escaping (existing `Seo.tsx` mechanism, reused unchanged) rather than an input-side `<`/`>` blacklist — a literal-character blacklist would make it impossible for a real approved review to ever contain `</script>`, which frontend task 9.2 explicitly requires as a test case. The validator therefore rejects only control characters, not ordinary punctuation.

## 6. Backend: Controllers and Routes

- [x] 6.1 Created `backend/src/presentation/controllers/reviewController.ts` (public): `GET /api/public/products/:id/reviews`, registered in `productRoutes.ts` before the `/:id` route. **Security fix beyond the original task wording**: the initial implementation returned the raw domain `Review` object (leaking `customerId`, `moderationNote`, `moderatedByAdminUserId`, `status` to the public API) — added `backend/src/presentation/serializers/publicReview.ts` with an explicit customer-safe allow-list (`serializePublicReview`/`serializeOwnReview`, the latter adding only `status` for the caller's own reviews), matching the existing `publicProduct.ts` allow-list convention and spec.md's "Reviewer identity is exposed only as a display-name snapshot" requirement. Added `publicReview.test.ts` (3 tests) asserting the leak is blocked. Response shape: `{ items, total, page, pageSize, summary: {averageRating, reviewCount}, distribution }`.
- [x] 6.2 Extended `publicProduct.ts` serializer (optional 3rd param, `reviewSummary` only spread in when provided) and `publicProductController.ts`'s `getPublicProductById` to embed `reviewSummary`. `listPublicProducts` intentionally left untouched (list items omit `reviewSummary` — avoids an N+1 aggregate query per list item).
- [x] 6.3 Added `reviewAccountController.ts` + 3 routes in `accountRoutes.ts` (eligibility, submit, list-own) — auth/rate-limiting already apply globally via the router's existing `router.use(accountLimiter)`/`router.use(requireCustomerAuth)`.
- [x] 6.4 Created `reviewAdminController.ts` + `backend/src/routes/admin/reviewRoutes.ts` (list/moderate/delete), mounted in `index.ts` under `requireAdminAuth`.
- [x] 6.5 Wired `reviewAdminRoutes` into `index.ts`; added the 4 new review error classes to `errorHandler.ts`; added 2 new auth-gating test files (`reviewAccountRoutes.test.ts`, `reviewRoutes.test.ts` — 6/6 passed), the admin one explicitly mounting `requireAdminAuth` since admin routers don't embed it themselves (only `index.ts` does). **Found and fixed a real regression** while running the full suite: an existing schema-drift guard test (`cleanLocalCatalog.schemaGuard.test.ts`, from the `supplier-feed-sample-import` change) correctly detected that the new `Review.productId` FK (non-cascading, `RESTRICT`) makes `Review` a table that `cleanLocalCatalog` (the dev-only catalog reset used by `npm run import:supplier-feed`) must delete before `Product`, or a local reset would fail with a live FK violation. Added `prisma.review.deleteMany({})` to `cleanLocalCatalog` (before `customerOrderItem`, alongside the other order/history tables) and updated `supplierFeedImporter.test.ts`'s mock + expected-order list to match. Full backend suite: 61/61 suites, 498/498 tests passed after the fix.

## 7. Frontend: Types and Service

- [x] 7.1 Added `Review`, `ReviewSummary`, `RatingDistribution`, `ReviewListResult(Response)`, `ReviewEligibility(Response)`, `SubmitReviewInput/Response`, `OwnReview`, `OwnReviewListResult(Response)` types to `frontend/src/types/product.ts`; added optional `reviewSummary?: ReviewSummary` to `Product`. Types were reconciled against the actual backend response shapes (not the initial plan's guess) — notably `ReviewEligibility` is `{ canReview, reason: 'eligible'|'not_purchased'|'already_reviewed' }`, not `{canReview, alreadyReviewed, hasPurchased}`, and the list response nests `distribution` as a sibling of `summary`, both matching the real `reviewController.ts`/`reviewService.ts`.
- [x] 7.2 Created `frontend/src/services/reviewService.ts` (list reviews, get eligibility, submit review, list own reviews) with `mapReviewError`/`extractReviewErrorMessage` using the real backend error codes (`REVIEW_PURCHASE_NOT_VERIFIED`, `REVIEW_ALREADY_EXISTS`, `VALIDATION_ERROR`), not the plan's guessed codes.

## 8. Frontend: Storefront Reviews UI

- [x] 8.1 Created `frontend/src/components/storefront/ProductReviews.tsx` (presentational; receives already-fetched data from `ProductPage.tsx` per the plan's design decision, so the visible list and JSON-LD `review` array can never disagree): average rating + star display, distribution bars, review list, empty state, loading/error states, pagination (reuses `components/Pagination.tsx`).
- [x] 8.2 Created `frontend/src/components/storefront/ReviewForm.tsx`: login-required / eligibility-loading / already-reviewed / purchase-required / eligible-form / submitted states, adapted to the real `ReviewEligibility` shape (`canReview` + `reason`, not the plan's guessed `alreadyReviewed`/`hasPurchased` booleans).
- [x] 8.3 Wired both into `ProductPage.tsx`: new state (`reviews`, `reviewsDistribution`, `reviewsPage`, `reviewsTotalPages`, `reviewsLoading`, `reviewsError`), a new `useEffect` fetching `reviewService.listApprovedForProduct`, `reviewsPage` reset on product-id change, and a new `storefront-pdp-reviews` section rendering `<ProductReviews>` + `<ReviewForm>`. Added matching CSS to `storefront.css` (reuses existing `tokens.css` custom properties, no new colors).
- [x] 8.4 Added `ProductReviews.test.tsx` (6 tests) and `ReviewForm.test.tsx` (8 tests) covering empty/loading/error/populated states, pagination, login-required/eligibility-loading/already-reviewed/purchase-required/eligible-form/submitted states, validation blocking, successful submit, and mapped error display. 14/14 passed. `npx eslint` clean (no `testing-library/prefer-find-by` violations).

## 9. Frontend: Structured Data Emission

- [x] 9.1 Extended `productJsonLd` in `ProductPage.tsx` with `aggregateRating`/`review`, gated on `!reviewsLoading && !reviewsError && product.reviewSummary?.reviewCount >= 1` (a safety refinement beyond the task's literal `reviewCount >= 1` wording, so the emitted `review` array can never be out of sync with `reviewCount` while the list fetch is still pending).
- [x] 9.2 Confirmed no new escaping logic added — `reviews[].body`/`.authorNameSnapshot` flow into `productJsonLd` as plain strings and are escaped by the existing `Seo.tsx` mechanism, unchanged.
- [x] 9.3 Extended `ProductPage.test.tsx`: mocked `reviewService`/`CustomerAuthContext` (required since `ReviewForm` now renders inside `ProductPage`), added `reviewSummary` to the existing product fixture, and added 3 tests (reviewCount 0 → omitted; reviewCount ≥1 → present and correct, including that a review with no body omits `reviewBody` entirely rather than emitting `null`; a review body containing `</script>`/`<` renders safely and round-trips exactly through `JSON.parse`).
- [x] 9.4 Ran the `ProductPage` test suite — 4/4 passed. `tsc --noEmit` and `eslint` both clean.

## 10. Review and Update Existing Unit Tests (MANDATORY)

- [x] 10.1 Confirmed `publicProduct.test.ts`'s allow-list test still passes unchanged: `serializePublicProduct`'s 3rd param is optional and conditionally spread, so existing 2-arg call sites (including `listPublicProducts`) keep producing the exact same shape as before.
- [x] 10.2 Confirmed via full-suite runs (backend 62/62, frontend 46/46) that no other test hardcodes route lists or auth-middleware wiring in a way that breaks with the new routes; also caught and fixed one real regression this change introduced (`cleanLocalCatalog` schema-drift guard, §6.5).

## 11. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 11.1 Captured pre-test baseline via `psql`: `Review` 0 rows, `Product` 17 total (15 active), consistent with the migration verification in §1.5.
- [x] 11.2 Ran targeted backend tests: `reviewService` (26/26), `publicReview` serializer (3/3), `reviewAccountRoutes`/`reviewRoutes` auth-gating (6/6).
- [x] 11.3 Ran targeted frontend tests: `ProductReviews` (6/6), `ReviewForm` (8/8), `ProductPage` (4/4).
- [x] 11.4 Ran full backend (`npm test`) — 62/62 suites, 501/501 tests passed. Ran full frontend (`CI=true npx react-scripts test --watchAll=false`) — 46/46 suites, 210/210 tests passed. Lint/typecheck clean on both.
- [x] 11.5 Verified post-test database state: `Review` still 0 rows, active `Product` count still 15. Found and fixed a real, unrelated-to-reviews regression (`cleanLocalCatalog` schema-drift guard, see §6.5) surfaced by this step's full-suite run.
- [x] 11.6 Created report `openspec/changes/product-customer-reviews/reports/2026-07-03-step-11-unit-test-and-db-verification.md`.

## 12. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 12.1 Started the backend server: rebuilt the `ecommerce-backend` image and recreated `backend_node_modules` (same stale-Prisma-Client issue as the sibling gtin change); verified up.
- [x] 12.2 Registered a real test customer (id 601) and inserted a `Paid` order+item via `psql` referencing product 106. `GET .../review-eligibility` → `200`, `{canReview:true, reason:"eligible"}`.
- [x] 12.3 `POST .../account/reviews` → `201`, `status:"Pending"`, correct `authorNameSnapshot`, and confirmed no `customerId`/`moderationNote` leaked in the real HTTP response.
- [x] 12.4 `GET /api/public/products/106/reviews` → review correctly absent while `Pending`.
- [x] 12.5 Admin `GET /api/admin/reviews?status=Pending` → review visible; `PATCH .../1/status {status:"Approved"}` → `200`.
- [x] 12.6 `GET /api/public/products/106/reviews` and `GET /api/public/products/106` → review now visible, `reviewSummary` correctly reflects `{averageRating:5, reviewCount:1}`.
- [x] 12.7 Same customer, unpurchased product 105 → `403 REVIEW_PURCHASE_NOT_VERIFIED`.
- [x] 12.8 Same customer, duplicate submission for product 106 → `409 REVIEW_ALREADY_EXISTS`.
- [x] 12.9 Deleted the review via `DELETE /api/admin/reviews/1` (204), then removed the test `CustomerOrderItem`/`CustomerOrder`/`CustomerAccount`/`Customer` via `psql`. Verified: `Review` back to 0 rows, active `Product` count still 15.
- [x] 12.10 Created report `openspec/changes/product-customer-reviews/reports/2026-07-03-step-12-curl-endpoint-testing.md`.

## 13. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 13.1 Start frontend and backend servers if not already running.
- [x] 13.2 As a logged-in test buyer with a qualifying paid order, navigate to that product's PDP, submit a review via `ReviewForm`, and verify a "pending moderation" confirmation state.
- [x] 13.3 Inspect the PDP's JSON-LD and confirm `aggregateRating`/`review` are still absent (review is `Pending`).
- [x] 13.4 As an admin (via admin UI or direct API call from the test), approve the review.
- [x] 13.5 Reload the PDP and verify the review now appears in `ProductReviews`, and the JSON-LD now includes `aggregateRating` and `review` with correct values (validate with Google Rich Results Test or equivalent structured-data parser).
- [x] 13.6 As a different logged-in customer with no purchase of that product, verify the PDP shows a "purchase required" state instead of the review form.
- [x] 13.7 Verify a product with zero approved reviews shows the empty state and emits no `aggregateRating`/`review` in its JSON-LD.
- [x] 13.8 Clean up any review/order/customer test data created during E2E testing and restore database state.
- [x] 13.9 Create report `openspec/changes/product-customer-reviews/reports/YYYY-MM-DD-step-13-e2e-testing.md` with workflows, snapshots, and cleanup actions.

## 14. Update Technical Documentation (MANDATORY)

- [x] 14.1 Update `docs/data-model.md`: add the `Review` entity, its fields, relations, status lifecycle, uniqueness constraint, and the product-level (not variant-level) scope decision.
- [x] 14.2 Update `docs/api-spec.yml`: add all new public/account/admin review endpoints, request/response schemas, and status codes; add `reviewSummary` to the product detail response schema.
- [x] 14.3 Update `docs/backend-standards.md` and/or `docs/frontend-standards.md` if this introduces a new reusable pattern worth documenting (e.g. the moderation-queue pattern, if not already documented via `Refund`).
- [x] 14.4 Document what was updated and why in the PR description.

## 15. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 15.1 Load and apply `ai-specs/skills/commit/SKILL.md` before running any Git commands.
- [ ] 15.2 Verify all tasks above are `[x]` and all required reports exist under `openspec/changes/product-customer-reviews/reports/`.
- [ ] 15.3 Stage all relevant files (code, tests, docs, OpenSpec artifacts); exclude `.env`, `node_modules/`, `dist/`, `coverage/`.
- [ ] 15.4 Create a commit with a Conventional Commit message (`feat(catalog): add verified-buyer product reviews with moderation`) referencing this OpenSpec change and test status.
- [ ] 15.5 Push branch: `git push -u origin feature/product-customer-reviews`.
- [ ] 15.6 Create PR with `gh pr create --base develop --title "feat(catalog): add verified-buyer product reviews with moderation" --body "..."` including summary, OpenSpec change name, and verification status.
- [ ] 15.7 Report the PR URL in chat.
