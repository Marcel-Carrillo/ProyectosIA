# Context Session: cj-catalog-auto-provisioning

## OpenSpec artifacts (read these in full before planning)

- `openspec/changes/cj-catalog-auto-provisioning/proposal.md`
- `openspec/changes/cj-catalog-auto-provisioning/design.md`
- `openspec/changes/cj-catalog-auto-provisioning/specs/supplier-catalog-auto-provisioning/spec.md`
- `openspec/changes/cj-catalog-auto-provisioning/tasks.md`

## Summary

This is a backend-only change. It adds a scheduled (EventBridge, every 24h) Lambda job that automates the existing manual CJ Dropshipping onboarding flow end-to-end: auto-create `Supplier`+`SupplierIntegration` if missing, verify the connection, sync the catalog, and auto-promote newly synced items into `Product`/`ProductVariant` records in **Draft** status (never auto-published). An admin still manually adjusts price and calls the existing `activate` action.

All the underlying business logic already exists and must be reused, not reimplemented:
- `backend/src/application/services/supplierService.ts` — `SupplierService.create(...)`
- `backend/src/application/services/cjConnectionService.ts` — `CjConnectionService.configureConnection(supplierId, data)` and `.verifyConnection(supplierId)`
- `backend/src/application/services/cjCatalogSyncService.ts` — `CjCatalogSyncService.syncCatalog(supplierId)` and `.listStagedCatalog(supplierId, { syncStatus, promotionState })`
- `backend/src/application/services/cjCatalogPromotionService.ts` — `CjCatalogPromotionService.promote(supplierId, { categoryId, items, activate })`
- `backend/src/infrastructure/external/cjClient.ts` — the CJ HTTP client (module-level singleton, env-sourced key with placeholder fallback pattern)
- `backend/prisma/schema.prisma` — `Supplier`, `SupplierIntegration` (`provider` defaults to `'CJDropshipping'`, `supplierId @unique`), `CjCatalogItem`, `Product`, `ProductVariant` (`cjCatalogItemId @unique`)

## Key design decisions already made (do not relitigate — implement per these)

- **D1**: New dedicated Lambda function `supplierAutoProvision` in `backend/serverless.yml`, EventBridge `schedule` event, `timeout: 900`, no `http` event. Shares `provider.environment`.
- **D2**: Cadence `rate(1 day)` (confirmed with the user — 24h, not 1h/6h).
- **D3**: No Prisma schema change. Detect an existing CJ supplier via `SupplierIntegration.findFirst({ where: { provider: 'CJDropshipping' } })`, not a new `Supplier` column.
- **D4**: Fixed default category via new env var `CJ_DEFAULT_CATEGORY_ID` (must exist in DB already; job does not create it). If missing/invalid, sync still persists but promotion is skipped for that run, logged clearly.
- **D5**: Auto-promote always calls `promote(..., activate: false)` → `Product.status = 'Draft'`. This is the core safety property — never change this to auto-activate.
- **D6**: Select promotable items via `listStagedCatalog(supplierId, { syncStatus: 'Synced', promotionState: 'NotPromoted' })`, pass as `items` into `promote(...)`.
- **D7**: Minimal `SupplierProviderDescriptor` interface in `backend/src/application/providers/providerRegistry.ts`, single CJ entry only — do not build a full multi-provider system.
- **D8**: Kill-switch env var `SUPPLIER_AUTO_PROVISION_ENABLED` (`'true'`/`'false'`) — checked first, short-circuits with a log line if `'false'`.
- **D9**: No new HTTP endpoint. Not invocable via `/api/admin/...` or any route in this change.
- **Concurrency**: Postgres advisory lock (`pg_try_advisory_lock`), keyed per provider, acquired/released around that provider's pipeline run; skip (don't block) if already held.
- **Error isolation**: one provider's thrown error must not stop other providers in the same run (registry has only 1 entry today, but the orchestrator must still be written to isolate per-provider).

## Constraints from docs/base-standards.md and docs/backend-standards.md (already read by the parent agent)

- DDD layered architecture: Domain/Application/Infrastructure/Presentation. This job has no Presentation-layer HTTP surface — it's an Infrastructure-layer entry point (`backend/src/jobs/...`) calling an Application-layer orchestrator service.
- No composition root exists in this codebase — every controller/handler wires its own service/repository instances inline. The new job handler must do the same (see how existing admin CJ controllers construct `CjConnectionService`/`CjCatalogSyncService`/`CjCatalogPromotionService` for the pattern to copy).
- English-only technical artifacts; camelCase files; Jest tests colocated in `__tests__`; 90% coverage threshold; mock all external dependencies in unit tests (no real DB/HTTP).
- `CJ_DEFAULT_MARKUP_MULTIPLIER` pattern (module `process.env` read with `Number.isFinite` guard) already exists in `cjCatalogPromotionService.ts` — follow the same style for reading `CJ_DEFAULT_CATEGORY_ID` / `SUPPLIER_AUTO_PROVISION_ENABLED`.
- `cjClient.ts` env-var-with-placeholder-fallback pattern (`process.env.CJDROPSHIPPING_API_KEY ?? 'cj_test_placeholder'`) is the precedent for `isConfigured()` in the provider descriptor — a placeholder value must be treated as "not configured".
- Structured logging via the existing `logger` from `backend/src/infrastructure/logger.ts` — never log raw upstream error bodies or secrets.

## What I need from you (backend-developer agent)

Produce a concrete, file-by-file implementation plan covering tasks 1–5 of `tasks.md` (config env vars, provider registry, orchestrator service with its unit tests, Lambda job handler with its unit test, `serverless.yml` wiring). Do not implement — only plan. Save the plan to `.claude/doc/cj-catalog-auto-provisioning/backend.md`. Be specific about: exact function signatures, how the advisory lock is acquired/released via Prisma's `$queryRaw`, exact shape of the orchestrator's return value (for structured logging), and how the job handler constructs its dependencies (mirror the exact pattern used in the existing CJ admin controllers/routes — inspect them first).
