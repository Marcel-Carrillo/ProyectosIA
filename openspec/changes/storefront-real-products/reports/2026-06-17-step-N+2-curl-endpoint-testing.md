# Step N+2 Report - Manual Endpoint Testing with curl

- Date: 2026-06-17
- Change: storefront-real-products
- Agent: Claude (claude-opus-4-8)
- Backend: `npm run dev` on http://localhost:3000 (worktree), DB `ecommerce-db` up with imported catalog.

All endpoints under test are **GET (read-only)** — no CREATE/UPDATE/DELETE, so no database state mutation or restoration was required.

## Commands Executed and Results

1. `GET /api/public/products?pageSize=3` → **200**. Envelope `{success, data:{items,total,page,pageSize}, message}`. total=28, only `status=Active`. Item keys = allow-list (id, name, slug, description, brand, mainImageUrl, categoryId, images, variants, status, createdAt, updatedAt). Variant keys = `id, sku, size, color, publicPrice, compareAtPrice, status`.

2. `GET /api/public/products?status=Draft&pageSize=50` → **200**. Client `status=Draft` **ignored**; all returned items `Active`.

3. `GET /api/public/products?pageSize=500` → **200**. `pageSize` clamped to **100**.

4. `GET /api/public/products/5` → **200**. Active product; 1 variant; 3 images ordered by `sortOrder` = [0,1,2].

5. `GET /api/public/products/999999` → **404**, `error.code = PRODUCT_NOT_FOUND`.

6. `GET /api/public/products/abc` → **400**, `error.code = VALIDATION_ERROR`.

7. `GET /api/public/categories` → **200**. 5 active categories: Accessories, Electronics, Furniture, Shoes, Women.

8. `GET /api/public/products?search=sleek&sort=name&order=asc&pageSize=5` → **200**. total match=9; names returned in ascending order (verified sorted).

9. `GET /api/public/products?categoryId=4&pageSize=50` → **200**. 10 items, all `categoryId=4` (Electronics).

10. **Security assertion**: `grep -iE "supplierId|supplierReference|supplierCost|deletedAt"` over the full list payload (pageSize=100) and the detail payload (id=5) → **no matches** (empty). No supplier/internal fields exposed.

## Database State Verification

- Operations were read-only; pre/post DB counts unchanged (29 / 33 / 6 / 78).
- State restored: N/A (no mutations).

## Outcome

- Step N+2 status: PASS
- Blocking issues: none
