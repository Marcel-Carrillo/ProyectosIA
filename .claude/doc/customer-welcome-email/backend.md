# Backend Implementation Plan — customer-welcome-email

Generated: 2026-06-28
Feature branch: `feature/customer-welcome-email`
Context session: `.claude/sessions/context_session_customer-welcome-email.md`

---

## Execution Order (strict — each file depends on the ones above it)

1. `backend/src/infrastructure/email/templates/welcomeEmail.ts` (NEW)
2. `backend/src/infrastructure/email/emailService.ts` (MODIFY — add `sendWelcomeEmail`)
3. `backend/src/application/services/customerAuthService.ts` (MODIFY — coupon helper + hooks)
4. `backend/src/infrastructure/email/templates/__tests__/welcomeEmail.test.ts` (NEW)
5. `backend/src/application/services/__tests__/customerAuthService.test.ts` (NEW)
6. `backend/src/routes/public/__tests__/customerAuthRoutes.test.ts` (MODIFY — coupon DB assertion)
7. `backend/.env.example` (MODIFY — add three WELCOME_COUPON_* vars)

No Prisma migration. No schema change. No new domain entities or repository interfaces.

---

## 1. `backend/src/infrastructure/email/templates/welcomeEmail.ts` (NEW)

### Purpose

Branded email containing the customer's unique 15 % welcome coupon. Mirrors
`passwordResetEmail.ts` exactly — same palette, same Inter font stack, same
`escapeHtml` helper inlined at the top of the file.

### Exact function signature

```ts
export interface WelcomeEmailContent {
  subject: string;
  text: string;
  html: string;
}

export function buildWelcomeEmail(params: {
  firstName: string;
  couponCode: string;
  percent: number;
  expiresAt: Date;
  shopUrl: string;
}): WelcomeEmailContent
```

### `escapeHtml` helper

Copy verbatim from `passwordResetEmail.ts` — do NOT import from a shared module
(the existing codebase does not extract it, and we follow the same pattern):

```ts
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

### Subject line

```ts
const subject = `${BRAND_NAME} — Bienvenida a Mavile`;
```

(`BRAND_NAME = 'Mavile'` — same constant as in `passwordResetEmail.ts`)

### HTML structure

Follow the table-based layout of `passwordResetEmail.ts` identically.
Key differences:

| Section | Content |
|---------|---------|
| Eyebrow label | `Bienvenida` (replacing "Cuenta") |
| H1 | `Tu regalo de bienvenida` |
| Body paragraph | Personalised: `¡Hola, ${escapeHtml(firstName)}!` + explanation text |
| Coupon block | `<td>` with background `#d4a853`, letter-spacing, `font-size:22px`, `font-weight:600` containing `${escapeHtml(couponCode)}` |
| Coupon sub-line | `${percent}% de descuento — válido hasta ${expiresAt.toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' })}` |
| CTA button | Same dark button (`#1a1a18`), `href="${escapeHtml(shopUrl)}"`, label `Ir a la tienda` |
| Footer | `© ${new Date().getFullYear()} ${BRAND_NAME}` (same as existing template) |

All user-supplied strings that touch the DOM (`firstName`, `couponCode`, `shopUrl`)
MUST be passed through `escapeHtml` in the HTML output.

`shopUrl` appears in:
- The CTA button `href` attribute (use `escapeHtml(shopUrl)`)
- The plain-text link (use raw `shopUrl`)

### Plain-text fallback (`text`)

```
Mavile

¡Hola, ${firstName}!

Como regalo de bienvenida, hemos creado un cupón exclusivo de ${percent}% de descuento para tu primera compra:

${couponCode}

El cupón es válido hasta el ${expiresAt.toLocaleDateString('es-ES', { ... })} y tiene un solo uso.

Empieza a explorar nuestra colección:
${shopUrl}

— Mavile
```

All values used here are raw (no HTML escaping needed in plain text).

### Return value

```ts
return { subject, text, html };
```

---

## 2. `backend/src/infrastructure/email/emailService.ts` (MODIFY)

### What to add

Import `buildWelcomeEmail` at the top of the file, alongside the existing import:

```ts
import { buildWelcomeEmail } from './templates/welcomeEmail';
```

Add `sendWelcomeEmail` as a new exported async function **immediately after**
`sendPasswordResetEmail` (around line 43). Signature differs from the password
reset version: the caller pre-builds the content with `buildWelcomeEmail` and
passes it in, so this function accepts a pre-built content object:

```ts
export async function sendWelcomeEmail(
  to: string,
  content: { subject: string; html: string; text: string }
): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'noreply@example.com';
  try {
    await getTransporter().sendMail({
      from,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    logger.info('Welcome email sent', { to });
  } catch (err) {
    logger.warn('Welcome email failed', { to, err: String(err) });
    if (process.env.SMTP_STRICT === 'true') {
      throw err;
    }
  }
}
```

**Why content is pre-built (not taking raw params):** The caller (`customerAuthService`)
already has all template inputs in scope and needs the `couponCode` / `expiresAt`
values for other purposes (fire-and-forget means the call returns immediately —
no value flows back). Passing pre-built content keeps the email service as a thin
transport layer with no business-data knowledge. This also simplifies mocking in
tests (spy on `sendWelcomeEmail` directly without caring about template internals).

---

## 3. `backend/src/application/services/customerAuthService.ts` (MODIFY)

### New imports (add to the existing import block)

```ts
import { logger } from '../../infrastructure/logger';
import { buildWelcomeEmail } from '../../infrastructure/email/templates/welcomeEmail';
import { sendWelcomeEmail } from '../../infrastructure/email/emailService';
```

`sendPasswordResetEmail` import already exists — keep it.

### New helper function `createWelcomeCoupon`

Place this as a **module-level function** (outside the class), alongside
`normalizeEmail` and `validatePassword`, before the `CustomerAuthService` class
definition. It accepts a Prisma transaction client so it can be called from inside
a `$transaction` callback.

```ts
async function createWelcomeCoupon(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<{ code: string; percent: number; expiresAt: Date }> {
  const percent = parseInt(process.env.WELCOME_COUPON_PERCENT ?? '15', 10);
  const validityDays = parseInt(process.env.WELCOME_COUPON_VALIDITY_DAYS ?? '30', 10);
  const minOrderAmount = parseFloat(process.env.WELCOME_COUPON_MIN_ORDER ?? '0');

  const code = 'WELCOME-' + crypto.randomBytes(16).toString('hex').toUpperCase();

  const startsAt = new Date();
  const expiresAt = new Date(startsAt);
  expiresAt.setDate(expiresAt.getDate() + validityDays);

  await tx.coupon.create({
    data: {
      code,
      type: 'percentage',
      value: percent,
      maxUses: 1,
      active: true,
      startsAt,
      expiresAt,
      minOrderAmount,
    },
  });

  return { code, percent, expiresAt };
}
```

**Type note on `tx`:** Using `Parameters<Parameters<typeof prisma.$transaction>[0]>[0]`
avoids importing `Prisma` namespace types directly while staying type-safe. An
alternative is `import type { Prisma } from '@prisma/client'` and typing as
`Prisma.TransactionClient` — either is acceptable, but the inline `Parameters`
approach requires zero new imports.

### Changes to `register()` — introduce transaction

Current code creates `CustomerAccount` with a plain `prisma.customerAccount.create`.
Replace that single call with a `prisma.$transaction` that wraps both
`customerAccount.create` and `createWelcomeCoupon`:

**Before** (existing lines ~107-116):
```ts
const passwordHash = await hashPassword(data.password);
const account = await prisma.customerAccount.create({
  data: {
    customerId: customer.id,
    email,
    passwordHash,
    authProvider: 'local',
  },
});

return this.issueFullSession(account, customer);
```

**After**:
```ts
const passwordHash = await hashPassword(data.password);

const { account, coupon } = await prisma.$transaction(async (tx) => {
  const acc = await tx.customerAccount.create({
    data: {
      customerId: customer.id,
      email,
      passwordHash,
      authProvider: 'local',
    },
  });
  const couponResult = await createWelcomeCoupon(tx);
  return { account: acc, coupon: couponResult };
});

// Fire-and-forget: SMTP failure must not block the 201 response
const shopUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
const emailContent = buildWelcomeEmail({
  firstName: data.firstName.trim(),
  couponCode: coupon.code,
  percent: coupon.percent,
  expiresAt: coupon.expiresAt,
  shopUrl,
});
sendWelcomeEmail(account.email, emailContent).catch((err) =>
  logger.warn('Welcome email failed', { err })
);

return this.issueFullSession(account, customer);
```

**Key details:**
- The `Customer` creation (above this block) stays OUTSIDE the transaction — no change there.
- `sendWelcomeEmail` is called WITHOUT `await` — the `.catch` handles rejection. This is the fire-and-forget pattern.
- `issueFullSession` signature does not change — `account` returned from `tx.customerAccount.create` has the same shape as before.

### Changes to `oauthLogin()` — new-account branch only

The new-account branch is the `if (!account)` block (currently lines ~296-315).
Currently it ends with `account = await prisma.customerAccount.create(...)`.
Replace only that `customerAccount.create` call with a transaction that also creates the coupon:

**Before** (existing `if (!account)` block, end of it):
```ts
account = await prisma.customerAccount.create({
  data: {
    customerId: customer.id,
    email: normalized,
    authProvider: provider,
    [idField]: providerId,
  },
  include: { customer: true },
});
```

**After**:
```ts
let welcomeCoupon: { code: string; percent: number; expiresAt: Date } | null = null;

const txResult = await prisma.$transaction(async (tx) => {
  const acc = await tx.customerAccount.create({
    data: {
      customerId: customer.id,
      email: normalized,
      authProvider: provider,
      [idField]: providerId,
    },
    include: { customer: true },
  });
  const couponResult = await createWelcomeCoupon(tx);
  return { acc, couponResult };
});

account = txResult.acc;
welcomeCoupon = txResult.couponResult;

// Fire-and-forget
const shopUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
const emailContent = buildWelcomeEmail({
  firstName: account.customer.firstName,
  couponCode: welcomeCoupon.code,
  percent: welcomeCoupon.percent,
  expiresAt: welcomeCoupon.expiresAt,
  shopUrl,
});
sendWelcomeEmail(account.email, emailContent).catch((err) =>
  logger.warn('Welcome email failed', { err })
);
```

**What does NOT change in `oauthLogin()`:**
- The `else if (!account[idField])` branch (existing account + new provider link) — no coupon, no email.
- The fall-through case (existing account, same provider) — no coupon, no email.
- The `if (account.status !== 'Active')` check and `issueFullSession` call at the end — unchanged.

---

## 4. `backend/src/infrastructure/email/templates/__tests__/welcomeEmail.test.ts` (NEW)

Mirror `passwordResetEmail.test.ts` exactly in structure. Three `it` blocks:

### Test cases

```ts
import { buildWelcomeEmail } from '../welcomeEmail';

describe('buildWelcomeEmail', () => {
  const params = {
    firstName: 'Jane',
    couponCode: 'WELCOME-ABCDEF1234',
    percent: 15,
    expiresAt: new Date('2026-07-28T00:00:00.000Z'),
    shopUrl: 'http://localhost:3001',
  };

  it('includes Mavile branding, firstName, coupon code and shop URL in HTML', () => {
    const { html, subject } = buildWelcomeEmail(params);
    expect(subject).toContain('Mavile');
    expect(html).toContain('Jane');
    expect(html).toContain('WELCOME-ABCDEF1234');
    expect(html).toContain('15');
    expect(html).toContain('http://localhost:3001');
    expect(html).toContain('#faf9f7');
    expect(html).toContain('#d4a853');
  });

  it('includes coupon code and percent in plain-text fallback', () => {
    const { text } = buildWelcomeEmail(params);
    expect(text).toContain('Jane');
    expect(text).toContain('WELCOME-ABCDEF1234');
    expect(text).toContain('15');
    expect(text).toContain('http://localhost:3001');
  });

  it('escapes HTML in firstName and couponCode', () => {
    const malicious = {
      ...params,
      firstName: '<script>alert(1)</script>',
      couponCode: 'WELCOME-<b>BAD</b>',
    };
    const { html } = buildWelcomeEmail(malicious);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>BAD</b>');
    expect(html).toContain('&lt;b&gt;BAD&lt;/b&gt;');
  });
});
```

**ESLint notes:** No unused params. No `any`. No disabled rules needed.

---

## 5. `backend/src/application/services/__tests__/customerAuthService.test.ts` (NEW)

No existing unit test file for `customerAuthService`. Create from scratch.

### Mock strategy

`customerAuthService.ts` imports directly from infrastructure paths (no constructor
injection), so all mocks must use `jest.mock(...)` at module scope.

#### Mock: `../../../infrastructure/prismaClient`

The key complexity is the `$transaction` callback pattern. Use the same approach
as `refundService.test.ts`:

```ts
const mockAccountCreate = jest.fn();
const mockCustomerFindUnique = jest.fn();
const mockCustomerCreate = jest.fn();
const mockCouponCreate = jest.fn();
const mockRefreshTokenCreate = jest.fn();
const mockAccountFindUnique = jest.fn();
const mockAccountFindFirst = jest.fn();
const mockAccountUpdate = jest.fn();
const mockPasswordResetTokenCreate = jest.fn();

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        customerAccount: { create: (...args: unknown[]) => mockAccountCreate(...args) },
        coupon: { create: (...args: unknown[]) => mockCouponCreate(...args) },
      };
      return cb(tx);
    }),
    customerAccount: {
      findUnique: (...args: unknown[]) => mockAccountFindUnique(...args),
      findFirst: (...args: unknown[]) => mockAccountFindFirst(...args),
      update: (...args: unknown[]) => mockAccountUpdate(...args),
    },
    customer: {
      findUnique: (...args: unknown[]) => mockCustomerFindUnique(...args),
      create: (...args: unknown[]) => mockCustomerCreate(...args),
    },
    customerRefreshToken: { create: (...args: unknown[]) => mockRefreshTokenCreate(...args) },
    passwordResetToken: { create: (...args: unknown[]) => mockPasswordResetTokenCreate(...args) },
  },
}));
```

#### Mock: `../../../infrastructure/email/emailService`

```ts
const mockSendWelcomeEmail = jest.fn();
const mockSendPasswordResetEmail = jest.fn();

jest.mock('../../../infrastructure/email/emailService', () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));
```

#### Mock: `../../../infrastructure/logger`

```ts
jest.mock('../../../infrastructure/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
```

#### Mock: `../../../infrastructure/auth/passwordHasher`

```ts
jest.mock('../../../infrastructure/auth/passwordHasher', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  verifyPassword: jest.fn().mockResolvedValue(true),
}));
```

#### Mock: `../../../infrastructure/auth/refreshTokenUtils`

```ts
jest.mock('../../../infrastructure/auth/refreshTokenUtils', () => ({
  generateRefreshTokenRaw: jest.fn().mockReturnValue('raw-refresh-token'),
  hashRefreshToken: jest.fn().mockReturnValue('hashed-refresh-token'),
  refreshTokenExpiresAt: jest.fn().mockReturnValue(new Date()),
}));
```

#### Mock: `./customerTokenService`

```ts
jest.mock('./customerTokenService', () => ({
  signCustomerAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  signMfaToken: jest.fn().mockReturnValue('mock-mfa-token'),
  verifyMfaToken: jest.fn(),
}));
```

#### Mock: `speakeasy`

```ts
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: { verify: jest.fn(), generate: jest.fn() },
}));
```

### Factory helpers

```ts
const makeCustomer = () => ({
  id: 1,
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeAccount = (overrides = {}) => ({
  id: 10,
  customerId: 1,
  email: 'jane@example.com',
  authProvider: 'local',
  passwordHash: 'hashed-password',
  status: 'Active',
  totpEnabled: false,
  totpSecret: null,
  lastLoginAt: null,
  googleId: null,
  appleId: null,
  facebookId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: makeCustomer(),
  ...overrides,
});
```

### Test suite layout

```ts
describe('CustomerAuthService - register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a Coupon with WELCOME- prefix and calls sendWelcomeEmail on success', async () => { ... });
  it('returns 201 data even when sendWelcomeEmail rejects (fire-and-forget)', async () => { ... });
  it('throws AccountEmailConflictError when email is already taken', async () => { ... });
});

describe('CustomerAuthService - oauthLogin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('new-account branch creates Coupon and calls sendWelcomeEmail', async () => { ... });
  it('existing-account branch does NOT create Coupon or call sendWelcomeEmail', async () => { ... });
  it('provider-link branch does NOT create Coupon or call sendWelcomeEmail', async () => { ... });
});
```

### Key test case details

**"creates a Coupon with WELCOME- prefix and calls sendWelcomeEmail"**

```ts
mockAccountFindUnique.mockResolvedValue(null);   // no conflict
mockCustomerFindUnique.mockResolvedValue(null);  // no existing customer
mockCustomerCreate.mockResolvedValue(makeCustomer());
mockAccountCreate.mockResolvedValue(makeAccount());
mockCouponCreate.mockResolvedValue({ id: 99 });  // return value is ignored by helper
mockRefreshTokenCreate.mockResolvedValue({});

const service = new CustomerAuthService();
const result = await service.register({
  email: 'jane@example.com',
  password: 'Password1',
  firstName: 'Jane',
  lastName: 'Doe',
});

expect(result.accessToken).toBe('mock-access-token');
expect(mockCouponCreate).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      type: 'percentage',
      maxUses: 1,
      active: true,
    }),
  })
);
const couponData = mockCouponCreate.mock.calls[0][0].data;
expect(couponData.code).toMatch(/^WELCOME-[A-F0-9]{32}$/);

// sendWelcomeEmail is fire-and-forget: use a resolved promise so the test is synchronous
mockSendWelcomeEmail.mockResolvedValue(undefined);

// We need to flush the microtask queue so the fire-and-forget .catch() resolves
await Promise.resolve();

expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
  'jane@example.com',
  expect.objectContaining({ subject: expect.stringContaining('Mavile') })
);
```

**Important timing note:** `sendWelcomeEmail` is not awaited in the service. The
test must `await Promise.resolve()` (or `await new Promise(r => setImmediate(r))`)
after calling `register()` to let the microtask queue flush before asserting on
the spy. Mock `sendWelcomeEmail` BEFORE calling `register()`.

**"returns success even when sendWelcomeEmail rejects"**

```ts
mockSendWelcomeEmail.mockRejectedValue(new Error('SMTP down'));
// ... same setup mocks as above ...

await expect(service.register({ ... })).resolves.toMatchObject({ accessToken: 'mock-access-token' });

// Allow the .catch() to run
await new Promise((r) => setImmediate(r));

const { logger } = jest.requireMock('../../../infrastructure/logger') as {
  logger: { warn: jest.Mock };
};
expect(logger.warn).toHaveBeenCalledWith('Welcome email failed', expect.anything());
```

**"new-account oauthLogin creates Coupon and calls sendWelcomeEmail"**

```ts
mockAccountFindFirst.mockResolvedValue(null);    // no existing account
mockCustomerFindUnique.mockResolvedValue(null);
mockCustomerCreate.mockResolvedValue(makeCustomer());
mockAccountCreate.mockResolvedValue(makeAccount({ authProvider: 'google', googleId: 'gid-1' }));
mockCouponCreate.mockResolvedValue({ id: 100 });
mockAccountUpdate.mockResolvedValue(makeAccount());
mockRefreshTokenCreate.mockResolvedValue({});
mockSendWelcomeEmail.mockResolvedValue(undefined);

const service = new CustomerAuthService();
await service.oauthLogin('google', 'gid-1', 'jane@example.com', { firstName: 'Jane', lastName: 'Doe' });

await Promise.resolve();

expect(mockCouponCreate).toHaveBeenCalledTimes(1);
expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(1);
```

**"existing-account oauthLogin does NOT create Coupon or call sendWelcomeEmail"**

```ts
const existingAccount = makeAccount({ googleId: 'gid-1', authProvider: 'google' });
mockAccountFindFirst.mockResolvedValue(existingAccount);
mockAccountUpdate.mockResolvedValue(existingAccount);
mockRefreshTokenCreate.mockResolvedValue({});

await service.oauthLogin('google', 'gid-1', 'jane@example.com', { firstName: 'Jane', lastName: 'Doe' });

await Promise.resolve();

expect(mockCouponCreate).not.toHaveBeenCalled();
expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
```

### ESLint compliance

- All unused callback parameters prefixed with `_` (e.g., `(..._args: unknown[])` if the mock function is not used in assertions)
- No `any` — use `unknown` in mock factory callbacks
- `jest.mock(...)` at module scope, NOT inside `beforeEach`
- Import `CustomerAuthService` and `AccountEmailConflictError` from `../customerAuthService`

---

## 6. `backend/src/routes/public/__tests__/customerAuthRoutes.test.ts` (MODIFY)

### What to add

Add a second `it` block to the existing `describe('customerAuthRoutes', ...)` that
verifies the welcome coupon is created in the DB after registration:

```ts
import { prisma } from '../../../infrastructure/prismaClient';

// At the top of the describe block, add cleanup tracking:
let testEmail: string;
let createdCouponCode: string | null = null;

afterEach(async () => {
  if (createdCouponCode) {
    await prisma.coupon.deleteMany({ where: { code: { startsWith: 'WELCOME-' }, /* filter by email if possible */ } });
    createdCouponCode = null;
  }
  // Clean up CustomerAccount + Customer + CustomerRefreshToken as needed
});
```

**New `it` block:**

```ts
it('register creates a WELCOME- coupon in the database', async () => {
  const uniqueEmail = `welcome-test-${Date.now()}@example.com`;

  const register = await request(app)
    .post('/api/public/auth/register')
    .send({ email: uniqueEmail, password: 'BuyerPass1', firstName: 'Welcome', lastName: 'Test' });
  expect(register.status).toBe(201);

  const coupon = await prisma.coupon.findFirst({
    where: { code: { startsWith: 'WELCOME-' }, active: true },
    orderBy: { createdAt: 'desc' },
  });
  expect(coupon).not.toBeNull();
  expect(coupon!.code).toMatch(/^WELCOME-[A-F0-9]{32}$/);
  expect(Number(coupon!.value)).toBe(15);
  expect(coupon!.maxUses).toBe(1);
  expect(coupon!.type).toBe('percentage');

  // Track for cleanup
  if (coupon) createdCouponCode = coupon.code;
});
```

**Cleanup note:** The integration test hits a real DB. The `afterEach` block must
delete the welcome coupon (and the test customer/account) to avoid test pollution
between runs. The existing test suite does not do cleanup; this new test should
add it for its own records. Use `prisma.coupon.deleteMany`, `prisma.customerAccount.deleteMany`,
`prisma.customer.deleteMany` filtered by the unique email.

---

## 7. `backend/.env.example` (MODIFY)

Add three new lines in the **SMTP** section, after the `SMTP_STRICT=false` line,
with a blank separator and comment block:

```
# Welcome coupon (sent on new customer registration)
WELCOME_COUPON_PERCENT=15
WELCOME_COUPON_VALIDITY_DAYS=30
WELCOME_COUPON_MIN_ORDER=0
```

Note: The file uses UTF-16 LE encoding (BOM). Edit it with the same encoding
that the rest of the file uses, or use the Edit tool which preserves file encoding.

---

## Critical Notes and Non-Obvious Decisions

### Transaction scope in `register()`

The existing `Customer.create` stays OUTSIDE the new `$transaction`. Only
`CustomerAccount.create` + `Coupon.create` are inside it. This matches design
decision D2: "within the same Prisma transaction as CustomerAccount creation."
If coupon creation fails (unique constraint on `code`), the account creation also
rolls back — no ghost accounts.

### Transaction scope in `oauthLogin()`

Only the `if (!account)` branch (new account) introduces the transaction. The
`else if (!account[idField])` branch (provider link to existing account) and the
fall-through (existing same-provider account) are explicitly NOT modified.

### Fire-and-forget timing in tests

Because `sendWelcomeEmail` is not awaited, the spy assertion must be made AFTER
flushing the microtask queue. Use `await new Promise(r => setImmediate(r))` (more
reliable than `await Promise.resolve()` when the chain has more than one tick).
Set up the mock BEFORE calling the service method, not after.

### `createWelcomeCoupon` returns percent and expiresAt

The helper returns `{ code, percent, expiresAt }` (not just `code`) so that the
caller can pass all three values to `buildWelcomeEmail` without re-reading env
vars a second time. This keeps env var parsing in exactly one place.

### `sendWelcomeEmail` accepts pre-built content

Unlike `sendPasswordResetEmail(to, resetUrl)` which builds HTML internally,
`sendWelcomeEmail` accepts `{ subject, html, text }`. This design was chosen to
keep the email service as a pure transport adapter — it sends whatever content
the application layer provides. The caller (`customerAuthService`) assembles the
content with `buildWelcomeEmail(...)` and passes the result to `sendWelcomeEmail`.

### No `SMTP_STRICT` default change

`SMTP_STRICT=false` remains the default. Developers without SMTP credentials see
a `logger.warn` on each registration but are not blocked. Setting `SMTP_STRICT=true`
in CI/staging will cause `sendWelcomeEmail` to rethrow, but since the call is
fire-and-forget (`.catch` handler), the rethrow is caught there and logged — it
does not propagate to the request handler regardless of `SMTP_STRICT`.

### No new domain entity or repository interface

Coupon already exists in the schema and is written directly via `prisma.coupon.create`
inside the transaction. There is no `ICouponRepository` in the existing codebase,
and adding one is out of scope for this feature.

---

## Verification Commands

After implementation, run:

```bash
cd backend && npm run lint && npm test -- --watchAll=false --testPathPattern="welcomeEmail|customerAuthService|customerAuthRoutes"
```

Expected: all tests pass, lint exits 0.
