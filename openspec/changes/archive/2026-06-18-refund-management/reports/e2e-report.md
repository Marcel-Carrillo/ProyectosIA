# Refund Management — E2E Playwright Test Report
Date: 2026-06-18

## Setup
- Backend: http://localhost:3000 (confirmed healthy)
- Frontend: http://localhost:3001 (already running)
- Order 48 set to paymentStatus=Paid for testing

## Test Results

| # | Scenario | Expected | Result | Status |
|---|----------|----------|--------|--------|
| 12.1 | Servers running | Both respond | Backend /health OK, Frontend on port 3001 | ✅ |
| 12.2 | No auth required | Admin app loads | App loads without login (no auth system) | ✅ |
| 12.3 | RefundsPage renders | Table visible (not "Coming soon") | Table with columns ID/Order ID/Amount/Status/Reason/Created rendered | ✅ |
| 12.4 | Filter by status=Pending | URL updates, dropdown shows Pending | URL: /refunds?status=Pending, Pending selected | ✅ |
| 12.5 | "Create Refund" button visible on paid order | Button visible when paymentStatus=Paid | Button visible on order #48 (Paid) | ✅ |
| 12.6 | Create refund via modal | Modal opens, form fills, refund created with status=Pending | Refund #2 created: €15.00, status Pending, shown in table | ✅ |
| 12.7 | Advance to Processing via RefundStatusControl | Status updates to Processing | Status: Processing, transitions updated (Completed/Failed/Cancelled) | ✅ |
| 12.8 | Advance to Completed; processedAt shown | Status=Completed, processedAt rendered, order paymentStatus=PartiallyRefunded | processedAt: 18/6/2026 18:23:32; order badge shows PartiallyRefunded | ✅ |
| 12.9 | Submit amount > refundable balance | Error message displayed in modal | "The refund amount exceeds the available refundable balance." shown | ✅ |
| 12.10 | DB cleanup | All test refunds deleted, order reset | Refunds deleted, order 48 paymentStatus reset to Pending | ✅ |

## Summary
10/10 E2E scenarios passed ✅

No regressions observed in existing pages during navigation.
