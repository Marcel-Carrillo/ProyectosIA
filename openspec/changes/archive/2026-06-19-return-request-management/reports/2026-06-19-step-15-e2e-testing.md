# E2E Playwright Test Report — return-request-management

Date: 2026-06-19

## Environment

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Tool: Playwright MCP

## Test scenarios

### 15.1 — Servers running

Both servers started and verified: backend 200, frontend 200. ✓

### 15.2 — Return Requests list page loads (no "Coming soon")

Navigated to `/return-requests`. Page showed:
- Heading "Return Requests"
- Filter controls: status combobox (7 options) and order ID input
- Table with columns: ID, Order ID, Item ID, Status, Reason, Requested, (actions)
- Existing rows from curl test visible with correct data

Result: **PASS** ✓

### 15.3 — Return Request detail page

Clicked "View" on return request #2. Page showed:
- Heading "Return Request #2"
- Status badge: Requested
- Details card with all fields (Customer Order link, Order Item ID, Reason, Requested At, Approved At —, Rejected At —, Received At —, Created)
- Update Status card with status control select (options: Approved, Rejected, Cancelled)

Result: **PASS** ✓

### 15.4 — Status update: Requested → Approved

Selected "Approved" in the status control and clicked "Update status".
- Status badge updated to "Approved"
- `approvedAt` field filled with current timestamp
- Status select now shows: Received, Cancelled (no Rejected — correct per state machine)

Result: **PASS** ✓

### 15.5 — Status update: Approved → Received

Selected "Received" and saved.
- Status badge updated to "Received"
- Status select now shows only "Cancelled" (Refunded omitted — correct per design decision 3)

Result: **PASS** ✓

### 15.6 — CustomerOrderDetailPage: Create Return button per item

Navigated to `/customer-orders/66` (order status: PendingPayment — not Cancelled).
- Line items table showed extra "Create Return" column header
- Each row had a "Create Return" button

Result: **PASS** ✓

### 15.7 — Create Return modal

Clicked "Create Return" on item #65 (EJS-42 shoe).
- Modal opened with title "Create Return Request"
- Item name and SKU pre-shown in info box
- "Create return request" button disabled until reason typed
- Typed reason: "Product received in poor condition - packaging damaged"
- Button enabled, clicked submit
- Modal closed, new row (#3, Requested) appeared at top of Return Requests section immediately

Result: **PASS** ✓

### 15.8 — Return Requests section in order detail

The Return Requests card showed:
- All 3 return requests for order #66
- "View all for this order" link pointing to `/return-requests?customerOrderId=66`
- Each row with ID, Item ID, Status badge, Reason, Requested date, View link

Result: **PASS** ✓

## Data created during E2E

| ID | Status at end | Notes |
|----|--------------|-------|
| 2 | Received | Used for status transition tests |
| 3 | Requested | Created via UI modal test |

(Return requests #1 and #2 were created during curl tests. #3 created during E2E.)

## Result: PASS — all 8 scenarios passed
