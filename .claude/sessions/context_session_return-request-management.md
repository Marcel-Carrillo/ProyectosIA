# Context Session: return-request-management (KAN-25)

## Change Overview
Admin RMA lifecycle management — full vertical slice for `ReturnRequest` entity.

## Key Artifacts
- Proposal: `openspec/changes/return-request-management/proposal.md`
- Design: `openspec/changes/return-request-management/design.md`
- Specs:
  - `openspec/changes/return-request-management/specs/return-request-management/spec.md`
  - `openspec/changes/return-request-management/specs/refund-management/spec.md`
  - `openspec/changes/return-request-management/specs/customer-order-management/spec.md`
- Tasks: `openspec/changes/return-request-management/tasks.md`

## Critical Design Decisions
1. Mirror `refunds`/`shipments` vertical-slice pattern exactly (file names, layer structure)
2. Mount under `/api/admin/return-requests` (not public) — fixes api-spec.yml error
3. `Refund.returnRequestId Int?` → real optional FK relation to `ReturnRequest`
4. State machine: `Requested → Approved|Rejected|Cancelled`, `Approved → Received|Cancelled`, `Received → Refunded|Cancelled`
5. `Refunded` is API-valid but hidden in UI (reserved for KAN-20)
6. All validations in `prisma.$transaction` for atomicity

## Reference Patterns to Follow
- Backend model: `backend/src/domain/models/refund.ts`
- Backend repo interface: `backend/src/domain/repositories/refundRepository.ts`
- Backend Prisma repo: `backend/src/infrastructure/repositories/refundRepository.ts`
- Backend service: `backend/src/application/services/refundService.ts`
- Backend validator: `backend/src/application/validator.ts` (existing — add to it)
- Backend controller: `backend/src/presentation/controllers/refundController.ts`
- Backend serializer: `backend/src/presentation/serializers/refundSerializer.ts`
- Backend routes: `backend/src/routes/admin/refundRoutes.ts`
- Backend index mount: `backend/src/index.ts`
- Frontend service: `frontend/src/services/refundService.ts`
- Frontend hook: `frontend/src/hooks/useRefunds.ts`
- Frontend page: `frontend/src/pages/RefundsPage.tsx`
- Frontend detail: `frontend/src/pages/RefundDetailPage.tsx`
- Frontend status control: `frontend/src/components/admin/RefundStatusControl.tsx`
- Frontend App.tsx: routes already in place for list; detail route needs adding

## Error Codes
- `RETURN_REQUEST_NOT_FOUND` (404)
- `CUSTOMER_ORDER_NOT_FOUND` (404)
- `CUSTOMER_ORDER_ITEM_NOT_FOUND` (404)
- `RETURN_REQUEST_ORDER_CANCELLED` (409)
- `RETURN_REQUEST_ITEM_MISMATCH` (422)
- `RETURN_REQUEST_TRANSITION_INVALID` (409)
- `VALIDATION_ERROR` (400)

## Timestamp Fields by Transition
- `→ Approved`: set `approvedAt`
- `→ Rejected`: set `rejectedAt`
- `→ Received`: set `receivedAt`
