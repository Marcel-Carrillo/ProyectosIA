## Why

The project runs exclusively in local development (Docker Postgres + `npm run dev`). Every feature built across epics M1–M5 — catalog, orders, shipments, returns, refunds, authentication — produces zero realized business value until there is a reachable production environment. This ticket unblocks go-live.

## What Changes

- **Secret management**: all production secrets (JWT, cookie, SMTP, OAuth, DB URL) moved to AWS SSM Parameter Store / Secrets Manager; `.env` files excluded from git; `backend/.env.example` updated with missing keys (`COOKIE_SECRET`).
- **Build pipeline fix (prerequisite)**: `serverless` and `serverless-offline` added to `backend/package.json` devDependencies; `build:lambda` script ensured; Node runtime reconciled (`nodejs20.x` in `serverless.yml` vs `engines.node >=24`); `serverless.yml` `provider.environment` extended with all runtime secrets the app reads.
- **CI/CD deploy workflow** (`.github/workflows/deploy.yml`, new): on push to `master`, runs build → `prisma migrate deploy` → Serverless deploy (backend Lambda + API Gateway) → S3/CloudFront sync (frontend CRA build) → post-deploy smoke tests; pipeline fails if smoke tests fail.
- **DB-aware health check**: `GET /health` extended with a cheap DB connectivity probe (`SELECT 1`); returns `{status:'ok', db:'up'}` or `503`; wired to a CloudWatch alarm.
- **Post-deploy smoke tests** (`scripts/smoke.sh`): asserts `GET /health` → 200, `GET /api/public/products` → 200, `GET /api/admin/products` without token → 401; runs automatically in CI and can be run manually.
- **Production URL wiring**: `FRONTEND_URL` (CORS allow-list), `REACT_APP_API_BASE_URL` (frontend build-time), OAuth callback URLs configured for production.
- **Basic observability**: CloudWatch Logs (structured logs already emitted by the logger); CloudWatch alarm on sustained 5xx rate and on health-check failure.
- **Documentation**: `docs/development_guide.md` — new "Production Deployment (AWS Serverless)" section (prerequisites, secret setup, deploy commands, rollback note, smoke-test usage).

**Non-goals**: multi-region deployment, advanced auto-scaling, complex CDN configuration, disaster recovery, zero-downtime blue/green deploys.

**Critical prerequisite (deploy gate)**: Do not expose the admin surface in production until KAN-23 (admin authentication) is verified Done. The smoke test's `401` check on `GET /api/admin/products` without a token is the automated guard.

## Capabilities

### New Capabilities

- `production-deployment`: End-to-end production deployment capability — AWS Serverless (Lambda + API Gateway + managed PostgreSQL + S3 + CloudFront), CI/CD pipeline, secret management, smoke tests, and basic CloudWatch observability.

### Modified Capabilities

- `health-check`: Existing `GET /health` returns a static `{status:'ok'}`. Requirement changes: must perform a DB connectivity probe and return `{status:'ok', db:'up'}` (200) or `{status:'error', db:'down'}` (503), so monitoring reflects actual service health.

## Impact

- **Backend**: `backend/serverless.yml` (extended env, runtime reconciled), `backend/package.json` (devDependencies + scripts), `backend/src/routes/healthRoutes.ts` (DB probe), `backend/src/index.ts` (production env validation extended), `backend/.env.example` (add `COOKIE_SECRET` and any missing keys).
- **CI/CD**: `.github/workflows/deploy.yml` (new deploy workflow).
- **Scripts**: `scripts/smoke.sh` (new post-deploy smoke test script).
- **Documentation**: `docs/development_guide.md` (new deployment section), `docs/backend-standards.md` (align Serverless Deployment section if handler/runtime/scripts change).
- **No data model changes**, no new API endpoints visible to customers, no frontend feature changes. Admin and customer surfaces remain the same.
