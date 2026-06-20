# Session Context: refund-management (KAN-20)

## Change Summary
Add admin refund CRUD with state machine and paymentStatus sync. Closes the financial lifecycle of a customer order.

## Key Artifacts
- Proposal: openspec/changes/refund-management/proposal.md
- Design: openspec/changes/refund-management/design.md
- Specs: openspec/changes/refund-management/specs/refund-management/spec.md
         openspec/changes/refund-management/specs/customer-order-management/spec.md
- Tasks: openspec/changes/refund-management/tasks.md

## Branch
feature/KAN-20-refund-management (current branch, already created)

## Key Decisions from design.md
- Amount validation + paymentStatus update inside single Prisma transaction (race condition safety)
- returnRequestId: nullable Int, NO FK constraint until KAN-25
- DDD layered pattern: domain model → repository interface → Prisma repo → service → controller → routes
- API path: /api/admin/refunds (NOT /refunds)
- paymentStatus sync: Completed refunds sum → Refunded if equals totalAmount, PartiallyRefunded if > 0
- NO requireAdminAuth middleware (does not exist in codebase — other admin routes also don't use it)

## Refund State Machine
- Pending → Processing, Pending → Cancelled
- Processing → Completed, Processing → Failed, Processing → Cancelled
- Completed/Failed/Cancelled are terminals

## Critical Notes
- No admin auth middleware exists in codebase — skip requireAdminAuth in routes
- Decimal.js (bundled with Prisma) for all arithmetic in service
- processedAt set when transitioning to Completed
- CustomerOrder model: add refunds Refund[] relation

## Backend Files to Create/Modify
- backend/prisma/schema.prisma (add Refund model, CustomerOrder.refunds relation)
- backend/src/domain/models/refund.ts (Refund type, RefundStatus enum, REFUND_TRANSITIONS, isValidRefundTransition)
- backend/src/domain/repositories/refundRepository.ts (interface)
- backend/src/infrastructure/repositories/refundRepository.ts (Prisma implementation)
- backend/src/application/services/refundService.ts
- backend/src/presentation/validators/refundValidators.ts (Zod schemas)
- backend/src/presentation/controllers/refundController.ts
- backend/src/routes/admin/refundRoutes.ts
- backend/src/index.ts (register route)
- backend/src/middleware/errorHandler.ts (add new error classes)
- Tests: __tests__ for repository, service, controller

## Frontend Files to Create/Modify
- frontend/src/types/refund.ts (new)
- frontend/src/services/refundService.ts (replace stub)
- frontend/src/hooks/useRefunds.ts (new, React Query hooks)
- frontend/src/pages/RefundsPage.tsx (replace stub)
- frontend/src/pages/RefundDetailPage.tsx (new)
- frontend/src/pages/RefundCreatePage.tsx or modal (new)
- frontend/src/components/admin/RefundStatusControl.tsx (new)
- frontend/src/App.tsx (add refunds/:id route)
- frontend/src/pages/CustomerOrderDetailPage.tsx (add Create Refund button)

## Reference Patterns
- customerOrderRepository.ts — Prisma select patterns, error classes
- customerOrderService.ts — Decimal usage, service pattern
- customerOrderController.ts — handler pattern
- customerOrderRoutes.ts — route pattern
- SupplierOrderStatusControl.tsx — status control component pattern
- customerOrderService (frontend) — service pattern with axios
- customerOrder.ts (frontend types) — type pattern
