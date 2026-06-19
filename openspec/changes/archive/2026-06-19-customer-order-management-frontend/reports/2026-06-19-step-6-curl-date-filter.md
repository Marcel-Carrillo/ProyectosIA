# Step 6 — curl date-filter verification

**Change:** customer-order-management-frontend  
**Date:** 2026-06-19  
**Base URL:** `http://localhost:3000`

## Request

```
GET /api/admin/customer-orders?createdFrom=2026-06-01&createdTo=2026-06-30&pageSize=5
Authorization: Bearer <admin token>
```

## Result

| Check | Expected | Actual |
|-------|----------|--------|
| Status | 200 | 200 |
| Envelope | `{ success, data: { items, total, page, pageSize } }` | ✓ |
| Filter | Orders within June 2026 UTC range | ✓ (101 total on test DB for range) |

## Notes

- `docs/api-spec.yml` updated with `createdFrom` / `createdTo` query parameters.
- Backend filters `createdAt` with inclusive UTC day bounds.
