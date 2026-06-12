## Why

The backend API is operational but there is no frontend application yet. To allow store administrators to manage the catalog and orders through a browser, the project needs a fully scaffolded React + TypeScript frontend that establishes the folder structure, routing, service layer, and testing configuration — ready for feature pages to be built on top without re-architecting anything.

## What Changes

- A new `frontend/` directory is created at the project root using Create React App with the TypeScript template.
- All required npm dependencies are installed: React Router DOM 6, Bootstrap 5, React Bootstrap, React Bootstrap Icons, Axios, React DatePicker, React Beautiful DND, Cypress.
- A `Layout` component with a top navigation bar is set up to wrap all pages using React Router's nested route pattern.
- Placeholder page components are created for every domain route defined in the frontend standards.
- Service stub files are created for all domains (products, categories, suppliers, customers, customer orders, supplier orders, shipments, return requests, refunds) with typed, empty method signatures.
- Shared utility components (`LoadingSpinner`, `ErrorAlert`) are scaffolded.
- Environment variable files (`.env.development`, `.env.example`) are created with `REACT_APP_API_BASE_URL`.
- TypeScript is configured with strict mode and the `@/*` path alias.
- Cypress is configured with `baseUrl` and `API_URL` environment variables; stub e2e test files are created for each domain.

## Capabilities

### New Capabilities

- `frontend-skeleton`: Base React + TypeScript application scaffold for the admin interface of the women's fashion ecommerce store. Covers project setup, routing, service stubs, shared components, environment configuration, and Cypress scaffolding.

### Modified Capabilities

_None. This change introduces the frontend layer from scratch and does not alter any existing backend spec requirements._

## Impact

- **New directory**: `frontend/` at project root.
- **No backend changes**: No API endpoints, data models, or backend code are modified.
- **No customer-facing behavior**: This is an admin/backoffice interface skeleton only.
- **Dependencies**: The frontend will consume the existing REST API documented in `docs/api-spec.yml`.
- **Non-goals**: No authentication, no real data fetching, no production deployment configuration, no UI design system beyond Bootstrap defaults in this change.
