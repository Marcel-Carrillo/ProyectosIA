## Why

KAN-28 is the backend subtask of KAN-18 (customer order management). Store administrators need a reliable admin API for `CustomerOrder` and `CustomerOrderItem` so they can list, inspect, create, and advance orders through independent `status`, `paymentStatus`, and `fulfillmentStatus` lifecycles — the commercial source of truth before supplier-order fulfillment (KAN-19).

The backend module was delivered on `master` as part of the archived full-stack change `customer-order-management` (PR #21), but the Jira subtask KAN-28 remains **Por hacer**. This OpenSpec change formalizes the KAN-28 backend slice, verifies delivery against the main spec, closes any gaps found during audit, and transitions the ticket to Done.

## What Changes

- Audit existing backend module (`CustomerOrder` / `CustomerOrderItem` Prisma models, repository, service, validator, controller, routes) against KAN-28 acceptance criteria and `openspec/specs/customer-order-management/spec.md`.
- Run mandatory verification (unit tests, curl against `/api/admin/customer-orders*`, DB state check) and produce reports under `openspec/changes/customer-order-management-backend/reports/`.
- Fix only gaps discovered during audit (expected: none or minor doc/test alignment).
- Transition Jira KAN-28 to **Finalizado** after verification passes.
- No frontend work (deferred to KAN-29). No supplier-order generation scope (KAN-19 — route may exist but is out of KAN-28 scope).

## Capabilities

### New Capabilities

<!-- None — backend requirements already captured in main spec. -->

### Modified Capabilities

<!-- No requirement changes expected. Verification-only against existing main spec. -->

## Impact

- **Affected domain concepts**: `CustomerOrder`, `CustomerOrderItem`; relationships to `Customer`, `ProductVariant`.
- **Surface**: Internal admin API only (`/api/admin/customer-orders`). No customer-facing behavior changes.
- **Order lifecycle**: Confirms three independent status dimensions remain separate from supplier-order, shipment, return, and refund status.
- **Supplier data exposure**: Reinforced — responses must never include `supplierId`, `supplierReference`, or `supplierCost`.
- **Code (audit targets)**: `backend/prisma/schema.prisma`, `backend/src/domain/models/customerOrder.ts`, `backend/src/domain/repositories/customerOrderRepository.ts`, `backend/src/infrastructure/repositories/customerOrderRepository.ts`, `backend/src/application/services/customerOrderService.ts`, `backend/src/application/validator.ts`, `backend/src/presentation/controllers/customerOrderController.ts`, `backend/src/routes/admin/customerOrderRoutes.ts`, related tests.
- **Docs**: `docs/api-spec.yml` and `docs/data-model.md` — update only if audit finds drift.

## Non-goals

- Frontend pages or `customerOrderService` (KAN-29).
- Integration / cross-module E2E (KAN-30).
- `POST /api/admin/customer-orders/:id/supplier-orders` (KAN-19).
- Returns, refunds, shipments admin features.
- Payment provider integration or automated webhooks.
- New Prisma models or API endpoints unless audit reveals a blocking gap.
