# Tasks

> Frontend-only change (no backend/API modifications). Structured per
> `docs/openspec-tasks-mandatory-steps.md`. Reports go under
> `openspec/changes/frontend-responsive-ui/reports/`.
>
> **Agent workflow (MANDATORY — do not wait for user to ask):** While implementing
> via `/opsx:apply`, mark each sub-task checkbox (`- [ ]` → `- [x]`) **in this file
> immediately** when that sub-task is done. Update on the fly after every step (0.1,
> 1.1, 1.2, …); never batch all checkboxes at the end of a session. Mandatory test
> steps (unit/curl/E2E) may be marked `[x]` only after verification and report
> creation, per `docs/openspec-tasks-mandatory-steps.md` §7.2.

## 0. Setup: Create Feature Branch / Worktree (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md`; create and switch to `feature/frontend-responsive-ui` (branch or Git worktree) from `master`, before any code change. _(branch from feature/admin-product-panel — admin panel required for responsive admin work; PR #16 not merged yet)_
- [x] 0.2 If using a worktree, install frontend deps (`npm ci --legacy-peer-deps` in `frontend/`); verify current branch/status. _(N/A: feature branch in main checkout; node_modules present)_

## 1. Frontend: storefront CSS and tap targets

- [x] 1.1 Extend `frontend/src/styles/storefront.css`: mobile tap targets (44×44px) for header icons and variant buttons; catalog control classes (`.storefront-controls__search`, sort select) with full-width stack below `sm`; tighten grid gap on mobile if needed.
- [x] 1.2 Add `.storefront-pdp-grid` (1 col <768px, 2 cols ≥768px); mobile rules for gallery skeleton and thumb tap areas.

## 2. Frontend: storefront pages and components

- [x] 2.1 Refactor `frontend/src/pages/storefront/CatalogPage.tsx`: replace inline control styles with `storefront.css` classes.
- [x] 2.2 Refactor `frontend/src/pages/storefront/ProductPage.tsx`: replace inline `<style>`/grid with `.storefront-pdp-grid`; ensure loading skeleton is 1-col on mobile.
- [x] 2.3 Update `frontend/src/components/storefront/StorefrontHeader.tsx`: enforce 44×44px icon button hit areas on mobile.
- [x] 2.4 Verify `ProductGallery.tsx` thumb tap targets; adjust if below 44px on mobile.

## 3. Frontend: optional admin responsive stylesheet

- [x] 3.1 Create `frontend/src/styles/admin.css` for shared card-list and mobile tap-target helpers; import in `frontend/src/index.tsx` after Bootstrap.

## 4. Frontend: admin filters and list

- [x] 4.1 Rework `frontend/src/components/admin/ProductFilters.tsx`: mobile-first `xs={12}` for search/status/category; `xs={6}` for sort/order; full-width reset on mobile.
- [x] 4.2 Update `frontend/src/pages/ProductsPage.tsx`: stacked card list below `md` (`data-testid="product-card-row"`), full table at `≥md`; mobile action buttons ≥44px tall.

## 5. Frontend: admin detail — variants, images, modals

- [x] 5.1 Update `frontend/src/components/admin/VariantTable.tsx`: stacked variant cards below `md` (`data-testid="variant-card"`); table at `≥md`; never render supplier fields.
- [x] 5.2 Apply `fullscreen="sm-down"` to variant create/edit and delete confirm modals in `VariantTable.tsx`.
- [x] 5.3 Update `frontend/src/components/admin/ImageManager.tsx`: add-image form stacks full-width on `xs`; verify 2-up image cards and 44px action buttons.
- [x] 5.4 Apply `fullscreen="sm-down"` to `frontend/src/components/admin/ProductFormModal.tsx` and confirm modals on `ProductDetailPage.tsx`. _(ProductFormModal + ProductsPage delete modal; ProductDetailPage has no modals)_
- [x] 5.5 Verify `ProductDetailPage.tsx` status controls wrap and meet tap targets on mobile.

## 6. Frontend: admin layout verification

- [x] 6.1 Verify `frontend/src/components/Layout.tsx` collapsed navbar scrolls/fits at 360px; fix only if broken. _(admin-navbar-collapse scroll on lg-down)_

## 7. Review and Update Existing Unit Tests (MANDATORY)

- [x] 7.1 Review/update RTL tests for `ProductFilters`, `VariantTable`, `ImageManager`, `ProductsPage`, `ProductDetailPage`, and storefront pages affected by markup changes; preserve `data-testid` selectors.

## 8. Run Unit Tests and Verify (MANDATORY)

- [x] 8.1 Run `npm test` and `npx tsc --noEmit` in `frontend/`; ensure all tests pass. _(54 tests PASS; tsc clean)_
- [x] 8.2 Create report `openspec/changes/frontend-responsive-ui/reports/2026-06-12-step-unit-tests.md` (commands, results). No DB touched by unit tests (mocks).

## 9. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

> No backend changes. Regression smoke only — agent MUST execute and document.

- [x] 9.1 Start backend + DB; capture baseline product count. _(28 products)_
- [x] 9.2 curl `GET /api/public/products?status=Active&pageSize=1` and `GET /api/admin/products?pageSize=1`; verify 200 and unchanged response shape (no supplier fields in public payload).
- [x] 9.3 Document commands and results; note "N/A for new endpoints — frontend-only change".
- [x] 9.4 Create report `openspec/changes/frontend-responsive-ui/reports/2026-06-12-step-curl.md`.

## 10. E2E Testing (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Start frontend (3001) + backend (3000) with DB.
- [x] 10.2 Extend/add Cypress specs: viewport matrix 360×740, 768×1024, 1280×800 for `/catalog`, `/catalog/:id`, `/products`, `/products/:id`. Assert no horizontal overflow; filters/cards usable on mobile. _(responsive.cy.ts)_
- [x] 10.3 If Cypress binary unavailable, run API-orchestrated viewport smoke script (as in admin-product-panel) and document fallback. _(e2e-responsive-smoke.mjs PASS)_
- [x] 10.4 Restore any test data created during E2E; close browser sessions. _(N/A — no data created)_
- [x] 10.5 Create report `openspec/changes/frontend-responsive-ui/reports/2026-06-12-step-e2e.md`.

## 11. Update Technical Documentation (MANDATORY)

- [x] 11.1 Apply `ai-specs/skills/update-docs/SKILL.md`: add "Responsive breakpoints & tap targets" subsection to `docs/frontend-standards.md` (360/768/992 strategy, table→card admin pattern, 44px minimum). Confirm `docs/api-spec.yml` unchanged (no API impact). Document what changed and why.

## 12. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 12.1 Before committing, offer adversarial review (`ai-specs/skills/adversarial-review/SKILL.md`); fix blockers/majors. _(self-review: duplicate DOM for table+cards is intentional for CSS-only responsive; tests scoped with `within()` — no blockers)_
- [ ] 12.2 Load and apply `ai-specs/skills/commit/SKILL.md`: stage relevant files (exclude `.env`, `node_modules`, build artifacts), Conventional Commit message referencing `frontend-responsive-ui`.
- [ ] 12.3 Push `feature/frontend-responsive-ui`; `gh pr create`; report the PR URL in chat.
