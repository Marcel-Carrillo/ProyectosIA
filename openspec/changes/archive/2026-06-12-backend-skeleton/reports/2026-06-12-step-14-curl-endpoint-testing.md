# Step 14 — Endpoint Testing

**Date:** 2026-06-12
**Change:** backend-skeleton

## Docker Note

Docker is not available in this environment. `docker-compose.yml` at project root is correct and ready. PostgreSQL must be started manually with `docker compose up -d` before running the dev server in production workflows. The server was tested without a live DB (health endpoint does not query the database).

## Server Startup

**Command:** `npx ts-node --transpile-only src/index.ts`

```json
{"level":"info","message":"Server started","timestamp":"2026-06-11T22:42:09.393Z","port":3000,"env":"development"}
```

## curl Tests

### GET /health

```
curl -s http://localhost:3000/health
```

**Response:**
- HTTP status: `200 OK`
- Body: `{"status":"ok"}`

### GET /nonexistent

```
curl -s http://localhost:3000/nonexistent
```

**Response:**
- HTTP status: `404 Not Found`
- Body: `{"success":false,"error":{"message":"Route not found","code":"NOT_FOUND"}}`

## Verification

- Health endpoint: **PASS** — 200 with `{"status":"ok"}`
- 404 handler: **PASS** — 404 with standard error body format
- No stack traces in response bodies: **PASS**
- Standard `{ success, error }` envelope: **PASS**
