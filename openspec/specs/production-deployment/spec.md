# Spec: Production Deployment

## Purpose

Defines the production deployment pipeline for the women's fashion ecommerce platform: AWS Lambda backend via Serverless Framework, CRA frontend on S3 + CloudFront, secrets in SSM Parameter Store, CI/CD via GitHub Actions, post-deploy smoke tests, and basic CloudWatch observability.

## Requirements

### Requirement: Production secrets are externalized and never committed

All production secrets (database URL, JWT secrets, cookie secret, SMTP credentials, OAuth credentials) SHALL be stored in AWS SSM Parameter Store (SecureString) and referenced at runtime. The `.env` file SHALL be excluded from git. The `backend/.env.example` file SHALL document all required environment variable keys with placeholder values.

#### Scenario: Required secret keys are documented in .env.example

- **WHEN** a developer clones the repository
- **THEN** `backend/.env.example` contains placeholder entries for all required keys including `DATABASE_URL`, `ADMIN_JWT_SECRET`, `CUSTOMER_JWT_SECRET`, `COOKIE_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `FRONTEND_URL`

#### Scenario: Application fails fast on missing production secrets

- **WHEN** the backend starts with `NODE_ENV=production` and a required secret is absent
- **THEN** the process exits immediately with a clear error message listing the missing variable

### Requirement: Backend build pipeline is consistent and deployable

The backend SHALL have a working build pipeline that compiles TypeScript to `dist/lambda.js`, with the Serverless Framework and required plugins present as dev dependencies. The Node.js runtime specified in `serverless.yml` SHALL match the project's `engines.node` requirement.

#### Scenario: Build produces the Lambda handler artifact

- **WHEN** `npm run build` runs in the `backend/` directory
- **THEN** `dist/lambda.js` (and `dist/lambda.handler` export) is produced with no TypeScript errors

#### Scenario: Serverless Framework is available as a dev dependency

- **WHEN** `npm ci` installs dependencies in `backend/`
- **THEN** the `serverless` CLI and `serverless-offline` are available under `node_modules/.bin/`

### Requirement: serverless.yml injects all required runtime secrets

The `serverless.yml` `provider.environment` block SHALL include every environment variable the application reads at startup, resolved from SSM Parameter Store or CI-injected secrets. Missing variables SHALL cause the Lambda to fail fast (per startup validation).

#### Scenario: All required env vars are present in deployed Lambda

- **WHEN** the backend Lambda starts in the production environment
- **THEN** `ADMIN_JWT_SECRET`, `CUSTOMER_JWT_SECRET`, `COOKIE_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `FRONTEND_URL`, `DATABASE_URL`, and `NODE_ENV` are all available via `process.env`

### Requirement: CI/CD pipeline deploys backend and frontend on push to master

A GitHub Actions workflow SHALL run on every push to `master` and perform: backend build, `prisma migrate deploy` against the production database, Serverless Framework deploy (Lambda + API Gateway), frontend CRA build with production API URL, S3 sync, CloudFront cache invalidation, and post-deploy smoke tests. The pipeline SHALL fail if smoke tests fail.

#### Scenario: Successful deploy pipeline completes smoke tests

- **WHEN** a commit is pushed to `master` and all steps succeed
- **THEN** the pipeline ends with a green status and the smoke test output reports `GET /health` → 200, `GET /api/public/products` → 200, and `GET /api/admin/products` (no token) → 401

#### Scenario: Pipeline fails when smoke tests fail

- **WHEN** the smoke test script returns a non-zero exit code after deploy
- **THEN** the GitHub Actions workflow step fails, the pipeline is marked failed, and the deploy is considered unsuccessful

### Requirement: Post-deploy smoke tests verify the live environment

A smoke test script (`scripts/smoke.sh`) SHALL assert three conditions against a configurable base URL: the health endpoint returns 200, at least one public read endpoint returns 200, and the admin endpoint without a token returns 401. The script SHALL exit with a non-zero code on any failure.

#### Scenario: Smoke test passes against a healthy deployment

- **WHEN** the script runs against the production base URL and all three assertions succeed
- **THEN** the script exits with code 0 and prints a pass summary

#### Scenario: Smoke test fails when admin gate is not enforced

- **WHEN** `GET /api/admin/products` returns anything other than 401 without a Bearer token
- **THEN** the script exits with a non-zero code and reports which assertion failed

### Requirement: Basic CloudWatch observability is configured

The production Lambda SHALL emit structured logs to CloudWatch Logs (via the existing logger). At minimum one CloudWatch alarm SHALL be configured: a sustained API Gateway 5xx error rate alarm.

#### Scenario: Lambda logs are visible in CloudWatch

- **WHEN** the backend handles a request in production
- **THEN** structured log entries appear in the Lambda's CloudWatch log group

#### Scenario: CloudWatch 5xx alarm triggers on sustained errors

- **WHEN** the API Gateway 5xx error rate exceeds threshold for the configured evaluation period
- **THEN** the CloudWatch alarm transitions to ALARM state

### Requirement: Production CORS restricts origins to explicit allow-list

In production (`NODE_ENV=production`), the backend CORS policy SHALL only allow the origins listed in `FRONTEND_URL` (comma-separated). The dev-mode allow-all origin override SHALL NOT apply.

#### Scenario: CORS rejects unknown origin in production

- **WHEN** a request arrives from an origin not listed in `FRONTEND_URL` with `NODE_ENV=production`
- **THEN** the response does not include `Access-Control-Allow-Origin` for that origin

#### Scenario: CORS allows listed origin in production

- **WHEN** a request arrives from an origin that matches an entry in `FRONTEND_URL`
- **THEN** the response includes `Access-Control-Allow-Origin` with that origin

### Requirement: Production deployment is documented in the development guide

`docs/development_guide.md` SHALL contain a "Production Deployment (AWS Serverless)" section covering: prerequisites (AWS CLI, Serverless Framework, SSM parameters), secret setup steps, deploy command sequence, production health-check URL, smoke-test usage, and a rollback note.

#### Scenario: Developer can follow guide to deploy from scratch

- **WHEN** a developer follows the Production Deployment section in `docs/development_guide.md`
- **THEN** they can set up SSM parameters, run the deploy pipeline, and verify the deployment using the smoke test
