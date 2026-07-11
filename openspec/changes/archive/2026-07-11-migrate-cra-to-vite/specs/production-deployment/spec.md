# Delta Spec: production-deployment (migrate-cra-to-vite)

## MODIFIED Requirements

### Requirement: CI/CD pipeline deploys backend and frontend on push to master

A GitHub Actions workflow SHALL run on every push to `master` and perform: backend build, `prisma migrate deploy` against the production database, Serverless Framework deploy (Lambda + API Gateway), frontend Vite build (`vite build`, artifacts emitted to `frontend/build/`) with the production API URL provided via `VITE_API_BASE_URL`, S3 sync, CloudFront cache invalidation, and post-deploy smoke tests. The pipeline SHALL fail if smoke tests fail.

#### Scenario: Successful deploy pipeline completes smoke tests

- **WHEN** a commit is pushed to `master` and all steps succeed
- **THEN** the pipeline ends with a green status and the smoke test output reports `GET /health` → 200, `GET /api/public/products` → 200, and `GET /api/admin/products` (no token) → 401

#### Scenario: Pipeline fails when smoke tests fail

- **WHEN** the smoke test script returns a non-zero exit code after deploy
- **THEN** the GitHub Actions workflow step fails, the pipeline is marked failed, and the deploy is considered unsuccessful

#### Scenario: Frontend build receives the production API URL

- **WHEN** the "Build frontend" step runs in the deploy workflow
- **THEN** the build is executed with `VITE_API_BASE_URL` set to the production API base URL and the resulting bundle calls the production API (no `REACT_APP_*` variables are referenced anywhere in the workflow)
