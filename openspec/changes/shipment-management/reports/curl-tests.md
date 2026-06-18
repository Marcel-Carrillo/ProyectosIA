# Manual Curl Tests Report — shipment-management

Date: 2026-06-18

All tests run against `http://localhost:3000` with admin token obtained via `POST /api/admin/auth/login`.

## Results

| # | Endpoint | Payload | Expected | Actual | Status |
|---|----------|---------|----------|--------|--------|
| 1 | `GET /api/admin/shipments` | — | 200, empty list | `success: true, total: 0` | ✅ |
| 2 | `POST /api/admin/shipments` | `{}` | 422 VALIDATION_ERROR | `VALIDATION_ERROR` | ✅ |
| 3 | `POST /api/admin/shipments` | valid customerOrderId + carrier + trackingNumber | 201, status=Pending | `status: Pending, id: 1` | ✅ |
| 4 | `GET /api/admin/shipments/1` | — | 200, shipment detail | carrier=DHL, trackingNumber=TEST-TRK-001 | ✅ |
| 5 | `PATCH /api/admin/shipments/1/status` | `{"status":"Shipped"}` | 200, shippedAt set | `status: Shipped, shippedAt ≠ null` | ✅ |
| 6 | `PATCH /api/admin/shipments/1/status` | `{"status":"Pending"}` | 400 SHIPMENT_STATUS_TRANSITION_INVALID | `SHIPMENT_STATUS_TRANSITION_INVALID` | ✅ |
| 7 | `GET /api/admin/shipments?status=Shipped` | — | 200, 1 result | `total: 1` | ✅ |
| 8 | `GET /api/admin/shipments/999999` | — | 404 SHIPMENT_NOT_FOUND | `SHIPMENT_NOT_FOUND` | ✅ |

## 8/8 tests passed ✅
