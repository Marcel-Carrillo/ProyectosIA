# Step 12 Report — Manual Endpoint Testing (curl)

- **Date:** 2026-06-17
- **Change:** supplier-management
- **Agent:** Auto (Cursor)

## Environment

- Backend: `http://localhost:3000` (running)
- Database: PostgreSQL via Docker (`ecommerce-db`, port 5432)
- Pre-test Supplier count: **1** (leftover from prior session)
- Post-test Supplier count: **0** (restored via SQL cleanup)

## Database Baseline (12.1)

| Table | Pre-test | Post-test |
|---|---|---|
| Supplier | 1 | 0 |

Cleanup: removed curl-created supplier (id=2) and prior `Curl Test Supplier%` rows via `prisma db execute`.

---

## 12.2 GET Endpoints

### List suppliers
```bash
curl -s "http://localhost:3000/api/admin/suppliers"
```
- **Status:** 200
- **Envelope:** `{ success: true, data: { items, total, page, pageSize }, message }` ✓

### Search + status filter
```bash
curl -s "http://localhost:3000/api/admin/suppliers?search=Curl&status=Active"
```
- **Status:** 200 ✓

### pageSize clamp
```bash
curl -s "http://localhost:3000/api/admin/suppliers?pageSize=999"
```
- **Status:** 200, `data.pageSize` = **100** ✓

### GET by id
```bash
curl -s "http://localhost:3000/api/admin/suppliers/2"
```
- **Status:** 200, returns created supplier ✓

### Invalid id (non-numeric)
```bash
curl -s "http://localhost:3000/api/admin/suppliers/abc"
```
- **Status:** 400 ✓

### Not found
```bash
curl -s "http://localhost:3000/api/admin/suppliers/99999"
```
- **Status:** 404 ✓

---

## 12.3 POST Create

```bash
curl -s -X POST "http://localhost:3000/api/admin/suppliers" \
  -H "Content-Type: application/json" \
  -d '{"name":"Curl Test Supplier","contactName":"Test User","contactEmail":"test@curl.com","contactPhone":"123456","status":"Active"}'
```
- **Status:** 201
- **Body:** `{ success: true, data: { id: 2, name, status: "Active", ... } }` ✓
- **Cleanup:** hard-deleted test row via SQL (no hard-delete API)

---

## 12.4 PATCH Update

```bash
curl -s -X PATCH "http://localhost:3000/api/admin/suppliers/2" \
  -H "Content-Type: application/json" \
  -d '{"status":"Blocked","notes":"curl patch test"}'
```
- **Status:** 200, `data.status` = **Blocked** ✓
- **Revert:** PATCH restored original `status` and `notes` ✓

---

## 12.5 DELETE Soft-delete

```bash
curl -s -X DELETE "http://localhost:3000/api/admin/suppliers/2"
```
- **Status:** 200 (not 204)
- **Body:** `data.status` = **Inactive**, row preserved ✓
- **Restore:** PATCH set status back to `Active` before SQL cleanup ✓

---

## 12.6 Error Cases

| Case | Command | Status | Result |
|---|---|---|---|
| Missing name | POST `{}` | 400 | ✓ |
| Invalid email | POST `{ name, contactEmail: "not-an-email" }` | 400 | ✓ |
| Invalid status | POST `{ name, status: "Deleted" }` | 400 | ✓ |
| Not found id | GET `/99999` | 404 | ✓ |

---

## 12.7 Security / Isolation

### No public suppliers route
```bash
curl -s "http://localhost:3000/api/public/suppliers"
```
- **Status:** 404 (route does not exist) ✓

### Public products omit supplier fields
```bash
curl -s "http://localhost:3000/api/public/products?pageSize=1"
```
- **Result:** Response JSON contains **no** `supplierId`, `supplierReference`, or `supplierCost` ✓

---

## 12.8 Database Restoration

- Final Supplier count: **0** (matches step-11 baseline)
- All curl-created data removed

## Outcome

- **Step 12 status:** PASS
- **Blocking issues:** none
