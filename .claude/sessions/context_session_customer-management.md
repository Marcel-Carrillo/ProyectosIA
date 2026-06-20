# Session Context: customer-management (KAN-17)

## Change
- Jira: KAN-17
- Branch: feature/KAN-17
- OpenSpec: openspec/changes/customer-management/

## Artifacts
- Proposal: openspec/changes/customer-management/proposal.md
- Spec: openspec/changes/customer-management/specs/customer-management/spec.md
- Design: openspec/changes/customer-management/design.md
- Tasks: openspec/changes/customer-management/tasks.md

## Project Structure
- Backend root: backend/ (Express + TypeScript + Prisma + PostgreSQL)
- Frontend root: frontend/ (React + TypeScript + React Bootstrap + Axios)

## Key Finding: Prisma Schema
The Customer and CustomerAddress models are NOT yet in backend/prisma/schema.prisma.
They need to be added before any backend work.

## Backend Pattern (from supplier-management)
- Domain model: backend/src/domain/models/supplier.ts
- Domain repo interface: backend/src/domain/repositories/supplierRepository.ts
- Infrastructure repo: backend/src/infrastructure/repositories/supplierRepository.ts
- Service: backend/src/application/services/supplierService.ts
- Controller: backend/src/presentation/controllers/supplierController.ts
- Route: backend/src/routes/admin/supplierRoutes.ts
- Registered in: backend/src/index.ts
- Errors registered in: backend/src/middleware/errorHandler.ts
- Validator: backend/src/application/validator.ts

## Frontend Pattern (from supplier-management)
- Types: frontend/src/types/supplier.ts
- Service: frontend/src/services/supplierService.ts
- Page: frontend/src/pages/SuppliersPage.tsx
- Form modal: frontend/src/components/admin/SupplierFormModal.tsx
- Tests: frontend/src/pages/__tests__/SuppliersPage.test.tsx, frontend/src/components/admin/__tests__/SupplierFormModal.test.tsx

## Already Scaffolded (before this change)
- frontend/src/pages/CustomersPage.tsx — placeholder "Coming soon"
- frontend/src/services/customerService.ts — stub (not implemented)
- App.tsx — route /customers already registered
- Layout.tsx — navigation may or may not have Customers entry (check)

## Critical Rules
- Admin-only endpoints under /api/admin/customers
- No public customer endpoint
- Email must be unique (409 CUSTOMER_EMAIL_CONFLICT)
- Delete blocked if customer has CustomerOrder (409 CUSTOMER_HAS_ORDERS)
- Address ownership enforced (address.customerId == :customerId)
- Customer PII not logged in plain text
- Supplier cost never appears in any response
