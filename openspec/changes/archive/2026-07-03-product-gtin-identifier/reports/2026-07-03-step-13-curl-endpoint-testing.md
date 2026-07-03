# Step 13 Report - Manual Endpoint Testing with curl

- Date: 2026-07-03
- Change: product-gtin-identifier
- Agent: Claude (Sonnet 5)

## Environment setup notes

The `ecommerce-backend` Docker image bakes `prisma/schema.prisma` in at build time (not bind-mounted; only `src/` is). After editing `schema.prisma` on the host and generating the migration from the host (`backend/.env` points at `localhost:5432`, published by `docker-compose.yml`), the running container's Prisma Client was stale and rejected the new `gtin` field with `Unknown argument`. Fixed by:
1. `docker compose build backend` (picks up the updated `prisma/schema.prisma` via the Dockerfile's `COPY prisma ./prisma`).
2. Removing the stale `backend_node_modules` named volume (it was shadowing the freshly-built image's `node_modules`/generated Prisma Client, and also had a permission mismatch preventing `prisma generate` from running in-place).
3. `docker compose up -d backend` — Docker re-populated the empty named volume from the rebuilt image, giving the running container a Prisma Client aware of `gtin`.

The container's automatic seed step (`entrypoint.sh`) hit a pre-existing, unrelated FK error (`seedFashionCatalog.ts` vs. existing `CustomerOrderItem` rows) — this is not caused by this change (no `gtin`-related code runs in that path) and did not mutate the database (row count unchanged, verified below); the dev server started normally afterward.

## Commands Executed

- `POST /api/admin/auth/login` — obtain admin bearer token.
- `POST /api/admin/products` with a valid 13-digit `gtin`.
- `POST /api/admin/products` with a non-digit `gtin`.
- `POST /api/admin/products` with a bad-length `gtin`.
- `PATCH /api/admin/products/107` with a valid `gtin`.
- `PATCH /api/admin/products/107` with an invalid `gtin` (verifies the scoped update-path validation added in task 4.4).
- `PATCH /api/admin/products/106` (existing Active product) with a valid `gtin`, then `GET /api/public/products/106` to confirm public exposure, then `PATCH` back to `gtin: null` to restore it.
- `DELETE /api/admin/products/107` (soft delete, restores database state for the CREATE test).
- `psql` verification of active product count and non-null `gtin` count pre/post.

## Responses

### 13.2 — POST with valid 13-digit gtin
Request: `{"name":"GTIN Test Product","gtin":"4006381333931"}`
Response: `201`, body includes `"gtin":"4006381333931"`.

### 13.3 — POST with invalid gtin (non-digit)
Request: `{"name":"Bad GTIN Product","gtin":"12345ABC9012"}`
Response: `400`, `{"success":false,"error":{"message":"Field 'gtin' must contain only digits and be 8, 12, 13, or 14 characters long","code":"VALIDATION_ERROR"}}`

### 13.3b — POST with invalid gtin (bad length, 9 digits)
Request: `{"name":"Bad Length Product","gtin":"123456789"}`
Response: `400`, same validation error message.

### 13.4 — PATCH valid gtin on existing product (id 107)
Response: `200`, body includes `"gtin":"5901234123457"`, `updatedAt` bumped.

### 13.4b — PATCH invalid gtin on existing product (id 107)
Request: `{"gtin":"BAD123"}`
Response: `400`, same validation error — confirms the scoped `validateAndNormalizeGtinField` call added to `ProductService.update()` (task 4.4) works end-to-end over HTTP, not just in the unit test mock.

### 13.5 — Public catalog exposes gtin
Set `gtin` on Active product 106 via `PATCH`, then `GET /api/public/products/106` → `200`, body includes `"gtin":"5901234123457"`. Reverted with a follow-up `PATCH { "gtin": null }` → `200`, confirmed `"gtin":null`.
(Note: product 107, created as `Draft` with no variants, correctly returned `404 PRODUCT_NOT_FOUND` on the public endpoint — expected existing business rule, not gtin-related, so 106 was used instead to exercise the public-exposure scenario on a real Active product.)

### 13.6 — Cleanup
`DELETE /api/admin/products/107` → `204`. Verified via `psql`: active (`deletedAt IS NULL`) product count is `15`, matching the pre-test baseline exactly. The one remaining non-null `gtin` row is product 107 itself, now soft-deleted (`deletedAt` set) — consistent with how every other field is preserved-but-hidden on soft delete in this codebase; no live/visible product carries test data.

## Outcome

- Step 13 status: **PASS**
- Blocking issues: none (the stale-Prisma-Client container issue and the pre-existing seed FK error were both diagnosed, worked around, and confirmed not to affect data integrity)
