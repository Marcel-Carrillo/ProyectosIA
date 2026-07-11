# Proposal: migrate-cra-to-vite

## Why

The frontend build toolchain, Create React App (`react-scripts@5.0.1`), was officially deprecated by the React team in February 2025: it no longer receives maintenance or security patches, pins an outdated webpack dependency chain (transitive `npm audit` findings), and blocks the path to modern React tooling. Migrating to Vite moves the storefront and admin frontend onto a maintained, security-patched build system. Stack-change approval (required by `docs/base-standards.md` §17 for technology stack and testing framework) was explicitly granted by the user in the 2026-07-09 audit session; this change records and executes that approval.

## What Changes

- Replace `react-scripts` with `vite` + `@vitejs/plugin-react` for dev server, production build, and (via Vitest) tests.
- Move `frontend/public/index.html` to `frontend/index.html`, remove CRA `%PUBLIC_URL%` placeholders, add the module entry script.
- **BREAKING (dev environment only):** rename environment variables `REACT_APP_API_BASE_URL` → `VITE_API_BASE_URL` and `REACT_APP_SITE_URL` → `VITE_SITE_URL`; replace `process.env.*` with `import.meta.env.*` in all 21 `src/` call sites. Every developer `.env.development` and the GitHub Actions secret must be renamed accordingly.
- Replace `frontend/src/setupProxy.js` and the `package.json` `"proxy"` field with `server.proxy` configuration in `vite.config.ts` (same behavior: `/api` → backend on `:3000`, dev server on `:3001`).
- Migrate the 51 frontend test files (271 tests) from CRA-embedded Jest to Vitest, converting `jest.*` APIs to `vi.*`.
- Keep the production build output directory as `build/` (`build.outDir: 'build'`) so the S3 sync path, CloudFront setup, and `deploy.yml` artifact path remain untouched.
- Add `eslint-config-react-app` as a direct devDependency (previously provided transitively by `react-scripts`) so the CI lint job keeps resolving.
- Update CI workflows (`pr-extra-quality.yml`, `deploy.yml`), `frontend/Dockerfile`, `docs/frontend-standards.md` (including the "CRA vs. Vite" decision record), `docs/development_guide.md`, `frontend/README.md`, and `.env*` templates.

## Non-goals

- Replacing `react-beautiful-dnd` with `@hello-pangea/dnd` (separate change).
- Migrating or reconfiguring Cypress (it keeps consuming the dev server on `:3001`).
- Upgrading React, TypeScript, or any runtime dependency.
- Any user-visible behavior, styling, routing, or API change.
- SSR/prerendering (already deferred in the standards).

## Capabilities

### New Capabilities

None. This change replaces the build/test toolchain behind existing capabilities without introducing new product behavior.

### Modified Capabilities

- `frontend-skeleton`: requirements currently mandate scaffolding with "Create React App 5", `REACT_APP_API_BASE_URL` env vars read via `process.env`, and CRA-based path alias resolution. These requirements change to Vite + `VITE_*` env vars read via `import.meta.env`, with the `@/*` alias resolved by `vite.config.ts`, and Vitest as the unit test runner.
- `production-deployment`: the CI/CD requirement currently specifies a "frontend CRA build with production API URL". It changes to a Vite build (`vite build`, output kept at `frontend/build/`) with the production API URL provided as `VITE_API_BASE_URL`; the S3 sync, CloudFront invalidation, and smoke-test requirements are unchanged.

## Impact

- **Customer-facing behavior:** none expected — parity is the acceptance criterion. Same bundle served from S3/CloudFront, same routes, same i18n/SEO behavior. Internal supplier fulfillment: not touched.
- **Supplier data exposure / order lifecycle / payment, fulfillment, return, refund statuses:** no impact. No API contract, domain entity (Product, ProductVariant, CustomerOrder, SupplierOrder, etc.), or backend code changes. The existing invariant that no supplier costs/credentials or `STRIPE_SECRET_KEY` reach the client is preserved.
- **Code:** `frontend/package.json`, new `vite.config.ts` / `tsconfig.node.json` / `env.d.ts`, moved `index.html`, deleted `setupProxy.js`, 21 env-var call sites, 51 test files, `setupTests.ts`, `tsconfig.json`.
- **Infrastructure/CI:** `.github/workflows/pr-extra-quality.yml` (test command syntax), `.github/workflows/deploy.yml` (env var name for the build step), GitHub Actions secret rename (`REACT_APP_API_BASE_URL` → `VITE_API_BASE_URL`, manual step), `frontend/Dockerfile` (copy `index.html` + Vite config files).
- **Docs:** `docs/frontend-standards.md` (stack, testing, env sections and the "CRA vs. Vite" decision record), `docs/development_guide.md`, `frontend/README.md`, `.env.example`.
- **Dependencies:** remove `react-scripts`, `@types/jest`; add `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `eslint-config-react-app` (direct). Removes the deprecated webpack chain from `npm audit` surface.
