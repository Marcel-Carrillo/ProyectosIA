## 0. Setup: Create Feature Branch (MANDATORY — FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide between current checkout and a dedicated Git worktree
- [x] 0.2 Create and switch to feature branch `feature/KAN-26-production-deployment` from `master`
- [x] 0.3 Verify branch creation and current branch status with `git status`

## 1. Backend: Build Pipeline Fix (Prerequisite)

- [x] 1.1 Update `backend/package.json` `engines.node` from `>=24.16.0` to `>=20.0.0` to align with the `nodejs20.x` Lambda runtime
- [x] 1.2 Add `serverless` and `serverless-offline` to `backend/package.json` devDependencies (use latest stable versions); run `npm install` to update `package-lock.json`
- [x] 1.3 Add a `deploy:lambda` script to `backend/package.json` as a convenience alias: `"deploy:lambda": "serverless deploy"`
- [x] 1.4 Verify that `npm run build` in `backend/` emits `dist/lambda.js` with no TypeScript errors and that `dist/lambda.handler` is reachable

## 2. Backend: Environment & Secrets Configuration

- [x] 2.1 Add `COOKIE_SECRET` to `backend/.env.example` with a placeholder value (e.g. `COOKIE_SECRET=change-me-min-32-chars`); also review and add any other keys present in `backend/src/index.ts` env validation that are currently missing from `.env.example`
- [x] 2.2 Update `backend/src/index.ts` production env validation (`requiredEnvVars` or equivalent) to assert presence of `ADMIN_JWT_SECRET`, `CUSTOMER_JWT_SECRET`, `COOKIE_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` when `NODE_ENV=production`, failing fast with a descriptive error message
- [x] 2.3 Extend `backend/serverless.yml` `provider.environment` to inject all runtime secrets via SSM references:
  - `ADMIN_JWT_SECRET: ${ssm:/ecommerce/prod/ADMIN_JWT_SECRET}`
  - `CUSTOMER_JWT_SECRET: ${ssm:/ecommerce/prod/CUSTOMER_JWT_SECRET}`
  - `COOKIE_SECRET: ${ssm:/ecommerce/prod/COOKIE_SECRET}`
  - `ADMIN_JWT_EXPIRES_IN: ${ssm:/ecommerce/prod/ADMIN_JWT_EXPIRES_IN}`
  - `CUSTOMER_JWT_EXPIRES_IN: ${ssm:/ecommerce/prod/CUSTOMER_JWT_EXPIRES_IN}`
  - `SMTP_HOST: ${ssm:/ecommerce/prod/SMTP_HOST}`
  - `SMTP_PORT: ${ssm:/ecommerce/prod/SMTP_PORT}`
  - `SMTP_SECURE: ${ssm:/ecommerce/prod/SMTP_SECURE}`
  - `SMTP_USER: ${ssm:/ecommerce/prod/SMTP_USER}`
  - `SMTP_PASS: ${ssm:/ecommerce/prod/SMTP_PASS}`
  - `SMTP_FROM: ${ssm:/ecommerce/prod/SMTP_FROM}`
  - `FRONTEND_URL: ${ssm:/ecommerce/prod/FRONTEND_URL}`
  - `DATABASE_URL: ${ssm:/ecommerce/prod/DATABASE_URL}`

## 3. Backend: DB-Aware Health Check

- [x] 3.1 Update `backend/src/routes/healthRoutes.ts`: replace the static `{status:'ok'}` response with a DB connectivity probe using `prisma.$queryRaw\`SELECT 1\`` inside a try/catch
  - On success: HTTP 200 `{status:'ok', db:'up'}`
  - On failure: HTTP 503 `{status:'error', db:'down'}`
- [x] 3.2 Update or create `backend/src/routes/__tests__/healthRoutes.test.ts`:
  - Test: DB reachable → 200 `{status:'ok', db:'up'}`
  - Test: DB unreachable (mock Prisma throwing) → 503 `{status:'error', db:'down'}`
  - Test: response body contains only `status` and `db` fields (no extra fields)
- [x] 3.3 Verify TypeScript compiles without errors after the change

## 4. Scripts: Post-Deploy Smoke Test

- [x] 4.1 Create `scripts/smoke.sh` (executable, POSIX sh) that:
  - Accepts `BASE_URL` as first argument (default: `http://localhost:4000`)
  - Asserts `GET $BASE_URL/health` → HTTP 200 and response body contains `"status":"ok"`
  - Asserts `GET $BASE_URL/api/public/products` → HTTP 200
  - Asserts `GET $BASE_URL/api/admin/products` (no Authorization header) → HTTP 401
  - Prints PASS/FAIL per assertion and exits with code 1 on any failure
- [x] 4.2 Make `scripts/smoke.sh` executable: `chmod +x scripts/smoke.sh`
- [x] 4.3 Run `scripts/smoke.sh http://localhost:4000` against the local backend (ensure it's running) and verify all three assertions pass; document the output

## 5. CI/CD: GitHub Actions Deploy Workflow

- [x] 5.1 Create `.github/workflows/deploy.yml` with:
  - Trigger: `push` to `master` and `workflow_dispatch`
  - Job `deploy` with steps:
    1. `actions/checkout@v4`
    2. `actions/setup-node@v4` with `node-version: '20'`
    3. `npm ci` in `backend/`
    4. `npm run build` in `backend/`
    5. `npx prisma generate` in `backend/`
    6. `npx prisma migrate deploy` using `DATABASE_URL` from GitHub Actions secrets
    7. `npx serverless deploy` using `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from GitHub Actions secrets
    8. `npm ci` in `frontend/`
    9. `npm run build` in `frontend/` with `REACT_APP_API_BASE_URL` from GitHub Actions secrets
    10. `aws s3 sync frontend/build/ s3://$S3_BUCKET --delete` using bucket name from secrets
    11. `aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"` using distribution ID from secrets
    12. Run `bash scripts/smoke.sh $PROD_API_BASE_URL`; fail the pipeline if exit code is non-zero
  - Secrets used (document in `docs/development_guide.md`): `PROD_DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `PROD_API_BASE_URL`, `REACT_APP_API_BASE_URL`, `PROD_S3_BUCKET`, `PROD_CF_DIST_ID`
- [x] 5.2 Verify the workflow YAML is valid (no syntax errors) by running `cat .github/workflows/deploy.yml` and reviewing structure

## 6. Observability: CloudWatch Alarm (Documentation + Comment)

- [x] 6.1 Add a comment block in `backend/serverless.yml` (under a `resources:` section stub) documenting the CloudWatch alarm to be created manually (one-time AWS console / AWS CLI setup):
  - Alarm name: `ecommerce-api-5xx-high`
  - Metric: `AWS/ApiGateway` `5XXError`
  - Threshold: ≥ 5 errors over a 5-minute period
  - This is documented as a manual one-time setup step — not created by the deploy pipeline at MVP stage
- [x] 6.2 Add a similar note in `docs/development_guide.md` production section covering the CloudWatch alarm setup (see Task 11)

## 7. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 7.1 Run the existing health-route tests (if any) to confirm they fail against the new DB-probe implementation (expected — tests not yet updated)
- [x] 7.2 Review all tests in `backend/src/**/__tests__/` for any reference to the old `{status:'ok'}` shape and update them to expect `{status:'ok', db:'up'}` or `{status:'error', db:'down'}` as appropriate
- [x] 7.3 Confirm that non-health-check tests are unaffected by the `engines.node` change

## 8. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 8.1 Capture pre-test baseline (count of tables, Prisma seed state)
- [x] 8.2 Run targeted unit tests for the modified health route: `cd backend && npx jest --testPathPattern="healthRoutes"`
- [x] 8.3 Run the full backend unit test suite: `cd backend && npm test -- --watchAll=false`
- [x] 8.4 Verify post-test database state matches pre-test baseline (health check tests should not mutate data)
- [x] 8.5 Create report `openspec/changes/production-deployment/reports/YYYY-MM-DD-step-8-unit-test-and-db-verification.md`
- [x] 8.6 Mark step complete only after all tests pass and report exists

## 9. Backend: Manual Endpoint Testing with curl (MANDATORY — AGENT MUST EXECUTE)

- [x] 9.1 Ensure the backend server is running (`cd backend && npm run dev` or equivalent)
- [x] 9.2 Test `GET /health` when DB is reachable: `curl -s http://localhost:4000/health` — verify HTTP 200 and `{"status":"ok","db":"up"}`
- [x] 9.3 Test `GET /health` response body has only `status` and `db` fields (no extra fields)
- [x] 9.4 Test smoke script locally: `bash scripts/smoke.sh http://localhost:4000` — verify all three assertions pass (health 200, public products 200, admin products 401)
- [x] 9.5 Create report `openspec/changes/production-deployment/reports/YYYY-MM-DD-step-9-curl-endpoint-testing.md`
- [x] 9.6 Mark step complete only after all curl tests pass and report exists

## 10. Update Technical Documentation (MANDATORY)

- [x] 10.1 Update `docs/development_guide.md` — add a "Production Deployment (AWS Serverless)" section covering:
  - Prerequisites: AWS CLI, Node 20, Serverless Framework (`npm i -g serverless`), `gh` CLI
  - One-time AWS setup: SSM parameter creation for all 13 keys under `/ecommerce/prod/*`
  - S3 bucket and CloudFront distribution creation (manual, one-time)
  - IAM user creation with least-privilege policy; GitHub Actions secrets list
  - CloudWatch 5xx alarm creation (manual)
  - Deploy command sequence: `npm run build` → `prisma migrate deploy` → `serverless deploy` → frontend build + S3 sync + CF invalidation
  - Running smoke tests: `bash scripts/smoke.sh <PROD_URL>`
  - Rollback: `serverless rollback` for backend; re-sync previous frontend build for frontend
  - Connection limit note: append `?connection_limit=1` to `DATABASE_URL` for Lambda
  - Prerequisite gate: KAN-23 (admin auth) must be verified Done before exposing admin surface
- [x] 10.2 Update `docs/backend-standards.md` Serverless Deployment section if the build script, runtime, or env var conventions changed (align with the `nodejs20.x` / `build` script decisions)
- [x] 10.3 Review `docs/api-spec.yml` `GET /health` response schema — update if the shape changed from `{status}` to `{status, db}` (add `db` field to the response schema)

## 11. Commit and Create Pull Request (MANDATORY — LAST STEP)

- [ ] 11.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 11.2 Verify all tasks are marked `[x]` and reports exist under `openspec/changes/production-deployment/reports/`
- [ ] 11.3 Stage all relevant files (exclude `.env`, `node_modules`, `dist/`, `coverage/`); include: `backend/package.json`, `backend/package-lock.json`, `backend/serverless.yml`, `backend/.env.example`, `backend/src/routes/healthRoutes.ts`, `backend/src/routes/__tests__/healthRoutes.test.ts`, `backend/src/index.ts`, `.github/workflows/deploy.yml`, `scripts/smoke.sh`, `docs/development_guide.md`, `docs/backend-standards.md`, `docs/api-spec.yml`, `openspec/changes/production-deployment/`
- [ ] 11.4 Create commit with message: `feat(KAN-26): add production deployment pipeline, DB health check, and smoke tests`
- [ ] 11.5 Push branch `feature/KAN-26-production-deployment` to remote origin
- [ ] 11.6 Run `gh pr create` and report the PR URL in chat
