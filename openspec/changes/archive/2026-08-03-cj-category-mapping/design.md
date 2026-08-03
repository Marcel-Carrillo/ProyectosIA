## Context

Promotion (`CjCatalogPromotionService.promote()`, `backend/src/application/services/cjCatalogPromotionService.ts`) is shared by two callers:
- **Manual**: `POST /api/admin/suppliers/:supplierId/cj/catalog/promote`, driven by `CjPromoteModal.tsx`, where an admin currently must pick one `categoryId` applied to the whole selected batch.
- **Automated**: the scheduled auto-provisioning job (`supplierAutoProvisionService.ts` → `providerRegistry.ts`), which promotes up to ~300 items per run using a single fixed `categoryId` read from `CJ_DEFAULT_CATEGORY_ID`.

CJ's `/product/getCategory` endpoint (already wrapped as `ICjClient.fetchCategories()`, `cjClient.ts:202`) returns CJ's own category tree with readable names, and each synced `CjCatalogItem.categoryId` (`cjCatalogSyncService.ts:143`) already stores the CJ category id for that product — both are currently unused at promotion time. This design routes that already-captured data into category assignment instead of always applying the fixed default.

The `Category` model (`schema.prisma:14`) has no field linking it to any external supplier taxonomy today.

## Goals / Non-Goals

**Goals:**
- Promoted products (manual and automated) land in a category derived from CJ's real taxonomy whenever that's resolvable.
- Auto-created categories never silently appear in storefront navigation without admin review.
- Category resolution/creation is race-safe under concurrent promotion runs (manual + scheduled job can overlap).
- `CJ_DEFAULT_CATEGORY_ID` keeps working as a safety net — resolution failure never blocks promotion outright when a fallback is configured.
- Backfill for products already stuck under the default category is available, but never overrides a category an admin picked deliberately.

**Non-Goals:**
- Replicating CJ's multi-level category hierarchy into `Category.parentId` — this change creates a flat local `Category` per resolved CJ leaf category. Hierarchy mapping is future scoped work.
- A curated admin UI for mapping CJ categories to specific local categories before they're auto-created — auto-create-on-first-use is the only mapping mechanism in this increment (per user decision).
- Renaming or re-syncing a local category if CJ later renames the source category — the mapping is created once and is not kept in sync afterward.
- Supporting a second supplier's taxonomy in this increment — the schema is shaped to allow it later (see Decision 1), but no second provider is wired up now.

## Decisions

### Decision 1: A dedicated `SupplierCategoryMapping` table, not a field on `Category`
**Chosen:** add `model SupplierCategoryMapping { id, provider, externalCategoryId, categoryId (FK → Category), createdAt, updatedAt }` with `@@unique([provider, externalCategoryId])`.

**Rejected alternative:** add `Category.externalRef String? @unique`. Simpler (no new table/join), but ties the generic `Category` model to a single external taxonomy — a second supplier with its own category ids couldn't be mapped without a second column, and the codebase already models suppliers generically (`Supplier`, `SupplierIntegration.provider`) rather than CJ-specifically elsewhere. Rejected to stay consistent with that existing pattern and with base-standards' "must remain flexible enough to support multiple suppliers."

### Decision 2: Resolve once per `pid`-group, before the transaction opens
CJ's `categoryId` is product-level (`CjProductDto.categoryId`), so all variants sharing a `pid` share one category — resolution happens once per group, matching the existing per-group loop in `promote()`. Resolution (the `fetchCategories()` call, tree walk, and find-or-create against `SupplierCategoryMapping`) happens entirely **before** `prisma.$transaction(...)` opens, mirroring the existing pre-validation-before-transaction discipline in `promote()` (see the comment on `PROMOTE_TRANSACTION_OPTIONS`). A CJ API failure during resolution degrades to the fallback category rather than aborting or leaving a half-open transaction.

**Alternative rejected:** resolve inside the transaction, closer to the `tx.product.create()` call. Rejected — makes an external HTTP call inside an already-long-running transaction (the existing 120s timeout comment explicitly calls out that this transaction currently does "only synchronous DB writes with no external API calls in between" specifically to stay safe under Lambda execution-environment freezes; adding a CJ call inside it would reintroduce the exact risk that comment warns against).

### Decision 3: `fetchCategories()` called once per `promote()` invocation, not once per pid-group
Fetch CJ's full category tree once at the start of `promote()`, build an in-memory `Map<categoryId, categoryName>` by walking the tree recursively (see Decision 5), and reuse it for every `pid`-group in that call. Avoids O(distinct-pid-groups) redundant CJ API calls in a single promote/auto-provision run (the auto job promotes up to ~300 items/run).

### Decision 4: Auto-created categories default to `status = Inactive`
A `Category` created through `SupplierCategoryMapping`'s find-or-create defaults to `Inactive` (existing `GET /categories` already excludes `Inactive` by default, and the public catalog only shows products under categories an admin has reviewed). Categories created directly via `POST /categories` are unaffected and keep defaulting to `Active`. This prevents raw/untranslated CJ category names from appearing in storefront navigation before an admin reviews them, while still letting the promoted products exist immediately (a product's own `Draft`/`Active` status is the real storefront-visibility gate, independent of its category's status).

**Confirmed intentional (adversarial review, 2026-07-17)**: `findOrCreateByExternalRef`'s name-collision fallback (`CategoryRepository.findOrCreateByName`) reuses **any** existing `Category` matching CJ's resolved name **regardless of its current status** — including an admin-created `Active` category. This is deliberate, not an oversight: the user explicitly wants CJ-promoted products to land under their real, searchable category (even an existing `Active` one) so they can be found/filtered by category in the admin Products list — never auto-activated into the storefront, since the *product's own* `Draft` status (not the category's status) is what gates storefront visibility (see above). The `Inactive`-by-default behavior only applies to a genuinely **new** `Category` created because no name match existed.

### Decision 5: Recursive tree walk over `CjCategoryDto`, not a fixed-depth lookup
**Open technical risk carried into implementation (see Open Questions):** `CjCategoryDto` currently only types `categoryFirstId`/`categoryFirstName`/`categoryFirstList` — a single level. CJ's real `/product/getCategory` response is documented (and, based on the nested `categoryFirstList` field already present, evidently modeled) as a multi-level tree, and a product's `categoryId` likely targets a leaf (second or third level), not the first-level id. The resolver SHALL walk the tree recursively by id at arbitrary depth (not hardcode "check `categoryFirstList` one level down") so it keeps working regardless of whether the real tree turns out to be 2 or 3 levels deep. `CjCategoryDto` SHALL be extended with the additional nested list field(s) once a real payload is inspected (this dev environment has no CJ sandbox credentials today — see `reports/2026-07-14-step-15-e2e-testing.md` from a prior change — so this must be validated against CJ's public API docs and/or a real payload as the first implementation task, before the resolver is written against assumed field names).

### Decision 6: `categoryId` becomes optional in the promote request; explicit value still wins
An admin-supplied `categoryId` in the promote request is always honored as an override — CJ resolution is skipped entirely for that request when present, preserving today's "admin picks the category" behavior for anyone who still wants it. Omitting it opts into automatic CJ-taxonomy resolution. This keeps the change backward-compatible for any existing caller that always sends `categoryId`.

### Decision 7: Backfill is an idempotent, admin-triggered maintenance action (not automatic migration)
A new admin-only endpoint (not a data migration script run once at deploy time) lets an admin trigger re-categorization of legacy products on demand, re-runnable safely. It only touches `Product` rows whose `categoryId` currently equals the resolved default/fallback category **at the time of the call** — never a product an admin has since re-categorized manually, since there's no way to distinguish "still default because never touched" from "admin manually chose the default category" other than this exact same-value check, which is accepted as the deliberate, documented limitation (see Risks).

## Risks / Trade-offs

- **[Risk] `CjCategoryDto` may not model enough tree depth to resolve leaf category ids** → Mitigation: Decision 5's recursive walk + explicit first-implementation-task validation against a real/documented payload before the resolver ships; if CJ's `categoryId` turns out to reference an id not present anywhere in the fetched tree, resolution fails closed (falls back to `CJ_DEFAULT_CATEGORY_ID`), never throws.
- **[Risk] Concurrent promotion runs (manual admin action racing the scheduled job) could both try to create the same new `Category`/`SupplierCategoryMapping`** → Mitigation: `@@unique([provider, externalCategoryId])` at the DB level; the find-or-create implementation catches the Prisma `P2002` unique-violation on the losing concurrent insert and re-reads the now-existing row instead of surfacing an error.
- **[Risk] Category proliferation / low-quality names** → Mitigation: Decision 4 (auto-created categories start `Inactive`, requiring admin review before storefront exposure).
- **[Risk] Backfill can't distinguish "still default because never reviewed" from "admin deliberately chose the default category"** → Accepted trade-off (Decision 7); documented behavior, not silently incorrect — the backfill endpoint's response reports exactly which products it touched so an admin can review.
- **[Risk] Adding a CJ API call to the promote path introduces a new external dependency where there was none before** → Mitigation: Decision 2 (resolved before the transaction, so failure just falls back, never aborts) + Decision 3 (one call per `promote()` invocation, not per item, bounding worst-case latency).
- **[Risk — found and fixed by adversarial review, 2026-07-17] One poison item could permanently stall the entire auto-provisioning batch** → The initial implementation threw a bare `CjPromotionCategoryRequiredError` on the *first* pid-group that failed to resolve a category, aborting the whole `promote()` call with no way to identify which item(s) were the problem — `providerRegistry.ts`'s existing poison-item retry (already built for price-validation failures) had no equivalent path for category failures, so a single unresolvable item would block the same ~300-item batch on every scheduled run, forever. Fixed: `CjPromotionCategoryRequiredError` now carries an optional `itemErrors` list (mirroring `CjPromotionValidationError.itemErrors`), populated with every `cjCatalogItemId` belonging to an unresolvable pid-group (the whole `promote()` call still aborts — nothing is persisted from that attempt, matching the existing pre-transaction validation discipline); `providerRegistry.ts`'s `promoteExcludingPoisonItems` now retries once excluding those ids for both error types, so other resolvable items in the same run still promote, per the `supplier-catalog-auto-provisioning` spec's explicit requirement. The manual admin promote endpoint's contract is unchanged (still a flat all-or-nothing 422, no `itemErrors` in the HTTP response) since it never retries.

## Migration Plan

1. Prisma migration: add `SupplierCategoryMapping` model + `@@unique([provider, externalCategoryId])`; no changes to existing tables' columns, purely additive.
2. Ship resolution logic behind the existing `promote()` entry points (manual + automated) — no feature flag needed since the optional-`categoryId` contract is backward-compatible (explicit `categoryId` still short-circuits to today's exact behavior).
3. Ship the backfill endpoint separately (admin-triggered, not automatic) so it can be run deliberately after verifying the resolution logic in production with new promotions first.
4. Rollback: the migration is purely additive (new table only) — safe to leave in place even if the feature is reverted at the application level; no destructive rollback needed.

## Open Questions

- Confirm the real shape of CJ's `/product/getCategory` response (levels, field names) before implementing the resolver — cannot be verified live in this dev environment (no CJ sandbox credentials configured here); use CJ's published API documentation and/or a real payload captured against a credentialed environment.
- Should the backfill endpoint be triggerable repeatedly on demand (as designed) or should it also be safe to wire into the scheduled auto-provisioning job as a periodic "re-sweep" of default-category products? Deferred — start with the on-demand admin endpoint only; revisit if legacy-product drift turns out to be ongoing rather than one-time.
