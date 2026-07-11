## Context

Today, getting CJ Dropshipping products into the admin Products panel requires four manual admin actions, each backed by an existing, already-shipped service:

1. `SupplierService.create(...)` — create the `Supplier` row.
2. `CjConnectionService.configureConnection(supplierId, { externalAccountRef })` — upsert `SupplierIntegration` (idempotent, keyed on `supplierId @unique`).
3. `CjConnectionService.verifyConnection(supplierId)` — ping CJ via `cjClient`, set `SupplierIntegration.status` to `Connected`/`Error`.
4. `CjCatalogSyncService.syncCatalog(supplierId)` — page through CJ's catalog into `CjCatalogItem` rows (staging table).
5. `CjCatalogPromotionService.promote(supplierId, { categoryId, items, activate })` — group `CjCatalogItem` rows by `pid`/`vid` into real `Product`/`ProductVariant` rows; idempotent via `ProductVariant.cjCatalogItemId @unique`.

`CJDROPSHIPPING_API_KEY` is already wired into the production Lambda (`backend/serverless.yml`), but no `Supplier`/`SupplierIntegration` row exists yet — step 1 never ran. There is no scheduled-job mechanism anywhere in this repo today (`serverless.yml` defines only the single HTTP-proxied `app` function; no EventBridge, no cron, no worker). This change adds that mechanism and wires steps 1–5 behind it.

Constraint carried over unmodified from `base-standards.md` §4: *"The first version should prioritize manual control over premature automation."* This design satisfies that by stopping automation at `Product.status = Draft` — publishing to the storefront remains a manual `activate` action.

## Goals / Non-Goals

**Goals:**
- Eliminate the four manual admin steps (create supplier, configure connection, verify, sync) before CJ products are reviewable.
- Auto-promote synced items into Draft `Product`/`ProductVariant` rows so an admin's only remaining action is: open Products, optionally adjust `publicPrice`, click Activate.
- Run on a recurring 24-hour schedule via AWS EventBridge, with no HTTP surface (IAM-invoked only).
- Full idempotency: re-running the job at any point must not create duplicate suppliers, integrations, or products, and must not re-verify/re-sync/re-promote work already done in a way that duplicates state.
- Isolate failures per provider: one provider's failure (e.g. CJ unreachable) must not abort the run for a future second provider.
- Provide a minimal seam (`SupplierProviderDescriptor`) so a second provider can be added later by adding a descriptor, not by editing the job's control flow.

**Non-Goals:**
- Auto-activating products to the public storefront (explicitly deferred to manual admin action).
- A full multi-provider architecture (per-provider API key storage, per-provider token cache, concurrent multi-credential support). The current single global credential per provider (module-level env var, module-level token cache in `cjClient`) is preserved as-is.
- Configurable scheduling cadence per environment or admin-facing schedule management UI.
- Mapping CJ's own category taxonomy onto local `Category` rows (all auto-promoted items land in one fixed default category).
- A manual "run now" admin endpoint (may be added later; not required for this change).

## Decisions

### D1: New dedicated scheduled Lambda function, not folded into the existing `app` function
The existing `app` function is an HTTP proxy (`serverless-http`) with a request/response lifecycle unsuited to a long-running batch job (catalog sync pages through up to `CJ_SYNC_MAX_PAGES` pages). A second function (`supplierAutoProvision`) is added to `serverless.yml` with an EventBridge `schedule` event and its own generous `timeout` (900s, the Lambda maximum), sharing the same `provider.environment` block so it inherits `CJDROPSHIPPING_API_KEY`, `DATABASE_URL`, etc. without duplicating SSM references.
- **Alternative considered**: trigger sync lazily from an HTTP admin route on a timer client-side. Rejected — contradicts the user's explicit requirement for a periodic backend-owned job, and would tie job execution to whether an admin happens to have the panel open.

### D2: Cadence = every 24 hours (`rate(1 day)`)
Chosen to bound CJ API load (catalog sync makes many paginated calls plus a verify ping) and Lambda cost, at the cost of up to a 24h delay before new upstream products are stageable for review. Confirmed with the user as an explicit trade-off versus a faster (1h/6h) cadence.

### D3: Supplier↔provider detection via `SupplierIntegration.provider`, no schema change
To detect "has CJ already been provisioned?" idempotently, the job queries `SupplierIntegration.findFirst({ where: { provider: 'CJDropshipping' } })` rather than adding a new `Supplier.providerKey` column. `SupplierIntegration.provider` already defaults to `'CJDropshipping'` and is the natural key. If found, reuse its `supplierId`; if not, create a new `Supplier` (name: `"CJ Dropshipping"`) and call `configureConnection` on it.
- **Alternative considered**: add `Supplier.providerKey String? @unique` for an explicit 1:1 link. Rejected for this change — it's a schema migration for a distinction the existing `provider` field already captures, and the current model already assumes one `SupplierIntegration` per `Supplier` (`supplierId @unique`). Revisit only if a future provider needs a `Supplier` to exist independently of any integration.

### D4: Fixed default category ("Uncategorized"), resolved via `CJ_DEFAULT_CATEGORY_ID`
`CjCatalogPromotionService.promote` requires a valid, existing `categoryId`. Since no human selects one per item at auto-promotion time, the job resolves a single fixed category id from `CJ_DEFAULT_CATEGORY_ID`. The job does not create this category automatically at runtime — the category must be seeded/created once (documented in `docs/development_guide.md`) and its id set in env config. If the env var is missing or the category doesn't exist, the job logs the failure for that provider and skips promotion (sync still completes, leaving items in `CjCatalogItem` for manual promotion as today).
- **Alternative considered**: map CJ's own `CjCatalogItem.categoryId` (their taxonomy id) to local categories. Rejected as a non-goal — meaningfully mapping an external taxonomy is separate scoped work, not needed to unblock the admin review workflow.

### D5: Auto-promote always calls `promote(..., activate: false)`
Every auto-promotion call is made with `activate: false`, producing `Product.status = 'Draft'`. This is the load-bearing safety decision: it guarantees nothing becomes customer-visible without a human `activate` action, satisfying `base-standards.md` §4 and the user's own stated expectation ("el admin debería poder ajustar precio y activar").

### D6: Auto-promotion selects only `syncStatus != 'Failed'` and `promotionState = 'NotPromoted'` items
Reuses `CjCatalogSyncService.listStagedCatalog(supplierId, { syncStatus: 'Synced', promotionState: 'NotPromoted' })` to build the `items` array passed to `promote`. This makes re-runs idempotent for free: items already promoted (linked via `ProductVariant.cjCatalogItemId`) are excluded by construction, and `promote` itself is additionally idempotent per item.

### D7: Minimal provider abstraction — interface only, single implementation
```ts
interface SupplierProviderDescriptor {
  key: string;                 // 'CJDropshipping'
  isConfigured(): boolean;     // credential present and not a placeholder value
  defaultSupplierName: string; // 'CJ Dropshipping'
  runPipeline(supplierId: number): Promise<ProviderPipelineResult>;
}
```
`providerRegistry.ts` exports a single-element array containing the CJ descriptor. The orchestrator (`SupplierAutoProvisionService`) iterates the registry and never branches on `provider === 'cj'` directly. Adding a second provider later means adding a descriptor + its own client, not touching the orchestrator or the Lambda handler.
- **Alternative considered**: fully generalize now (per-provider credential storage, per-provider token cache, relax `supplierId @unique`). Rejected as premature — no second provider exists yet, and `base-standards.md` explicitly warns against premature automation/abstraction; the interface seam is the cheapest form of "prepared for the future" without the cost of a real multi-provider refactor.

### D8: Kill-switch via `SUPPLIER_AUTO_PROVISION_ENABLED`
The handler checks this env var first and short-circuits (no-op, logged) if `'false'`, so the job can be disabled without a redeploy if it misbehaves in production.

### D9: No new HTTP endpoint
The job is invoked only by EventBridge under Lambda's execution IAM role. No `/api/admin/...` route is added for it in this change (see Non-Goals) — this avoids exposing a catalog-mutating action outside the existing `adminAuth` + admin-panel surface.

## Risks / Trade-offs

- **[Risk]** Auto-created `Supplier`/`SupplierIntegration` rows appear with no admin action, which could be surprising in the Suppliers admin list. → **Mitigation**: name it clearly ("CJ Dropshipping"), and this is exactly the state the user asked for (auto-provisioned, ready to review in Products — not in Suppliers).
- **[Risk]** Two invocations overlapping (a delayed EventBridge retry, or a manual future trigger) could interleave sync/promote calls for the same supplier. → **Mitigation**: use a Postgres advisory lock (`pg_try_advisory_lock`/`pg_advisory_unlock`) keyed on the provider, acquired at the start of that provider's pipeline and released at the end; skip (not block) if already held. Implemented as two independent `prisma.$queryRaw` calls against the shared `prisma` singleton (not wrapped in a `prisma.$transaction`).
  **Implementation history:** an adversarial review before merge flagged that advisory locks are session-scoped, and two independent `$queryRaw` calls don't guarantee sharing a physical connection under Prisma's pool — so a release could theoretically land on a different connection than the acquire. The fix at the time wrapped acquire → critical section → release in a single `prisma.$transaction(...)` to pin one connection for that span. **This was reverted after live production testing**, found the day of first deployment: AWS Lambda freezes the execution environment's CPU immediately once the handler's promise resolves, and this consistently left Prisma's interactive transaction as `idle in transaction` in Postgres forever — the COMMIT/ROLLBACK never actually completed server-side, permanently holding the advisory lock and requiring a manual `pg_terminate_backend` to recover, on every single invocation without exception. This is strictly worse than the narrower risk being guarded against. Reverted to the original two-call approach; the residual risk (acquire/release on different pooled connections) is bounded in practice — this job runs once a day with a comfortably sized connection pool, and any stale session-held lock self-heals as soon as that connection's Lambda container is recycled. **Do not reintroduce `prisma.$transaction` wrapping around this lock without first validating it against a real Lambda deployment, not just mocked unit tests** — the failure mode is invisible to unit tests and only manifests under Lambda's actual execution-freezing semantics.
- **[Risk]** (found during adversarial review, before merge) `ensureSupplierProvisioned` performs two independent, non-transactional writes (`SupplierService.create` then `CjConnectionService.configureConnection`) across service boundaries — a crash between them would leave an orphaned `Supplier` with no integration, undetectable by the `SupplierIntegration.findFirst` check alone, causing a duplicate `Supplier` on the next run. → **Mitigation**: before creating a new `Supplier`, check for an existing one matching the provider's default name with no linked `SupplierIntegration` (`cjIntegration: null`) and reuse it instead of creating a duplicate.
- **[Risk]** (found during adversarial review, before merge) `CjCatalogPromotionService.promote()` validates and writes its entire batch atomically — a single unresolvable item (e.g. a zero-cost item, which `syncCatalog` does not reject as `Failed`) fails the whole batch, which without further handling would silently re-block the *entire* remaining catalog's auto-promotion on every scheduled run, forever. → **Mitigation**: on `CjPromotionValidationError`, retry once excluding exactly the item ids the error reports; only the genuinely bad item(s) are skipped (and re-attempted, and re-logged, on the next run), while the rest of the batch still promotes. Bounded to one retry — no risk of an infinite loop.
- **[Risk]** (found during adversarial review, before merge) the paginated candidate-item listing (`listStagedCatalog`, ordered by `createdAt desc`) had no secondary sort key; every item from one `syncCatalog` batch shares an identical `createdAt` (a single-transaction upsert), so offset pagination across ties was undefined once a supplier had more pending items than one page — capable of skipping an item on every run, or colliding on the same id across two pages (tripping `ProductVariant.cjCatalogItemId`'s unique constraint and failing the whole promote batch). → **Mitigation**: added `id: 'asc'` as a secondary sort key (shared repository method, benefits the existing admin catalog listing UI too) and a defensive `Set`-based dedupe when collecting ids across pages.
- **[Risk]** `CJ_SYNC_MAX_PAGES` pagination plus per-product variant fetches can approach the 900s Lambda timeout for a large catalog. → **Mitigation**: reuse the existing `syncCatalog` pagination/limits as-is (no new work here); if timeouts occur in practice, splitting into multiple scheduled invocations is future work, not blocking this change.
- **[Risk]** Missing/invalid `CJ_DEFAULT_CATEGORY_ID` silently blocks all auto-promotion (sync still runs). → **Mitigation**: log a clear structured warning each run so it's visible in CloudWatch; document the required one-time category setup in `docs/development_guide.md`.
- **[Risk]** Running unattended against a real, shared CJ merchant account (per `effe34e`'s note: same account used in dev and prod) means a bug could burn real API quota on a schedule, unsupervised. → **Mitigation**: the `SUPPLIER_AUTO_PROVISION_ENABLED` kill-switch (D8) and the 24h cadence (D2) bound the blast radius.

## Migration Plan

1. Add `providerRegistry.ts`, `supplierAutoProvisionService.ts`, `supplierAutoProvisionHandler.ts` — no behavior changes to existing code paths.
2. Add `CJ_DEFAULT_CATEGORY_ID` and `SUPPLIER_AUTO_PROVISION_ENABLED` to `serverless.yml` environment and to SSM for production; create the "Uncategorized" `Category` row once via existing admin Category management (no new endpoint needed).
3. Add the `supplierAutoProvision` scheduled function to `serverless.yml`, initially deployed with `SUPPLIER_AUTO_PROVISION_ENABLED=false` in production to allow a dry-run style first manual invocation (`serverless invoke -f supplierAutoProvision`) before enabling the schedule.
4. Verify end-to-end against production data once: confirm a `Supplier`, `Connected` `SupplierIntegration`, `CjCatalogItem` rows, and Draft `Product`/`ProductVariant` rows are created; confirm a second manual invocation makes no further changes (idempotency evidence).
5. Flip `SUPPLIER_AUTO_PROVISION_ENABLED=true` and deploy with the schedule enabled.
6. Rollback: set `SUPPLIER_AUTO_PROVISION_ENABLED=false` and redeploy (no schema/data rollback needed — auto-created rows are ordinary `Supplier`/`Product` data an admin can deactivate or edit like any other).

## Open Questions

- Should a future manual "run now" admin endpoint be added for support/debugging, or is `serverless invoke` sufficient? (Deferred — not required for this change.)
- If a second provider is added later, does the single global `CJDROPSHIPPING_API_KEY`-style env var pattern hold, or does credential storage need to move into the database per-supplier? (Explicitly out of scope here; flagged for whoever adds the second provider.)
