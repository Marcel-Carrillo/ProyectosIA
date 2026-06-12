## Context

The backend Express + TypeScript + Prisma API is running on port 3000 and has endpoints for categories. No frontend exists yet. Store administrators currently have no browser-based interface. The frontend standards document (`docs/frontend-standards.md`) already specifies the full tech stack, folder layout, routing conventions, service patterns, and Cypress testing approach — this design follows those standards exactly.

## Goals / Non-Goals

**Goals:**
- Scaffold the `frontend/` directory with Create React App (`--template typescript`).
- Install all dependencies mandated by the frontend standards.
- Wire up React Router DOM v6 with all admin routes in a nested layout.
- Create typed placeholder page components for every route.
- Create typed service stub files for all domains (empty method signatures, throw `Not implemented`).
- Create shared `LoadingSpinner` and `ErrorAlert` components.
- Configure TypeScript strict mode + `@/*` path alias.
- Configure Cypress with `baseUrl` and `API_URL`; scaffold stub test files.
- Provide `.env.development` and `.env.example` with `REACT_APP_API_BASE_URL`.

**Non-Goals:**
- Authentication / authorization.
- Real API calls or data fetching.
- UI design beyond default Bootstrap styling.
- Production build or deployment configuration.
- Backend changes of any kind.
- Customer-facing storefront pages (this is admin backoffice only).

## Decisions

### D1: Create React App with TypeScript template (not Vite)

The frontend standards document mandates CRA 5 + TypeScript 4.9.5. Vite is faster but is not approved yet (see Approval Rules — technology stack changes require explicit user approval). CRA is used as-is.

**Alternative considered**: Vite + React — rejected because it would change the approved tech stack without authorization.

### D2: Nested layout route with React Router `<Outlet>`

A single `Layout` component with a `<Navbar>` wraps all pages via React Router's nested route pattern. This avoids prop-drilling the nav into every page and matches the navigation pattern specified in the standards.

```
<Route path="/" element={<Layout />}>
  <Route index element={<Navigate to="/products" />} />
  <Route path="products" element={<ProductsPage />} />
  ...
</Route>
```

**Alternative considered**: Each page renders its own Navbar — rejected because it duplicates the nav and makes global nav changes expensive.

### D3: Service stubs throw `Error('Not implemented')`

Service files are scaffolded with typed method signatures that throw `new Error('Not implemented')`. This keeps TypeScript happy (no implicit `any`) and makes it obvious when a feature needs implementation rather than silently returning empty data.

**Alternative considered**: Return empty arrays/null — rejected because silent stubs can mask missing wiring during development.

### D4: Single `frontend-skeleton` spec (not per-domain specs)

This change is infrastructure-only — no domain behavior is being specified. A single spec covering the skeleton's requirements is appropriate. Per-domain specs (product management, order management, etc.) belong to their own future changes.

### D5: `.env.development` for local dev, `.env.example` for documentation

CRA reads `.env.development` automatically in `npm start`. `.env.example` is committed to document required variables without exposing secrets.

## Risks / Trade-offs

- **CRA is in maintenance mode upstream** → Mitigation: CRA is the approved tool; migration to Vite is a separate future change.
- **Stub services that throw will break any component that calls them** → Mitigation: Placeholder pages make no service calls; this is expected behavior for a skeleton.
- **Bootstrap and React Bootstrap version compatibility** → Mitigation: Install exact versions from the standards document.

## Migration Plan

1. Run `npx create-react-app frontend --template typescript` from the project root.
2. Install additional dependencies via `npm install` in `frontend/`.
3. Replace generated `App.tsx` and `index.tsx` with skeleton implementations.
4. Create all page, component, and service files.
5. Configure `tsconfig.json`, Cypress, and environment files.
6. Verify `npm start` runs on port 3001 (set `PORT=3001` in `.env.development`).
7. Verify TypeScript compiles without errors.

**Rollback**: Delete the `frontend/` directory — no backend state is affected.

## Open Questions

_None. All decisions are covered by the existing frontend standards._
