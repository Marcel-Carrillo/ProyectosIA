# Refund Endpoints — curl Test Report
Date: 2026-06-18

## Setup
- Order 48 payment status set to `Paid` for testing
- Refund table confirmed present in DB with correct columns

## Results

| # | Endpoint | Input | Expected | Result | Status |
|---|----------|-------|----------|--------|--------|
| 1 | GET /api/admin/refunds | — | success, total=0 | success: true, total: 0 | ✅ |
| 2 | POST /api/admin/refunds | orderId=48, amount=10 | 201, status=Pending | id=1, status: Pending | ✅ |
| 3 | GET /api/admin/refunds/1 | — | success, id=1 | success: true, id: 1 | ✅ |
| 4 | GET /api/admin/refunds?customerOrderId=48 | — | total=1 | total: 1 | ✅ |
| 5 | PATCH /api/admin/refunds/1/status | Pending→Processing | status=Processing | status: Processing | ✅ |
| 6 | PATCH /api/admin/refunds/1/status | Processing→Completed | status=Completed, processedAt set | Completed, processedAt=2026-06-18T16:20:16.529Z | ✅ |
| 7 | GET /api/admin/customer-orders/48 | — | paymentStatus=PartiallyRefunded | paymentStatus: PartiallyRefunded | ✅ |
| 8 | PATCH /api/admin/refunds/1/status | Completed→Cancelled (invalid) | 422 REFUND_TRANSITION_INVALID | 422, code: REFUND_TRANSITION_INVALID | ✅ |
| 9 | POST /api/admin/refunds | orderId=47 (Pending) | 409 REFUND_ORDER_NOT_PAID | 409, code: REFUND_ORDER_NOT_PAID | ✅ |
| 10 | POST /api/admin/refunds | orderId=48, amount=999 (>balance) | 409 REFUND_AMOUNT_EXCEEDS_BALANCE | 409, code: REFUND_AMOUNT_EXCEEDS_BALANCE | ✅ |
| 11 | GET /api/admin/refunds/9999 | — | 404 REFUND_NOT_FOUND | 404, code: REFUND_NOT_FOUND | ✅ |

## DB Cleanup
- Refund id=1 deleted
- Order 48 paymentStatus reset to Pending

## Summary
11/11 tests passed ✅
