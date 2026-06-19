# Context: production-deployment (KAN-26)

## Change Summary
Production deployment & monitoring — AWS Serverless. Backend on Lambda + API Gateway, frontend CRA on S3 + CloudFront, managed PostgreSQL, CI/CD pipeline, secrets in SSM, DB-aware health check, post-deploy smoke tests, basic CloudWatch observability.

## Artifacts
- Proposal: openspec/changes/production-deployment/proposal.md
- Design: openspec/changes/production-deployment/design.md
- Specs: openspec/changes/production-deployment/specs/production-deployment/spec.md
- Specs: openspec/changes/production-deployment/specs/health-check/spec.md
- Tasks: openspec/changes/production-deployment/tasks.md

## Key Findings (from design.md)
1. `serverless.yml` only injects 3 of ~13 required env vars — must extend with SSM refs
2. `serverless` + `serverless-offline` NOT in devDependencies — must add
3. `engines.node >=24` conflicts with `nodejs20.x` Lambda runtime — change engines to `>=20.0.0`
4. `/health` returns static `{status:'ok'}` — must add DB probe via `prisma.$queryRaw\`SELECT 1\``
5. `COOKIE_SECRET` missing from `backend/.env.example`

## Files to Modify (backend scope)
- `backend/package.json` — engines.node, devDependencies (serverless, serverless-offline), scripts (deploy:lambda)
- `backend/serverless.yml` — extend provider.environment with all SSM refs
- `backend/.env.example` — add COOKIE_SECRET and any missing keys
- `backend/src/index.ts` — extend production env validation for ADMIN_JWT_SECRET, CUSTOMER_JWT_SECRET, COOKIE_SECRET, SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM
- `backend/src/routes/healthRoutes.ts` — replace static response with DB probe
- `backend/src/routes/__tests__/healthRoutes.test.ts` — create/update with 3 test cases

## New Files
- `.github/workflows/deploy.yml` — CI/CD deploy workflow
- `scripts/smoke.sh` — post-deploy smoke test script

## Design Decisions
- Node runtime: keep nodejs20.x, change engines.node to >=20.0.0
- Build: reuse existing `npm run build` (tsc), no bundler plugin
- Secrets: SSM SecureString, /ecommerce/prod/<KEY> convention
- Health check: single SELECT 1 via prisma.$queryRaw, HTTP 200 {status:'ok',db:'up'} or 503 {status:'error',db:'down'}
- CI trigger: push to master + workflow_dispatch
- AWS creds: GitHub Actions secrets (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)

## Branch
feature/KAN-26-production-deployment
