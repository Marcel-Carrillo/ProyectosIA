# Tasks: migrate-cra-to-vite

> Reports directory for this change: `openspec/changes/migrate-cra-to-vite/reports/`
> During apply, mark each sub-task `- [x]` immediately after completing and verifying it (see `docs/openspec-tasks-mandatory-steps.md`).

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide workspace isolation (dedicated worktree strongly preferred for this change: it rewrites `node_modules` and build tooling). Note for worktree runs on Windows: frontend tests may need an explicit `--testMatch`/include override. → Worktree created at `.worktrees/feature-migrate-cra-to-vite`.
- [x] 0.2 Create branch `feature/migrate-cra-to-vite` from up-to-date `develop` (`git fetch origin && git checkout develop && git pull`, then branch). Never branch from `master`. → Branched from `origin/develop` @ 721576a after fetch.
- [x] 0.3 Verify branch and clean working tree (`git branch --show-current` → `feature/migrate-cra-to-vite`, `git status` → clean except change artifacts).
- [x] 0.4 Capture the pre-migration test baseline: run the frontend suite once under CRA/Jest and record the exact suite/test counts (271 tests as of the proposal, but `develop` has since merged PR #85 and #100 — the real baseline may be higher). This number is the parity gate for steps 5.4 and 8.2. → **BASELINE: 53 suites, 315 tests, all passing** (`CI=true npx react-scripts test --watchAll=false --testMatch "**/src/**/*.test.{ts,tsx}"`, 11.8s).

## 1. Vite Scaffolding and Dependency Swap

- [x] 1.1 In `frontend/package.json`: remove `react-scripts` and `@types/jest`; add devDependencies `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `eslint-config-react-app`; run `npm install` and confirm a clean install.
- [x] 1.2 Update `scripts`: `"start": "vite"`, `"dev": "vite"`, `"build": "vite build"`, `"test": "vitest run"`, `"test:watch": "vitest"`; remove `"eject"`; remove the top-level `"proxy"` field.
- [x] 1.3 Create `frontend/vite.config.ts` per design.md: `plugins: [react()]`; `server: { port: 3001, proxy: { '/api': { target: process.env.BACKEND_URL || 'http://localhost:3000', changeOrigin: true } } }`; `resolve.alias` for `@` → `./src`; `build.outDir: 'build'`; `test: { globals: true, environment: 'jsdom', setupFiles: './src/setupTests.ts', css: true }`.
- [x] 1.4 Move `frontend/public/index.html` to `frontend/index.html`: replace every `%PUBLIC_URL%/x` with `/x`, add `<script type="module" src="/src/index.tsx"></script>`, preserve Google Fonts links, `lang="es"`, `theme-color`, and `<div id="root">` verbatim.
- [x] 1.5 Delete `frontend/src/setupProxy.js` (its `BACKEND_URL` logic now lives in `vite.config.ts`).
- [x] 1.6 Port the `jest.moduleNameMapper` react-router entries from `package.json` only if Vitest resolution fails without them (verify first); then delete the `package.json` `"jest"` block.

## 2. Environment Variable Migration (REACT_APP_* → VITE_*)

- [x] 2.1 Rename variables in `.env.development`, `.env.production` (if present), and `.env.example`: `REACT_APP_API_BASE_URL` → `VITE_API_BASE_URL`, `REACT_APP_SITE_URL` → `VITE_SITE_URL`; remove `PORT` (port now set in `vite.config.ts`).
- [x] 2.2 Replace `process.env.REACT_APP_*` with `import.meta.env.VITE_*` in all 21 call sites, preserving existing fallbacks: the 17 service files (`customerAuthService`, `categoryService`, `adminAuthService`, `cjCatalogService`, `adminProductService`, `checkoutService`, `refundService`, `shipmentService`, `productService`, `reviewService`, `paymentService`, `customerService`, `customerOrderService`, `returnRequestService`, `supplierService`, `supplierOrderService`, `wishlistService`), plus `components/storefront/OAuthButtons.tsx`, `components/storefront/Seo.tsx`, `pages/storefront/ContentPage.tsx`, `pages/storefront/TwoFactorSetupPage.tsx`.
- [x] 2.3 Create `frontend/env.d.ts` with `/// <reference types="vite/client" />` and an `ImportMetaEnv` interface declaring `VITE_API_BASE_URL` and `VITE_SITE_URL`.
- [x] 2.4 Verify zero residual references: `grep -rn "REACT_APP_\|%PUBLIC_URL%\|react-scripts\|setupProxy" frontend/src frontend/package.json frontend/index.html` returns empty (evidence required).

## 3. TypeScript Configuration

- [x] 3.1 Update `frontend/tsconfig.json`: add `"vite/client"` to `types`, keep `strict: true`, `paths` `@/*`, and `isolatedModules: true`.
- [x] 3.2 Add `frontend/tsconfig.node.json` for `vite.config.ts` (Node/bundler module resolution) and reference it from `tsconfig.json`.
- [x] 3.3 Run `npx tsc --noEmit` in `frontend/` and fix any errors (evidence: clean output).

## 4. Dev Server Parity Verification (AGENT MUST EXECUTE)

- [x] 4.1 Start the backend (Docker DB + API on `:3000`) and run `npm run dev` in `frontend/`; confirm Vite serves on `http://localhost:3001` without compile errors.
- [x] 4.2 Verify proxy parity with curl: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/public/products` returns 200 (same as direct backend call).
- [x] 4.3 Load the storefront catalog page in a browser (Playwright MCP acceptable) and confirm products render through the proxied API.

## 5. Test Migration: Jest → Vitest (51 files, 271 tests)

- [x] 5.1 Update `frontend/src/setupTests.ts`: convert `jest.fn()` in the `matchMedia` mock to `vi.fn()`; keep `@testing-library/jest-dom` import and `TextEncoder/TextDecoder` polyfill.
- [x] 5.2 Run a scripted codemod over `frontend/src/**/*.test.*` converting `jest.*` → `vi.*` (`jest.fn`, `jest.mock`, `jest.spyOn`, `jest.clearAllMocks`, `jest.useFakeTimers`, `jest.advanceTimersByTime`, `jest.Mock` type → `Mock` from `vitest`), adding `import { vi } from 'vitest'` where needed.
- [x] 5.3 Manually review and convert `jest.requireActual` → `await vi.importActual` (async factories) case by case.
- [x] 5.4 Run `npx vitest run` iteratively and fix remaining failures file-by-file until **all tests from the Step 0.4 baseline pass with 0 skipped and 0 deleted** (evidence: final run summary).

## 6. Lint, Production Build, and Docker

- [x] 6.1 Verify `npx eslint src --ext .ts,.tsx` passes with `eslint-config-react-app` as a direct dependency; pin any missing `eslint-plugin-*` peers if resolution fails.
- [x] 6.2 Run `npm run build`; confirm artifacts are emitted to `frontend/build/` and serve them statically (e.g. `npx serve build`) verifying the app loads and lazy-loaded storefront routes work.
- [x] 6.3 Update `frontend/Dockerfile`: additionally COPY `index.html`, `vite.config.ts`, `tsconfig.node.json`, `env.d.ts`; confirm `EXPOSE 3001` matches `server.port` and `CMD ["npm","start"]` now runs Vite; build the image and start the container as evidence.

## 7. CI Workflow Updates

- [x] 7.1 `.github/workflows/pr-extra-quality.yml` (`frontend-quality` job): replace `npm test -- --watchAll=false` with `npm test` (`vitest run`); keep eslint and `tsc --noEmit` steps.
- [x] 7.2 `.github/workflows/deploy.yml`: rename the build-step env var `REACT_APP_API_BASE_URL` → `VITE_API_BASE_URL`; confirm the S3 sync path `frontend/build/` still matches `build.outDir`.
- [x] 7.3 Coordinate the GitHub Actions secret rename: create `VITE_API_BASE_URL` with the same value as the existing `REACT_APP_API_BASE_URL` (via `gh secret set` if the value is available, otherwise flag it to the user as a pre-merge blocker for `master`); keep the old secret until the first green production deploy.

## 8. Review and Update Existing Unit Tests (MANDATORY)

- [x] 8.1 Review the migrated suites against `docs/frontend-standards.md` testing conventions (`renderWithI18n`, provider wrappers, `findBy*` preference): API rename only, no behavioral edits, no weakened assertions.
- [x] 8.2 Confirm the test count matches the Step 0.4 pre-migration baseline and no `.skip`/`.todo` was introduced (`grep -rn "\.skip\|\.todo" frontend/src --include="*.test.*"`).

## 9. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 9.1 Capture pre-test database baseline (row counts of key tables via Prisma/psql) — frontend unit tests must not touch the DB; the baseline proves it. → products=12, variants=24, customer_orders=196, customers=1086, suppliers=16.
- [x] 9.2 Run the full frontend suite `npx vitest run` and record totals/runtime. → 53 suites, 315/315 passing, 0 skipped (paridad exacta con baseline CRA).
- [x] 9.3 Run the backend suite (`npm test` in `backend/`) to confirm zero cross-impact (expected 844 passing). → 844/844, 85 suites.
- [x] 9.4 Verify post-test database state equals the baseline; restore and document if any mutation occurred. → Vitest DB-neutral (counts byte-identical); mutaciones del suite backend restauradas en transacción; post-restore = baseline exacto.
- [x] 9.5 Create report `openspec/changes/migrate-cra-to-vite/reports/YYYY-MM-DD-step-9-unit-test-and-db-verification.md` with commands, results, and DB pre/post comparison. → `reports/2026-07-10-step-9-unit-test-and-db-verification.md`.

## 10. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

> No backend endpoints change in this migration; this step verifies API reachability parity through the new Vite dev proxy (read-only calls, no DB restoration needed).

- [x] 10.1 Ensure backend (`:3000`) and Vite dev server (`:3001`) are running. → Backend Docker + Vite 6.4.3 dev server.
- [x] 10.2 Through the proxy, verify: `GET http://localhost:3001/api/public/products` → 200; `GET http://localhost:3001/api/public/categories` → 200; `GET http://localhost:3001/api/admin/products` without token → 401; `GET http://localhost:3001/health` (direct backend `:3000/health`) → 200. → Todos los códigos esperados.
- [x] 10.3 Compare each proxied response body/status with the direct backend call to confirm parity. → Cuerpos idénticos (diff vacío).
- [x] 10.4 Create report `openspec/changes/migrate-cra-to-vite/reports/YYYY-MM-DD-step-10-curl-endpoint-testing.md` with all commands and responses. → `reports/2026-07-10-step-10-curl-endpoint-testing.md`.

## 11. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 11.1 Ensure frontend and backend servers are running with a known database state. → Backend `:3000` + Vite `:3001` + build estático `:5050`, BD en baseline restaurado.
- [x] 11.2 Storefront workflow: navigate to `/`, browse the catalog, open a product detail page, switch language (i18n), confirm images/styles load (Bootstrap CSS order parity). → Catálogo 12 productos, detalle lazy-loaded, ES→EN OK, Bootstrap sin regresión (también en build de producción).
- [x] 11.3 Admin workflow: log in to the admin panel, list products, open a product with variants (verifies auth cookies/API calls through the new tooling). → Login admin y tabla de productos con datos reales.
- [x] 11.4 Verify no console errors related to env vars (`undefined` API base URL) or missing assets (`%PUBLIC_URL%` regressions) in either workflow. → Solo los 401 esperados de auth/refresh (idéntico pre-migración).
- [x] 11.5 Restore test environment (log out, close browser, revert any data touched). → Flujos read-only; navegador cerrado, sesión descartada.
- [x] 11.6 Create report `openspec/changes/migrate-cra-to-vite/reports/YYYY-MM-DD-step-11-e2e-testing.md` with workflows, snapshots, and outcomes. → `reports/2026-07-10-step-11-e2e-testing.md`.

## 12. Update Technical Documentation (MANDATORY)

- [x] 12.1 `docs/frontend-standards.md`: update the Technology Stack (CRA → Vite + Vitest), Environment Configuration (`VITE_*`, `import.meta.env`), Development Scripts, and rewrite the "CRA vs. Vite" decision record to document the completed, approved migration (approval: 2026-07-09 session). → Stack, ESLint, env vars, scripts, Seo/`index.html`, Stripe testing (`vi.mock`) y decision record actualizados.
- [x] 12.2 `docs/development_guide.md`: update `REACT_APP_*` references, scripts, and confirm the `frontend/build/` artifact path statements still hold. → Env de desarrollo, secrets de GitHub Actions y secuencia de deploy actualizados; `frontend/build/` sigue vigente (`build.outDir`).
- [x] 12.3 `frontend/README.md`: replace CRA boilerplate with Vite/Vitest instructions. → Reescrito completo (scripts, proxy, configuración, env vars).
- [x] 12.4 `openspec/config.yaml`: update the Tech stack context lines (Create React App → Vite; Jest → Vitest for frontend) so future changes inherit the correct stack. → Hecho (Jest queda como framework del backend).
- [x] 12.5 Document what was updated and why (in the PR body and change notes). `docs/data-model.md` and `docs/api-spec.yml` require no changes (no entity/API impact) — state this explicitly. → Documentado en el PR body. Además se actualizaron `docs/arquitectura-dev-prod.md`, `docs/aws-infrastructure.md` y `docs/backend-standards.md` (menciones a setupProxy/CRA proxy/`REACT_APP_*`). `docs/data-model.md` y `docs/api-spec.yml` sin cambios: la migración no toca entidades ni contratos de API.

## 13. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 13.1 Load and apply `ai-specs/skills/commit/SKILL.md` before any Git command.
- [ ] 13.2 Verify all tasks are `[x]`, the three reports exist under `openspec/changes/migrate-cra-to-vite/reports/`, and docs are updated.
- [ ] 13.3 Run and report `git status`, `git branch --show-current`, `git diff --stat`; stage only change-related files (never `.env*` values, `node_modules/`, `build/`, `coverage/`).
- [ ] 13.4 Create Conventional Commit(s), e.g. `chore(frontend): migrate build tooling from CRA to Vite and tests to Vitest`, referencing OpenSpec change `migrate-cra-to-vite` and test evidence.
- [ ] 13.5 Push `feature/migrate-cra-to-vite` to origin.
- [ ] 13.6 Check no duplicate PR exists, then `gh pr create --base develop` (never `master`) with summary, OpenSpec change name, and verification status; report the PR URL in chat.
