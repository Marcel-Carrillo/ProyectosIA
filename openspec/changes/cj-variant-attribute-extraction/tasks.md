# Tasks: cj-variant-attribute-extraction

> Reports directory for this change: `openspec/changes/cj-variant-attribute-extraction/reports/`
> During apply, mark each sub-task `- [x]` immediately after completing and verifying it (see `docs/openspec-tasks-mandatory-steps.md`).

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide workspace isolation (current checkout acceptable: backend-only change, no tooling rewrite).
- [x] 0.2 Create branch `feature/cj-variant-attribute-extraction` from up-to-date `develop` (`git fetch origin && git checkout develop && git pull`, then branch). Never branch from `master`.
- [x] 0.3 Verify branch and clean working tree (`git branch --show-current`, `git status`).

## 1. Backend: Extraction Logic (TDD)

- [x] 1.1 Add `variantKey?: string` and `variantNameEn?: string` to `CjVariantDto` in `backend/src/infrastructure/external/cjTypes.ts`; update the `variantProperty` comment to document it as fallback-only.
- [x] 1.2 Write failing unit tests for the new extraction (in `backend/src/application/services/__tests__/cjCatalogSyncService.test.ts` or a dedicated extraction test file): `"Black-XXL"` → `{color:"Black", size:"XXL"}`; `"Blue-37"` and `"EU38"` (numeric/EU sizes); single-token size (`"XL"`) and color (`"Red"`); multi-word color (`"Ivory white-S"`); `variantKey` absent + `variantNameEn` present; `variantProperty` JSON fallback (regression); garbage input → both `null`, non-throwing.
- [x] 1.3 Implement the extraction per design.md D1/D2: precedence `variantKey` → `variantNameEn` → `variantProperty`; size vocabulary `XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL`, `^\d{1,3}$`, `EU\s?\d{2}`, `One Size`/`Free Size` (case-insensitive, whole-token); non-size tokens joined with a space as color; ambiguity → `null`; never throws; wire into the sync mapping at the existing `parseSizeColor` call site.
- [x] 1.4 Confirm the previously-failing tests pass and the item-level failure semantics are untouched (extraction failure never yields `syncStatus: 'Failed'`).

## 2. Backend: Attribute Backfill (service + script)

- [x] 2.1 Write failing unit tests for `cjVariantAttributeBackfill` (new `backend/src/application/services/__tests__/cjVariantAttributeBackfill.test.ts`): derives from `rawPayload.variant.variantKey`; updates item and linked promoted variant; idempotent second run reports zero changes; never touches `ProductVariant.status`; skips and logs `(size,color)` collisions among siblings of the same product.
- [x] 2.2 Implement `backend/src/application/services/cjVariantAttributeBackfill.ts` (pure derivation + batched Prisma updates, mirroring `cjProductImageBackfill.ts`), reusing the exact extraction function from task 1.3.
- [x] 2.3 Implement thin driver `backend/scripts/backfillCjVariantAttributes.ts` (ts-node --transpile-only entry, console progress, final `processed / itemsUpdated / variantsUpdated / skippedAmbiguous` summary), mirroring `backfillCjProductImages.ts` including its operational caveat header.
- [x] 2.4 Confirm backfill tests pass.

## 3. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 3.1 Review existing `cjCatalogSyncService.test.ts` fixtures: add `variantKey` to representative mock variants so the suite exercises the real payload shape; verify no existing assertion weakened or deleted.
- [x] 3.2 Verify no other suite (promotion, repositories, controllers) needs fixture updates (`grep -rn "variantProperty\|variantKey" backend/src`).

## 4. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 4.1 Capture pre-test database baseline (row counts: Product, ProductVariant, CjCatalogItem, CustomerOrder, Customer).
- [x] 4.2 Run targeted tests (`npm test -- --watchAll=false --testPathPattern="cjCatalogSync|cjVariantAttributeBackfill"`).
- [x] 4.3 Run the full backend suite (`npm test` in `backend/`) and record totals/runtime.
- [x] 4.4 Verify post-test database state equals the baseline; restore and document if any mutation occurred.
- [x] 4.5 Create report `openspec/changes/cj-variant-attribute-extraction/reports/YYYY-MM-DD-step-4-unit-test-and-db-verification.md`.

## 5. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 5.1 Ensure backend (`:3000`) and Docker DB are running; capture pre-test CjCatalogItem/ProductVariant size/color counts.
- [x] 5.2 With a Connected CJ integration (or a seeded staging fixture if CJ credentials are unavailable locally — document which), trigger `POST /api/admin/suppliers/:supplierId/cj/sync` with admin auth and verify `200 { itemsUpserted, itemsFailed, syncedAt }`; verify synced items now carry non-null `size`/`color` where `variantKey` provides them (psql check).
- [x] 5.3 Run the backfill script against the dev DB (`npx ts-node --transpile-only scripts/backfillCjVariantAttributes.ts`), verify the summary and the updated rows via psql, and verify a second run reports zero changes (idempotence).
- [x] 5.4 Verify `GET /api/public/products/:id` for a multi-variant promoted product returns each Active variant with its distinct `size`/`color`, and that no supplier-internal field (`supplierCost`, `vid`, `rawPayload`, `cjCatalogItemId`) appears in the response.
- [x] 5.5 Error cases: sync without admin token → 401; sync for a supplier without connection → 404 `CJ_CONNECTION_NOT_FOUND`.
- [x] 5.6 Restore any DB state mutated by testing (delete synced test rows / revert attributes) and verify counts match the pre-test baseline; document restoration.
- [x] 5.7 Create report `openspec/changes/cj-variant-attribute-extraction/reports/YYYY-MM-DD-step-5-curl-endpoint-testing.md`.

## 6. Frontend: E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

> No frontend code changes — this validates the end-to-end outcome: a multi-color/multi-size product renders both selectors and each combination is purchasable.

- [x] 6.1 Ensure backend and frontend servers are running with a known DB state including at least one Active product with ≥2 colors and ≥2 sizes (seeded or CJ-promoted after backfill).
- [x] 6.2 Navigate to the product detail page; verify both the color and the size selector render with all expected options.
- [x] 6.3 Select each color/size combination; verify the selected variant (price/SKU-level data) updates and unavailable combinations are disabled, and add one combination to the cart successfully.
- [x] 6.4 Verify no console errors and that a single-variant product still renders without selectors (regression).
- [x] 6.5 Restore test environment (empty cart/revert any data touched, close browser).
- [x] 6.6 Create report `openspec/changes/cj-variant-attribute-extraction/reports/YYYY-MM-DD-step-6-e2e-testing.md`.

## 7. Update Technical Documentation (MANDATORY)

- [x] 7.1 Apply `ai-specs/skills/update-docs/SKILL.md`. Expected: `docs/data-model.md` — note on `CjCatalogItem.size/color` derivation source (`variantKey` → `variantNameEn` → `variantProperty`) and the attribute backfill script; `docs/development_guide.md` — add `backfillCjVariantAttributes.ts` alongside the image backfill instructions.
- [x] 7.2 Confirm explicitly that `docs/api-spec.yml` needs no change (fields `size`/`color` already in schemas) and state it in the PR body.

## 8. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 8.1 Load and apply `ai-specs/skills/commit/SKILL.md` before any Git command.
- [x] 8.2 Verify all tasks are `[x]`, the three reports exist under `openspec/changes/cj-variant-attribute-extraction/reports/`, and docs are updated.
- [x] 8.3 Run and report `git status`, `git branch --show-current`, `git diff --stat`; stage only change-related files (never `.env*`, `node_modules/`, `dist/`, `coverage/`).
- [x] 8.4 Create Conventional Commit, e.g. `fix(suppliers): derive CJ variant size/color from variantKey and backfill promoted variants`, referencing OpenSpec change `cj-variant-attribute-extraction` and test evidence.
- [x] 8.5 Push `feature/cj-variant-attribute-extraction` to origin.
- [x] 8.6 Check no duplicate PR exists, then `gh pr create --base develop` (never `master`) with summary, OpenSpec change name, and verification status; report the PR URL in chat.
