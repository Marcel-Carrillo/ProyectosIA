## Why

KAN-30 is the **Integration** subtask of KAN-18 (customer order management). Backend (KAN-28) and frontend (KAN-29) were delivered in separate branches; store administrators need proof that the combined admin experience works end-to-end against a real database, honors the published API contract, and never exposes supplier-internal data. Without this certification, KAN-18 cannot close and KAN-19 (supplier order management) cannot safely build on the customer-order foundation.

KAN-29 left the Cypress E2E run blocked (tasks 7.4/7.6). Integration is the correct place to unblock full-stack E2E, reconcile branches if needed, and produce the final verification reports and PR.

## What Changes

- Create integration branch from `master` (or merge KAN-28/KAN-29 feature branches if not yet on `master`) and confirm both layers run together.
- **Audit** the merged customer-order module against `openspec/specs/customer-order-management/spec.md` — fix only gaps found during verification.
- Run mandatory **curl** testing for all `/api/admin/customer-orders*` endpoints (list, filters, create, status PATCH, error cases, supplier-field absence, no public routes) with DB restore and report.
- Run mandatory **E2E** (Cypress headless + Playwright MCP): list → detail → three-dimension status updates, date filters, timeline, responsive viewports (360/768/1280), supplier-field absence in DOM — unblock KAN-29 Cypress 7.4/7.6.
- Run full **unit test** suites (backend + frontend) with DB baseline verification.
- Align **`docs/api-spec.yml`** with actual responses; mark legacy `/customer-orders*` paths as superseded if still present.
- Run **adversarial review** (status model separation, snapshot immutability, supplier isolation, monetary correctness).
- Open integration **PR** referencing KAN-30/KAN-18; transition Jira KAN-30 to **En revisión** after PR is open.

## Capabilities

### New Capabilities

<!-- None — requirements already captured in main spec. -->

### Modified Capabilities

<!-- No requirement changes expected. Verification-only against existing main spec. -->

## Impact

- **Affected domain concepts**: `CustomerOrder`, `CustomerOrderItem`; relationships to `Customer`, `ProductVariant`.
- **Surface**: Internal admin operations only (`/customer-orders` UI + `/api/admin/customer-orders` API). No customer-facing behavior changes.
- **Order lifecycle**: Confirms three independent status dimensions (`status`, `paymentStatus`, `fulfillmentStatus`) work end-to-end and remain separate from supplier-order, shipment, return, and refund status.
- **Supplier data exposure**: Hard gate — `supplierId`, `supplierReference`, and `supplierCost` must be absent in every API response and rendered DOM.
- **Code (verification targets)**: `backend/src/**/customerOrder*`, `frontend/src/pages/CustomerOrdersPage.tsx`, `CustomerOrderDetailPage.tsx`, `frontend/src/components/admin/OrderStatusControl.tsx`, `OrderStatusTimeline.tsx`, `frontend/src/services/customerOrderService.ts`, `frontend/cypress/e2e/customer-orders.cy.ts`.
- **Docs**: `docs/api-spec.yml` alignment; `docs/data-model.md` / standards docs only if drift is found.
- **Dependencies**: Requires KAN-28 backend and KAN-29 frontend deliverables on the integration branch.

## Non-goals

- New product behavior, Prisma schema changes, or new API endpoints (unless audit reveals a blocking defect).
- Order status history model (`CustomerOrderStatusHistory`) — timeline remains derived from timestamps.
- Supplier-order generation E2E (KAN-19).
- Refund/return execution flows (KAN-20/KAN-25) — only verify entry-point buttons render per existing rules.
- Payment provider integration or automated webhooks.
