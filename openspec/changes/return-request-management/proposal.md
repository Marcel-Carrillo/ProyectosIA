## Why

There is no way to register or track customer return (RMA) requests. `ReturnRequest` and `ReturnRequestsPage` exist only as stubs, so the post-sale chain (order → return → refund) is not auditable and `Refund.returnRequestId` references a non-existent entity. This change closes that gap by introducing the full `ReturnRequest` persistence layer for admin use.

## What Changes

- Introduce `ReturnRequest` model in the database with a validated state machine (`Requested` → `Approved`/`Rejected` → `Received` → `Refunded`/`Cancelled`).
- Add admin REST API `/api/admin/return-requests` (list, create, detail, status transition) behind `requireAdminAuth`.
- Wire the deferred FK: convert `Refund.returnRequestId Int?` into a real optional relation to `ReturnRequest` (closes the "until KAN-25" deferral in `data-model.md` §14).
- Replace `returnRequestService.ts` and `ReturnRequestsPage.tsx` stubs with real implementations.
- Add `ReturnRequestDetailPage`, approve/reject/receive status controls, and a "Create return" action per item in the customer order detail.
- Fix `api-spec.yml`: correct the route from the public `/return-requests` to the admin-protected `/api/admin/return-requests`, and add missing `GET /{id}` and `PATCH /{id}/status` operations.

## Capabilities

### New Capabilities

- `return-request-management`: Admin CRUD-light for RMA lifecycle — create, list (filterable by `customerOrderId` and `status`), view detail, and advance through a strict state machine. Includes frontend list page, detail page, status action controls, and a link from the customer order detail.

### Modified Capabilities

- `refund-management`: `Refund.returnRequestId` gains a real database foreign key relation to `ReturnRequest`. No requirement changes to the refund workflow itself; this is a schema-level constraint addition that closes the documented deferral.
- `customer-order-management`: Customer order detail gains a per-item "Create return request" action and a link to the order's return requests list. This is an additive UI change that extends the existing capability.

## Impact

- **Database:** new `ReturnRequest` table + indexes; new FK constraint on `Refund.returnRequestId`. Migration must be safe over existing `Refund` rows (field stays nullable).
- **Backend:** new domain model, repository interface, Prisma repository, service, controller, serializer, and router; `index.ts` updated to mount the new router; `validator.ts` updated.
- **Frontend:** `returnRequestService.ts` and `ReturnRequestsPage.tsx` stubs replaced; new `ReturnRequestDetailPage.tsx`, `ReturnRequestStatusControl.tsx`, and `useReturnRequests.ts`; `CustomerOrderDetailPage.tsx` extended.
- **Docs:** `docs/api-spec.yml` corrected and extended; `docs/data-model.md` §13–§14 updated.
- **No customer-facing APIs affected** — all new endpoints are admin-only under `/api/admin/return-requests`.
- **No supplier data exposure** — `ReturnRequest` contains no supplier cost, references, or internal fulfillment notes.

## Non-goals

- Customer self-service return portal (storefront).
- Return shipping label generation.
- Automatic `Refund` creation when a return reaches `Received`.
- Partial-unit returns (MVP is per-item without `quantity` field).
