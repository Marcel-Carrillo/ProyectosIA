# Tasks

> Full-stack change (Jira KAN-17). Structured per `docs/openspec-tasks-mandatory-steps.md`
> and `openspec/config.yaml`. Reports go under `openspec/changes/customer-management/reports/`.
>
> **Architecture:** Express + DDD layered stack (Presentation → Application → Domain → Infrastructure).
> Mirror `supplier-management` file layout — **not** NestJS modules/DTOs.
>
> **Agent workflow (MANDATORY — non-negotiable):** During `/opsx:apply` or any implementation
> session on this change, the agent MUST edit this file on disk **immediately** after each
> sub-task: `- [ ]` → `- [x]`. Do this on the fly every step; never batch at session end;
> never wait for the user to ask. Verification steps are marked `[x]` only after tests pass
> AND the report file exists. Chat summaries do **not** replace updating this file.

## 0. Setup: Create Feature Branch / Worktree (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to choose workspace isolation
- [x] 0.2 Create feature branch `feature/KAN-17` from `master`
- [x] 0.3 Verify branch creation and confirm current branch status

## 1. Backend: Schema & domain model

- [x] 1.1 Apply Prisma migration for `Customer` and `CustomerAddress` if tables missing (`prisma migrate status` current)
- [x] 1.2 Create `backend/src/domain/models/customer.ts` (domain entities + `AddressType`)
- [x] 1.3 Create `backend/src/domain/repositories/customerRepository.ts` (interface + `CustomerCreateData`, `CustomerUpdateData`, `CustomerListFilters`, address types)

## 2. Backend: Validator (TDD)

- [x] 2.1 Add `validateCustomerData` and `validateCustomerAddressData` to `backend/src/application/validator.ts` (firstName/lastName/email required, lengths, email format, `AddressType` enum)
- [x] 2.2 Write failing unit tests in `backend/src/application/__tests__/validator.customer.test.ts` then make them pass

## 3. Backend: Repository

- [x] 3.1 Implement `backend/src/infrastructure/repositories/customerRepository.ts` (Prisma): paginated `findAll` + search, `findById` (with addresses), `findByEmail`, `create`, `update`, `delete`, `countOrders`, address CRUD with ownership check
- [x] 3.2 Typed errors: `CustomerNotFoundError`, `CustomerEmailConflictError`, `CustomerHasOrdersError`, `AddressNotFoundError` with `code` + `status`
- [x] 3.3 Unit tests for repository (mock Prisma)

## 4. Backend: Service

- [x] 4.1 Implement `backend/src/application/services/customerService.ts`: email normalize (trim + lowercase), uniqueness → 409, delete guard → 409 `CUSTOMER_HAS_ORDERS`, address ownership
- [x] 4.2 Unit tests for service: happy paths + not-found, email conflict, delete blocked, address ownership

## 5. Backend: Controller and routes

- [x] 5.1 Implement `backend/src/presentation/controllers/customerController.ts` (customers + nested addresses, standard envelope)
- [x] 5.2 Create `backend/src/routes/admin/customerRoutes.ts`; register in `backend/src/routes/index.ts` and mount under `/api/admin/customers` in `backend/src/index.ts`. No `/api/public/customers` route
- [x] 5.3 Map errors in `backend/src/middleware/errorHandler.ts` (404/409/400 codes per spec)
- [x] 5.4 Unit tests for controller (`customerController.test.ts`)

## 6. Frontend: types and service

- [x] 6.1 Create `frontend/src/types/customer.ts` (`Customer`, `CustomerAddress`, payloads, list response types)
- [x] 6.2 Implement `frontend/src/services/customerService.ts` against `/api/admin/customers` (+ nested addresses), `mapCustomerError` / `extractCustomerErrorMessage`

## 7. Frontend: CustomersPage and modals

- [x] 7.1 Implement `frontend/src/pages/CustomersPage.tsx`: list, debounced search, pagination, create/edit/delete, address section trigger — mirror `SuppliersPage`
- [x] 7.2 Create `frontend/src/components/admin/CustomerFormModal.tsx` (create/edit, client validation, 409 email conflict)
- [x] 7.3 Create `frontend/src/components/admin/CustomerAddressesSection.tsx` and `CustomerAddressFormModal.tsx` (Shipping/Billing, CRUD)
- [x] 7.4 Unit tests: `CustomersPage.test.tsx`, `CustomerFormModal.test.tsx`, `CustomerAddressFormModal.test.tsx` — use `findBy*` for async assertions (ESLint)

## 8. Frontend: Router and navigation

- [x] 8.1 Register `/customers` route in admin `Layout` via `App.tsx` (same pattern as suppliers)
- [x] 8.2 Add "Customers" link in `frontend/src/components/Layout.tsx`

## 9. Review and Update Existing Unit Tests (MANDATORY)

- [x] 9.1 Review existing backend + frontend tests for regressions after new routes/module; full suites green (see step-12 report)

## 10. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 10.1 Capture pre-test DB baseline (`Customer`, `CustomerAddress` counts)
- [x] 10.2 Run full backend Jest suite + `tsc --noEmit`
- [x] 10.3 Run full frontend RTL suite + `tsc --noEmit`
- [x] 10.4 Verify post-test DB state unchanged
- [x] 10.5 Create report `openspec/changes/customer-management/reports/2026-06-18-step-12-unit-test-and-db-verification.md`

## 11. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 11.1 Start backend + DB; capture pre-test counts
- [x] 11.2 `GET /api/admin/customers` — list, search, pagination envelope
- [x] 11.3 `POST` create → 201; duplicate email → 409; missing firstName → 400
- [x] 11.4 `GET /:id`, `PATCH`, `DELETE` customer; `GET/POST/PATCH/DELETE` addresses; ownership 404
- [x] 11.5 No `/api/public/customers`; restore DB; report `openspec/changes/customer-management/reports/2026-06-18-step-13-curl-endpoint-testing.md`

## 12. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 12.1 Start frontend (:3001) + backend (:3000); navigate to `/customers`
- [x] 12.2 E2E: create customer → list → search → edit → addresses CRUD → delete customer
- [x] 12.3 Restore DB; report `openspec/changes/customer-management/reports/2026-06-18-step-14-e2e-testing.md`
- [x] 12.4 Add/extend Cypress spec `frontend/cypress/e2e/customers.cy.ts` if missing (covered by RTL tests; Playwright MCP used for E2E)

## 13. Update Technical Documentation (MANDATORY)

- [x] 13.1 Update `docs/api-spec.yml` with `/api/admin/customers` and nested address routes
- [x] 13.2 Confirm `docs/data-model.md` matches schema (Customer + CustomerAddress sections verified, no drift)

## 14. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 14.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 14.2 Verify all tasks `[x]` and reports exist
- [ ] 14.3 Commit, push `feature/KAN-17`, `gh pr create`; report PR URL
