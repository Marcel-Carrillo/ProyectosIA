# Adversarial Review (pre-commit) and Fixes

Run per `ai-specs/skills/adversarial-review/SKILL.md`, from an independent subagent with no prior session context, before task 15 (commit + PR). Full findings, verified independently against the diff and tests before any fix was applied.

## Verdict (before fixes): FAIL — archiving not advisable

### Findings

| Severity | Area | Finding |
|----------|------|---------|
| Blocker | `cjCatalogPromotionService.ts` / `providerRegistry.ts` | A single pid-group that can't resolve a category (no CJ match, no `CJ_DEFAULT_CATEGORY_ID` fallback) aborted the *entire* `promote()` call with a bare `CjPromotionCategoryRequiredError` — no item-level breakdown. `providerRegistry.ts`'s poison-item retry (already built for price-validation failures) had no equivalent path for category failures, so one bad item silently stalled the whole scheduled batch (up to ~300 items) forever, contradicting the `supplier-catalog-auto-provisioning` spec's explicit "other resolvable items in the same run SHALL still be promoted" requirement. |
| Major | `categoryRepository.ts` `findOrCreateByName` | Reuses any existing `Category` matching CJ's resolved name regardless of its `status` — including an admin-created `Active`, customer-facing category — with no review gate. |
| Minor | `productVariantRepository.ts` `findManyByProductCategoryId` (backfill) | Not supplier-scoped at the DB level; relies entirely on in-memory filtering by `CjCatalogItem.supplierIntegrationId`. No data leak today, but doesn't scale once a second supplier shares the fallback category. |
| Minor | `cjCatalogPromotionService.ts` / `categoryRepository.ts` | `findOrCreateByExternalRef` writes happen outside the main `promote()` transaction — if that transaction later fails for an unrelated reason, a newly created `Category`/mapping isn't rolled back (self-healing on retry, but undocumented). |
| Question | `cjCategoryResolution.ts` | `buildCjCategoryResolver` never logs on a `fetchCategories()` failure or an empty-map result — a real taxonomy-shape mismatch in production could silently no-op forever with nothing in the logs to reveal why. |

## Decisions (with the user, in Spanish)

- **Blocker: fix now.** User's own words: *"si un producto viene mal por lo que sea y va a romper el flujo para traer productos nuevos lo obviamos y seguimos"* — confirmed the poison-item-skip behavior is required, not optional.
- **Major: no code change — confirmed intentional.** User's own words: *"yo lo que quiero es que los productos vengan con la categoria de cj, no inyectarlos y activarlos directamente en el store si la categoria existe, quiero poder ver y buscar los productos que necesito activar por categoria desde el admin"* — reusing an existing (even `Active`) category by name is the desired behavior: it lets CJ-promoted products be found/filtered by real category in the admin Products list. The product's own `Draft` status (not the category's status) is what actually gates storefront visibility, so this poses no premature customer exposure. Documented as an intentional, confirmed decision in `design.md`'s Decision 4, not left as an ambiguous risk.
- **Minor findings + Question: not addressed** (scoped as pre-existing/acceptable for this increment — no second CJ-alternative supplier is wired up yet, per design.md's own Non-Goals, and the logging gap is a defensive nice-to-have, not a correctness bug). Left for a future change if they become load-bearing.

## Fix implemented (Blocker)

- `backend/src/application/validator.ts`: `CjPromotionCategoryRequiredError` gained an optional `itemErrors?: CjPromotionItemError[]` field, mirroring `CjPromotionValidationError.itemErrors`.
- `backend/src/application/services/cjCatalogPromotionService.ts`: the per-pid-group category-resolution loop no longer throws on the first unresolvable group — it collects every unresolvable group's `cjCatalogItemId`s into `categoryItemErrors`, keeps resolving the rest, and throws once at the end with the full list attached (`new CjPromotionCategoryRequiredError(undefined, categoryItemErrors)`). The whole call still aborts either way (nothing persisted from that attempt) — unchanged all-or-nothing contract for a single `promote()` call.
- `backend/src/application/providers/providerRegistry.ts`: `promoteExcludingPoisonItems`'s catch block now reads `itemErrors` off *either* `CjPromotionValidationError` or `CjPromotionCategoryRequiredError`, and retries once excluding those ids for both error types — so other resolvable pid-groups in the same run still get promoted.
- The manual admin `POST /cj/catalog/promote` endpoint's contract is unchanged: still a flat 422 `CJ_PROMOTION_CATEGORY_REQUIRED` with no `itemErrors` in the HTTP response (it never retries), matching the existing `cj-catalog-promotion` spec scenario exactly — no `docs/api-spec.yml` change needed for this fix.
- `design.md` updated: new Risk entry under "Risks / Trade-offs" documenting the found-and-fixed issue, and Decision 4 updated with the confirmed-intentional note on name-collision reuse.

## Tests added

- `cjCatalogPromotionService.test.ts`: `should_report_itemErrors_only_for_the_pid_group_that_failed_when_another_group_resolves` — two pid-groups, one resolves via CJ taxonomy, the other has no CJ category and no fallback; asserts `itemErrors` contains only the failing group's item, and nothing persists. Also strengthened the existing single-item category-required test to assert `itemErrors` shape.
- `providerRegistry.test.ts`: `should_retry_excluding_items_that_failed_category_resolution_and_still_promote_the_rest` (mirrors the existing price-validation retry test) and `should_give_up_without_an_infinite_retry_when_every_item_fails_category_resolution` (no-op guard when excluding the only item would leave nothing to promote).

## Verification after the fix

- `npx tsc --noEmit`: clean.
- `npx jest cjCatalogPromotionService providerRegistry --watchAll=false`: 2 suites / 53 tests passing (up from 50 — 3 new tests, 0 regressions).
- `npx jest --watchAll=false` (full backend suite): 105 suites / 1054 tests passing (up from 1051).
- `npm run lint`: clean.

## Post-fix verdict

The Blocker is resolved and independently re-verified. The Major finding was reviewed with the user and confirmed as intentional product behavior, not a defect — documented in `design.md` rather than code-changed. Proceeding to task 15 (commit + PR) is now advisable.
