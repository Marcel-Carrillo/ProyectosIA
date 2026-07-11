# Frontend — Vite + React + TypeScript

Storefront and admin panel for the ecommerce platform, built with [Vite](https://vite.dev/) and tested with [Vitest](https://vitest.dev/). See `docs/frontend-standards.md` at the repo root for coding conventions.

## Prerequisites

- Node.js 20+
- Backend API running on `http://localhost:3000` (see `docs/development_guide.md`)
- `frontend/.env.development` with the required variables (see `.env.example`)

## Available Scripts

### `npm start` (alias: `npm run dev`)

Runs the Vite dev server on [http://localhost:3001](http://localhost:3001) with hot module replacement. Requests to `/api/*` are proxied to the backend (`server.proxy` in `vite.config.ts`, target overridable via `BACKEND_URL`).

### `npm test`

Runs the full unit test suite once with Vitest (jsdom environment, Testing Library).

### `npm run test:watch`

Runs Vitest in interactive watch mode.

### `npm run build`

Builds the app for production into the `build/` folder (`build.outDir` in `vite.config.ts`). Output is minified with hashed filenames. Serve it locally with `npx serve -s build` to verify.

### `npm run cypress:open` / `npm run cypress:run`

End-to-end tests with Cypress (interactive / headless).

## Configuration

- `vite.config.ts` — dev server port and proxy, `@` → `src` alias, build output, Vitest config.
- `index.html` — application entry HTML (project root, not `public/`).
- `env.d.ts` — TypeScript declarations for `import.meta.env.VITE_*` variables; declare new variables here.
- Environment variables must be prefixed `VITE_` to be exposed to client code and are read via `import.meta.env.VITE_*`.
