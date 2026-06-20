## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Read `ai-specs/skills/using-git-worktrees/SKILL.md` and decide workspace isolation strategy (current checkout vs dedicated Git worktree)
- [x] 0.2 Create and switch to feature branch `feature/dual-environment-docker-dev` from `master`
- [x] 0.3 Verify branch creation with `git status` and `git branch`

## 1. Backend: Fix trust proxy in Express

- [x] 1.1 Read `backend/src/index.ts` and locate app initialization (before middleware mounting)
- [x] 1.2 Add `app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 'loopback')` immediately after `const app = express()`
- [x] 1.3 Verify TypeScript compiles without errors (`cd backend && npx tsc --noEmit`)

## 2. Infra: Backend Dockerfile and dockerignore

- [x] 2.1 Create `backend/Dockerfile` with two stages: `build` (tsc compile) and `dev` (ts-node-dev with src bind-mount)
- [x] 2.2 `dev` stage: `CMD ["npm", "run", "dev"]`; expose port `3000`
- [x] 2.3 Create `backend/.dockerignore` excluding `node_modules`, `dist`, `.env`, `.env.docker`, `coverage`
- [x] 2.4 Create `backend/entrypoint.sh`: wait for DB healthcheck → `npx prisma migrate deploy` → `npx prisma db seed` (only if empty) → `npm run dev`
- [x] 2.5 Ensure `entrypoint.sh` is executable and referenced as container entrypoint in Dockerfile dev stage

## 3. Infra: Extend docker-compose.yml

- [x] 3.1 Read existing `docker-compose.yml` to understand current `db` and `mailpit` service configs
- [x] 3.2 Add `healthcheck` to `db` service (`pg_isready -U <user> -d <dbname>`)
- [x] 3.3 Add `backend` service: `build: { context: ./backend, target: dev }`, `ports: ['3000:3000']`, `env_file: ./backend/.env.docker`, `depends_on: { db: { condition: service_healthy } }`, `volumes: ['./backend/src:/app/src', 'backend_node_modules:/app/node_modules']`
- [x] 3.4 Add named volume `backend_node_modules` at the bottom of compose file (prevents host node_modules from shadowing container's)
- [x] 3.5 Add optional `frontend` service under `profiles: [frontend]`: `build: ./frontend`, `ports: ['3001:3001']`, `environment: REACT_APP_API_BASE_URL=http://localhost:3000`, `volumes: ['./frontend/src:/app/src']`
- [x] 3.6 Verify `docker compose config` parses the compose file without errors

## 4. Infra: Backend .env.docker and .env.example

- [x] 4.1 Create `backend/.env.docker` with all required keys using local values: `DATABASE_URL=postgresql://ecommerceUser:ecommercePassword@db:5432/ecommerceDb`, `NODE_ENV=development`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_SECURE=false`, `FRONTEND_URL=http://localhost:3001`, and dummy values for JWT secrets, cookie secret, OAuth credentials, Stripe test keys
- [x] 4.2 Verify `.env.docker` is listed in `.gitignore` (add if missing)
- [x] 4.3 Update `backend/.env.example`: add comment block at top distinguishing "Host local" (`localhost:5432`) vs "Docker" (`db:5432`) for `DATABASE_URL` and SMTP vars

## 5. Infra: Optional Frontend Dockerfile

- [x] 5.1 Create `frontend/Dockerfile` (single stage, `node:20-alpine`, `npm start`, expose `3001`)
- [x] 5.2 Create `frontend/.dockerignore` excluding `node_modules`, `build`, `.env*`
- [x] 5.3 Verify the frontend profile starts correctly with `docker compose --profile frontend up frontend`

## 6. Verification: Review and Update Existing Unit Tests (MANDATORY)

- [x] 6.1 Read backend test files that cover middleware or index.ts initialization (if any)
- [x] 6.2 Check if any existing test mocks `app.set` or depends on `trust proxy` not being set; update if needed
- [x] 6.3 Confirm no test asserts on `X-Forwarded-For` behavior in a way that conflicts with the new setting

## 7. Verification: Run Unit Tests and Verify Stack (MANDATORY)

- [x] 7.1 Start the Docker stack: `docker compose up -d --build`
- [x] 7.2 Wait for backend health: `curl -s http://localhost:3000/api/public/categories` returns JSON (not a connection error)
- [x] 7.3 Run backend unit tests from host: `cd backend && npm test -- --forceExit`
- [x] 7.4 Confirm all tests pass with no new failures
- [x] 7.5 Verify DB is local: inspect `DATABASE_URL` in the running container — must NOT contain `rds.amazonaws.com`
- [x] 7.6 Create report `openspec/changes/dual-environment-docker-dev/reports/YYYY-MM-DD-step-7-unit-test-and-db-verification.md`

## 8. Verification: Manual curl Testing (MANDATORY - AGENT MUST EXECUTE)

- [x] 8.1 Verify categories endpoint: `curl -s http://localhost:3000/api/public/categories` → `200` with JSON array
- [x] 8.2 Verify products endpoint: `curl -s "http://localhost:3000/api/public/products?status=Active&page=1&pageSize=5"` → `200`
- [x] 8.3 Verify rate-limited auth route does NOT crash: `curl -s -X POST http://localhost:3000/api/public/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"wrong"}'` → `401` (not 500)
- [x] 8.4 Verify rate limit triggers: send 6+ rapid login requests and confirm last returns `429`
- [x] 8.5 Verify admin auth does NOT crash: `curl -s -X POST http://localhost:3000/api/admin/auth/login -H "Content-Type: application/json" -d '{"email":"x","password":"y"}'` → `401` (not 500)
- [x] 8.6 Verify Mailpit UI accessible: `curl -s http://localhost:8025` → HTML (Mailpit inbox)
- [x] 8.7 Create report `openspec/changes/dual-environment-docker-dev/reports/YYYY-MM-DD-step-8-curl-endpoint-testing.md`

## 9. Verification: E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Ensure frontend dev server is running on host (`cd frontend && npm start`) and backend Docker stack is up
- [x] 9.2 Navigate to `http://localhost:3001` with Playwright MCP `browser_navigate`
- [x] 9.3 Verify catalog page loads with products (no 500 errors in network tab — use `browser_network_requests`)
- [x] 9.4 Verify categories appear in navigation (populated from local DB via seed)
- [x] 9.5 Take screenshot of catalog and save as evidence
- [x] 9.6 Create report `openspec/changes/dual-environment-docker-dev/reports/YYYY-MM-DD-step-9-e2e-testing.md`

## 10. Update Technical Documentation (MANDATORY)

- [x] 10.1 Update `docs/development_guide.md`: add "Docker Dev Setup" section with `docker compose up -d`, first-run instructions, how to view Mailpit, how to use frontend profile, and troubleshooting tips for the `trust proxy` fix
- [x] 10.2 Update `docs/backend-standards.md`: document two environments (dev: Docker + ts-node-dev; prod: Lambda + Serverless), `trust proxy` convention by `NODE_ENV`, and `backend/.env.docker` usage
- [x] 10.3 Verify `backend/.env.example` changes reflect the host vs Docker distinction added in task 4.3

## 11. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 11.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 11.2 Verify all tasks above are marked `[x]` and reports exist under `openspec/changes/dual-environment-docker-dev/reports/`
- [ ] 11.3 Stage all relevant files: `backend/Dockerfile`, `backend/.dockerignore`, `backend/entrypoint.sh`, `backend/.env.example`, `docker-compose.yml`, `backend/src/index.ts`, `frontend/Dockerfile`, `frontend/.dockerignore`, `docs/development_guide.md`, `docs/backend-standards.md`, `openspec/changes/dual-environment-docker-dev/` — exclude `.env.docker`, `node_modules`, `dist`, `coverage`
- [ ] 11.4 Create commit: `feat(infra): add Docker dev environment and fix trust proxy for rate limiter`
- [ ] 11.5 Push branch: `git push -u origin feature/dual-environment-docker-dev`
- [ ] 11.6 Create Pull Request with `gh pr create` and report URL in chat
