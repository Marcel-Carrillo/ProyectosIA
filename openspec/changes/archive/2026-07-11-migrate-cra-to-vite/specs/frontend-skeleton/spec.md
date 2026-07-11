# Delta Spec: frontend-skeleton (migrate-cra-to-vite)

## ADDED Requirements

### Requirement: Frontend project builds and serves with Vite
The system SHALL build and serve the `frontend/` project with Vite (`vite` + `@vitejs/plugin-react`). The dev server SHALL run on port 3001 (configured via `server.port` in `vite.config.ts`) and SHALL proxy `/api` requests to the backend at `http://localhost:3000` (overridable via `BACKEND_URL`) with `changeOrigin` enabled. The production build SHALL emit its artifacts to `frontend/build/` (`build.outDir: 'build'`). The entry document SHALL be `frontend/index.html` loading `/src/index.tsx` as a module script, with no CRA `%PUBLIC_URL%` placeholders. The project SHALL keep all runtime dependencies specified in `docs/frontend-standards.md`: React Router DOM 6, Bootstrap 5, React Bootstrap, React Bootstrap Icons, Axios, React DatePicker, React Beautiful DND, and Cypress 14.

#### Scenario: Application starts without errors
- **WHEN** a developer runs `npm run dev` (or `npm start`) inside `frontend/`
- **THEN** Vite serves the application on port 3001 with no compilation errors

#### Scenario: Dev proxy forwards API calls to the backend
- **WHEN** the app running on `http://localhost:3001` requests `/api/public/products` with the backend running on port 3000
- **THEN** the request is proxied to the backend and returns the backend response (HTTP 200)

#### Scenario: Production build emits servable artifacts
- **WHEN** a developer runs `npm run build` inside `frontend/`
- **THEN** Vite writes the production bundle to `frontend/build/` and the built app loads correctly when served statically

### Requirement: Frontend unit tests run with Vitest
The system SHALL run frontend unit tests with Vitest configured in `vite.config.ts` (`test` section) with `globals: true`, `environment: 'jsdom'`, and `setupFiles: './src/setupTests.ts'`. Tests SHALL use `vi.*` APIs (not `jest.*`) for mocks, spies, and timers, and SHALL keep using React Testing Library and `@testing-library/jest-dom` matchers. The full pre-migration test suite SHALL pass without deleted or skipped tests.

#### Scenario: Full test suite passes
- **WHEN** a developer runs `npm test` (i.e. `vitest run`) inside `frontend/`
- **THEN** all existing test files pass with the same total test count as the pre-migration baseline captured at implementation start (271 tests as of the proposal) and exit code 0

#### Scenario: No residual Jest API usage
- **WHEN** the codebase is searched for `jest.` API calls in `frontend/src/`
- **THEN** no occurrences remain (all mocks, spies, and timers use `vi.*`)

## MODIFIED Requirements

### Requirement: Environment configuration files are present
The system SHALL include `.env.development` with `VITE_API_BASE_URL=http://localhost:3000`, and `.env.example` documenting all required environment variables using the `VITE_*` prefix. Client code SHALL read environment variables via `import.meta.env.VITE_*` (never `process.env.REACT_APP_*`), with types declared in an `env.d.ts` `ImportMetaEnv` interface. The dev server port SHALL be configured in `vite.config.ts` (`server.port: 3001`), not via a `PORT` env var. `.env.development` SHALL NOT be committed to version control.

#### Scenario: API base URL is available at runtime
- **WHEN** a service file reads `import.meta.env.VITE_API_BASE_URL`
- **THEN** the value resolves to `http://localhost:3000` in the development environment

### Requirement: TypeScript is configured with strict mode and path alias
The `tsconfig.json` SHALL have `"strict": true` and path alias `"@/*": ["src/*"]` so that imports like `import { LoadingSpinner } from '@/components/LoadingSpinner'` resolve correctly. The same alias SHALL be configured in `vite.config.ts` (`resolve.alias`) so that dev server, build, and Vitest resolve it identically, and `tsconfig.json` `types` SHALL include `"vite/client"` for `import.meta.env` typing.

#### Scenario: Path alias import resolves
- **WHEN** a component uses `import X from '@/components/X'`
- **THEN** TypeScript and Vite resolve the import to `src/components/X.tsx` without errors

## REMOVED Requirements

### Requirement: Frontend project is scaffolded with CRA TypeScript template
**Reason**: Create React App (`react-scripts`) was officially deprecated by the React team in February 2025 and no longer receives maintenance or security patches. The build toolchain is replaced by Vite with explicit user approval (2026-07-09 session, per `docs/base-standards.md` §17).
**Migration**: Superseded by the ADDED requirement "Frontend project builds and serves with Vite". Runtime dependencies are unchanged; `react-scripts` is removed, `vite` + `@vitejs/plugin-react` + `vitest` are added as devDependencies.
