## ADDED Requirements

### Requirement: Local dev stack runs entirely in Docker with no AWS dependencies

The local development environment SHALL be fully runnable via `docker compose up` with Postgres 15, Mailpit, and the Express backend as containers. No connection to AWS RDS, SSM, or any AWS service SHALL be required to start or use the dev stack.

#### Scenario: Stack starts from scratch with a single command

- **WHEN** a developer runs `docker compose up -d` in the project root
- **THEN** the `db`, `mailpit`, and `backend` services start successfully and the backend is reachable at `http://localhost:3000`

#### Scenario: Backend connects to local Postgres, not RDS

- **WHEN** the backend container starts in dev
- **THEN** `DATABASE_URL` resolves to `postgresql://<user>:<pass>@db:5432/<dbname>` (Compose internal network) and no connection attempt is made to `*.rds.amazonaws.com`

#### Scenario: Backend rejects startup if DATABASE_URL is missing

- **WHEN** the `backend/.env.docker` file is missing or `DATABASE_URL` is empty
- **THEN** the backend container exits immediately with a clear error message indicating the missing variable

---

### Requirement: Prisma migrations and seed run automatically on first container start

The backend container SHALL run `prisma migrate deploy` before starting the dev server, ensuring the local schema is up to date without manual steps.

#### Scenario: Migrations apply on clean database

- **WHEN** the `db` container has an empty database and `docker compose up` is run for the first time
- **THEN** all Prisma migrations execute successfully before the Express server begins accepting requests

#### Scenario: Seed populates local database on first start

- **WHEN** migrations succeed and the database is empty
- **THEN** the seed script (`npx prisma db seed`) runs and populates the database with baseline data (categories, sample products)

#### Scenario: Migrations are skipped when schema is up to date

- **WHEN** the database already has all migrations applied
- **THEN** `prisma migrate deploy` exits cleanly with no changes and the dev server starts normally

---

### Requirement: Backend hot-reload works without container rebuild

The backend development container SHALL mount `backend/src/` as a bind volume so that source code changes trigger `ts-node-dev` hot-reload without requiring a Docker image rebuild.

#### Scenario: Source change reloads the server

- **WHEN** a developer edits a file under `backend/src/`
- **THEN** `ts-node-dev` detects the change and restarts the Express process within the container within 3 seconds

#### Scenario: node_modules are isolated inside the container

- **WHEN** the backend container starts
- **THEN** `node_modules` inside the container are not overwritten by the host filesystem (anonymous volume takes precedence over any host `node_modules`)

---

### Requirement: Email delivery in dev uses Mailpit (no external SMTP)

The backend SHALL send all outbound emails to Mailpit in dev, and the Mailpit web UI SHALL be accessible to inspect those emails.

#### Scenario: Password reset email captured by Mailpit

- **WHEN** a customer requests a password reset in dev
- **THEN** the reset email is visible in the Mailpit web UI at `http://localhost:8025` and no real email is sent externally

#### Scenario: Mailpit is accessible on expected port

- **WHEN** the dev stack is running
- **THEN** `http://localhost:8025` returns the Mailpit inbox UI

---

### Requirement: express-rate-limit does not crash on X-Forwarded-For in dev or prod

The Express application SHALL configure `trust proxy` conditionally by `NODE_ENV` so that `express-rate-limit` v8 does not throw `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` in any environment.

#### Scenario: Rate-limited route responds correctly when CRA proxy is active in dev

- **WHEN** the frontend dev server proxies a request to `POST /api/public/auth/login` (which has `authLimiter`)
- **THEN** the backend returns `200` (or `401` for wrong credentials) and does NOT crash with `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`

#### Scenario: Rate limit is enforced per IP in dev after trust proxy fix

- **WHEN** more requests than the configured limit are sent to a rate-limited endpoint from the same IP in dev
- **THEN** the backend returns `429 Too Many Requests` without crashing

#### Scenario: Rate-limited route behaves correctly in production behind API Gateway

- **WHEN** a request reaches the backend Lambda with `X-Forwarded-For` set by API Gateway
- **THEN** `trust proxy: 1` causes Express to read the client IP from that header and `express-rate-limit` enforces the limit per real client IP without error

---

### Requirement: Frontend optional Docker profile does not affect default dev workflow

The `docker-compose.yml` SHALL include an optional `frontend` service under the `frontend` profile, which developers may activate with `docker compose --profile frontend up`. The default `docker compose up` SHALL NOT start the frontend container.

#### Scenario: Default compose up does not start frontend

- **WHEN** a developer runs `docker compose up -d` without `--profile frontend`
- **THEN** only `db`, `mailpit`, and `backend` containers start; the `frontend` container is not created

#### Scenario: Frontend profile starts the React dev server in a container

- **WHEN** a developer runs `docker compose --profile frontend up -d`
- **THEN** the `frontend` container starts and the React app is accessible at `http://localhost:3001`

---

### Requirement: Production deployment is unaffected by local dev changes

The `serverless.yml`, AWS Lambda configuration, RDS connection, CloudFront distribution, SSM Parameter Store references, and CORS settings SHALL remain unchanged. No file modified for local dev SHALL alter the production deployment pipeline.

#### Scenario: serverless deploy succeeds after local dev changes are applied

- **WHEN** `serverless deploy` is run after all local dev changes are committed
- **THEN** the production backend deploys to Lambda without errors and passes smoke tests against the production API Gateway endpoint
