# Spec: Frontend Skeleton

## Purpose

Defines the requirements for scaffolding the React TypeScript frontend skeleton, including project setup, routing, layout, placeholder pages, service stubs, shared components, environment configuration, TypeScript configuration, and Cypress e2e test stubs.

---

## Requirements

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

### Requirement: All admin routes are navigable
The system SHALL define React Router DOM v6 routes for all admin domains inside a nested `<Layout>` component. Required routes: `/products`, `/products/:id`, `/categories`, `/suppliers`, `/customers`, `/customer-orders`, `/customer-orders/:id`, `/supplier-orders`, `/supplier-orders/:id`, `/shipments`, `/return-requests`, `/refunds`. The root `/` SHALL redirect to `/products`.

#### Scenario: Route renders placeholder page
- **WHEN** a user navigates to any defined admin route (e.g. `/categories`)
- **THEN** the Layout renders with the navigation bar visible and the corresponding placeholder page component is displayed

#### Scenario: Unknown route falls back gracefully
- **WHEN** a user navigates to an undefined path (e.g. `/does-not-exist`)
- **THEN** a 404 not found page or redirect to `/products` is shown

### Requirement: Layout component provides top navigation
The system SHALL provide a `Layout` component that renders a Bootstrap-styled top navigation bar linking to the main admin sections. The navigation SHALL use `<NavLink>` from React Router DOM to highlight the active section.

#### Scenario: Active nav link is highlighted
- **WHEN** the user is on the `/categories` route
- **THEN** the Categories navigation link is visually highlighted (active state)

### Requirement: Placeholder page components exist for all routes
The system SHALL provide a TypeScript `.tsx` placeholder component under `src/pages/` for each admin route. Each placeholder SHALL display the section name and a "Coming soon" message without making any API calls.

#### Scenario: Placeholder page renders title
- **WHEN** the `/suppliers` route is visited
- **THEN** a page component renders with text identifying it as the Suppliers section

### Requirement: Typed service stub files exist for all domains
The system SHALL provide service stub files under `src/services/` for: `productService.ts`, `categoryService.ts`, `supplierService.ts`, `customerService.ts`, `customerOrderService.ts`, `supplierOrderService.ts`, `shipmentService.ts`, `returnRequestService.ts`, `refundService.ts`. Each stub SHALL export a typed service object with method signatures that throw `new Error('Not implemented')`.

#### Scenario: Service stub is importable without TypeScript errors
- **WHEN** a component imports a service stub (e.g. `import { categoryService } from '../services/categoryService'`)
- **THEN** TypeScript resolves the import and the exported methods are typed with no `any` return types

### Requirement: Shared LoadingSpinner and ErrorAlert components exist
The system SHALL provide reusable components `src/components/LoadingSpinner.tsx` and `src/components/ErrorAlert.tsx` using React Bootstrap. `LoadingSpinner` SHALL render a Bootstrap `<Spinner>`. `ErrorAlert` SHALL accept a `message: string` prop and render a dismissible Bootstrap `<Alert variant="danger">`.

#### Scenario: ErrorAlert renders with message
- **WHEN** `<ErrorAlert message="Something went wrong" />` is rendered
- **THEN** the component displays the error message in a red Bootstrap alert

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

### Requirement: Cypress is configured with stub e2e test files
The system SHALL have `cypress.config.ts` configured with `baseUrl: 'http://localhost:3001'` and `env.API_URL: 'http://localhost:3000'`. Stub test files SHALL exist under `cypress/e2e/` for: `products.cy.ts`, `categories.cy.ts`, `suppliers.cy.ts`, `customers.cy.ts`, `customerOrders.cy.ts`, `supplierOrders.cy.ts`, `shipments.cy.ts`, `returnRequests.cy.ts`, `refunds.cy.ts`.

#### Scenario: Cypress opens without configuration errors
- **WHEN** a developer runs `npx cypress open` inside `frontend/`
- **THEN** Cypress opens with the configured `baseUrl` and lists all stub test files

### Requirement: Storefront catalog reads only the public API
The storefront SHALL obtain all catalog data exclusively from our own public API (`/api/public/...`). The product service SHALL read from `GET /api/public/products` (and `/api/public/products/:slug` for detail) and the category service SHALL read from `GET /api/public/categories`. The storefront MUST NOT call the EscuelaJS external API (`api.escuelajs.co`) at runtime, and SHALL NOT depend on `/api/admin/...` routes for customer-facing data.

#### Scenario: Catalog page loads products from the public API
- **WHEN** a user opens `/catalog` with the backend and database running
- **THEN** the page fetches products from `/api/public/products` and renders the real imported products with category filtering, search, and sorting working against our own API

#### Scenario: No external or admin calls at runtime
- **WHEN** the storefront is used in the browser
- **THEN** no network request is made to `api.escuelajs.co`, and customer-facing catalog data is not fetched from `/api/admin/...`
