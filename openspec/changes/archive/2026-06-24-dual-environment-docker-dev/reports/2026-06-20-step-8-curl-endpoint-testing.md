# Step 8 Report - Manual curl Endpoint Testing

- Date: 2026-06-20
- Change: dual-environment-docker-dev
- Agent: claude-sonnet-4-6

## Commands Executed

```bash
# 8.1 Categories
curl -s http://localhost:3000/api/public/categories
# → 200 {"success":true,"data":[...3 categories...]}

# 8.2 Products
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/public/products?status=Active&page=1&pageSize=5"
# → 200

# 8.3 Rate-limited public auth (trust proxy fix verification)
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST http://localhost:3000/api/public/auth/login \
  -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"wrong"}'
# → 401 {"success":false,"error":{"message":"Invalid email or password","code":"INVALID_CREDENTIALS"}}

# 8.4 Rate limit trigger (admin auth, limit=30)
for i in $(seq 1 32); do ... done
# → 429 triggered at request 30 (no crash at any point)

# 8.5 Admin auth no crash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" -d '{"email":"x","password":"y"}'
# → 401 {"success":false,"error":{"message":"Invalid email or password","code":"INVALID_CREDENTIALS"}}

# 8.6 Mailpit UI
curl -s -o /dev/null -w "%{http_code}" http://localhost:8025
# → 200
```

## Results Summary

| Test | Endpoint | Expected | Actual | Pass |
|------|----------|----------|--------|------|
| 8.1 Categories | GET /api/public/categories | 200 + JSON | 200 ✓ | ✓ |
| 8.2 Products | GET /api/public/products | 200 | 200 ✓ | ✓ |
| 8.3 Auth no crash | POST /api/public/auth/login | 401 (not 500) | 401 ✓ | ✓ |
| 8.4 Rate limit 429 | POST /api/admin/auth/login x30+ | 429 at limit | 429 at req 30 ✓ | ✓ |
| 8.5 Admin auth | POST /api/admin/auth/login | 401 (not 500) | 401 ✓ | ✓ |
| 8.6 Mailpit | GET http://localhost:8025 | 200 HTML | 200 ✓ | ✓ |

## Key Validation: trust proxy fix

- Before fix: `express-rate-limit` threw `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` → 500
- After fix: all rate-limited routes return correct HTTP status codes; no crashes
- Rate limit correctly enforces per-IP limit (429 at request 30 for admin, limit=30)

## Database State

- Local Docker Postgres used for all responses (categories, products from seed)
- No CREATE/UPDATE/DELETE operations performed; no restoration needed

## Outcome

- Step 8 status: PASS
- Blocking issues: None
