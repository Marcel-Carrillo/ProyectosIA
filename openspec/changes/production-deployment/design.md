## Context

The backend already has `backend/src/lambda.ts` (serverless-http wrapping the Express `app`) and `backend/serverless.yml`, but several gaps prevent a real deploy:

1. `serverless` and `serverless-offline` are not in `backend/package.json` devDependencies.
2. `serverless.yml` only injects 3 env vars (`NODE_ENV`, `DATABASE_URL`, `FRONTEND_URL`) — JWT, cookie, SMTP, and OAuth secrets are missing, so a deployed Lambda would silently fail auth and email flows.
3. `serverless.yml` specifies `nodejs20.x` but `package.json` `engines` requires Node ≥24; this inconsistency should be resolved.
4. `backend/src/routes/healthRoutes.ts` returns a static `{status:'ok'}` with no DB probe — monitoring cannot detect a DB outage.
5. `COOKIE_SECRET` is consumed by `index.ts` (cookie-parser) but absent from `backend/.env.example`.
6. No deploy GitHub Actions workflow exists.

The frontend is a CRA app. It needs a prod `REACT_APP_API_BASE_URL` baked at build time, then the build artifact synced to an S3 bucket behind CloudFront.

## Goals / Non-Goals

**Goals:**
- Fix the five build/config gaps so a real deploy is possible.
- Externalize all production secrets into AWS SSM Parameter Store.
- Add a CI/CD GitHub Actions deploy workflow triggered on push to `master`.
- Add a DB-aware health check (lightweight `SELECT 1` probe).
- Add a post-deploy smoke script and wire it into CI.
- Add a CloudWatch 5xx alarm.
- Document the deployment process in `docs/development_guide.md`.

**Non-Goals:**
- Multi-region, auto-scaling, complex CDN, disaster recovery.
- Zero-downtime blue/green deploys.
- Changing the backend architecture or adding new API endpoints.
- Frontend feature changes.

## Decisions

### Decision 1 — Node runtime: keep nodejs20.x in serverless.yml, update engines.node

The current `engines.node >=24` was set before the Lambda runtime target was established. AWS Lambda's latest available Node.js runtime as of 2025 is `nodejs20.x`. Requiring Node 24 locally while deploying to 20.x creates a hidden incompatibility. **Resolution**: Change `engines.node` in `backend/package.json` to `>=20.0.0` and align local dev / CI to Node 20 LTS. This is the authoritative constraint for the Lambda target.

*Alternative considered*: Use `nodejs22.x` (preview) or wait for Node 24 GA on Lambda. Rejected — `nodejs20.x` is the current LTS-supported Lambda runtime; `nodejs22.x` is in preview. Changing to 22 introduces risk without benefit at this stage.

### Decision 2 — Build pipeline: reuse existing `npm run build` (tsc), no bundler plugin

`backend/package.json` already has `"build": "tsc"` which emits to `dist/`. The handler path `dist/lambda.handler` is correct for a plain tsc output. **Resolution**: Add `serverless` and `serverless-offline` to devDependencies; add a `deploy:lambda` npm script (`serverless deploy`) for convenience; the existing `build` script is sufficient for Lambda artifact creation.

*Alternative considered*: Add `serverless-esbuild` for tree-shaking and faster cold starts. Deferred — adds complexity; cold-start optimization is premature until there is real traffic.

### Decision 3 — Secrets: SSM Parameter Store SecureString, referenced via `${ssm:...}` in serverless.yml

Serverless Framework supports `${ssm:/path}` resolution at deploy time. Secrets are fetched once during `serverless deploy` and baked into the Lambda environment — no runtime SSM calls, no latency penalty, no SDK dependency.

*Alternative considered*: AWS Secrets Manager with runtime fetching + caching. Rejected at this stage — adds an SDK dependency and per-call cost; SSM SecureString at deploy time is simpler and sufficient for an MVP.

**SSM parameter paths convention** (`/ecommerce/prod/<KEY>`):
```
/ecommerce/prod/DATABASE_URL
/ecommerce/prod/ADMIN_JWT_SECRET
/ecommerce/prod/CUSTOMER_JWT_SECRET
/ecommerce/prod/COOKIE_SECRET
/ecommerce/prod/SMTP_HOST
/ecommerce/prod/SMTP_PORT
/ecommerce/prod/SMTP_SECURE
/ecommerce/prod/SMTP_USER
/ecommerce/prod/SMTP_PASS
/ecommerce/prod/SMTP_FROM
/ecommerce/prod/FRONTEND_URL
```
`NODE_ENV=production` stays as a literal in `serverless.yml` (not a secret).

### Decision 4 — Health check: single `SELECT 1` via Prisma `$queryRaw`, no separate liveness/readiness split

A single `GET /health` that probes DB is sufficient for MVP monitoring. A liveness/readiness split (Kubernetes-style) adds complexity not needed for Lambda where AWS handles process health.

The probe: `await prisma.$queryRaw\`SELECT 1\`` inside a try/catch. On success → 200 `{status:'ok', db:'up'}`. On failure → 503 `{status:'error', db:'down'}`.

*Trade-off*: every health ping hits the DB. Mitigation: keep the check cheap (`SELECT 1`), configure the CloudWatch alarm to call `/health` at a low frequency (e.g. every 5 minutes), not every second.

### Decision 5 — Frontend deployment: S3 + basic CloudFront, manually created (not in deploy.yml infra-as-code)

For MVP, the S3 bucket and CloudFront distribution are created manually (one-time setup) and documented in the dev guide. The CI pipeline only runs `aws s3 sync` and `aws cloudfront create-invalidation`. Infra-as-code (CDK / Terraform) is out of scope.

### Decision 6 — CI deploy workflow trigger: push to master only (no PR preview environments)

The deploy workflow fires on `push` to `master`. Manual `workflow_dispatch` is also added for hotfix deploys. PR preview environments are out of scope.

### Decision 7 — AWS credentials in CI: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY GitHub secrets

OIDC role federation (the more secure option) requires IAM provider setup. For MVP, static IAM credentials stored as GitHub Actions secrets is acceptable and simpler. Document in the dev guide with a note to rotate them. Migrate to OIDC when the team has the AWS org setup.

## Risks / Trade-offs

- **[Risk] Lambda cold start on first request** → Mitigation: acceptable for MVP; revisit with provisioned concurrency if needed.
- **[Risk] DB connection exhaustion** — Prisma's connection pool + Lambda scales horizontally, which can exhaust Postgres max_connections. → Mitigation: add `?connection_limit=1` to `DATABASE_URL` for the Lambda function (single connection per instance), and consider PgBouncer / RDS Proxy if traffic justifies it.
- **[Risk] Migration failure mid-deploy** — `prisma migrate deploy` runs before the new Lambda is deployed; if it fails, the old Lambda continues running against the unmodified schema. → Mitigation: migrations must be backward-compatible with the previous Lambda version (additive only, no column renames or drops in the same deploy). Document this constraint in the dev guide.
- **[Risk] SSM parameter drift** — a secret changed in SSM won't take effect until the next `serverless deploy`. → Mitigation: document that secret rotation requires a redeploy; future improvement is Secrets Manager with rotation hooks.
- **[Risk] Admin surface exposed before KAN-23 verified** → Mitigation: smoke test asserts `GET /api/admin/products` → 401 (without token). CI fails if this assertion fails. Document the explicit deploy gate in the dev guide.

## Migration Plan

1. **Prerequisite check**: Verify KAN-23 (admin auth) is Done.
2. **AWS setup (one-time, manual)**:
   - Create SSM parameters under `/ecommerce/prod/*` with production values.
   - Create S3 bucket for frontend static assets (public read or CloudFront OAC).
   - Create CloudFront distribution pointing to S3 bucket.
   - Create IAM user with least-privilege policy: `serverless:Deploy`, `s3:PutObject`/`s3:DeleteObject` on the bucket, `cloudfront:CreateInvalidation`, `ssm:GetParameter` on `/ecommerce/prod/*`.
   - Store `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as GitHub Actions secrets.
   - Store `PROD_DB_URL`, `PROD_API_BASE_URL`, `PROD_CLOUDFRONT_DISTRIBUTION_ID`, `PROD_S3_BUCKET` as GitHub Actions secrets.
3. **Code changes** (this PR):
   - Fix `backend/package.json` (devDependencies + engines.node).
   - Fix `backend/serverless.yml` (full env block with SSM refs, runtime).
   - Fix `backend/.env.example` (add `COOKIE_SECRET`).
   - Extend `backend/src/index.ts` env validation.
   - Update `backend/src/routes/healthRoutes.ts` (DB probe).
   - Add `.github/workflows/deploy.yml`.
   - Add `scripts/smoke.sh`.
   - Update `docs/development_guide.md`.
4. **First deploy**: push to `master` or trigger `workflow_dispatch`. Monitor CloudWatch logs.
5. **Rollback**: re-run `serverless deploy` from the previous git SHA; or `serverless rollback` (Serverless Framework keeps previous deployment state). Frontend rollback: re-sync previous build to S3.

## Open Questions

- **RDS vs Aurora Serverless v2**: Which managed Postgres offering? Aurora Serverless v2 has auto-pause (cost savings) but cold-start latency. Standard RDS `db.t3.micro` is always-on and cheaper for low traffic. → Decision deferred to infra setup; document both options in the dev guide.
- **CloudFront distribution for admin panel**: Should the admin React app be served from the same distribution as the storefront, or a separate one? For MVP, same bucket/distribution with a path prefix is simplest. → Document in dev guide; separate distribution is a future option.
- **`SMTP_STRICT` env var**: Present in app code but not in the SSM path list. Add it if email is needed at launch; otherwise document as optional.
