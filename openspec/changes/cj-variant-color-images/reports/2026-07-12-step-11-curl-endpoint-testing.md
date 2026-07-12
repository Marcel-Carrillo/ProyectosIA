# Step 11 Report - Manual Endpoint Testing with curl

- Date: 2026-07-12
- Change: cj-variant-color-images
- Agent: claude (Sonnet 5)

## Environment note (important finding)

The `ecommerce-backend` Docker container does **not** hot-reload on Prisma schema changes: `docker-compose.yml` only bind-mounts `./backend/src`, not `./backend/prisma`, and the container's `node_modules` (including the generated Prisma Client) lives in a separate named volume (`backend_node_modules`) decoupled from the host. After running `npx prisma migrate dev` on the host, the container's own `prisma/schema.prisma` was stale and its generated client had no `color` field, causing the first promotion attempt to fail with `PrismaClientValidationError: Unknown argument 'color'`. Fixed by `docker cp`-ing the updated `schema.prisma` into the container, running `npx prisma generate` inside the container, then `docker restart ecommerce-backend`. No transactional data was left behind by the failed attempts (promotion is wrapped in `prisma.$transaction`, confirmed no partial `Product` row existed after each failed call).

## Pre-test baseline

```
docker exec ecommerce-db psql -U ecommerceUser -d ecommerceDb -c "SELECT count(*) FROM \"Product\"..."
```
`Product: 12, ProductVariant: 24, ProductImage: 25, CjCatalogItem: 0`

Backend health: `curl http://localhost:3000/health` → `{"status":"ok","db":"up"}`.

## 11.2 — Promotion with a multi-color group

No staged `CjCatalogItem` fixture existed in the dev DB (0 rows). Inserted two rows directly via `psql` sharing `pid = 'e2e-test-pid'`, distinct colors (`Black` / `Red`), each with a distinct `variantImage` and a shared `bigImage`, mirroring CJ's real `rawPayload` shape:

```sql
INSERT INTO "CjCatalogItem" (..., "rawPayload", ...) VALUES
(22, 'e2e-test-vid-black', 'e2e-test-pid', ..., '{"product":{"bigImage":"https://picsum.photos/seed/e2emain/400/600"},"variant":{"variantImage":"https://picsum.photos/seed/e2eblack/400/600","variantKey":"Black-M"}}', ...),
(22, 'e2e-test-vid-red',   'e2e-test-pid', ..., '{"product":{"bigImage":"https://picsum.photos/seed/e2emain/400/600"},"variant":{"variantImage":"https://picsum.photos/seed/e2ered/400/600","variantKey":"Red-M"}}', ...);
```

```bash
curl -X POST http://localhost:3000/api/admin/suppliers/71/cj/catalog/promote \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"categoryId": 1, "activate": true, "items": [{"cjCatalogItemId": 4001, "publicPrice": 39.99}, {"cjCatalogItemId": 4002, "publicPrice": 39.99}]}'
```
Response: `201`-equivalent success envelope, `productId: 140`, two variants created.

Verified via psql:
```sql
SELECT id, url, "sortOrder", color FROM "ProductImage" WHERE "productId" = 140 ORDER BY "sortOrder";
```
```
 1814 | .../e2emain/...  | 0 | (null)
 1815 | .../e2eblack/... | 1 | Black
 1816 | .../e2ered/...   | 2 | Red
```
Exactly matches expectation: product-level image `color = null`, each variant image tagged with its derived color.

## 11.3 — Admin image create/update with color

```bash
curl -X POST http://localhost:3000/api/admin/products/140/images \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url": "https://picsum.photos/seed/e2etest-black/400/600", "color": "Black"}'
```
→ `201`, `data.color === "Black"`.

```bash
curl -X PATCH http://localhost:3000/api/admin/products/140/images/1817 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"color": "Red"}'
```
→ `200`, `data.color === "Red"`.

## 11.4 — Public API

```bash
curl http://localhost:3000/api/public/products/140
```
Every entry in `images[]` includes a `color` key (`null` or a string). Grepped the raw response for `supplierCost|supplierReference|supplierId|rawPayload`: no matches. A grep for `vid` matched only inside the test fixture's own SKU strings (`CJ-e2e-test-vid-black`, from the `externalRef` I chose for the fixture) — not a real CJ-internal field leak, confirmed by inspecting the match context.

## 11.5 — Backfill script (dev DB)

```bash
DATABASE_URL="postgresql://ecommerceUser:ecommercePassword@localhost:5432/ecommerceDb" \
  npx ts-node --transpile-only scripts/backfillCjImageColors.ts
```
First run: `processed=2 imagesUpdated=0 skipped=0` (nothing to backfill — the promotion flow had already set colors correctly). To positively verify the backfill's write path, temporarily nulled `color` on images 1815/1816 via `psql`, re-ran:
```
[backfill-cj-image-colors] progress: 2/2
[backfill-cj-image-colors] done. processed=2 imagesUpdated=2 skipped=0
```
Verified via psql: both rows correctly restored to `Black`/`Red`. Ran a third time to confirm idempotence: `imagesUpdated=0 skipped=0`.

## 11.6 — Restoration

- Deleted the admin-created test image (`DELETE /api/admin/products/140/images/1817` → `204`).
- Deleted all fixture rows via `psql`: `ProductImage` (productId=140), `ProductVariant` (productId=140), `Product` (id=140), `CjCatalogItem` (ids 4001, 4002).
- Post-cleanup counts: `Product: 12, ProductVariant: 24, ProductImage: 25, CjCatalogItem: 0` — identical to the pre-test baseline.

## Outcome

- Step 11 status: PASS
- Blocking issues: none (the Docker container Prisma-client staleness was a local dev-environment quirk, not a code defect — documented above for future sessions)
