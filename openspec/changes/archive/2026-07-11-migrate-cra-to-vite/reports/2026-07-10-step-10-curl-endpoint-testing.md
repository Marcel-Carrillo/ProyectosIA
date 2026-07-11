# Step 10 Report - Manual Endpoint Testing with curl (Vite dev proxy parity)

- Date: 2026-07-10
- Change: migrate-cra-to-vite
- Agent: Claude Code (Fable 5)

> No backend endpoints changed in this migration. This step verifies API reachability parity through the new Vite dev proxy (`server.proxy` in `vite.config.ts`, replacing CRA's `setupProxy.js`). All calls are read-only — no database restoration needed.

## Environment

- Backend: Docker (`ecommerce-backend`) on `http://localhost:3000`, DB healthy
- Frontend dev server: `npm run dev` (Vite 6.4.3) on `http://localhost:3001` (the stale CRA Docker frontend container was stopped first so Vite owns port 3001)

## Commands Executed and Results

| # | Command | Result | Expected |
|---|---|---|---|
| 1 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/public/products` | **200** | 200 ✔ |
| 2 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/public/categories` | **200** | 200 ✔ |
| 3 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/admin/products` (no token) | **401** | 401 ✔ |
| 4 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health` (direct backend) | **200** | 200 ✔ |
| 5 | `diff <(curl -s :3001/api/public/categories) <(curl -s :3000/api/public/categories)` | **IDENTICAL** | body parity ✔ |

Sample proxied body (`/api/public/products` via :3001): `{"success":true,"data":{"items":[{"id":120,"name":"Acetate Sunglasses",...` — real catalog data served through the proxy.

## Error Cases

- Admin surface without Bearer token through the proxy → 401 (auth gate preserved through proxying, `changeOrigin: true`).

## Cleanup

- No mutations performed (GET-only). Database untouched.

## Outcome

- Step 10 status: **PASS** — full behavior parity between Vite `server.proxy` and the removed CRA `setupProxy.js`.
