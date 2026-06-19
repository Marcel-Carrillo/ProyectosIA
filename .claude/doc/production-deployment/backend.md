# Backend Implementation Plan — production-deployment (KAN-26)

> This document covers only backend-scoped file changes.
> Non-backend files (`.github/workflows/deploy.yml`, `scripts/smoke.sh`, `docs/`) are out of scope here.

---

## File 1: `backend/package.json`

### Current State

- `engines.node` is `">=24.16.0"` — conflicts with the `nodejs20.x` Lambda runtime in `serverless.yml`.
- `devDependencies` contains no `serverless` or `serverless-offline` entries, even though `serverless-offline` is already referenced in `plugins` in `serverless.yml`.
- `scripts` has no `deploy:lambda` entry.
- Note: `backend-standards.md` mentions `npm run build:lambda` — that is an outdated doc artefact. The task spec says to add `deploy:lambda`, not `build:lambda`. The existing `build` script (`tsc`) is the build step; `deploy:lambda` is the deploy alias.

### Exact Changes Needed

1. **`engines.node`** — change the value from `">=24.16.0"` to `">=20.0.0"`.

2. **`devDependencies`** — add two new entries (insert alphabetically between `"ts-node-dev"` and `"typescript"` or at the end of the block — exact position is cosmetic):
   - `"serverless": "^3.38.0"` — use the latest stable v3 release. Do NOT use v4 (it is a paid product requiring a Serverless Framework account). Run `npm install serverless --save-dev` to confirm the resolved version before hardcoding.
   - `"serverless-offline": "^13.8.0"` — v13 is the compatible companion for Serverless v3. Run `npm install serverless-offline --save-dev` to confirm.

3. **`scripts`** — add a new entry after `"db:seed"`:
   ```
   "deploy:lambda": "serverless deploy"
   ```

4. After adding the devDependencies, run `npm install` in `backend/` to update `package-lock.json`. Verify `node_modules/.bin/serverless` and `node_modules/.bin/serverless-offline` exist after install.

### Edge Cases / Gotchas

- Changing `engines.node` is informational; it does not change the actual Node version used at runtime. However, CI and local tooling that honour `engines` (e.g. Volta, nvm's `.nvmrc`) will now align to 20. If a developer has Node 24 locally, this change has no breaking effect.
- `serverless-http` is already in `dependencies` (not devDependencies) — it is a runtime dependency used by `lambda.ts`. Do not move it.
- The `allowScripts` block and `prisma` block at the bottom of `package.json` are unchanged.

---

## File 2: `backend/serverless.yml`

### Current State

```yaml
provider:
  environment:
    NODE_ENV: production
    DATABASE_URL: ${env:DATABASE_URL}
    FRONTEND_URL: ${env:FRONTEND_URL}
```

Only 3 of ~13 required vars are injected. `DATABASE_URL` and `FRONTEND_URL` are pulled from the local process environment (`${env:...}`), which works locally with `.env` but does not work in CI where no `.env` file is loaded.

### Exact Changes Needed

**Replace the entire `provider.environment` block** with:

```yaml
provider:
  name: aws
  runtime: nodejs20.x
  region: eu-west-1
  environment:
    NODE_ENV: production
    DATABASE_URL: ${ssm:/ecommerce/prod/DATABASE_URL}
    FRONTEND_URL: ${ssm:/ecommerce/prod/FRONTEND_URL}
    ADMIN_JWT_SECRET: ${ssm:/ecommerce/prod/ADMIN_JWT_SECRET}
    ADMIN_JWT_EXPIRES_IN: ${ssm:/ecommerce/prod/ADMIN_JWT_EXPIRES_IN}
    CUSTOMER_JWT_SECRET: ${ssm:/ecommerce/prod/CUSTOMER_JWT_SECRET}
    CUSTOMER_JWT_EXPIRES_IN: ${ssm:/ecommerce/prod/CUSTOMER_JWT_EXPIRES_IN}
    COOKIE_SECRET: ${ssm:/ecommerce/prod/COOKIE_SECRET}
    SMTP_HOST: ${ssm:/ecommerce/prod/SMTP_HOST}
    SMTP_PORT: ${ssm:/ecommerce/prod/SMTP_PORT}
    SMTP_SECURE: ${ssm:/ecommerce/prod/SMTP_SECURE}
    SMTP_USER: ${ssm:/ecommerce/prod/SMTP_USER}
    SMTP_PASS: ${ssm:/ecommerce/prod/SMTP_PASS}
    SMTP_FROM: ${ssm:/ecommerce/prod/SMTP_FROM}
```

`NODE_ENV` stays as a literal string `production` — it is not a secret.

**After `plugins`, append a `resources:` section** with a documentation comment for the CloudWatch alarm (it is not created by the framework deploy — it is a manual one-time setup):

```yaml
# resources:
#   Resources:
#     # CloudWatch alarm — manual one-time setup (not deployed by serverless deploy):
#     #   Alarm name:   ecommerce-api-5xx-high
#     #   Namespace:    AWS/ApiGateway
#     #   Metric:       5XXError
#     #   Threshold:    >= 5 errors
#     #   Period:       300 seconds (5 min)
#     #   Evaluation:   1 period
#     # Create via AWS Console → CloudWatch → Alarms, or via AWS CLI:
#     #   aws cloudwatch put-metric-alarm --alarm-name ecommerce-api-5xx-high \
#     #     --metric-name 5XXError --namespace AWS/ApiGateway \
#     #     --statistic Sum --period 300 --evaluation-periods 1 --threshold 5 \
#     #     --comparison-operator GreaterThanOrEqualToThreshold
```

The `functions` block and `plugins` block remain unchanged.

### Edge Cases / Gotchas

- `${ssm:/ecommerce/prod/DATABASE_URL}` is resolved at **deploy time** by the Serverless Framework CLI, not at Lambda start. The IAM role/user running `serverless deploy` must have `ssm:GetParameter` permission on `/ecommerce/prod/*`. If the SSM parameters do not yet exist, `serverless deploy` will fail with a parameter not found error.
- For local dev with `serverless-offline`, the developer still needs a local `.env` file. `serverless-offline` does not resolve SSM refs against AWS; it reads from the local environment instead. Document this in `docs/development_guide.md` (out of scope for this plan, but flag for the implementer).
- `SMTP_STRICT` and `MAILPIT_API_URL` are development-only variables (`SMTP_STRICT=false` default, `MAILPIT_API_URL` local only). They are intentionally excluded from the SSM list. `SMTP_STRICT` can be omitted in production (defaults to `false`); if production needs it set to `true`, add `/ecommerce/prod/SMTP_STRICT` later.
- OAuth vars (`GOOGLE_CLIENT_ID`, etc.) are intentionally excluded from the SSM list per the design doc. Add them only when OAuth is wired in production.
- `PORT` is not needed in Lambda (API Gateway handles port routing); the existing `index.ts` startup block reads `PORT` from env but the Lambda never calls `app.listen`. No action needed.

---

## File 3: `backend/.env.example`

### Current State

Contains all variables except `COOKIE_SECRET`. The file has 38 lines covering `DATABASE_URL`, `PORT`, `NODE_ENV`, `FRONTEND_URL`, `API_PUBLIC_URL`, admin/customer JWT vars, SMTP vars, `SMTP_STRICT`, `MAILPIT_API_URL`, and OAuth vars. All of these are present.

Missing entry: `COOKIE_SECRET`.

### Exact Changes Needed

Add `COOKIE_SECRET` to the **Admin auth** section (after `ADMIN_JWT_EXPIRES_IN`, before the blank line separating the Customer auth section), so auth-related secrets stay grouped:

```
# Admin auth
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=AdminPass1
ADMIN_JWT_SECRET=change-me-admin-jwt-secret-min-32-chars
ADMIN_JWT_EXPIRES_IN=15m
COOKIE_SECRET=change-me-cookie-secret-min-32-chars
```

The comment above the line is optional but recommended: `# Used by cookie-parser to sign/verify cookies`.

No other lines need to be added or removed — all other required keys are already present.

### Edge Cases / Gotchas

- `COOKIE_SECRET` must be at least 32 characters in production (the spec says so). The placeholder value `change-me-cookie-secret-min-32-chars` is 36 chars and satisfies the constraint while being obviously a placeholder.
- In `index.ts`, the `cookieParser` call has a fallback chain: `COOKIE_SECRET || JWT_SECRET || 'change-me-in-production'`. The `JWT_SECRET` key does not appear in `.env.example` at all, which means it was already removed. With the production validation added in `index.ts` (see File 4), `COOKIE_SECRET` will be required in production, so the fallback is only relevant for dev/test environments where the example value is used.

---

## File 4: `backend/src/index.ts`

### Current State

Lines 25–30:
```typescript
const requiredEnvVars = ['DATABASE_URL', 'PORT'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

Only `DATABASE_URL` and `PORT` are validated unconditionally. There is no production-specific validation. The app would silently start in production with missing JWT secrets, COOKIE_SECRET, or SMTP credentials and fail only at the point of the first auth/email request.

### Exact Changes Needed

**After the existing `requiredEnvVars` loop (after line 30), add** a production-only fast-fail block:

```typescript
if (process.env.NODE_ENV === 'production') {
  const productionRequiredVars = [
    'ADMIN_JWT_SECRET',
    'CUSTOMER_JWT_SECRET',
    'COOKIE_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
  ];
  const missingProdVars = productionRequiredVars.filter((key) => !process.env[key]);
  if (missingProdVars.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missingProdVars.join(', ')}`
    );
  }
}
```

This uses the `filter + join` pattern rather than throwing on the first missing key, so the error message lists all missing vars at once — better developer experience when multiple SSM parameters are absent.

No other changes to `index.ts`. The `cookieParser` line (48), CORS config, and route registration blocks are unchanged.

### Edge Cases / Gotchas

- The block must be placed **before** `export const app = express()` (i.e., at lines 25–31 of the current file, keep it right after the existing loop). Placing it after `app` is created would still work but is semantically odd — fail before you allocate resources.
- The test environment (`NODE_ENV=test`) intentionally skips the production check. Tests do not set `NODE_ENV=production`, so this is safe.
- `SMTP_STRICT` is deliberately excluded from this list. It is an optional override (`false` is the safe default). Including it would require every dev environment to set it.
- `ADMIN_JWT_EXPIRES_IN` and `CUSTOMER_JWT_EXPIRES_IN` are excluded from the hard-fail list because they have sensible defaults coded into the auth service. The design doc does not require them to be present for the app to start safely. Include them only if the auth service has no default fallback (verify before implementing).
- `FRONTEND_URL` is already required by the CORS config. It defaults to `'http://localhost:3001,http://localhost:3002'` via the `||` operator on line 34, so it does not strictly need to be in the production required list. However, if CORS silently allowing all origins in production is considered a risk, add it. The spec does not explicitly require it in the fast-fail list, so leave it out for now.

---

## File 5: `backend/src/routes/healthRoutes.ts`

### Current State

```typescript
// Health routes are mounted at /health in src/index.ts
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

export default router;
```

Static response, no DB probe, no async handler.

### Exact Changes Needed

**Replace the entire file content** with:

```typescript
// Health routes are mounted at /health in src/index.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../infrastructure/prismaClient';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

export default router;
```

Key points:
- Import `prisma` from `'../infrastructure/prismaClient'` — this is the shared singleton that all other repositories use. Do NOT create a new `new PrismaClient()` instance here; that would create a separate connection pool.
- Handler becomes `async`.
- `prisma.$queryRaw\`SELECT 1\`` is the lightest possible DB probe — no table scans, no application-level query parsing.
- On success: HTTP 200, body `{ status: 'ok', db: 'up' }`.
- On failure: HTTP 503, body `{ status: 'error', db: 'down' }`. The `catch` block must NOT log the error details in the response body (per spec: response must only contain `status` and `db`).
- The catch clause parameter is intentionally omitted (`catch {` without a variable) to suppress the unused-variable TypeScript lint warning. If the project's ESLint config does not support this syntax (requires TypeScript 4.0+), use `catch (_e)` instead.

### Edge Cases / Gotchas

- **Response body discipline**: The spec explicitly states the response MUST contain only `status` and `db`. Do not add `timestamp`, `version`, `environment`, or any other field. The test in File 6 will assert on exact key count.
- **Error logging**: The `catch` block should log the DB error internally (using the project logger) but NOT expose it in the response. However, since the health endpoint is a presentation-layer route and the logger import would add a dependency, keep it simple for MVP: just return the 503 body without logging. If the team wants logging, add `import { logger } from '../infrastructure/logger'` and call `logger.error('Health check DB probe failed', { error: e })` inside the catch.
- **Lambda connection pool**: On Lambda, each function instance holds one Prisma connection. `SELECT 1` is cheap but still creates a connection if none is warm. The CloudWatch alarm is configured to call `/health` at low frequency (5-minute intervals) to avoid connection churn.
- **Import path**: `'../infrastructure/prismaClient'` — the health route file is at `src/routes/healthRoutes.ts`, so `..` navigates to `src/`, and `infrastructure/prismaClient` is `src/infrastructure/prismaClient.ts`. Verify the relative path resolves correctly in the TypeScript compilation.

---

## File 6: `backend/src/routes/__tests__/healthRoutes.test.ts` (NEW FILE)

### Current State

The directory `backend/src/routes/__tests__/` does not exist. This file must be created from scratch.

### Exact Changes Needed

Create the file `backend/src/routes/__tests__/healthRoutes.test.ts` with three test cases covering the spec requirements.

**Structure**:

1. **Module-level mock**: Mock `'../../infrastructure/prismaClient'` so that `prisma.$queryRaw` is a jest mock function. This prevents actual DB calls during unit tests. Use `jest.mock(...)` at the top of the file (before imports).

2. **Test case 1 — DB reachable → 200 `{status:'ok', db:'up'}`**:
   - Arrange: mock `prisma.$queryRaw` to resolve (return `undefined` or `[{1:1}]`).
   - Act: make a `GET /health` request via supertest against the `app` from `../../index` (or create a minimal express app that mounts the router — see gotcha below).
   - Assert: response status is 200, response body deeply equals `{ status: 'ok', db: 'up' }`.

3. **Test case 2 — DB unreachable → 503 `{status:'error', db:'down'}`**:
   - Arrange: mock `prisma.$queryRaw` to reject with `new Error('Connection refused')`.
   - Act: `GET /health`.
   - Assert: response status is 503, response body deeply equals `{ status: 'error', db: 'down' }`.

4. **Test case 3 — Response body contains only `status` and `db`**:
   - Can be combined with test case 1 or written separately.
   - Assert: `Object.keys(response.body)` has length 2 and contains exactly `['status', 'db']`.

**Preferred test setup pattern** — mount the router on a minimal express app, not the full `app` from `index.ts`:

```typescript
import express from 'express';
import request from 'supertest';
import healthRouter from '../healthRoutes';
import { prisma } from '../../infrastructure/prismaClient';

jest.mock('../../infrastructure/prismaClient', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

const app = express();
app.use('/health', healthRouter);

const mockQueryRaw = prisma.$queryRaw as jest.MockedFunction<typeof prisma.$queryRaw>;
```

This avoids triggering the `requiredEnvVars` validation in `index.ts` (which would throw in the test environment unless all env vars are set), and keeps the test focused on the health route only.

**Why not use the full `app`**: `index.ts` has a top-level `requiredEnvVars` loop that throws if `DATABASE_URL` or `PORT` are missing. In Jest's test environment those may not be set, and even if they are, importing the full app would load all routes and middleware unnecessarily.

### Edge Cases / Gotchas

- `prisma.$queryRaw` is a tagged template literal function (`$queryRaw`\`SELECT 1\``). When mocking with Jest, mock it as a regular function: `jest.fn().mockResolvedValue(...)`. Jest does not distinguish tagged template calls from regular calls for mocking purposes.
- The mock must be set up with `jest.mock(...)` at module scope (top of the file), before any `import` that transitively imports `prismaClient`. Jest hoists `jest.mock` calls to the top automatically.
- Reset mock implementation between tests with `beforeEach(() => { mockQueryRaw.mockReset(); })` to prevent test bleed.
- The `__tests__` directory needs to be created. The file path is `backend/src/routes/__tests__/healthRoutes.test.ts`.
- TypeScript will need `@types/supertest` (already present in devDependencies) and the Jest types (already present). No new dev dependencies needed for the test file.
- The test file must be discoverable by Jest. Check `backend/jest.config.js` — if `testMatch` or `testPathPattern` is configured restrictively, ensure `__tests__/*.test.ts` under `src/routes/` is included. Based on the project's existing test structure (other `__tests__` dirs exist under `src/`), the default Jest glob `**/__tests__/**/*.ts` should pick it up.

---

## Implementation Order

Execute in this order to avoid compilation errors:

1. `backend/package.json` — engines + devDependencies + script, then `npm install`
2. `backend/.env.example` — add `COOKIE_SECRET`
3. `backend/serverless.yml` — extend environment block + resources comment
4. `backend/src/index.ts` — add production env validation block
5. `backend/src/routes/healthRoutes.ts` — replace with DB-probe implementation
6. `backend/src/routes/__tests__/healthRoutes.test.ts` — create test file
7. Run `npm run build` in `backend/` — confirm no TypeScript errors
8. Run `npx jest --testPathPattern="healthRoutes"` — confirm all 3 tests pass
9. Run full test suite `npm test -- --watchAll=false` — confirm no regressions

---

## Summary of Critical Decisions

| Decision | Value | Rationale |
|---|---|---|
| Serverless version | v3 (not v4) | v4 requires paid account; v3 is LTS-stable |
| engines.node | `>=20.0.0` | Aligns with `nodejs20.x` Lambda runtime |
| Prisma probe | `$queryRaw\`SELECT 1\`` | Lightest possible; no table dependency |
| Prisma instance in health route | Import shared `prismaClient` singleton | Avoid creating extra connection pool |
| Production fail-fast | Lists all missing vars at once | Better DX than single-variable throw |
| SSM resolution | At `serverless deploy` time | No runtime latency; no SDK dependency |
| Test setup | Minimal express app, not full `app` | Avoids index.ts env var validation side-effects |
