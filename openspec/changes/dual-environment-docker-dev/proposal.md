## Why

Running the backend locally today connects directly to the production AWS RDS database, meaning any test, seed, or write-path bug hits real customer and order data. Additionally, `express-rate-limit` crashes on local development because the CRA dev proxy injects `X-Forwarded-For` headers that Express rejects due to a missing `trust proxy` configuration, blocking auth and checkout flows from being tested locally at all.

## What Changes

- **New**: `backend/Dockerfile` (multi-stage: build + dev with hot-reload)
- **New**: `backend/.dockerignore`
- **New**: `backend/.env.docker` (local dev env vars — not committed, listed in `.gitignore`)
- **Modified**: `docker-compose.yml` — extend existing `db` + `mailpit` services with a `backend` service and optional `frontend` profile
- **Modified**: `backend/src/index.ts` — add conditional `trust proxy` setting by `NODE_ENV` to fix `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`
- **Modified**: `backend/.env.example` — clarify host-local vs Docker URL for `DATABASE_URL` and SMTP
- **Modified**: `docs/development_guide.md` — new "Docker dev setup" section with full workflow
- **Modified**: `docs/backend-standards.md` — document two environments (dev containerized, prod Lambda) and `trust proxy` convention

No business logic, API contracts, data models, or production deployment configuration changes.

## Capabilities

### New Capabilities

- `local-dev-environment`: Full local development stack runnable with `docker compose up` — Postgres 15, Mailpit, and the Express backend in containers; frontend optional via Docker profile. Zero connections to AWS RDS from dev.

### Modified Capabilities

_(none — `production-deployment` spec requirements are unchanged; AWS Lambda + API Gateway + RDS + CloudFront + SSM remain exactly as deployed)_

## Impact

- **Backend**: `backend/src/index.ts` (`trust proxy`), new `Dockerfile` + `.dockerignore`, new `.env.docker`
- **Infra**: `docker-compose.yml` extended with `backend` service and optional `frontend` profile
- **Docs**: `docs/development_guide.md`, `docs/backend-standards.md`, `backend/.env.example`
- **No impact on**: API contracts, data model, business rules, Serverless config, CloudFront, RDS, SSM, customer-facing behavior, or supplier fulfillment logic
- **Affected environments**: `dev` (new Docker-based); `prod` (unchanged)
- **No breaking changes**
