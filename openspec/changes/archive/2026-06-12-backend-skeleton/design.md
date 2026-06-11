## Context

The project has a complete documentation framework (data model, API spec, backend/frontend standards, DDD architecture guidelines) but zero application code. Before any business feature can be built, a compilable and runnable backend project must exist. This change establishes that foundation.

Current state: `backend/` directory does not exist. No `package.json`, no TypeScript config, no Prisma schema, no Docker setup.

Constraints from `docs/backend-standards.md`:
- DDD layered architecture: Presentation / Application / Domain / Infrastructure
- TypeScript strict mode
- Prisma ORM for PostgreSQL
- Jest with 90% coverage threshold
- Serverless Framework + AWS Lambda deployment target
- CORS for `FRONTEND_URL` (default `http://localhost:3001`)

## Goals / Non-Goals

**Goals:**
- Runnable Express server on port 3000 with one verifiable endpoint (`GET /health`)
- DDD folder structure ready for feature layers to be added
- Prisma configured (datasource + generator, no models yet)
- Docker Compose for local PostgreSQL
- Consistent error response format established from day one
- Infrastructure and application layer utilities (logger, Prisma singleton, validator)
- Admin vs. public route separation marked architecturally

**Non-Goals:**
- No domain entities, repositories, or application services
- No authentication/authorization
- No API endpoints beyond `/health`
- No frontend scaffold
- No CI/CD, no actual production deployment

## Decisions

### D1 — Single `src/index.ts` as Express entry point, separate `src/lambda.ts` as Lambda handler

**Decision**: Keep the Express app export in `index.ts` and wrap it with `serverless-http` only in `lambda.ts`.

**Rationale**: This keeps local development (`npm run dev` via `ts-node-dev`) cleanly separated from Lambda deployment. The app does not need to know it is running on Lambda.

**Alternative considered**: Single file that detects the environment and conditionally wraps. Rejected because it adds runtime branching and makes tests harder to isolate.

---

### D2 — Prisma client as a module-level singleton

**Decision**: Export a single `PrismaClient` instance from `src/infrastructure/prismaClient.ts`.

**Rationale**: Prevents connection pool exhaustion during development hot-reload cycles. Standard Prisma best practice for Node.js.

**Alternative considered**: Instantiate inside each repository. Rejected because it creates multiple connections in development.

---

### D3 — Environment variable validation at startup, not lazily

**Decision**: Validate required env vars (`DATABASE_URL`, `PORT`) in `src/index.ts` before mounting any routes. Throw immediately if missing.

**Rationale**: Fail-fast avoids confusing runtime errors deep in request handling. The error message is clear and actionable.

**Alternative considered**: Validate only when the variable is first used. Rejected because silent failures are harder to debug.

---

### D4 — Route separation via comment markers, not separate Express apps

**Decision**: Use a single Express app instance but separate routers mounted at `/api/admin` and `/api/public`, documented with comments in `src/index.ts` and `src/routes/`.

**Rationale**: For the skeleton phase, a single app with clear router prefixes is sufficient. Splitting into two separate Lambda functions would add operational complexity with no benefit yet.

**Alternative considered**: Two separate apps/Lambdas. Deferred to a future change if isolation becomes necessary.

---

### D5 — Logger as a simple structured wrapper over `console`

**Decision**: `src/infrastructure/logger.ts` wraps `console.log/warn/error` with a consistent `{ level, message, timestamp, ...meta }` structure.

**Rationale**: No external logging library needed at this stage. The wrapper makes it trivial to swap in Winston or Pino later without touching call sites.

**Alternative considered**: Winston from the start. Rejected to avoid dependency overhead before any real logging needs are established.

---

### D6 — `tsconfig.json` targets ES2020 with `rootDir: src`, `outDir: dist`

**Decision**: ES2020 target, `moduleResolution: node`, strict mode, no decorators.

**Rationale**: ES2020 is well-supported by Node.js v24 and avoids the overhead of downcompiling modern syntax. Strict mode is mandatory per `docs/backend-standards.md`.

---

### D7 — `docker-compose.yml` at project root (not inside `backend/`)

**Decision**: Place `docker-compose.yml` at the repository root so it can serve both backend (PostgreSQL) and potentially other services in future.

**Rationale**: The development guide already references `docker-compose up -d` from the project root.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `docker-compose.yml` not present causes `npm run dev` to fail silently if DB is not up | Prisma connection error is logged clearly at startup with a human-readable message |
| Prisma singleton causes stale connections after long idle periods in Lambda | `context.callbackWaitsForEmptyEventLoop = false` is set in `lambda.ts`; connection management will be revisited when Lambda deployment is active |
| 90% Jest coverage threshold with minimal code may require trivial tests | Threshold applies only once business code exists; the skeleton has no service/domain code to cover; config is correct but tests will be minimal until features are added |
| `_global` and `requirements` rule keys in `openspec/config.yaml` generate warnings | Fix the config.yaml rules structure in a follow-up documentation change |

## Open Questions

*(none — all decisions above are resolved for the skeleton scope)*
