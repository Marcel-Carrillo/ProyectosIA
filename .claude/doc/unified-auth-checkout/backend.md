# Backend Implementation Plan — unified-auth-checkout

> Feature branch: `feature/unified-auth-checkout`  
> Jira: KAN-23 (admin auth) · KAN-51 (customer auth, wishlist, coupons) · KAN-21 (checkout MVP)  
> Tasks: A1, B1, B2, B3, C1

---

## Important notes for implementers

- **Dependencies already installed**: `bcryptjs`, `jsonwebtoken`, `nodemailer`, `speakeasy`, `uuid`, `cookie-parser` are all in `package.json`. No new npm packages needed.
- **`cookie-parser` is NOT yet wired into `src/index.ts`**. Must add `import cookieParser from 'cookie-parser'` and `app.use(cookieParser())` before auth routes.
- **Dual JWT namespaces are non-negotiable**: admin tokens use `ADMIN_JWT_SECRET` + `aud: "admin"`, customer tokens use `CUSTOMER_JWT_SECRET` + `aud: "customer"`. Each middleware rejects the other audience.
- **Admin seeding**: `prisma/seed.ts` currently only imports products. A separate `prisma/seedAdmin.ts` script (or a migration SQL approach) seeds the single `AdminUser` from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.
- **All existing admin tests** in `src/routes/admin/__tests__/`, `src/presentation/controllers/__tests__/`, and `src/application/services/__tests__/` will break after `requireAdminAuth` is mounted on `/api/admin/*`. Every test that calls admin endpoints must be updated to first obtain an admin access token (or mock the middleware).
- **Supplier fields** (`supplierId`, `supplierCost`, `supplierReference`) must never appear in any public API response. The existing `variantSelectForOrder` pattern in `customerOrderService.ts` already omits them — follow it everywhere.
- **`checkoutService.createOrder`** is the single shared entry point for both guest and authenticated checkout. It re-uses the snapshot and total-computation logic already established in `CustomerOrderService`, so align the data structures.
- **Order numbers** for checkout-created orders: generate with same pattern as existing admin order creation (UUID short prefix).
- **Rate limiting**: specs require rate limiting on auth and coupon endpoints. Install and use `express-rate-limit` (add to package.json).
- All new env vars required: `ADMIN_JWT_SECRET`, `CUSTOMER_JWT_SECRET`, `ADMIN_JWT_EXPIRES_IN`, `CUSTOMER_JWT_EXPIRES_IN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FRONTEND_URL`.
- **OAuth Google**: Use `google-auth-library` for ID token verification (add to package.json). Apple and Facebook: implement server-side token exchange.

---

## Implementation order

1. [Phase A] Admin auth backend — security gate must land first
2. [Phase B] Customer auth + wishlist + coupons backend
3. [Phase C] Checkout service and routes
4. Update existing tests and documentation

---

## Phase A — Admin Authentication (KAN-23 / task A1)

### A.1 Prisma schema changes

**File**: `backend/prisma/schema.prisma`  
**Action**: MODIFY — append two new models at the end of the file.

```
model AdminUser {
  id           Int                @id @default(autoincrement())
  email        String             @unique @db.VarChar(255)
  passwordHash String             @db.VarChar(255)
  status       String             @default("Active")   // "Active" | "Disabled"
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
  refreshTokens AdminRefreshToken[]
}

model AdminRefreshToken {
  id          Int       @id @default(autoincrement())
  adminUserId Int
  adminUser   AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique @db.VarChar(255)
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())

  @@index([adminUserId])
  @@index([tokenHash])
}
```

**Migration name**: `add_admin_auth`  
Run: `npx prisma migrate dev --name add_admin_auth`

---

### A.2 Admin seed script

**File**: `backend/prisma/seedAdmin.ts` *(NEW)*  
**Purpose**: Seeds one `AdminUser` from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars using bcryptjs (cost 12). Safe to run multiple times (upsert by email). Called manually during first deploy or via a migration SQL script.

Key content:
- Import `PrismaClient` and `bcryptjs`
- Read `ADMIN_EMAIL`, `ADMIN_PASSWORD` from `process.env` — throw if missing
- Hash password with `bcrypt.hash(password, 12)`
- `prisma.adminUser.upsert({ where: { email }, update: {}, create: { email, passwordHash, status: 'Active' } })`
- Never log or print the password hash

---

### A.3 Domain model

**File**: `backend/src/domain/models/adminUser.ts` *(NEW)*

```typescript
export type AdminStatus = 'Active' | 'Disabled';

export class AdminUser {
  id?: number;
  email: string;
  passwordHash: string;
  status: AdminStatus;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: { id?: number; email: string; passwordHash: string; status?: string; createdAt?: Date; updatedAt?: Date }) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.status = (data.status as AdminStatus) ?? 'Active';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  isActive(): boolean {
    return this.status === 'Active';
  }
}
```

No refresh token domain model needed — it is handled entirely at the infrastructure layer.

---

### A.4 Domain repository interface

**File**: `backend/src/domain/repositories/adminUserRepository.ts` *(NEW)*

```typescript
import { AdminUser } from '../models/adminUser';

export interface IAdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: number): Promise<AdminUser | null>;
  storeRefreshToken(adminUserId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<{ adminUserId: number; expiresAt: Date; revokedAt: Date | null } | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllRefreshTokensForAdmin(adminUserId: number): Promise<void>;
}
```

---

### A.5 Infrastructure repository implementation

**File**: `backend/src/infrastructure/repositories/adminUserRepository.ts` *(NEW)*

Implements `IAdminUserRepository` using `prisma` from `infrastructure/prismaClient`.

Key points:
- `findByEmail`: `prisma.adminUser.findUnique({ where: { email } })` → return `new AdminUser(data)` or `null`
- `findById`: same pattern
- `storeRefreshToken`: `prisma.adminRefreshToken.create({ data: { adminUserId, tokenHash, expiresAt } })`
- `findRefreshToken`: `prisma.adminRefreshToken.findUnique({ where: { tokenHash } })` — return raw record (no domain class needed)
- `revokeRefreshToken`: `prisma.adminRefreshToken.update({ where: { tokenHash }, data: { revokedAt: new Date() } })` — catch Prisma P2025 (not found) silently
- `revokeAllRefreshTokensForAdmin`: `prisma.adminRefreshToken.updateMany({ where: { adminUserId }, data: { revokedAt: new Date() } })`

Error classes exported from this file:
```typescript
export class AdminNotFoundError extends Error { readonly code = 'ADMIN_NOT_FOUND'; readonly status = 404; }
export class AdminDisabledError extends Error { readonly code = 'ADMIN_DISABLED'; readonly status = 403; }
export class AdminRefreshTokenInvalidError extends Error { readonly code = 'REFRESH_TOKEN_INVALID'; readonly status = 401; }
```

---

### A.6 Admin token service

**File**: `backend/src/application/services/adminTokenService.ts` *(NEW)*

Responsibilities: sign and verify admin JWTs only. Never mixes with customer token logic.

```typescript
import jwt from 'jsonwebtoken';

const ADMIN_ACCESS_TOKEN_EXPIRY = process.env.ADMIN_JWT_EXPIRES_IN ?? '15m';
const ADMIN_REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface AdminTokenPayload {
  sub: string;   // adminUser.id as string
  email: string;
  aud: 'admin';
}

export function signAdminAccessToken(payload: Omit<AdminTokenPayload, 'aud'>): string {
  return jwt.sign(
    { ...payload, aud: 'admin' },
    process.env.ADMIN_JWT_SECRET as string,
    { expiresIn: ADMIN_ACCESS_TOKEN_EXPIRY }
  );
}

export function verifyAdminAccessToken(token: string): AdminTokenPayload {
  // Throws if invalid, expired, or wrong audience
  return jwt.verify(token, process.env.ADMIN_JWT_SECRET as string, { audience: 'admin' }) as AdminTokenPayload;
}

export function generateRefreshTokenRaw(): string {
  // crypto.randomBytes(64).toString('hex')
}

export function hashRefreshToken(raw: string): string {
  // crypto.createHash('sha256').update(raw).digest('hex')
}

export function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ADMIN_REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
}
```

---

### A.7 Admin auth service

**File**: `backend/src/application/services/adminAuthService.ts` *(NEW)*

Orchestrates login, refresh, logout, me. Depends on `IAdminUserRepository` and `adminTokenService`. Does NOT touch Prisma directly.

Methods:
- `login(email, password): Promise<{ admin: Omit<AdminUser, 'passwordHash'>; accessToken: string; rawRefreshToken: string }>`
  1. `repo.findByEmail(normalizedEmail)` — throw `InvalidCredentialsError` if null (generic message)
  2. `bcrypt.compare(password, admin.passwordHash)` — throw `InvalidCredentialsError` if false
  3. Check `admin.isActive()` — throw `AdminDisabledError` if disabled
  4. `signAdminAccessToken({ sub: id, email })`
  5. Generate raw refresh token, hash it, store via `repo.storeRefreshToken`
  6. Return `{ admin: safeAdmin, accessToken, rawRefreshToken }`
- `refresh(rawToken): Promise<{ accessToken: string; rawRefreshToken: string }>`
  1. Hash incoming token, `repo.findRefreshToken(hash)`
  2. Validate not null, not revoked, not expired — throw `AdminRefreshTokenInvalidError`
  3. `repo.findById(adminUserId)` — validate active
  4. Revoke old token, issue new token pair
- `logout(rawToken): Promise<void>`
  1. Hash token, `repo.revokeRefreshToken(hash)` — silently ignore not-found
- `me(adminId): Promise<Omit<AdminUser, 'passwordHash'>>`
  1. `repo.findById(adminId)` — throw `AdminNotFoundError`
  2. Return safe fields only

New error class in this file or in `adminUserRepository.ts`:
```typescript
export class InvalidCredentialsError extends Error { readonly code = 'INVALID_CREDENTIALS'; readonly status = 401; }
```

---

### A.8 Validators for admin auth

**File**: `backend/src/application/validator.ts`  
**Action**: MODIFY — add `validateAdminLoginData` function.

```typescript
export function validateAdminLoginData(data: Record<string, unknown>): void {
  // email: required, valid format
  // password: required, non-empty string
}
```

---

### A.9 Admin auth controller

**File**: `backend/src/presentation/controllers/adminAuthController.ts` *(NEW)*

Thin Express handler — delegates entirely to `adminAuthService`. No business logic.

Functions:
- `loginAdmin(req, res, next)`: reads body `{ email, password }`, calls `validateAdminLoginData`, calls `adminAuthService.login`, sets httpOnly `admin_refresh` cookie (`httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000`), returns `200 { success: true, data: { admin, accessToken } }`.
- `refreshAdminToken(req, res, next)`: reads `req.cookies.admin_refresh`, calls `adminAuthService.refresh`, sets new cookie, returns `200 { success: true, data: { accessToken } }`.
- `logoutAdmin(req, res, next)`: reads cookie, calls `adminAuthService.logout`, clears cookie, returns `200 { success: true }`.
- `getAdminMe(req, res, next)`: reads `req.adminUser.id` (set by middleware), calls `adminAuthService.me`, returns `200 { success: true, data: { admin } }`.

**Critical**: Never log or return `passwordHash`, cookie token value, or raw refresh token in response body.

---

### A.10 `requireAdminAuth` middleware

**File**: `backend/src/middleware/requireAdminAuth.ts` *(NEW)*

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyAdminAccessToken } from '../application/services/adminTokenService';

declare global {
  namespace Express {
    interface Request {
      adminUser?: { id: number; email: string };
    }
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
    return;
  }
  try {
    const payload = verifyAdminAccessToken(token);
    req.adminUser = { id: Number(payload.sub), email: payload.email };
    next();
  } catch {
    res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
  }
}
```

Key design decisions:
- Responds immediately with `401` on failure — does NOT call `next(error)` — to avoid leaking internal error details.
- `aud: "admin"` validation is done inside `verifyAdminAccessToken`. Customer tokens will fail here.

---

### A.11 Admin auth routes

**File**: `backend/src/routes/admin/authRoutes.ts` *(NEW)*

```typescript
import { Router } from 'express';
import { loginAdmin, refreshAdminToken, logoutAdmin, getAdminMe } from '../../presentation/controllers/adminAuthController';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';

const router = Router();

router.post('/login', loginAdmin);
router.post('/refresh', refreshAdminToken);
router.post('/logout', logoutAdmin);
router.get('/me', requireAdminAuth, getAdminMe);

export default router;
```

---

### A.12 Wire middleware and routes in `index.ts`

**File**: `backend/src/index.ts`  
**Action**: MODIFY

Changes needed:
1. Add `import cookieParser from 'cookie-parser';` and `app.use(cookieParser())` before route mounting.
2. Import `{ requireAdminAuth }` from `./middleware/requireAdminAuth`.
3. Import admin auth routes: `import adminAuthRoutes from './routes/admin/authRoutes';`
4. Mount `app.use('/api/admin/auth', adminAuthRoutes)` — **before** the `requireAdminAuth` guard.
5. Apply `requireAdminAuth` as a router-level middleware on all existing admin route groups:
   ```typescript
   app.use('/api/admin/products', requireAdminAuth, productAdminRoutes);
   app.use('/api/admin/suppliers', requireAdminAuth, supplierAdminRoutes);
   app.use('/api/admin/customers', requireAdminAuth, customerAdminRoutes);
   app.use('/api/admin/customer-orders', requireAdminAuth, customerOrderAdminRoutes);
   app.use('/api/admin/supplier-orders', requireAdminAuth, supplierOrderAdminRoutes);
   ```

---

### A.13 Error handler update

**File**: `backend/src/middleware/errorHandler.ts`  
**Action**: MODIFY — import and handle new error types:

```typescript
import { AdminNotFoundError, AdminDisabledError, AdminRefreshTokenInvalidError } from '../infrastructure/repositories/adminUserRepository';
import { InvalidCredentialsError } from '../application/services/adminAuthService';
```

Add corresponding `else if` branches:
- `InvalidCredentialsError` → `401 INVALID_CREDENTIALS`
- `AdminDisabledError` → `403 ADMIN_DISABLED`
- `AdminRefreshTokenInvalidError` → `401 REFRESH_TOKEN_INVALID`
- `AdminNotFoundError` → `404 ADMIN_NOT_FOUND`

---

### A.14 Unit tests — admin auth

New test files (all use Jest + mock pattern consistent with existing tests):

| File | Tests |
|------|-------|
| `backend/src/application/services/__tests__/adminAuthService.test.ts` | login success, wrong password → `INVALID_CREDENTIALS`, disabled admin → `ADMIN_DISABLED`, refresh valid, refresh revoked → `REFRESH_TOKEN_INVALID`, logout, me success |
| `backend/src/presentation/controllers/__tests__/adminAuthController.test.ts` | loginAdmin 200 sets cookie, loginAdmin 401 on bad creds, refreshAdminToken 200, logoutAdmin 200, getAdminMe 200 |
| `backend/src/middleware/requireAdminAuth.test.ts` | passes with valid admin token, 401 on missing token, 401 on customer token, 401 on expired token |
| `backend/src/routes/admin/__tests__/adminAuthRoutes.test.ts` | smoke: login → get me → refresh → logout → get me 401 |

**Update existing admin tests** — all files under `src/routes/admin/__tests__/` and `src/presentation/controllers/__tests__/` that call admin endpoints (product, supplier, customer, customer order, supplier order controllers) must add a `beforeAll` that logs in and attaches `Authorization: Bearer <token>` header. Create `test-utils/adminAuthHelper.ts` that exports `getAdminAccessToken()` to centralise this.

---

## Phase B — Customer Authentication, Wishlist & Coupons (KAN-51 / tasks B1, B2, B3)

### B.1 Prisma schema additions

**File**: `backend/prisma/schema.prisma`  
**Action**: MODIFY — append the following models.

**Migration 1 of 3** (`add_customer_account_auth`):
```
model CustomerAccount {
  id               Int                    @id @default(autoincrement())
  customerId       Int                    @unique
  customer         Customer               @relation(fields: [customerId], references: [id], onDelete: Cascade)
  email            String                 @unique @db.VarChar(255)
  passwordHash     String?                @db.VarChar(255)
  authProvider     String                 @default("local")   // "local" | "google" | "apple" | "facebook"
  googleId         String?                @unique @db.VarChar(255)
  appleId          String?                @unique @db.VarChar(255)
  facebookId       String?                @unique @db.VarChar(255)
  status           String                 @default("Active")  // "Active" | "Disabled"
  lastLoginAt      DateTime?
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt
  refreshTokens    CustomerRefreshToken[]
  passwordResets   PasswordResetToken[]
  @@index([email])
}

model CustomerRefreshToken {
  id                Int             @id @default(autoincrement())
  customerAccountId Int
  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id], onDelete: Cascade)
  tokenHash         String          @unique @db.VarChar(255)
  expiresAt         DateTime
  revokedAt         DateTime?
  createdAt         DateTime        @default(now())
  @@index([customerAccountId])
  @@index([tokenHash])
}
```

Also add reverse relation to `Customer` model:
```
// In Customer model, add:
customerAccount  CustomerAccount?
```

**Migration 2 of 3** (`add_password_reset_and_2fa`):
```
model PasswordResetToken {
  id                Int             @id @default(autoincrement())
  customerAccountId Int
  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id], onDelete: Cascade)
  tokenHash         String          @unique @db.VarChar(255)
  expiresAt         DateTime
  usedAt            DateTime?
  createdAt         DateTime        @default(now())
  @@index([customerAccountId])
  @@index([tokenHash])
}
```

Also add 2FA fields to `CustomerAccount` model:
```
  totpSecret       String?   @db.VarChar(255)
  totpEnabled      Boolean   @default(false)
```

**Migration 3 of 3** (`add_wishlist_coupons`):
```
model WishlistItem {
  id               Int            @id @default(autoincrement())
  customerId       Int
  customer         Customer       @relation(fields: [customerId], references: [id], onDelete: Cascade)
  productVariantId Int
  productVariant   ProductVariant @relation(fields: [productVariantId], references: [id])
  createdAt        DateTime       @default(now())
  @@unique([customerId, productVariantId])
  @@index([customerId])
}

model Coupon {
  id             Int                @id @default(autoincrement())
  code           String             @unique @db.VarChar(50)
  type           String             @db.VarChar(20)   // "percentage" | "fixed"
  value          Decimal            @db.Decimal(10, 2)
  minOrderAmount Decimal?           @db.Decimal(10, 2)
  maxUses        Int?
  usedCount      Int                @default(0)
  active         Boolean            @default(true)
  startsAt       DateTime?
  expiresAt      DateTime?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  redemptions    CouponRedemption[]
  @@index([code])
}

model CouponRedemption {
  id              Int           @id @default(autoincrement())
  couponId        Int
  coupon          Coupon        @relation(fields: [couponId], references: [id])
  customerOrderId Int           @unique
  customerOrder   CustomerOrder @relation(fields: [customerOrderId], references: [id])
  discountAmount  Decimal       @db.Decimal(10, 2)
  createdAt       DateTime      @default(now())
  @@index([couponId])
}
```

Also add to `Customer` model:
```
  wishlistItems  WishlistItem[]
```

Also add to `CustomerOrder` model:
```
  couponRedemption CouponRedemption?
```

Also add to `ProductVariant` model:
```
  wishlistItems   WishlistItem[]
```

---

### B.2 Domain models

**File**: `backend/src/domain/models/customerAccount.ts` *(NEW)*

```typescript
export type AuthProvider = 'local' | 'google' | 'apple' | 'facebook';
export type AccountStatus = 'Active' | 'Disabled';

export class CustomerAccount {
  id?: number;
  customerId: number;
  email: string;
  passwordHash?: string | null;
  authProvider: AuthProvider;
  googleId?: string | null;
  appleId?: string | null;
  facebookId?: string | null;
  status: AccountStatus;
  lastLoginAt?: Date | null;
  totpSecret?: string | null;
  totpEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: { ... }) { ... }
  isActive(): boolean { return this.status === 'Active'; }
}
```

**File**: `backend/src/domain/models/wishlistItem.ts` *(NEW)*

```typescript
export class WishlistItem {
  id?: number;
  customerId: number;
  productVariantId: number;
  createdAt?: Date;
  // Safe product display fields (populated from include):
  productVariant?: { id: number; sku: string; size?: string | null; color?: string | null; publicPrice: string; product: { name: string; mainImageUrl?: string | null } };

  constructor(data: { ... }) { ... }
}
```

**File**: `backend/src/domain/models/coupon.ts` *(NEW)*

```typescript
export type CouponType = 'percentage' | 'fixed';

export class Coupon {
  id?: number;
  code: string;
  type: CouponType;
  value: string;
  minOrderAmount?: string | null;
  maxUses?: number | null;
  usedCount: number;
  active: boolean;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: { ... }) { ... }

  isValidForSubtotal(subtotalAmount: number): { valid: boolean; reason?: string } {
    // Check active, date window, minOrderAmount, maxUses
  }

  computeDiscount(subtotalAmount: number): number {
    // percentage: floor(subtotal * value / 100, 2); fixed: Math.min(value, subtotal)
  }
}
```

---

### B.3 Domain repository interfaces

**File**: `backend/src/domain/repositories/customerAccountRepository.ts` *(NEW)*

```typescript
export interface ICustomerAccountRepository {
  findByEmail(email: string): Promise<CustomerAccount | null>;
  findById(id: number): Promise<CustomerAccount | null>;
  findByCustomerId(customerId: number): Promise<CustomerAccount | null>;
  findByGoogleId(googleId: string): Promise<CustomerAccount | null>;
  findByAppleId(appleId: string): Promise<CustomerAccount | null>;
  findByFacebookId(facebookId: string): Promise<CustomerAccount | null>;
  create(data: CustomerAccountCreateData): Promise<CustomerAccount>;
  update(id: number, data: CustomerAccountUpdateData): Promise<CustomerAccount>;
  storeRefreshToken(customerAccountId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<{ customerAccountId: number; expiresAt: Date; revokedAt: Date | null } | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllRefreshTokens(customerAccountId: number): Promise<void>;
  createPasswordResetToken(customerAccountId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findPasswordResetToken(tokenHash: string): Promise<{ customerAccountId: number; expiresAt: Date; usedAt: Date | null } | null>;
  markPasswordResetTokenUsed(tokenHash: string): Promise<void>;
}
```

**File**: `backend/src/domain/repositories/wishlistRepository.ts` *(NEW)*

```typescript
export interface IWishlistRepository {
  findByCustomerId(customerId: number): Promise<WishlistItem[]>;
  findItem(customerId: number, productVariantId: number): Promise<WishlistItem | null>;
  addItem(customerId: number, productVariantId: number): Promise<WishlistItem>;
  removeItem(customerId: number, productVariantId: number): Promise<void>;
}
```

**File**: `backend/src/domain/repositories/couponRepository.ts` *(NEW)*

```typescript
export interface ICouponRepository {
  findByCode(code: string): Promise<Coupon | null>;
  incrementUsedCount(couponId: number): Promise<void>;
}
```

---

### B.4 Infrastructure repository implementations

**File**: `backend/src/infrastructure/repositories/customerAccountRepository.ts` *(NEW)*

Implements `ICustomerAccountRepository` using `prisma`.

Key notes:
- `create`: wraps in `prisma.$transaction` when creating account + linking to existing Customer (find-or-create `Customer` by email pattern used in guest checkout).
- `findByEmail`: `prisma.customerAccount.findUnique({ where: { email } })`
- Refresh token operations: identical pattern to `adminUserRepository.ts`.
- Password reset: `prisma.passwordResetToken.create / findUnique / update`.
- Never return `passwordHash`, `totpSecret`, provider ids in service-layer safe objects — provide a `toSafeAccount()` helper or use a select projection.

Error classes:
```typescript
export class AccountEmailConflictError extends Error { readonly code = 'ACCOUNT_EMAIL_CONFLICT'; readonly status = 409; }
export class AccountDisabledError extends Error { readonly code = 'ACCOUNT_DISABLED'; readonly status = 403; }
export class CustomerRefreshTokenInvalidError extends Error { readonly code = 'REFRESH_TOKEN_INVALID'; readonly status = 401; }
export class ResetTokenInvalidError extends Error { readonly code = 'RESET_TOKEN_INVALID'; readonly status = 400; }
export class InvalidTotpCodeError extends Error { readonly code = 'INVALID_TOTP_CODE'; readonly status = 401; }
export class OAuthVerificationFailedError extends Error { readonly code = 'OAUTH_VERIFICATION_FAILED'; readonly status = 401; }
```

**File**: `backend/src/infrastructure/repositories/wishlistRepository.ts` *(NEW)*

Implements `IWishlistRepository`.
- `findByCustomerId`: `prisma.wishlistItem.findMany({ where: { customerId }, include: { productVariant: { select: { id, sku, size, color, publicPrice, product: { select: { name, mainImageUrl } } } } } })`
- `addItem`: `prisma.wishlistItem.upsert({ where: { customerId_productVariantId: { customerId, productVariantId } }, create: ..., update: {} })` — idempotent per spec.
- `removeItem`: `prisma.wishlistItem.delete(...)` — catch P2025 to throw `WishlistItemNotFoundError` (or silently ignore for 204).

Error classes:
```typescript
export class WishlistItemNotFoundError extends Error { readonly code = 'WISHLIST_ITEM_NOT_FOUND'; readonly status = 404; }
```

**File**: `backend/src/infrastructure/repositories/couponRepository.ts` *(NEW)*

Implements `ICouponRepository`.
- `findByCode`: `prisma.coupon.findUnique({ where: { code } })` — return `new Coupon(data)` or `null`.
- `incrementUsedCount`: `prisma.coupon.update({ where: { id }, data: { usedCount: { increment: 1 } } })`.

Error classes:
```typescript
export class CouponNotFoundError extends Error { readonly code = 'COUPON_NOT_FOUND'; readonly status = 404; }
export class CouponExhaustedError extends Error { readonly code = 'COUPON_EXHAUSTED'; readonly status = 409; }
```

---

### B.5 Customer token service

**File**: `backend/src/application/services/customerTokenService.ts` *(NEW)*

Mirrors `adminTokenService.ts` exactly, but uses `CUSTOMER_JWT_SECRET` and `aud: "customer"`:

```typescript
export interface CustomerTokenPayload {
  sub: string;         // customerAccount.id as string
  customerId: number;
  email: string;
  aud: 'customer';
}

export function signCustomerAccessToken(payload: Omit<CustomerTokenPayload, 'aud'>): string { ... }
export function verifyCustomerAccessToken(token: string): CustomerTokenPayload { ... }
export function generateRefreshTokenRaw(): string { ... }
export function hashRefreshToken(raw: string): string { ... }
export function refreshTokenExpiresAt(): Date { ... }
```

---

### B.6 Customer auth service (core)

**File**: `backend/src/application/services/customerAuthService.ts` *(NEW)*

Depends on `ICustomerAccountRepository`, `customerTokenService`, `bcryptjs`. Does NOT touch Prisma directly.

Methods:
- `register(data): Promise<RegisterResult>`
  1. Validate via `validateCustomerRegisterData`
  2. Check existing account via `repo.findByEmail` — throw `AccountEmailConflictError` if found
  3. Find existing `Customer` by email via `ICustomerRepository` — link if found, create if not
  4. Hash password (`bcrypt.hash(password, 12)`)
  5. `repo.create({ customerId, email, passwordHash, authProvider: 'local' })`
  6. Issue access token and refresh token, store refresh token
  7. Return `{ account: safeAccount, customer: safeCustomer, accessToken }` + raw refresh for cookie
- `login(email, password): Promise<LoginResult>`
  1. `repo.findByEmail(email)` — throw `InvalidCredentialsError` if null
  2. `bcrypt.compare` — throw `InvalidCredentialsError` if mismatch (same generic message, prevent enumeration)
  3. Check `account.isActive()` — throw `AccountDisabledError`
  4. If `account.totpEnabled === true` — issue short-lived `mfaToken` (separate JWT signed with same secret but short expiry + `mfaRequired: true` claim) and return `{ mfaRequired: true, mfaToken }` without setting refresh cookie
  5. Otherwise: issue full token pair, update `lastLoginAt`, return result
- `verify2fa(mfaToken, totpCode): Promise<FullLoginResult>`
  1. Verify `mfaToken` (check `mfaRequired: true` claim, not expired)
  2. Load account, verify TOTP code with `speakeasy.totp.verify`
  3. Throw `InvalidTotpCodeError` if invalid
  4. Issue full token pair
- `refresh(rawToken): Promise<{ accessToken, rawRefreshToken }>`
  1. Hash token, `repo.findRefreshToken(hash)` — validate not revoked, not expired
  2. Load account, rotate token pair
- `logout(rawToken): Promise<void>`
  1. Hash token, `repo.revokeRefreshToken(hash)` — silently ignore not-found
- `me(accountId): Promise<{ account: SafeAccount; customer: Customer }>`
  1. `repo.findById(accountId)` — throws if not found
  2. Load customer via `ICustomerRepository.findById`
  3. Return safe fields only
- **OAuth handlers** (Google, Apple, Facebook):
  - `loginWithGoogle(idToken): Promise<LoginResult>` — verify token with `google-auth-library`, get email + googleId, apply email-merge-or-create logic, issue tokens
  - `loginWithApple(code): Promise<LoginResult>` — exchange code server-side
  - `loginWithFacebook(accessToken): Promise<LoginResult>` — verify via Graph API
- `forgotPassword(email): Promise<void>`
  1. Find account — if not found, return silently (anti-enumeration)
  2. Generate reset token (raw), hash it, store with 1-hour expiry
  3. Send email via `smtpService.sendPasswordResetEmail(email, rawToken)`
- `resetPassword(rawToken, newPassword): Promise<void>`
  1. Hash token, `repo.findPasswordResetToken(hash)` — validate not used, not expired
  2. Hash new password, `repo.update(accountId, { passwordHash })` + mark token used
  3. `repo.revokeAllRefreshTokens(accountId)`

---

### B.7 Customer account service

**File**: `backend/src/application/services/customerAccountService.ts` *(NEW)*

Handles authenticated buyer profile and own orders. Depends on `ICustomerAccountRepository`, `ICustomerRepository`, `ICustomerOrderRepository`.

Methods:
- `getProfile(customerId): Promise<Customer>`
- `updateProfile(customerId, data): Promise<Customer>` — only firstName, lastName, phone
- `listOrders(customerId, filters): Promise<CustomerOrderListResult>` — uses `ICustomerOrderRepository.findAll({ customerId })` with supplier fields stripped from items
- `getOrder(customerId, orderId): Promise<CustomerOrder>` — `repo.findById(orderId)` then verify `order.customerId === customerId`, else throw `CustomerOrderNotFoundError`
- `setup2fa(accountId): Promise<{ secret, qrCodeUrl }>` — generate TOTP secret with `speakeasy`, store in `repo.update(accountId, { totpSecret })`
- `confirm2fa(accountId, code): Promise<void>` — verify TOTP, `repo.update(accountId, { totpEnabled: true })`
- `disable2fa(accountId, password): Promise<void>` — verify password, `repo.update(accountId, { totpEnabled: false, totpSecret: null })`

---

### B.8 SMTP service

**File**: `backend/src/infrastructure/smtpService.ts` *(NEW)*

Wraps `nodemailer`. Used by `customerAuthService` for password reset emails.

```typescript
import nodemailer from 'nodemailer';

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Reset your password',
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
  });
}
```

---

### B.9 Wishlist service

**File**: `backend/src/application/services/wishlistService.ts` *(NEW)*

Depends on `IWishlistRepository` and `IProductVariantRepository` (for existence/status check).

Methods:
- `listWishlist(customerId): Promise<WishlistItem[]>`
- `addToWishlist(customerId, productVariantId): Promise<WishlistItem>` — verify variant exists and is Active (throw `VariantNotFoundError` if not), then `repo.addItem`
- `removeFromWishlist(customerId, productVariantId): Promise<void>` — `repo.removeItem`

---

### B.10 Coupon service

**File**: `backend/src/application/services/couponService.ts` *(NEW)*

Depends on `ICouponRepository`.

Methods:
- `validateCoupon(code, subtotalAmount): Promise<CouponValidationResult>` — find coupon, call `coupon.isValidForSubtotal(subtotal)`, compute discount. Returns `{ valid: true, discountAmount, type, value }` or `{ valid: false, reason }` or throws `CouponNotFoundError`.

```typescript
export interface CouponValidationResult {
  valid: boolean;
  discountAmount?: number;
  type?: string;
  value?: string;
  reason?: string;
}
```

---

### B.11 Validators for customer auth and wishlist

**File**: `backend/src/application/validator.ts`  
**Action**: MODIFY — add these functions:

- `validateCustomerRegisterData(data)`: email (required, valid format, ≤255 chars), password (required, ≥8 chars, letters+digits), firstName (required, ≤100), lastName (required, ≤100), phone (optional, ≤30)
- `validateCustomerLoginData(data)`: email required + valid, password required
- `validateForgotPasswordData(data)`: email required + valid
- `validateResetPasswordData(data)`: token required, password required + strength check
- `validate2faSetupData(data)` / `validate2faVerifyData(data)`: code required (6-digit numeric)
- `validateWishlistAddData(data)`: productVariantId required, positive integer
- `validateCouponValidateData(data)`: code required, subtotalAmount required + >= 0

---

### B.12 `requireCustomerAuth` middleware

**File**: `backend/src/middleware/requireCustomerAuth.ts` *(NEW)*

Mirrors `requireAdminAuth.ts` but uses `verifyCustomerAccessToken` and populates `req.customerUser`:

```typescript
declare global {
  namespace Express {
    interface Request {
      customerUser?: { accountId: number; customerId: number; email: string };
    }
  }
}
```

Verifies `aud: "customer"`. Responds immediately with `401` on failure without calling `next(error)`.

---

### B.13 Controllers — customer auth and account

**File**: `backend/src/presentation/controllers/customerAuthController.ts` *(NEW)*

Functions:
- `registerCustomer(req, res, next)`: → `201 { success: true, data: { account, customer, accessToken } }` + sets `customer_refresh` httpOnly cookie
- `loginCustomer(req, res, next)`: → `200 { success: true, data: { account, customer, accessToken } }` OR `200 { success: true, data: { mfaRequired: true, mfaToken } }` (no cookie in 2FA case)
- `verify2faLogin(req, res, next)`: → `200` with full token + cookie
- `refreshCustomerToken(req, res, next)`: → `200 { success: true, data: { accessToken } }` + rotated cookie
- `logoutCustomer(req, res, next)`: → `200` + cleared cookie
- `getCustomerMe(req, res, next)`: `requireCustomerAuth` on route level → `200 { success: true, data: { account, customer } }` — strip `passwordHash`, `totpSecret`, provider ids
- `forgotPassword(req, res, next)`: → always `200 { success: true, message: "If that email exists, a reset link has been sent" }`
- `resetPassword(req, res, next)`: → `200` on success
- OAuth controllers: `googleAuthCallback(req, res, next)`, `appleAuthCallback(req, res, next)`, `facebookAuthCallback(req, res, next)` — set cookie and redirect to storefront

**File**: `backend/src/presentation/controllers/customerAccountController.ts` *(NEW)*

Functions (all behind `requireCustomerAuth`):
- `getProfile(req, res, next)`: → `200 { success: true, data: { customer } }`
- `updateProfile(req, res, next)`: → `200 { success: true, data: { customer } }`
- `listMyOrders(req, res, next)`: → `200 { success: true, data: { items, total, page, pageSize } }` — orders stripped of supplier fields
- `getMyOrder(req, res, next)`: → `200 { success: true, data: { order } }` or `404 CUSTOMER_ORDER_NOT_FOUND`
- `setup2fa(req, res, next)`: → `200 { success: true, data: { secret, qrCodeUrl } }`
- `confirm2fa(req, res, next)`: → `200`
- `disable2fa(req, res, next)`: → `200`

**File**: `backend/src/presentation/controllers/wishlistController.ts` *(NEW)*

Functions (all behind `requireCustomerAuth`):
- `listWishlist(req, res, next)`: → `200 { success: true, data: { items } }`
- `addToWishlist(req, res, next)`: → `201 { success: true, data: { item } }` or `200` if already exists
- `removeFromWishlist(req, res, next)`: → `204`

**File**: `backend/src/presentation/controllers/couponController.ts` *(NEW)*

Functions:
- `validateCoupon(req, res, next)`: → `200 { success: true, data: { valid, discountAmount?, type?, value?, reason? } }` or `404 COUPON_NOT_FOUND`

---

### B.14 Routes — customer auth, account, wishlist, coupons

**File**: `backend/src/routes/public/authRoutes.ts` *(NEW)*

```typescript
router.post('/register', rateLimiter, registerCustomer);
router.post('/login', rateLimiter, loginCustomer);
router.post('/2fa/verify', verify2faLogin);
router.post('/refresh', rateLimiter, refreshCustomerToken);
router.post('/logout', logoutCustomer);
router.get('/me', requireCustomerAuth, getCustomerMe);
router.post('/forgot-password', rateLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/google', initiateGoogleOAuth);
router.get('/google/callback', rateLimiter, googleAuthCallback);
router.get('/apple', initiateAppleOAuth);
router.get('/apple/callback', appleAuthCallback);
router.get('/facebook', initiateFacebookOAuth);
router.get('/facebook/callback', facebookAuthCallback);
```

**File**: `backend/src/routes/public/accountRoutes.ts` *(NEW)*

All routes use `requireCustomerAuth` at router level:
```typescript
router.use(requireCustomerAuth);
router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.get('/orders', listMyOrders);
router.get('/orders/:id', getMyOrder);
router.get('/wishlist', listWishlist);
router.post('/wishlist', addToWishlist);
router.delete('/wishlist/:productVariantId', removeFromWishlist);
router.post('/security/2fa/setup', setup2fa);
router.post('/security/2fa/confirm', confirm2fa);
router.post('/security/2fa/disable', disable2fa);
```

**File**: `backend/src/routes/public/couponRoutes.ts` *(NEW)*

```typescript
router.post('/validate', rateLimiter, validateCoupon);
```

---

### B.15 Rate limiter

**File**: `backend/src/middleware/rateLimiter.ts` *(NEW)*

Uses `express-rate-limit` (add to `package.json`):

```typescript
import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests', code: 'RATE_LIMITED' } },
});
```

---

### B.16 Error handler update (Phase B additions)

**File**: `backend/src/middleware/errorHandler.ts`  
**Action**: MODIFY — import and handle:

```typescript
import { AccountEmailConflictError, AccountDisabledError, CustomerRefreshTokenInvalidError, ResetTokenInvalidError, InvalidTotpCodeError, OAuthVerificationFailedError } from '../infrastructure/repositories/customerAccountRepository';
import { WishlistItemNotFoundError } from '../infrastructure/repositories/wishlistRepository';
import { CouponNotFoundError, CouponExhaustedError } from '../infrastructure/repositories/couponRepository';
import { InvalidCredentialsError } from '../application/services/customerAuthService';
```

Add branches:
- `AccountEmailConflictError` → `409`
- `AccountDisabledError` → `403`
- `CustomerRefreshTokenInvalidError` → `401`
- `InvalidCredentialsError` → `401`
- `ResetTokenInvalidError` → `400`
- `InvalidTotpCodeError` → `401`
- `OAuthVerificationFailedError` → `401`
- `WishlistItemNotFoundError` → `404`
- `CouponNotFoundError` → `404`
- `CouponExhaustedError` → `409`

---

### B.17 Wire new public routes in `index.ts`

**File**: `backend/src/index.ts`  
**Action**: MODIFY — add (Phase B):

```typescript
import publicAuthRoutes from './routes/public/authRoutes';
import publicAccountRoutes from './routes/public/accountRoutes';
import couponPublicRoutes from './routes/public/couponRoutes';

app.use('/api/public/auth', publicAuthRoutes);
app.use('/api/public/account', publicAccountRoutes);
app.use('/api/public/coupons', couponPublicRoutes);
```

---

### B.18 Unit tests — customer auth, account, wishlist, coupons

| File | Key scenarios |
|------|---------------|
| `src/application/services/__tests__/customerAuthService.test.ts` | register new account, register conflict → 409, login success, login wrong password → 401, login disabled → 403, login 2FA enabled → mfaRequired, verify2fa valid, verify2fa invalid → 401, refresh valid, refresh revoked → 401, logout, forgot-password (existing + missing, both 200), reset valid, reset expired/used → 400, OAuth Google new + existing |
| `src/application/services/__tests__/customerAccountService.test.ts` | getProfile, updateProfile (only name/phone), listOrders scoped to customerId, getOrder own, getOrder other customer → 404, setup2fa, confirm2fa, disable2fa |
| `src/application/services/__tests__/wishlistService.test.ts` | list, add valid variant, add inactive variant → 404, add duplicate (idempotent), remove existing, remove non-existing |
| `src/application/services/__tests__/couponService.test.ts` | validate active % coupon, validate active fixed, validate expired, validate below min, validate exhausted, validate unknown → 404 |
| `src/presentation/controllers/__tests__/customerAuthController.test.ts` | all endpoints + cookie assertions |
| `src/presentation/controllers/__tests__/customerAccountController.test.ts` | all endpoints |
| `src/presentation/controllers/__tests__/wishlistController.test.ts` | list, add 201, add duplicate 200, remove 204 |
| `src/presentation/controllers/__tests__/couponController.test.ts` | validate 200 valid, validate 200 invalid, validate 404 |
| `src/middleware/requireCustomerAuth.test.ts` | valid customer token, admin token rejected, missing token, expired token |

---

## Phase C — Checkout MVP (KAN-21 / task C1)

### C.1 Checkout service

**File**: `backend/src/application/services/checkoutService.ts` *(NEW)*

This is the single source of truth for order creation from storefront. Shares snapshot logic with existing `CustomerOrderService`. Does NOT replace admin order creation.

Depends on: `ICustomerOrderRepository`, `ICustomerRepository`, `ICouponRepository`, Prisma client (via `prisma.$transaction` for atomicity).

```typescript
export interface CheckoutLineItem {
  productVariantId: number;
  quantity: number;
}

export interface CheckoutAddressInput {
  fullName: string;
  phone?: string;
  streetLine1: string;
  streetLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface GuestCheckoutInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  items: CheckoutLineItem[];
  shippingAddressSnapshot: CheckoutAddressInput;
  billingAddressSnapshot: CheckoutAddressInput;
  couponCode?: string;
}

export interface AuthCheckoutInput {
  customerId: number;
  items: CheckoutLineItem[];
  shippingAddressSnapshot: CheckoutAddressInput;
  billingAddressSnapshot: CheckoutAddressInput;
  couponCode?: string;
}
```

Methods:
- `createGuestOrder(input: GuestCheckoutInput): Promise<CustomerOrder>`
  1. Validate via `validateGuestCheckoutData`
  2. Normalize email (trim, lowercase)
  3. `ICustomerRepository.findByEmail(email)` — if not found, create `Customer` (no account)
  4. Call `createOrder(customerId, { items, shippingAddressSnapshot, billingAddressSnapshot, couponCode })`
- `createAuthOrder(input: AuthCheckoutInput): Promise<CustomerOrder>`
  1. Validate via `validateCheckoutItemsData`
  2. Verify customer exists via `ICustomerRepository.findById(input.customerId)` — throw if not found
  3. Call `createOrder(customerId, { items, shippingAddressSnapshot, billingAddressSnapshot, couponCode })`
- `private createOrder(customerId, data): Promise<CustomerOrder>` — shared internal implementation:
  1. Load variants: `prisma.productVariant.findMany({ where: { id: { in: variantIds }, deletedAt: null, status: 'Active' } })` using `variantSelectForOrder` (no supplier fields). Throw `VariantNotFoundError` for any missing/inactive variant.
  2. Compute line items: snapshot `productNameSnapshot`, `variantSnapshot: { size, color }`, `skuSnapshot`, `unitPrice = publicPrice`, `totalPrice = unitPrice * quantity`.
  3. Compute `subtotalAmount = sum(totalPrice)`.
  4. Apply coupon if `couponCode` provided:
     - `ICouponRepository.findByCode(code)` — throw `CouponNotFoundError` if absent
     - `coupon.isValidForSubtotal(subtotal)` — throw `CouponExhaustedError` if exhausted (check `maxUses` vs `usedCount`)
     - `discountAmount = coupon.computeDiscount(subtotal)`
  5. `totalAmount = subtotalAmount - discountAmount + shippingAmount (0)`.
  6. Generate `orderNumber` = `'ORD-' + Date.now().toString(36).toUpperCase() + '-' + randomBytes(3).toString('hex').toUpperCase()`.
  7. All DB writes inside `prisma.$transaction`:
     - `prisma.customerOrder.create({ data: { orderNumber, customerId, status: 'PendingPayment', paymentStatus: 'Pending', fulfillmentStatus: 'NotStarted', subtotalAmount, discountAmount, totalAmount, shippingAmount: 0, currency: 'EUR', shippingAddressSnapshot, billingAddressSnapshot, items: { createMany: { data: lineItems } } } })`
     - If coupon applied: `prisma.couponRedemption.create(...)` + `prisma.coupon.update({ where: { id }, data: { usedCount: { increment: 1 } } })`
     - Note: Prisma does not support `increment` plus concurrent exhaustion check atomically without a raw SQL `UPDATE ... WHERE usedCount < maxUses`. Use a raw query or a `SELECT FOR UPDATE` pattern to prevent concurrent over-redemption (`COUPON_EXHAUSTED`).
  8. Load the created order with items (no supplier fields), return as `CustomerOrder`.

---

### C.2 Validators for checkout

**File**: `backend/src/application/validator.ts`  
**Action**: MODIFY — add:

- `validateGuestCheckoutData(data)`:
  - `email`: required + valid format
  - `firstName`, `lastName`: required, ≤100 chars
  - `phone`: optional, ≤30 chars
  - `items`: non-empty array of `{ productVariantId: positive int, quantity: positive int }`
  - `shippingAddressSnapshot`, `billingAddressSnapshot`: delegate to existing `validateAddressSnapshotField`
  - `couponCode`: optional, non-empty string if present
- `validateAuthCheckoutData(data)`:
  - Same as guest but without customer name fields (customerId comes from token)
  - `items`, `shippingAddressSnapshot`, `billingAddressSnapshot`, `couponCode`

---

### C.3 Checkout controller

**File**: `backend/src/presentation/controllers/checkoutController.ts` *(NEW)*

Functions:
- `guestCheckout(req, res, next)`:
  1. `validateGuestCheckoutData(req.body)`
  2. `checkoutService.createGuestOrder(req.body)`
  3. Return `201 { success: true, data: { order } }` — strip supplier fields from response
- `authCheckout(req, res, next)` (behind `requireCustomerAuth`):
  1. `customerId = req.customerUser!.customerId`
  2. `validateAuthCheckoutData(req.body)`
  3. `checkoutService.createAuthOrder({ customerId, ...req.body })`
  4. Return `201 { success: true, data: { order } }`

**Critical**: Response must never include `supplierId`, `supplierCost`, `supplierReference`, internal notes.

---

### C.4 Checkout routes

**File**: `backend/src/routes/public/checkoutRoutes.ts` *(NEW)*

```typescript
import { Router } from 'express';
import { guestCheckout, authCheckout } from '../../presentation/controllers/checkoutController';
import { requireCustomerAuth } from '../../middleware/requireCustomerAuth';

const router = Router();

router.post('/guest', guestCheckout);
router.post('/', requireCustomerAuth, authCheckout);

export default router;
```

---

### C.5 Wire checkout routes in `index.ts`

**File**: `backend/src/index.ts`  
**Action**: MODIFY — add:

```typescript
import checkoutPublicRoutes from './routes/public/checkoutRoutes';
app.use('/api/public/checkout', checkoutPublicRoutes);
```

---

### C.6 Unit tests — checkout

| File | Key scenarios |
|------|---------------|
| `src/application/services/__tests__/checkoutService.test.ts` | guest order created, guest finds existing customer, guest creates new customer, auth order uses token customerId, variant not found → 404, inactive variant → 404, coupon applied correctly, coupon expired → validation fails, coupon exhausted → 409, snapshot preserves price after variant changes, no supplier fields in response |
| `src/presentation/controllers/__tests__/checkoutController.test.ts` | guestCheckout 201, guestCheckout 400 validation, authCheckout 201, authCheckout 401 without token, coupon 409, variant 404 |
| `src/routes/public/__tests__/checkoutIsolation.test.ts` | confirm no admin-style GET /customer-orders on public path |

---

## Phase D — Update existing admin tests (task E.1)

### D.1 Test helper

**File**: `backend/test-utils/adminAuthHelper.ts` *(NEW)*

```typescript
import supertest from 'supertest';
import { app } from '../src/index';

export async function getAdminAccessToken(): Promise<string> {
  const res = await supertest(app)
    .post('/api/admin/auth/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  return res.body.data.accessToken;
}
```

### D.2 Files to update

All existing test files that call admin endpoints must add `beforeAll` to obtain and attach the bearer token:

| File | Change |
|------|--------|
| `src/routes/admin/__tests__/customerOrderIsolation.test.ts` | Add `Authorization: Bearer` header to all admin requests |
| `src/presentation/controllers/__tests__/customerOrderController.test.ts` | Same |
| `src/presentation/controllers/__tests__/supplierOrderController.test.ts` | Same |
| `src/presentation/controllers/__tests__/productController.test.ts` | Same |
| `src/presentation/controllers/__tests__/productVariantController.test.ts` | Same |
| `src/presentation/controllers/__tests__/productImageController.test.ts` | Same |
| `src/presentation/controllers/__tests__/supplierController.test.ts` | Same |
| `src/presentation/controllers/__tests__/customerController.test.ts` (if exists) | Same |

**Approach for unit tests** (not integration): Mock `requireAdminAuth` middleware directly so it bypasses auth and sets `req.adminUser = { id: 1, email: 'test@admin.com' }`. Add a mock module `test-utils/mocks/adminAuthMiddleware.ts`.

---

## Phase E — Documentation updates (task I)

### E.1 Data model doc

**File**: `docs/data-model.md`  
**Action**: MODIFY — add sections for:
- `AdminUser` and `AdminRefreshToken`
- `CustomerAccount` and `CustomerRefreshToken`
- `PasswordResetToken` (as part of CustomerAccount section)
- `WishlistItem`
- `Coupon` and `CouponRedemption`
- Update `Customer` relationships section to mention `customerAccount` (1:1 optional) and `wishlistItems`
- Update `CustomerOrder` to mention `couponRedemption` (1:0..1)
- Update `ProductVariant` to mention `wishlistItems`

### E.2 API spec

**File**: `docs/api-spec.yml`  
**Action**: MODIFY — add all new endpoints:
- `POST /api/admin/auth/login`, `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`, `GET /api/admin/auth/me`
- Note on all existing `/api/admin/*` paths: now requires `Authorization: Bearer <adminToken>` with `aud: "admin"`
- `POST /api/public/auth/register`, `POST /api/public/auth/login`, etc. (full customer auth surface)
- `GET /api/public/account/profile`, `PATCH /api/public/account/profile`
- `GET /api/public/account/orders`, `GET /api/public/account/orders/:id`
- `GET /api/public/account/wishlist`, `POST /api/public/account/wishlist`, `DELETE /api/public/account/wishlist/:productVariantId`
- `POST /api/public/coupons/validate`
- `POST /api/public/checkout/guest`, `POST /api/public/checkout`

### E.3 Backend standards doc

**File**: `docs/backend-standards.md`  
**Action**: MODIFY — add a "Dual JWT Authentication" section explaining:
- The two namespaces, their environment variables, `aud` claim, separate secrets, separate refresh cookies
- `requireAdminAuth` and `requireCustomerAuth` middleware: location, how they work, that they respond immediately with 401 (do not call `next(error)`)
- Rate limiting middleware: when to apply it

---

## Complete file inventory

### NEW files

| Path | Type |
|------|------|
| `backend/prisma/seedAdmin.ts` | Seed |
| `backend/src/domain/models/adminUser.ts` | Domain |
| `backend/src/domain/models/customerAccount.ts` | Domain |
| `backend/src/domain/models/wishlistItem.ts` | Domain |
| `backend/src/domain/models/coupon.ts` | Domain |
| `backend/src/domain/repositories/adminUserRepository.ts` | Domain |
| `backend/src/domain/repositories/customerAccountRepository.ts` | Domain |
| `backend/src/domain/repositories/wishlistRepository.ts` | Domain |
| `backend/src/domain/repositories/couponRepository.ts` | Domain |
| `backend/src/infrastructure/repositories/adminUserRepository.ts` | Infrastructure |
| `backend/src/infrastructure/repositories/customerAccountRepository.ts` | Infrastructure |
| `backend/src/infrastructure/repositories/wishlistRepository.ts` | Infrastructure |
| `backend/src/infrastructure/repositories/couponRepository.ts` | Infrastructure |
| `backend/src/infrastructure/smtpService.ts` | Infrastructure |
| `backend/src/application/services/adminTokenService.ts` | Application |
| `backend/src/application/services/customerTokenService.ts` | Application |
| `backend/src/application/services/adminAuthService.ts` | Application |
| `backend/src/application/services/customerAuthService.ts` | Application |
| `backend/src/application/services/customerAccountService.ts` | Application |
| `backend/src/application/services/wishlistService.ts` | Application |
| `backend/src/application/services/couponService.ts` | Application |
| `backend/src/application/services/checkoutService.ts` | Application |
| `backend/src/middleware/requireAdminAuth.ts` | Middleware |
| `backend/src/middleware/requireCustomerAuth.ts` | Middleware |
| `backend/src/middleware/rateLimiter.ts` | Middleware |
| `backend/src/presentation/controllers/adminAuthController.ts` | Presentation |
| `backend/src/presentation/controllers/customerAuthController.ts` | Presentation |
| `backend/src/presentation/controllers/customerAccountController.ts` | Presentation |
| `backend/src/presentation/controllers/wishlistController.ts` | Presentation |
| `backend/src/presentation/controllers/couponController.ts` | Presentation |
| `backend/src/presentation/controllers/checkoutController.ts` | Presentation |
| `backend/src/routes/admin/authRoutes.ts` | Routes |
| `backend/src/routes/public/authRoutes.ts` | Routes |
| `backend/src/routes/public/accountRoutes.ts` | Routes |
| `backend/src/routes/public/couponRoutes.ts` | Routes |
| `backend/src/routes/public/checkoutRoutes.ts` | Routes |
| `backend/test-utils/adminAuthHelper.ts` | Test utils |
| Test files (see per-phase test tables above) | Tests |

### MODIFIED files

| Path | Summary of changes |
|------|-------------------|
| `backend/prisma/schema.prisma` | Add AdminUser, AdminRefreshToken, CustomerAccount, CustomerRefreshToken, PasswordResetToken, WishlistItem, Coupon, CouponRedemption + add relations to Customer, CustomerOrder, ProductVariant |
| `backend/src/index.ts` | Add `cookie-parser`, mount `requireAdminAuth` on admin routes, mount 5 new public route groups |
| `backend/src/middleware/errorHandler.ts` | Add 12+ new error type handlers |
| `backend/src/application/validator.ts` | Add validateAdminLoginData, validateCustomerRegisterData, validateCustomerLoginData, validateForgotPasswordData, validateResetPasswordData, validate2fa*, validateWishlistAddData, validateCouponValidateData, validateGuestCheckoutData, validateAuthCheckoutData |
| `backend/src/routes/index.ts` | Export new route files |
| `backend/package.json` | Add `express-rate-limit`, `@types/express-rate-limit`, `google-auth-library` |
| `docs/data-model.md` | Document new entities |
| `docs/api-spec.yml` | Document all new endpoints + admin auth requirement on existing admin paths |
| `docs/backend-standards.md` | Add Dual JWT section |
| All existing admin test files | Add admin auth token in requests (or mock middleware) |

---

## Env vars checklist

Add to `.env` / deployment config:

```
ADMIN_JWT_SECRET=<strong-random>
ADMIN_JWT_EXPIRES_IN=15m
CUSTOMER_JWT_SECRET=<strong-random>
CUSTOMER_JWT_EXPIRES_IN=15m
ADMIN_EMAIL=admin@store.com
ADMIN_PASSWORD=<strong-password>
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@store.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```
