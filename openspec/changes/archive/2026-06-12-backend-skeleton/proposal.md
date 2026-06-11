## Why

The project has complete documentation and domain specifications but no running code. A backend skeleton is needed to give agents a compilable, testable foundation on which every future feature can be implemented incrementally without revisiting project setup.

## What Changes

- Create the `backend/` directory from scratch with the full DDD layered folder structure (Presentation, Application, Domain, Infrastructure).
- Add all configuration files: `package.json`, `tsconfig.json`, `jest.config.js`, `serverless.yml`, `.env.example`, `.gitignore`.
- Add `prisma/schema.prisma` with datasource and generator only (no models yet).
- Implement a working `GET /health` endpoint as the first verifiable slice.
- Implement global error middleware returning the standard `{ success, error }` response format.
- Add a centralized logger and a Prisma client singleton.
- Add a base `validator.ts` module in the application layer.
- Create `docker-compose.yml` at project root to run PostgreSQL locally.
- Establish the admin/public route separation comment structure in `src/routes/` and `src/index.ts`.

## Capabilities

### New Capabilities

- `backend-project-setup`: Full backend project configuration — package.json, TypeScript, Jest, ESLint, Serverless Framework, Prisma schema, environment setup, and docker-compose.
- `health-check`: `GET /health` endpoint that verifies the server is running and returns `{ "status": "ok" }`.
- `global-error-handler`: Express error middleware that catches all unhandled errors and responds with the standard `{ success: false, error: { message, code } }` format.
- `infrastructure-layer`: Prisma client singleton (`prismaClient.ts`) and centralized logger (`logger.ts`) with info/warn/error levels.
- `application-validator`: Base `validator.ts` module in the application layer with a `validateRequiredFields` utility function.

### Modified Capabilities

*(none — this is a greenfield change)*

## Impact

- **New directory**: `backend/` (does not exist yet).
- **New file at root**: `docker-compose.yml`.
- **No API changes**: `docs/api-spec.yml` is not affected (health check is infrastructure-only).
- **No data model changes**: `docs/data-model.md` is not affected (no Prisma models added).
- **Development guide**: `docs/development_guide.md` may need a minor update to confirm Node.js v24.16.0 requirement once the `package.json` engines field is set.
- **No frontend impact**.
- **No business logic**: no domain entities, no repositories, no services, no routes beyond health check.

## Non-goals

- No domain entities or Prisma models (those belong to feature-specific changes).
- No authentication or authorization middleware.
- No customer-facing or admin API endpoints beyond health check.
- No frontend scaffold (separate change).
- No CI/CD pipeline configuration.
- No production deployment (Serverless config is scaffolded only).
