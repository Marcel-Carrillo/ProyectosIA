## Why

Administrators have no way to record or track refunds — money returned to customers happens outside the system with no traceability or link to the originating order. This closes the financial lifecycle of an order by enabling admins to register total or partial refunds, control their status, and keep `CustomerOrder.paymentStatus` consistent (`Paid` → `PartiallyRefunded` → `Refunded`).

## What Changes

- Add `Refund` Prisma model + database migration (model does not yet exist in `backend/prisma/schema.prisma`).
- Add `refunds` relation to `CustomerOrder` model in Prisma schema.
- Implement four admin endpoints under `/api/admin/refunds`: list with filters, create, get by ID, and update status.
- Enforce amount validation: `amount ≤ CustomerOrder.totalAmount − Σ refunds[Completed, Processing]` inside a Prisma transaction to prevent race conditions.
- Implement refund state machine: `Pending → {Processing, Cancelled}`, `Processing → {Completed, Failed, Cancelled}`; terminals are `Completed`, `Failed`, `Cancelled`; `processedAt` is set when entering `Completed`.
- Synchronize `CustomerOrder.paymentStatus` on every refund create/status-change: `Paid → PartiallyRefunded → Refunded` based on sum of completed refunds.
- Replace the `RefundsPage` frontend stub ("Coming soon") with a functional admin page: table/cards with filters, detail view, and create-from-order flow.
- Update `docs/api-spec.yml`: relocate `/refunds` → `/api/admin/refunds`, add `GET /:id` and `PATCH /:id/status` endpoints, add `paymentProviderReference` to `CreateRefundRequest`, add state transition body schema.
- Update `docs/data-model.md` §14 to reflect confirmed field constraints and state machine.

**Non-goals:**
- Real payment gateway integration (`paymentProviderReference` is set manually/offline in MVP).
- Automatic refunds without admin intervention.
- Customer-facing refund history UI.
- Refund creation from a return request (`returnRequestId` is supported as nullable FK but the `ReturnRequest` model does not yet exist — KAN-25 delivers it separately).

## Capabilities

### New Capabilities

- `refund-management`: Admin CRUD for refunds under `/api/admin/refunds` — list with pagination and filters (`customerOrderId`, `status`), create total/partial refund, get by ID, advance state machine. Includes amount validation, `paymentStatus` sync on `CustomerOrder`, and the full admin UI (`RefundsPage`, `RefundDetailPage`, `RefundStatusControl`).

### Modified Capabilities

- `customer-order-management`: `paymentStatus` field on `CustomerOrder` gains two new computed transitions (`PartiallyRefunded`, `Refunded`) driven by refund lifecycle events. The detail page gains a "Create Refund" action button.

## Impact

**Backend:**
- `backend/prisma/schema.prisma` — new `Refund` model, `refunds` relation on `CustomerOrder`, new migration.
- New files: domain model, repository interface + Prisma implementation, service, controller, admin router.
- `backend/src/index.ts` — register refund admin routes.

**Frontend:**
- `frontend/src/pages/RefundsPage.tsx` — replace stub with functional page.
- New files: `RefundDetailPage.tsx`, `RefundStatusControl.tsx`, `refundService.ts`, `refund.ts` types, React Query hooks.
- `frontend/src/App.tsx` — add `/admin/refunds/:id` route; add "Create Refund" button in `CustomerOrderDetailPage`.

**Docs:**
- `docs/api-spec.yml` — update `/refunds` path and add missing endpoints/schemas.
- `docs/data-model.md` — confirm §14 state machine and field constraints.

**Dependencies:**
- KAN-18 (customer order management) — required, already delivered.
- KAN-25 (return request management) — optional; `returnRequestId` is nullable; the create-from-return UI is gated on KAN-25 availability.
