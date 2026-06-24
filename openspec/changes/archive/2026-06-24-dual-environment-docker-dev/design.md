## Context

The backend's `DATABASE_URL` currently points to the AWS RDS PostgreSQL instance in `eu-north-1`. Developers (and AI agents) running the project locally hit the production database directly. There is no isolated local data layer.

Additionally, `express-rate-limit` v8 (used on auth, checkout, and admin routes) throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` when `X-Forwarded-For` is present but Express does not have `trust proxy` configured. The CRA dev proxy sets this header on every forwarded request, making it impossible to test rate-limited routes locally without the server crashing.

The existing `docker-compose.yml` already has a `db` (postgres:15) and `mailpit` service but no backend container — the backend runs on the host and resolves `DATABASE_URL` to RDS.

## Goals / Non-Goals

**Goals:**
- Full local development stack reachable with `docker compose up` (Postgres 15 + Mailpit + backend Express)
- Backend dev container uses hot-reload (`ts-node-dev`) with `src/` bind-mounted so no rebuild on code changes
- `DATABASE_URL` in dev resolves to the Compose-internal `db` service; never to RDS
- Prisma migrations and seed run automatically on first container start
- Fix `trust proxy` conditionally by `NODE_ENV` to unblock rate-limited routes locally
- Frontend remains in host by default; optional Docker profile `--profile frontend` for full containerization
- Production AWS deployment (`serverless.yml`, Lambda, API Gateway, RDS, CloudFront, SSM) remains unchanged

**Non-Goals:**
- Staging or UAT environment
- CI/CD pipeline changes
- Kubernetes or Docker Swarm
- Containerizing prod (Lambda is the prod runtime; no change)
- Seeding prod data locally via tunnel
- Changing Postgres version in prod

## Decisions

### Decision 1: Backend containerized for dev; frontend optional via Docker profile

**Rationale:** The backend must run in Docker to connect to `db` by service name (`db:5432`) without exposing the Postgres port to the host. The frontend CRA hot-reload works well from the host and has no hard dependency on Docker networking; forcing it into a container adds volume-mount complexity on Windows (inotify quirks) with little gain. A `profiles: [frontend]` flag keeps the option available without making it mandatory.

**Alternative considered:** Backend on host with port-forwarded Postgres (`localhost:5432`). Rejected because it requires manual `DATABASE_URL` editing for each developer and doesn't scale to CI.

### Decision 2: Multi-stage Dockerfile — build stage + dev stage via `target`

**Rationale:** A single-stage image for dev is simpler, but a multi-stage file lets `docker build --target build` produce the production artifact (TypeScript compiled to `dist/`) in the future without a separate Dockerfile. The dev `target` installs all deps, mounts `src/`, and runs `ts-node-dev`; the build `target` produces `dist/`.

**Note:** The Lambda prod packaging continues to use the existing `npm run build` + Serverless Framework flow — Docker is not involved in prod deployment.

### Decision 3: `trust proxy` set conditionally by `NODE_ENV`, not globally

**Rationale:** Setting `app.set('trust proxy', true)` globally would trust any `X-Forwarded-For` value, allowing IP spoofing to bypass rate limits. Correct approach per Express and `express-rate-limit` v8 docs:
- `production`: `app.set('trust proxy', 1)` — trust exactly one hop (API Gateway / CloudFront adds one `X-Forwarded-For`)
- `development`: `app.set('trust proxy', 'loopback')` — trust only loopback sources (the CRA proxy runs on `127.0.0.1`)

This prevents `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` in both environments while preserving per-IP accuracy.

### Decision 4: `backend/.env.docker` for containerized dev config

**Rationale:** A dedicated env file for Docker (`DATABASE_URL` pointing to `db:5432`, `SMTP_HOST=mailpit`) avoids polluting the existing `backend/.env` (which contains prod RDS credentials). Both files are git-ignored. Developers who run the backend on the host keep using `backend/.env`; those using Docker use `backend/.env.docker`.

**Alternative considered:** Docker Compose `environment:` block with inline values. Rejected because it would commit dummy credentials to `docker-compose.yml` which is tracked by git. Using `env_file` keeps secrets out of version control.

### Decision 5: Migrations and seed via Compose `entrypoint` script on backend startup

**Rationale:** Running `prisma migrate deploy` before `npm run dev` ensures the local Postgres schema is always up to date without manual steps. A shell entrypoint (`entrypoint.sh`) handles the ordering: wait for DB healthcheck → run migrations → optionally seed → start dev server.

**Alternative considered:** Separate `migrate` Compose service. Rejected as it adds orchestration complexity; a simple entrypoint script is more transparent.

## Risks / Trade-offs

- **Volume bind-mount performance on Windows (Docker Desktop):** `./backend/src:/app/src` mounts can be slow on Windows with WSL2 backend. Mitigation: use WSL2 filesystem (project in `~/` rather than `/mnt/c/`); Docker Desktop's VirtioFS mitigates most cases on modern versions.
- **`node_modules` collision:** If host has `node_modules` and the container also installs them, a bind-mount of `./backend` would shadow the container's `node_modules`. Mitigation: mount only `./backend/src` (not the full `backend/` folder) and use an anonymous volume for `node_modules` inside the container.
- **`trust proxy` spoofing in prod:** Setting `trust proxy: 1` in prod is correct for single-hop load balancers (API Gateway + CloudFront). If the topology ever changes (e.g., additional proxy layer), this value must be updated. Mitigation: document the assumed topology in `docs/backend-standards.md`.
- **Drift between local Postgres and RDS:** Both run Postgres 15; Prisma migrations are the single source of truth. Risk is low as long as `prisma migrate deploy` runs on both environments.
- **`.env.docker` not committed:** Developer must create it from `.env.example`. Mitigation: document clearly in `docs/development_guide.md`; entrypoint script exits with helpful error if `DATABASE_URL` is missing.

## Migration Plan

1. Create `backend/Dockerfile`, `backend/.dockerignore`, `backend/entrypoint.sh`
2. Create `backend/.env.docker` from `.env.example` (local only, not committed)
3. Extend `docker-compose.yml` with `backend` service (and optional `frontend` profile)
4. Add `trust proxy` conditional in `backend/src/index.ts`
5. Update `backend/.env.example` with dev vs Docker URL comments
6. Update `docs/development_guide.md` and `docs/backend-standards.md`
7. Verify: `docker compose up -d` → backend healthy → `curl localhost:3000/api/public/categories` returns data from local DB

**Rollback:** No prod changes. If the Dockerfile or compose changes cause issues, revert `docker-compose.yml` and `backend/Dockerfile`; local dev falls back to host-only mode with `backend/.env`. The `trust proxy` fix has no prod rollback concern — it corrects behavior in both envs.

## Open Questions

_(none — all decisions resolved)_
