# Step 9 Report - curl and Smoke Script Verification

- Date: 2026-06-19
- Change: production-deployment (KAN-26)
- Base URL: `http://localhost:3000` (project default `PORT=3000`)

## Preconditions

- Backend restarted with updated `healthRoutes.ts` (`npm run dev` in `backend/`)
- PostgreSQL reachable via Docker Compose

## curl: GET /health (DB reachable)

```bash
curl.exe -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/health
```

**Result:** HTTP 200 — `{"status":"ok","db":"up"}`

## Response body fields

Parsed JSON property names: `status`, `db` only (no extra fields).

## Smoke script

```bash
"C:\Program Files\Git\bin\bash.exe" scripts/smoke.sh http://localhost:3000
```

**Output:**

```
Running smoke tests against: http://localhost:3000

  PASS: GET /health -> 200 with status:ok
  PASS: GET /api/public/products -> 200
  PASS: GET /api/admin/products (no token) -> 401

Results: 3 passed, 0 failed
```

Exit code: 0

## Outcome

- Step 9 status: PASS
- Blocking issues: None
