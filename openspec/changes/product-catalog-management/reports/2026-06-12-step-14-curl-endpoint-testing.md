# Step 14 — Curl Endpoint Testing Report
**Date:** 2026-06-12  
**Change:** product-catalog-management  
**Server:** `npm run dev` on `http://localhost:3000`

## Test Results

| # | Test | Expected | Actual | Status |
|---|------|----------|--------|--------|
| 14.2 | GET /api/admin/products | 200 `{items:[],total:0}` | 200 `{items:[],total:0,page:1,pageSize:20}` | PASS |
| 14.3 | POST /api/admin/products `{name:"Summer Dress",...}` | 201 + slug auto-gen | 201 `slug:"summer-dress"` | PASS |
| 14.4 | POST /api/admin/products `{}` (no name) | 400 VALIDATION_ERROR | 400 `VALIDATION_ERROR` | PASS |
| 14.5 | GET /api/admin/products/1 | 200 product | 200 `{id:1,name:"Summer Dress",...}` | PASS |
| 14.6 | GET /api/admin/products/9999 | 404 PRODUCT_NOT_FOUND | 404 `PRODUCT_NOT_FOUND` | PASS |
| 14.7 | PATCH /api/admin/products/1 `{status:"Active"}` (no variants) | 422 PRODUCT_REQUIRES_ACTIVE_VARIANT | 422 `PRODUCT_REQUIRES_ACTIVE_VARIANT` | PASS |
| 14.8 | POST /api/admin/products/1/variants `{sku:"DRESS-RED-S",...}` | 201 | 201 variant with no supplier fields | PASS |
| 14.9 | POST /api/admin/products/1/variants (duplicate SKU) | 409 VARIANT_SKU_CONFLICT | 409 `VARIANT_SKU_CONFLICT` | PASS |
| 14.10 | GET /api/admin/products/1/variants — supplier leak check | supplierId/supplierReference/supplierCost absent | All 3 fields absent | PASS |
| 14.11 | PATCH /api/admin/products/1 `{status:"Active"}` (has active variant) | 200 `status:"Active"` | 200 `status:"Active"` | PASS |
| 14.12 | DELETE /api/admin/products/1/variants/1 | 204 | 204 | PASS |
| 14.13 | POST /api/admin/products/1/images `{url:"..."}` | 201 | 201 | PASS |
| 14.14 | DELETE /api/admin/products/1/images/1 | 204 (hard-delete) | 204 | PASS |
| 14.15 | DELETE /api/admin/products/1 | 204 (soft-delete) | 204 | PASS |
| 14.15b | GET /api/admin/products after soft-delete | product NOT in list | `{items:[],total:0}` | PASS |

## Supplier Field Leak Prevention — Live Verification

Variant response body from `GET /api/admin/products/1/variants`:

```json
{
  "success": true,
  "data": [{
    "id": 1, "productId": 1, "sku": "DRESS-RED-S",
    "size": "S", "color": "Red", "publicPrice": 29.99,
    "compareAtPrice": null, "stockPolicy": "SupplierManaged",
    "status": "Active", "deletedAt": null,
    "createdAt": "2026-06-12T12:42:56.041Z",
    "updatedAt": "2026-06-12T12:42:56.041Z"
  }]
}
```

Fields `supplierId`, `supplierReference`, `supplierCost` — **ABSENT** from live API response. ✓

## Soft-Delete Verification

- `DELETE /api/admin/products/1` → 204 (sets `deletedAt = now()`, does NOT delete row)
- Subsequent `GET /api/admin/products` → `items: [], total: 0` (soft-deleted product excluded)

## Database State After Tests

All test data cleaned up via API DELETE calls during testing sequence.

| Table          | Row Count Post-Test |
|----------------|---------------------|
| Product        | 0 (soft-deleted)    |
| ProductVariant | 0 (soft-deleted)    |
| ProductImage   | 0 (hard-deleted)    |

## Result: 15/15 tests PASS ✓
