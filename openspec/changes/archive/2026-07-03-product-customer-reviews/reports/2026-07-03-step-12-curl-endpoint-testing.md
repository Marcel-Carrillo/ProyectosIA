# Step 12 Report - Manual Endpoint Testing with curl

- Date: 2026-07-03
- Change: product-customer-reviews
- Agent: Claude (Sonnet 5)

## Environment setup notes

Same Docker Prisma-Client-staleness issue as the sibling `product-gtin-identifier` change: rebuilt the `ecommerce-backend` image (`docker compose build backend`) and recreated the `backend_node_modules` named volume so the running container's Prisma Client recognized the new `Review` model. The pre-existing, unrelated seed-script FK error (`seedFashionCatalog.ts` vs. existing order data) occurred again on container start and did not affect data (confirmed via row counts before/after).

Test fixtures were created directly (not through checkout/Stripe, which is out of scope here): registered a real customer account via `POST /api/public/auth/register` (id 601, `review-tester@example.com`), then inserted one `Paid` `CustomerOrder` (id 268) + `CustomerOrderItem` (id 260) directly via `psql`, referencing an existing Active product variant (product 106 "Acetate Sunglasses", variant 1053).

## Commands Executed and Results

### 12.2 — Eligibility check for a verified buyer
`GET /api/public/account/products/106/review-eligibility` → `200`, `{"canReview":true,"reason":"eligible"}`.

### 12.3 — Submit review
`POST /api/public/account/reviews` `{"productId":106,"rating":5,"title":"Great sunglasses","body":"..."}` → `201`, response includes `status:"Pending"`, `authorNameSnapshot:"Review T."` (correctly built from `firstName`+last-initial), and **no `customerId`, `moderationNote`, or `moderatedByAdminUserId`** in the response — confirms the `serializeOwnReview` allow-list works over real HTTP, not just in the unit test mock.

### 12.4 — Pending review invisible on public list
`GET /api/public/products/106/reviews` → `200`, `items: []`, `summary.reviewCount: 0` — the just-submitted `Pending` review does not appear.

### 12.5 — Admin moderation
`GET /api/admin/reviews?status=Pending` (admin token) → `200`, the pending review appears with full domain fields (admin-only endpoint, no allow-list needed). `PATCH /api/admin/reviews/1/status` `{"status":"Approved"}` → `200`, response shows `status:"Approved"`, `publishedAt`/`moderatedAt` set, `moderatedByAdminUserId:1`.

### 12.6 — Approved review now public
`GET /api/public/products/106/reviews` → `200`, review now present, `summary: {averageRating:5, reviewCount:1}`. `GET /api/public/products/106` → `reviewSummary:{"averageRating":5,"reviewCount":1}` present in the product detail response.

### 12.7 — Non-buyer rejected
Same customer, `POST /api/public/account/reviews` for product 105 (not purchased) → `403`, `{"code":"REVIEW_PURCHASE_NOT_VERIFIED"}`.

### 12.8 — Duplicate rejected
Same customer, second `POST /api/public/account/reviews` for product 106 (already reviewed) → `409`, `{"code":"REVIEW_ALREADY_EXISTS"}`.

### 12.9 — Cleanup
`DELETE /api/admin/reviews/1` → `204`. Then via `psql`: deleted the test `CustomerOrderItem` (260), `CustomerOrder` (268), `CustomerAccount`, and `Customer` (601). Verified via `psql`: `Review` table back to 0 rows, active `Product` count still 15, test customer (601) fully removed.

## Outcome

- Step 12 status: **PASS**
- Blocking issues: none
