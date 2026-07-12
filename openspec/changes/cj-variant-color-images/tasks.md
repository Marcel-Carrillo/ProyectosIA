# Tasks: cj-variant-color-images

> Reports directory for this change: `openspec/changes/cj-variant-color-images/reports/`
> During apply, mark each sub-task `- [x]` immediately after completing and verifying it (see `docs/openspec-tasks-mandatory-steps.md`).

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide workspace isolation.
- [x] 0.2 Create branch `feature/cj-variant-color-images` from up-to-date `develop` (`git fetch origin && git checkout develop && git pull`, then branch). Never branch from `master`.
- [x] 0.3 Verify branch and clean working tree (`git branch --show-current`, `git status`).

## 1. Backend: Data Model

- [x] 1.1 Add `color String? @db.VarChar(50)` to the `ProductImage` model in `backend/prisma/schema.prisma`.
- [x] 1.2 Generate and apply a Prisma migration (`npx prisma migrate dev --name add_product_image_color`) against the local dev DB; verify the column exists via `psql`/Prisma Studio.
- [x] 1.3 Update `backend/src/domain/models/productImage.ts` to include `color: string | null`.

## 2. Backend: CJ Image Extraction — Color Association (TDD)

- [x] 2.1 Write failing unit tests in `backend/src/application/services/__tests__/cjImageExtraction.test.ts`: `extractCjImages` returns the variant's derived `color` alongside `variantImage` (reusing `extractCjVariantAttributesFromRawPayload`); `planProductImages` dedupes per `(url, color)` — two different colors sharing a URL both produce a row, two same-color items sharing a URL produce one row; the product-level image is always planned with `color: null`; garbage/incomplete payloads never throw and yield `color: null`.
- [x] 2.2 Implement in `backend/src/application/services/cjImageExtraction.ts`: extend `ExtractedCjImages`/`ImagePlanItem`/`PlannedImage` with `color: string | null`; derive it via `extractCjVariantAttributesFromRawPayload(rawPayload).color` inside `extractCjImages`; change `planProductImages`'s dedupe key from `url` to `` `${url}\0${color ?? ''}` ``; keep the product-level image's `color` forced to `null`.
- [x] 2.3 Confirm the previously-failing tests pass; confirm existing `cjImageExtraction` tests (URL-only dedup, main-image fallback) still pass unmodified in behavior.

## 3. Backend: CJ Catalog Promotion — Persist Color

- [x] 3.1 Update `backend/src/application/services/cjCatalogPromotionService.ts` (`createProductImageRecord` call, ~line 221) to pass the planned image's `color` through.
- [x] 3.2 Update/extend promotion service unit tests to assert created `ProductImage` rows carry the expected `color` (including the `null` case for the product-level image).

## 4. Backend: Public API — Expose Image Color

- [x] 4.1 Update `backend/src/presentation/serializers/publicProduct.ts`: `PublicProductImageDTO` gains `color: string | null`; `serializeImage` copies it. Confirm no other field is added (allow-list intact).
- [x] 4.2 Update/extend serializer unit tests to assert `color` is present and no supplier-internal field leaks.

## 5. Backend: Admin Image Endpoints — Accept and Return Color

- [x] 5.1 Update the admin product-image create/update DTOs and controller/service (`POST /api/admin/products/:id/images`, `PATCH /api/admin/products/:id/images/:imageId`) to accept an optional `color` field and persist it; list/get responses already return the full `ProductImage` row and therefore include `color` once step 1 lands — verify this explicitly.
- [x] 5.2 Update/extend admin image endpoint unit tests to cover create/update with `color`.

## 6. Backend: Color Backfill — Service and Script (TDD)

- [x] 6.1 Write failing unit tests in `backend/src/application/services/__tests__/cjImageColorBackfill.test.ts`: derives `color` for already-persisted `ProductImage` rows by matching `(productId, url)` against `CjCatalogItem.rawPayload`-derived `(url, color)` pairs; leaves non-matching rows untouched (`color` stays `null`); idempotent second run reports zero changes; never modifies `url`, `altText`, `sortOrder`, or unrelated rows.
- [x] 6.2 Implement `backend/src/application/services/cjImageColorBackfill.ts` (pure derivation + **bulk `UPDATE ... FROM (VALUES ...)` SQL, chunked** — apply the same pattern already proven in `backend/src/application/services/cjVariantAttributeBackfill.ts` from the start, not a per-row Prisma `update()` loop).
- [x] 6.3 Implement thin driver `backend/scripts/backfillCjImageColors.ts` (ts-node --transpile-only entry, chunked progress logging, final `processed / imagesUpdated / skipped` summary), mirroring `backfillCjVariantAttributes.ts`.
- [x] 6.4 Validate the bulk SQL pattern against a scratch table in the local dev DB (or reuse the dev DB directly) before relying on it, same verification done for the prior backfill.
- [x] 6.5 Confirm backfill tests pass.

## 7. Frontend: Types and ProductGallery Color Filter (TDD)

- [x] 7.1 Add `color: string | null` to the `ProductImage` type in `frontend/src/types/product.ts`.
- [x] 7.2 Write failing tests for `ProductGallery` (`frontend/src/components/storefront/__tests__/ProductGallery.test.tsx` or equivalent): given `selectedColor`, renders only images with matching `color` plus `color === null`; falls back to the full image list when the filtered set is empty; renders the full list unchanged when `selectedColor` is not provided; resets the active thumbnail to index 0 when `selectedColor` changes.
- [x] 7.3 Implement the `selectedColor?: string | null` prop and filter/fallback logic in `frontend/src/components/storefront/ProductGallery.tsx`, resetting `activeIdx` via a `useEffect` keyed on the filtered set's identity/selected color.
- [x] 7.4 Confirm tests pass; confirm no regression for products without color-tagged images (existing tests still green).

## 8. Frontend: Wire Selected Variant Color into ProductPage

- [x] 8.1 In `frontend/src/pages/storefront/ProductPage.tsx`, pass `selectedVariant?.color ?? null` as `selectedColor` to `<ProductGallery />` (~line 264).
- [x] 8.2 Update/extend `ProductPage` tests to cover: selecting a color-bearing variant filters the gallery; a product without variants/colors renders the gallery unchanged.

## 9. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 9.1 Review existing `cjImageExtraction.test.ts`, `cjCatalogPromotionService.test.ts`, and `publicProduct` serializer test fixtures for any assertion that assumed images have no `color` field; update fixtures to the real shape without weakening or deleting assertions.
- [x] 9.2 Verify no other suite needs fixture updates (`grep -rn "ProductImage\|planProductImages\|extractCjImages" backend/src`).

## 10. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 10.1 Capture pre-test database baseline (row counts: Product, ProductVariant, ProductImage, CjCatalogItem).
- [x] 10.2 Run targeted tests (`npm test -- --watchAll=false --testPathPattern="cjImageExtraction|cjCatalogPromotion|cjImageColorBackfill|publicProduct"`).
- [x] 10.3 Run the full backend suite (`npm test` in `backend/`) and record totals/runtime.
- [x] 10.4 Verify post-test database state equals the baseline; restore and document if any mutation occurred.
- [x] 10.5 Create report `openspec/changes/cj-variant-color-images/reports/YYYY-MM-DD-step-10-unit-test-and-db-verification.md`.

## 11. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 11.1 Ensure backend (`:3000`) and Docker DB are running; capture pre-test `ProductImage` color-null/non-null counts.
- [x] 11.2 Promote a seeded/staging multi-color CJ catalog item group via `POST /api/admin/suppliers/:supplierId/cj/catalog/promote`; verify via psql that the resulting `ProductImage` rows have the expected `color` values (including one `color = null` row for the product-level image).
- [x] 11.3 Run `POST /api/admin/products/:id/images` and `PATCH /api/admin/products/:id/images/:imageId` with a `color` value; verify `201`/`200` responses include `color`; restore DB state afterward.
- [x] 11.4 Verify `GET /api/public/products/:id` for that product returns each image with its `color` field, and that no supplier-internal field appears.
- [x] 11.5 Run the color backfill script against the dev DB (`npx ts-node --transpile-only scripts/backfillCjImageColors.ts`); verify the summary and updated rows via psql; verify a second run reports zero changes (idempotence).
- [x] 11.6 Restore any DB state mutated by testing and verify counts match the pre-test baseline; document restoration.
- [x] 11.7 Create report `openspec/changes/cj-variant-color-images/reports/YYYY-MM-DD-step-11-curl-endpoint-testing.md`.

## 12. Frontend: E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 12.1 Ensure backend and frontend servers are running with a known DB state including at least one Active product with color-tagged images across ≥2 colors.
- [x] 12.2 Navigate to the product detail page; verify the gallery initially shows the default/selected variant's images.
- [x] 12.3 Select a different color; verify the gallery updates to that color's images (plus any shared images) and the active thumbnail resets.
- [x] 12.4 Select a color with no color-specific images (or a single-color product); verify the gallery falls back to the full image list instead of appearing empty.
- [x] 12.5 Verify no console errors and that a product with no color-tagged images renders exactly as before this change (regression check).
- [x] 12.6 Restore test environment (close browser, revert any data touched).
- [x] 12.7 Create report `openspec/changes/cj-variant-color-images/reports/YYYY-MM-DD-step-12-e2e-testing.md`.

## 13. Update Technical Documentation (MANDATORY)

- [x] 13.1 Apply `ai-specs/skills/update-docs/SKILL.md`. Expected: `docs/data-model.md` — document `ProductImage.color` and its derivation source; `docs/api-spec.yml` — add `color` (nullable string) to the `ProductImage` schema used by both public and admin endpoints; `docs/development_guide.md` — add `backfillCjImageColors.ts` alongside the other CJ backfill scripts.
- [x] 13.2 Confirm explicitly in the PR body that no customer-facing field beyond the additive `color` changed, and that supplier-internal fields remain unexposed.

## 14. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 14.1 Load and apply `ai-specs/skills/commit/SKILL.md` before any Git command.
- [ ] 14.2 Verify all tasks are `[x]`, the three reports exist under `openspec/changes/cj-variant-color-images/reports/`, and docs are updated.
- [ ] 14.3 Run and report `git status`, `git branch --show-current`, `git diff --stat`; stage only change-related files (never `.env*`, `node_modules/`, `dist/`, `coverage/`).
- [ ] 14.4 Create Conventional Commit, e.g. `feat(catalog): associate product images with variant color and react to color selection`, referencing OpenSpec change `cj-variant-color-images` and test evidence.
- [ ] 14.5 Push `feature/cj-variant-color-images` to origin.
- [ ] 14.6 Check no duplicate PR exists, then `gh pr create --base develop` (never `master`) with summary, OpenSpec change name, verification status, and an explicit note that the production `ProductImage.color` backfill (~11,221 already-promoted `CjCatalogItem` records) must be run manually against production after this deploys, mirroring the `cj-variant-attribute-extraction` backfill follow-up. Report the PR URL in chat.
