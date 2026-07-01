# Step 8 Report — Manual Endpoint Testing (curl)

- Date: 2026-06-28
- Change: customer-welcome-email
- Agent: Claude Sonnet 4.6

## Environment

- Backend: Docker container rebuilt with new code (`docker compose build backend && docker compose up -d backend`)
- DB pre-test baseline: Coupon COUNT = 12

## Commands Executed and Results

### 8.2 — POST /api/public/auth/register (new customer)

```bash
curl -s -X POST http://localhost:3000/api/public/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"welcome-curl-test-1782661800@example.com","password":"BuyerPass1","firstName":"Welcome","lastName":"Test"}'
```

**Response:** 201 `{ success: true, data: { account: { id: 300 }, customer: { id: 421 }, accessToken } }`

**DB verification:**
```sql
SELECT code, type, value, "maxUses", active, "expiresAt" FROM "Coupon"
WHERE code LIKE 'WELCOME-%' ORDER BY "createdAt" DESC LIMIT 1;
```
Result: `WELCOME-966ED68FA25C3CF544148C7BBAD7CBB6 | percentage | 15.00 | 1 | t | 2026-07-28 15:50:00.928`

✓ Coupon created with correct format, type, value, maxUses, and 30-day expiry.

### 8.3 — POST /api/public/auth/register (duplicate email)

```bash
curl -s -X POST http://localhost:3000/api/public/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"welcome-curl-test-1782661800@example.com","password":"BuyerPass1","firstName":"Welcome","lastName":"Test"}'
```

**Response:** `{ success: false, error: { message: "An account with this email already exists", code: "ACCOUNT_EMAIL_CONFLICT" } }`

**DB verification:** COUNT of WELCOME- coupons created in last minute = 1 (unchanged — no new coupon on conflict)

✓ 409 ACCOUNT_EMAIL_CONFLICT, no coupon created.

### 8.4 — POST /api/public/coupons/validate (welcome coupon valid)

```bash
curl -s -X POST http://localhost:3000/api/public/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"WELCOME-966ED68FA25C3CF544148C7BBAD7CBB6","subtotalAmount":100}'
```

**Response:** `{ success: true, data: { valid: true, discountAmount: "15.00", type: "percentage", value: "15", couponId: 41 } }`

✓ Welcome coupon validates correctly with 15% discount on €100 order.

### 8.6 — Database Restoration

```sql
DELETE FROM "Coupon" WHERE code = 'WELCOME-966ED68FA25C3CF544148C7BBAD7CBB6';  -- 1 deleted
DELETE FROM "CustomerRefreshToken" WHERE "customerAccountId" = 300;             -- 1 deleted
DELETE FROM "CustomerAccount" WHERE id = 300;                                    -- 1 deleted
DELETE FROM "Customer" WHERE id = 421;                                           -- 1 deleted
```

Post-restoration: `SELECT COUNT(*) FROM "Coupon"` = **12** (matches baseline)

✓ Database fully restored.

## Outcome

- Step 8 status: **PASS**
- All assertions met: 201 on new registration, WELCOME- coupon created in DB, duplicate email returns 409 with no coupon, coupon validates at 15%
- Database restored to baseline (12 coupons)
- Blocking issues: None
