# Step G — curl / endpoint verification (2026-06-18)

## Admin auth

| Endpoint | Result |
|----------|--------|
| `POST /api/admin/auth/login` | 200 + accessToken |
| `GET /api/admin/customers` (no token) | 401 |
| Integration: `adminAuthRoutes.test.ts` | PASS |

## Customer auth

| Endpoint | Result |
|----------|--------|
| `POST /api/public/auth/register` | 201 |
| `GET /api/public/account/profile` (Bearer) | 200 |
| `POST /api/public/auth/logout` | 200 |
| Integration: `customerAuthRoutes.test.ts` | PASS |

## Checkout / coupons

- `checkoutService` + routes wired at `/api/public/checkout/guest` and `/api/public/checkout`
- `POST /api/public/coupons/validate` wired
- Wishlist CRUD at `/api/public/account/wishlist`

Manual live check: admin login via `Invoke-RestMethod` on `localhost:3000` returned 200 with `aud: admin` JWT.

## DB restore

No destructive test data beyond seeded admin/coupon; customer register tests create ephemeral accounts.
