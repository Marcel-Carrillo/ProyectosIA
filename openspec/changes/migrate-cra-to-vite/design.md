# Design: migrate-cra-to-vite

## Context

The frontend (`frontend/`) is a React 19 + TypeScript app built with Create React App (`react-scripts@5.0.1`), officially deprecated since February 2025. CRA currently provides four things that must be replaced with parity: the dev server on `:3001` with an `/api` proxy to the backend on `:3000` (`src/setupProxy.js` + `"proxy"` in `package.json`), the production build (output in `frontend/build/`, synced to S3 by `deploy.yml`), the embedded Jest test runner (51 test files, 271 tests), and the transitive `eslint-config-react-app` used by the CI lint job. Environment variables use the CRA convention (`process.env.REACT_APP_*`, 21 call sites in `src/`). Stakeholders: frontend developers (DX), CI/CD pipeline, and the Docker-based local dev environment. No user-visible behavior may change.

## Goals / Non-Goals

**Goals:**
- Replace CRA with Vite (`vite` + `@vitejs/plugin-react`) for dev server, build, and Vitest for unit tests, with full behavior parity.
- Keep all 271 frontend tests green, `tsc --noEmit` clean, and `eslint src` clean.
- Keep the deploy pipeline untouched except for the env var name in the build step.
- Update standards and docs so the recorded stack decision reflects reality.

**Non-Goals:**
- Replacing `react-beautiful-dnd` (separate change), Cypress changes, React/TS upgrades, SSR, or any runtime behavior change.

## Decisions

1. **`build.outDir: 'build'` instead of Vite's default `dist/`.** `deploy.yml` syncs `frontend/build/` to S3 and `docs/development_guide.md` references that path. Keeping `build/` confines the blast radius to the frontend package; the alternative (adopting `dist/`) would force coordinated CI + docs + S3 path changes for zero benefit.
2. **Vitest over standalone Jest.** Vitest reuses `vite.config.ts` (same transforms, aliases, env handling), has a near-identical API to Jest, and avoids maintaining a parallel babel/ts-jest toolchain. Standalone Jest would require its own transformer config and keep the duplication CRA used to hide.
3. **Convert `jest.*` to `vi.*` via codemod; no runtime alias.** `jest.mock` calls are hoisted by babel-jest; Vitest hoists only `vi.mock`. A `globalThis.jest = vi` shim would not be hoisted and would break every module mock. Mechanical rename (`jest.fn`→`vi.fn`, `jest.mock`→`vi.mock`, `jest.spyOn`→`vi.spyOn`, timer APIs→`vi.*`, `jest.clearAllMocks`→`vi.clearAllMocks`, `jest.Mock` type→`Mock` from `vitest`) plus manual review of `jest.requireActual`→`await vi.importActual` (becomes async).
4. **`test.globals: true` in Vitest config.** Keeps `describe`/`it`/`expect` as globals so test bodies don't need per-file imports, minimizing the diff across 51 files. `@testing-library/jest-dom` stays, imported from `setupTests.ts`.
5. **Proxy moves to `server.proxy` in `vite.config.ts`.** Same behavior as `setupProxy.js`: `/api` → `process.env.BACKEND_URL || 'http://localhost:3000'`, `changeOrigin: true`; dev server pinned to `port: 3001` (Vite does not read CRA's `PORT` env var). `setupProxy.js` and the `package.json` `"proxy"` field are deleted.
6. **Env var convention: `VITE_*` + `import.meta.env`.** Vite only exposes `VITE_`-prefixed vars to client code. `REACT_APP_API_BASE_URL` → `VITE_API_BASE_URL`, `REACT_APP_SITE_URL` → `VITE_SITE_URL`, replacing all 21 `process.env` call sites (17 services, `OAuthButtons.tsx`, `Seo.tsx`, `ContentPage.tsx`, `TwoFactorSetupPage.tsx`); existing `?? 'http://localhost:3000'` fallbacks are preserved. A new `env.d.ts` declares `ImportMetaEnv` for type safety; `"vite/client"` is added to `tsconfig.json` `types`.
7. **`eslint-config-react-app` becomes a direct devDependency.** The `eslintConfig` in `package.json` extends `react-app`/`react-app/jest`, resolved today through `react-scripts`. CI runs `npx eslint src`; without the direct dependency the lint job breaks the moment `react-scripts` is removed. Full ESLint flat-config migration is out of scope.
8. **Path alias `@/*` resolved in `vite.config.ts`.** `resolve.alias: { '@': '/src' }` mirrored in `test.alias` (or `vite-tsconfig-paths` plugin if manual aliases prove insufficient — decide at implementation, prefer the explicit alias for zero extra deps). The react-router `moduleNameMapper` entries currently in `package.json`'s `jest` block are ported only if Vitest resolution actually needs them (verify first; Vite's ESM resolution likely makes them obsolete).
9. **`index.html` moves to `frontend/` root, CRA placeholders removed.** `%PUBLIC_URL%/x` → `/x` (assets stay in `public/`, served at root), plus `<script type="module" src="/src/index.tsx"></script>`. Google Fonts links, `lang="es"`, `theme-color`, and `<div id="root">` are preserved verbatim.

## Risks / Trade-offs

- [Deploy breaks because the GitHub Actions secret still has the old name] → `deploy.yml` reads `VITE_API_BASE_URL`; renaming the repo secret is a manual step recorded in tasks.md and must happen before merging to `master`. The old secret is kept until the first green deploy.
- [Some of the 271 tests depend on Jest-specific semantics (hoisting order, timer defaults, `requireActual`)] → run the full suite after the codemod and fix file-by-file; the suite count is the acceptance gate, no test may be skipped or deleted.
- [ESLint behavior drift: `react-app/jest` preset assumes Jest globals] → keep the preset (Vitest's globals are name-compatible); if it errors on unresolved plugins, pin the missing `eslint-plugin-*` peers as devDependencies.
- [Dockerfile no longer copies everything the build needs] → it must additionally copy `index.html`, `vite.config.ts`, `tsconfig.node.json`, `env.d.ts`; verified by building the image in the dev environment.
- [CSS/JSON/lazy-import differences between webpack and Vite (Bootstrap CSS order, `resolveJsonModule` locales, `React.lazy` storefront pages)] → covered by running the real app: dev smoke (catalog page + one API call through the proxy) and a local production build served statically.
- [Cypress E2E assumptions about the dev server] → Cypress only targets `http://localhost:3001`; port parity keeps it working. Not migrated, only re-run.

## Migration Plan

1. Branch/worktree per Step 0 of tasks.md (no work on `develop`/`master`).
2. Introduce Vite config + root `index.html` + env renames + proxy port; verify `npm run dev` parity manually.
3. Migrate tests to Vitest (codemod + fixes) until 271/271 pass.
4. Update ESLint/tsconfig/Dockerfile/CI/docs; verify lint, typecheck, Docker build, and production build locally.
5. PR to `develop`. Before any deploy to production: rename the GitHub secret, then merge; watch the first `deploy.yml` run and post-deploy smoke tests.
6. **Rollback:** revert the merge commit — CRA config is fully restored by the revert since no external state changes except the secret rename (old secret is retained during transition).

## Open Questions

- None blocking. Two implementation-time verifications flagged: whether react-router ESM aliases from the old `jest.moduleNameMapper` are still needed under Vitest, and whether `browserslist` must stay for PostCSS/autoprefixer.
