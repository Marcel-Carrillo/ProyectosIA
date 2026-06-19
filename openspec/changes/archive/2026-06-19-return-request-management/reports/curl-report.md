# Curl Test Report — return-request-management

Date: 2026-06-19

## Endpoints tested

| Method | Path | Scenario | Expected | Actual |
|--------|------|----------|----------|--------|
| GET | `/api/admin/return-requests` (no auth) | Unauthorized | 401 | 401 ✓ |
| GET | `/api/admin/return-requests` | List (empty) | 200 | 200 ✓ |
| GET | `/api/admin/return-requests/9999` | Not found | 404 | 404 ✓ |
| POST | `/api/admin/return-requests` | Create (valid) | 201 | 201 ✓ |
| POST | `/api/admin/return-requests` | Missing reason | 400 | 400 ✓ |
| POST | `/api/admin/return-requests` | Order not found | 404 | 404 ✓ |
| POST | `/api/admin/return-requests` | Item not found | 404 | 404 ✓ |
| GET | `/api/admin/return-requests/1` | Get by ID | 200 | 200 ✓ |
| PATCH | `/api/admin/return-requests/1/status` | Requested → Approved | 200 | 200 ✓ |
| PATCH | `/api/admin/return-requests/1/status` | Approved → Rejected (invalid) | 409 | 409 ✓ |
| PATCH | `/api/admin/return-requests/1/status` | Approved → Received | 200 | 200 ✓ |
| PATCH | `/api/admin/return-requests/1/status` | Received → Cancelled | 200 | 200 ✓ |
| PATCH | `/api/admin/return-requests/1/status` | Cancelled → Approved (terminal) | 409 | 409 ✓ |

## Key validations

- **`approvedAt`** is set when transitioning to `Approved` ✓
- **`receivedAt`** is set when transitioning to `Received` ✓
- **Timestamps** for non-matching targets remain `null` ✓
- **`status`** field in response reflects new value ✓
- **Error codes** match spec: `RETURN_REQUEST_NOT_FOUND`, `RETURN_REQUEST_TRANSITION_INVALID`, `VALIDATION_ERROR`, `CUSTOMER_ORDER_NOT_FOUND`, `CUSTOMER_ORDER_ITEM_NOT_FOUND` ✓

## Result: PASS
