# Context Session: spocket-integration

## OpenSpec change
- Location: `openspec/changes/spocket-integration/`
- Artifacts: `proposal.md`, `design.md`, `specs/spocket-connection-management/spec.md`, `specs/spocket-catalog-sync/spec.md`, `tasks.md`

## Summary
Backend-only change. Adds the foundation to connect a `Supplier` to Spocket (a real dropshipping platform):
1. `spocket-connection-management`: admin configures/verifies a per-supplier Spocket connection. Credentials come from `SPOCKET_API_KEY`/`SPOCKET_API_BASE_URL` env vars, never persisted in a returnable column, never in responses/logs.
2. `spocket-catalog-sync`: admin-triggered read-only pull of Spocket catalog/inventory into a new staging table (`SpocketCatalogItem`), fully isolated from the live public catalog. No auto-publish, no order push, no webhooks (explicitly out of scope, deferred to future changes).

## Precedent to mirror
`backend/src/infrastructure/stripe/stripeClient.ts` — module-level singleton client, env-sourced secret with a safe placeholder fallback so Jest can import without a real key, secrets never logged/returned.

## Existing conventions to reuse
- Layered architecture: `domain/models`, `domain/repositories`, `application/services`, `infrastructure/repositories`, `infrastructure/external`, `presentation/controllers`, `routes/admin`.
- Look at `supplierService.ts` / `supplierController.ts` / `supplierRoutes.ts` for the CRUD pattern this mirrors (pagination envelope `{ success, data: { items, total, page, pageSize }, message }`, `VALIDATION_ERROR`/`*_NOT_FOUND` error codes, `requireAdminAuth` middleware).
- `backend/src/routes/public/__tests__/supplierIsolation.test.ts` is the pattern to mirror for `spocketIsolation.test.ts`.
- `ProductVariant` already has internal-only `supplierId`, `supplierReference`, `supplierCost` fields excluded via a `variantSelect` allow-list — do not touch that model in this change.

## Task list
Full breakdown in `openspec/changes/spocket-integration/tasks.md` (65 sub-tasks). Step 0 (feature branch `feature/spocket-integration` from `develop`) already done.

## Your job (backend-developer planning agent)
Produce a per-file implementation plan at `.claude/doc/spocket-integration/backend.md` covering:
- Exact Prisma schema additions (models, fields, enums if used vs string status, indexes, unique constraints, back-relation on `Supplier`).
- Domain model + repository interface signatures.
- `infrastructure/external/spocketTypes.ts` + `spocketClient.ts` shape (client construction, retry/timeout approach, error class).
- Repository Prisma implementations.
- Application service method signatures and logic (`spocketConnectionService.ts`, `spocketCatalogSyncService.ts`), including error mapping.
- Controller + route wiring (exact paths, HTTP methods, status codes, admin auth middleware usage, where to register the router).
- Validator additions.
- Test file plan (what each test file should cover, mirroring existing `supplierService.test.ts` / `supplierController.test.ts` structure).

Do NOT implement — only plan. Read `openspec/changes/spocket-integration/{proposal.md,design.md,tasks.md,specs/**/*.md}` plus the existing `supplier*`, `stripe*` backend files for conventions before writing the plan.
