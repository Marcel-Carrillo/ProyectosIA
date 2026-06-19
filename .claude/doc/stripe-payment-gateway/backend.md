# Backend Implementation Plan — stripe-payment-gateway

Generated: 2026-06-19  
Feature branch: `feature/stripe-payment-gateway`  
Context session: `.claude/sessions/context_session_stripe-payment-gateway.md`

---

## Execution Order (strict — each file depends on the ones above it)

1. `backend/prisma/schema.prisma`
2. `backend/src/infrastructure/stripe/stripeClient.ts` (new)
3. `backend/src/infrastructure/stripe/toStripeAmount.ts` (new)
4. `backend/src/domain/models/customerOrder.ts` (update)
5. `backend/src/domain/models/stripeWebhookEvent.ts` (new)
6. `backend/src/domain/repositories/customerOrderRepository.ts` (update)
7. `backend/src/domain/repositories/stripeWebhookEventRepository.ts` (new)
8. `backend/src/infrastructure/repositories/customerOrderRepository.ts` (update)
9. `backend/src/infrastructure/repositories/stripeWebhookEventRepository.ts` (new)
10. `backend/src/application/validator.ts` (update — new error classes)
11. `backend/src/application/services/paymentService.ts` (new)
12. `backend/src/application/services/checkoutService.ts` (update)
13. `backend/src/application/services/refundService.ts` (update)
14. `backend/src/presentation/controllers/paymentController.ts` (new)
15. `backend/src/presentation/controllers/checkoutController.ts` (update)
16. `backend/src/routes/public/paymentRoutes.ts` (new)
17. `backend/src/index.ts` (update)

---

## 1. `backend/prisma/schema.prisma`

### What to change

Add two nullable fields to the `CustomerOrder` model and add a new `StripeWebhookEvent` model.

### Changes inside `CustomerOrder` model

After `cancelledAt  DateTime?`, before the relations block, add:

```prisma
stripePaymentIntentId String?   @unique @db.VarChar(255)
stripeChargeId        String?   @db.VarChar(255)
```

Add two `@@index` entries after the existing ones:

```prisma
@@index([stripePaymentIntentId])
@@index([stripeChargeId])
```

### New model — `StripeWebhookEvent`

Add after the `CouponRedemption` model at the end of the file:

```prisma
model StripeWebhookEvent {
  id              Int      @id @default(autoincrement())
  stripeEventId   String   @unique @db.VarChar(255)
  type            String   @db.VarChar(100)
  customerOrderId Int?
  createdAt       DateTime @default(now())

  @@index([stripeEventId])
  @@index([customerOrderId])
  @@index([createdAt])
}
```

No relation back to `CustomerOrder` — `customerOrderId` is a loose audit reference, not a FK. This avoids cascade complexity and keeps the event log standalone.

### Migration command

```bash
cd backend
npx prisma migrate dev --name add-stripe-payment-fields
npx prisma generate
```

### Dependencies

None — must be done first.

---

## 2. `backend/src/infrastructure/stripe/stripeClient.ts` (NEW)

### What to create

A singleton Stripe SDK instance. The entire file is new. Create the directory `backend/src/infrastructure/stripe/`.

```typescript
import Stripe from 'stripe';

// Note: startup validation in index.ts guarantees STRIPE_SECRET_KEY is set.
// In unit tests this module is fully mocked — never imported directly.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-03-31.basil',
});
```

### Key details

- `STRIPE_API_VERSION`: hard-coded string `'2025-03-31.basil'` (current stable at planning time). Update if the Stripe SDK requires a different pinned version.
- `STRIPE_MODE` (`test | live`) is determined by the key prefix (`sk_test_` vs `sk_live_`) — Stripe SDK handles this automatically from the key. The `mode` value returned by `getConfig()` is computed from `process.env.STRIPE_MODE`.
- The empty-string fallback (`?? ''`) means the module can be imported in tests without throwing; Jest mocks replace the exported `stripe` before any service code calls it.

### Dependencies

- `npm install stripe` must be run before this file is compiled.
- `index.ts` must have `STRIPE_SECRET_KEY` in `requiredEnvVars` (step 17).

---

## 3. `backend/src/infrastructure/stripe/toStripeAmount.ts` (NEW)

### What to create

```typescript
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Converts a Prisma Decimal amount to Stripe integer minor units.
 * Uses Math.round to handle floating-point edge cases.
 * Currently only EUR (100 minor units per major) is supported.
 */
export function toStripeAmount(amount: Decimal, _currency: string): number {
  return Math.round(amount.times(100).toNumber());
}
```

### Key details

- `_currency` is prefixed with `_` (unused parameter, ESLint rule `no-unused-vars`) — it is there for forward-compatibility when multi-currency support is added.
- Always use `amount.times(100)` on the Prisma `Decimal` before calling `.toNumber()`. Do NOT convert to number first and then multiply — that causes floating-point errors.
- `Decimal` is imported from `@prisma/client/runtime/library`, the same import used throughout the existing codebase (e.g., `refundService.ts`).

### Unit tests: `toStripeAmount.test.ts` (new, alongside the file)

File: `backend/src/infrastructure/stripe/__tests__/toStripeAmount.test.ts`

Scenarios to cover (90% branch/line threshold):

| Input | Expected |
|---|---|
| `new Decimal('29.99'), 'EUR'` | `2999` |
| `new Decimal('10.00'), 'EUR'` | `1000` |
| `new Decimal('0.00'), 'EUR'` | `0` |
| `new Decimal('10.005'), 'EUR'` | `1001` (rounds 0.5 up) |
| `new Decimal('10.004'), 'EUR'` | `1000` (rounds down) |
| `new Decimal('99.99'), 'EUR'` | `9999` |

No mock needed — pure function.

---

## 4. `backend/src/domain/models/customerOrder.ts` (UPDATE)

### What to change

Add two nullable string fields to the `CustomerOrder` class.

#### In the class body, after `cancelledAt?: Date | null;`:

```typescript
stripePaymentIntentId: string | null;
stripeChargeId: string | null;
```

#### In the constructor `data` parameter type, after `cancelledAt?`:

```typescript
stripePaymentIntentId?: string | null;
stripeChargeId?: string | null;
```

#### In the constructor body, after `this.cancelledAt = ...`:

```typescript
this.stripePaymentIntentId = data.stripePaymentIntentId ?? null;
this.stripeChargeId = data.stripeChargeId ?? null;
```

### Key details

- Both fields default to `null` when not provided — matches the nullable Prisma schema.
- No business logic added here. The `CustomerOrder` domain class is intentionally simple (data holder with typed fields), following the existing pattern.
- `items` and `customer` are still optional on the class.

---

## 5. `backend/src/domain/models/stripeWebhookEvent.ts` (NEW)

### What to create

```typescript
export class StripeWebhookEvent {
  id?: number;
  stripeEventId: string;
  type: string;
  customerOrderId: number | null;
  createdAt?: Date;

  constructor(data: {
    id?: number;
    stripeEventId: string;
    type: string;
    customerOrderId?: number | null;
    createdAt?: Date;
  }) {
    this.id = data.id;
    this.stripeEventId = data.stripeEventId;
    this.type = data.type;
    this.customerOrderId = data.customerOrderId ?? null;
    this.createdAt = data.createdAt;
  }
}
```

### Key details

- No `updatedAt` — the event is immutable once written.
- `customerOrderId` is a loose audit reference (no relation defined in Prisma, so no domain FK here either).

---

## 6. `backend/src/domain/repositories/customerOrderRepository.ts` (UPDATE)

### What to change

Add one method signature to the `ICustomerOrderRepository` interface.

After the `updateStatus` signature, add:

```typescript
findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<CustomerOrder | null>;
```

Also add `updateStripeFields` for persisting intent/charge ids after Stripe calls (needed by checkoutService and paymentService):

```typescript
updateStripeFields(
  id: number,
  data: { stripePaymentIntentId?: string | null; stripeChargeId?: string | null }
): Promise<CustomerOrder>;
```

### Key details

- `findByStripePaymentIntentId` is called by `paymentService` when processing `payment_intent.succeeded` and `payment_intent.payment_failed` webhooks.
- `updateStripeFields` is a narrow update method — it only touches Stripe fields, avoiding unintended side-effects on status fields.
- The existing `updateStatus` method stays unchanged; the two concerns (status transitions vs Stripe field persistence) are kept separate.

---

## 7. `backend/src/domain/repositories/stripeWebhookEventRepository.ts` (NEW)

### What to create

```typescript
import { StripeWebhookEvent } from '../models/stripeWebhookEvent';

export interface StripeWebhookEventCreateData {
  stripeEventId: string;
  type: string;
  customerOrderId?: number | null;
}

export interface IStripeWebhookEventRepository {
  findByStripeEventId(stripeEventId: string): Promise<StripeWebhookEvent | null>;
  create(data: StripeWebhookEventCreateData): Promise<StripeWebhookEvent>;
}
```

### Key details

- No `findAll` or pagination — this table is audit-only; no admin list endpoint is planned for this feature.
- Minimal interface following ISP: only the two methods `paymentService` actually needs.

---

## 8. `backend/src/infrastructure/repositories/customerOrderRepository.ts` (UPDATE)

### What to change

#### 8a. Add Stripe fields to `orderSelect`

After `cancelledAt: true,` in the `orderSelect` constant, add:

```typescript
stripePaymentIntentId: true,
stripeChargeId: true,
```

#### 8b. Update `OrderRow` type (automatic — Prisma regeneration handles this after schema migration)

#### 8c. Update `mapOrder` function

The `new CustomerOrder({ ...row, ... })` spread will automatically pass `stripePaymentIntentId` and `stripeChargeId` from the row since they are now in `orderSelect`. No explicit mapping needed because `CustomerOrder` constructor accepts them from the spread.

#### 8d. Add `findByStripePaymentIntentId` method

```typescript
async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<CustomerOrder | null> {
  const row = await prisma.customerOrder.findUnique({
    where: { stripePaymentIntentId },
    select: orderSelect,
  });
  return row ? mapOrder(row) : null;
}
```

#### 8e. Add `updateStripeFields` method

```typescript
async updateStripeFields(
  id: number,
  data: { stripePaymentIntentId?: string | null; stripeChargeId?: string | null }
): Promise<CustomerOrder> {
  try {
    const row = await prisma.customerOrder.update({
      where: { id },
      data: {
        ...(data.stripePaymentIntentId !== undefined && {
          stripePaymentIntentId: data.stripePaymentIntentId,
        }),
        ...(data.stripeChargeId !== undefined && {
          stripeChargeId: data.stripeChargeId,
        }),
      },
      select: orderSelect,
    });
    return mapOrder(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new CustomerOrderNotFoundError();
    }
    throw err;
  }
}
```

### Key details

- `stripePaymentIntentId` is declared `@unique` in the schema, so `findUnique({ where: { stripePaymentIntentId } })` is valid.
- Admin controllers that return full order data will now include `stripePaymentIntentId` and `stripeChargeId` in the serialized domain object. Public controllers must **not** include these in their response (enforced by the `toPublicOrder` serializer — see step 15).
- The `orderSelect` change affects all existing usages of `findAll`, `findById`, and `create`. Since `CustomerOrder` constructor now accepts these fields (step 4), existing callers get the fields for free. No existing test breaks on field presence — tests would only break if `stripePaymentIntentId` was unexpectedly absent (it defaults to `null`).

---

## 9. `backend/src/infrastructure/repositories/stripeWebhookEventRepository.ts` (NEW)

### What to create

```typescript
import { prisma } from '../prismaClient';
import { StripeWebhookEvent } from '../../domain/models/stripeWebhookEvent';
import {
  IStripeWebhookEventRepository,
  StripeWebhookEventCreateData,
} from '../../domain/repositories/stripeWebhookEventRepository';

const webhookEventSelect = {
  id: true,
  stripeEventId: true,
  type: true,
  customerOrderId: true,
  createdAt: true,
} as const;

export class StripeWebhookEventRepository implements IStripeWebhookEventRepository {
  async findByStripeEventId(stripeEventId: string): Promise<StripeWebhookEvent | null> {
    const row = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId },
      select: webhookEventSelect,
    });
    return row ? new StripeWebhookEvent(row) : null;
  }

  async create(data: StripeWebhookEventCreateData): Promise<StripeWebhookEvent> {
    const row = await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: data.stripeEventId,
        type: data.type,
        customerOrderId: data.customerOrderId ?? null,
      },
      select: webhookEventSelect,
    });
    return new StripeWebhookEvent(row);
  }
}
```

### Key details

- `stripeEventId` is `@unique` so `findUnique({ where: { stripeEventId } })` is valid.
- `customerOrderId` stores `null` when the event type does not correspond to a known order (e.g., a test ping).

---

## 10. `backend/src/application/validator.ts` (UPDATE)

### What to add

Add three new error classes at the end of the file (before the closing of exports), following the exact same pattern as `RefundTransitionInvalidError` in `refundRepository.ts`:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Stripe / Payment error classes
// ─────────────────────────────────────────────────────────────────────────────

export class PaymentGatewayUnavailableError extends Error {
  readonly code = 'PAYMENT_GATEWAY_UNAVAILABLE' as const;
  readonly status = 503;

  constructor(message = 'Payment gateway is unavailable') {
    super(message);
    this.name = 'PaymentGatewayUnavailableError';
    Object.setPrototypeOf(this, PaymentGatewayUnavailableError.prototype);
  }
}

export class PaymentWebhookSignatureInvalidError extends Error {
  readonly code = 'PAYMENT_WEBHOOK_SIGNATURE_INVALID' as const;
  readonly status = 400;

  constructor(message = 'Webhook signature verification failed') {
    super(message);
    this.name = 'PaymentWebhookSignatureInvalidError';
    Object.setPrototypeOf(this, PaymentWebhookSignatureInvalidError.prototype);
  }
}

export class RefundStripeError extends Error {
  readonly code = 'REFUND_STRIPE_ERROR' as const;
  readonly status = 409;

  constructor(message = 'Stripe refund creation failed') {
    super(message);
    this.name = 'RefundStripeError';
    Object.setPrototypeOf(this, RefundStripeError.prototype);
  }
}
```

### Key details

- All three follow the project convention: class name in PascalCase, `code` as `const` string literal, `status` HTTP integer, `Object.setPrototypeOf` for correct `instanceof` checks.
- These are placed in `validator.ts` per the tasks spec ("Add to the validator/error codes registry"). This is the same file where other domain error re-exports live.
- The existing `globalErrorHandler` middleware in `middleware/errorHandler.ts` will automatically handle these if it already checks for `err.status` and `err.code`. Verify that the error handler serializes `{ success: false, error: { message, code } }` for these status codes. If not, update the error handler to handle 400, 409, 503.

---

## 11. `backend/src/application/services/paymentService.ts` (NEW)

### What to create

This is the main orchestration service for all Stripe interactions. It is injected with repository dependencies for testability.

```typescript
import Stripe from 'stripe';
import { Decimal } from '@prisma/client/runtime/library';
import { stripe } from '../../infrastructure/stripe/stripeClient';
import { toStripeAmount } from '../../infrastructure/stripe/toStripeAmount';
import { CustomerOrder } from '../../domain/models/customerOrder';
import { ICustomerOrderRepository } from '../../domain/repositories/customerOrderRepository';
import { IStripeWebhookEventRepository } from '../../domain/repositories/stripeWebhookEventRepository';
import { CustomerOrderRepository } from '../../infrastructure/repositories/customerOrderRepository';
import { StripeWebhookEventRepository } from '../../infrastructure/repositories/stripeWebhookEventRepository';
import {
  PaymentGatewayUnavailableError,
  PaymentWebhookSignatureInvalidError,
} from '../validator';
import { prisma } from '../../infrastructure/prismaClient';
import { logger } from '../../infrastructure/logger';

export class PaymentService {
  constructor(
    private readonly orderRepo: ICustomerOrderRepository,
    private readonly webhookEventRepo: IStripeWebhookEventRepository
  ) {}

  // ── Public config ──────────────────────────────────────────────────────────

  getConfig(): { publishableKey: string; mode: string } {
    return {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
      mode: process.env.STRIPE_MODE ?? 'test',
    };
  }

  // ── PaymentIntent creation ─────────────────────────────────────────────────

  async createPaymentIntent(
    order: CustomerOrder
  ): Promise<{ clientSecret: string; stripePaymentIntentId: string }> {
    const amountDecimal = new Decimal(order.totalAmount);
    const amount = toStripeAmount(amountDecimal, order.currency);

    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount,
          currency: order.currency.toLowerCase(),
          metadata: {
            customerOrderId: String(order.id),
            orderNumber: order.orderNumber,
          },
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey: `order:${order.orderNumber}:pi` }
      );
    } catch (err) {
      logger.error('Stripe PaymentIntent creation failed', {
        orderNumber: order.orderNumber,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new PaymentGatewayUnavailableError();
    }

    if (!intent.client_secret) {
      throw new PaymentGatewayUnavailableError('PaymentIntent missing client_secret');
    }

    return {
      clientSecret: intent.client_secret,
      stripePaymentIntentId: intent.id,
    };
  }

  // ── Webhook handler ────────────────────────────────────────────────────────

  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (_err) {
      throw new PaymentWebhookSignatureInvalidError();
    }

    // Idempotency check
    const existing = await this.webhookEventRepo.findByStripeEventId(event.id);
    if (existing) {
      logger.info('Stripe webhook event already processed — skipping', { eventId: event.id });
      return;
    }

    // Dispatch
    try {
      if (event.type === 'payment_intent.succeeded') {
        await this.handlePaymentIntentSucceeded(event);
      } else if (event.type === 'payment_intent.payment_failed') {
        await this.handlePaymentIntentFailed(event);
      } else if (event.type === 'charge.refunded') {
        await this.handleChargeRefunded(event);
      } else {
        logger.info('Stripe webhook event type not handled', { type: event.type });
      }
    } catch (err) {
      // Log but do not throw — Stripe expects 200 even on business logic errors.
      // The event is still persisted below so we do not reprocess.
      logger.error('Stripe webhook event handler error', {
        eventId: event.id,
        type: event.type,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Persist after processing (idempotency write)
    await this.webhookEventRepo.create({
      stripeEventId: event.id,
      type: event.type,
    });
  }

  // ── payment_intent.succeeded ───────────────────────────────────────────────

  private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
    const intent = event.data.object as Stripe.PaymentIntent;
    const order = await this.orderRepo.findByStripePaymentIntentId(intent.id);

    if (!order) {
      logger.warn('payment_intent.succeeded: order not found for PaymentIntent', {
        stripePaymentIntentId: intent.id,
      });
      return;
    }

    // Idempotent guard — already paid
    if (order.paymentStatus === 'Paid' || order.status === 'Paid') {
      logger.info('payment_intent.succeeded: order already Paid — skipping', {
        orderId: order.id,
      });
      return;
    }

    // Extract latest charge id
    const chargeId =
      typeof intent.latest_charge === 'string'
        ? intent.latest_charge
        : (intent.latest_charge as Stripe.Charge | null)?.id ?? null;

    await prisma.customerOrder.update({
      where: { id: order.id },
      data: {
        status: 'Paid',
        paymentStatus: 'Paid',
        paidAt: new Date(),
        ...(chargeId !== null && { stripeChargeId: chargeId }),
      },
    });

    logger.info('payment_intent.succeeded: order marked Paid', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      chargeId,
    });
  }

  // ── payment_intent.payment_failed ─────────────────────────────────────────

  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const intent = event.data.object as Stripe.PaymentIntent;
    const order = await this.orderRepo.findByStripePaymentIntentId(intent.id);

    if (!order) {
      logger.warn('payment_intent.payment_failed: order not found for PaymentIntent', {
        stripePaymentIntentId: intent.id,
      });
      return;
    }

    await prisma.customerOrder.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'Failed',
        // status stays 'PendingPayment' — buyer may retry
      },
    });

    logger.info('payment_intent.payment_failed: order paymentStatus set to Failed', {
      orderId: order.id,
    });
  }

  // ── charge.refunded ────────────────────────────────────────────────────────

  private async handleChargeRefunded(event: Stripe.Event): Promise<void> {
    const charge = event.data.object as Stripe.Charge;
    // The charge.refunds.data array contains individual refund objects
    const stripeRefunds = charge.refunds?.data ?? [];

    for (const stripeRefund of stripeRefunds) {
      const refundRecord = await prisma.refund.findFirst({
        where: { paymentProviderReference: stripeRefund.id },
        select: { id: true, status: true, customerOrderId: true },
      });

      if (!refundRecord) {
        logger.warn('charge.refunded: no local Refund found for Stripe refund id', {
          stripeRefundId: stripeRefund.id,
        });
        continue;
      }

      if (refundRecord.status === 'Completed') {
        logger.info('charge.refunded: refund already Completed — skipping', {
          refundId: refundRecord.id,
        });
        continue;
      }

      if (refundRecord.status !== 'Processing') {
        logger.warn('charge.refunded: refund not in Processing state — skipping', {
          refundId: refundRecord.id,
          status: refundRecord.status,
        });
        continue;
      }

      // Transition Processing → Completed and recalculate paymentStatus
      await prisma.$transaction(async (tx) => {
        const processedAt = new Date();

        await tx.refund.update({
          where: { id: refundRecord.id },
          data: { status: 'Completed', processedAt },
        });

        const completedRefunds = await tx.refund.findMany({
          where: {
            customerOrderId: refundRecord.customerOrderId,
            status: 'Completed',
          },
          select: { amount: true },
        });

        const completedSum = completedRefunds.reduce(
          (acc: Decimal, r: { amount: { toString(): string } }) =>
            acc.plus(r.amount.toString()),
          new Decimal(0)
        );

        const order = await tx.customerOrder.findUnique({
          where: { id: refundRecord.customerOrderId },
          select: { totalAmount: true },
        });

        if (order) {
          const totalAmount = new Decimal(order.totalAmount.toString());
          const newPaymentStatus = completedSum.isZero()
            ? 'Paid'
            : completedSum.gte(totalAmount)
              ? 'Refunded'
              : 'PartiallyRefunded';

          await tx.customerOrder.update({
            where: { id: refundRecord.customerOrderId },
            data: { paymentStatus: newPaymentStatus },
          });
        }
      });

      logger.info('charge.refunded: refund transitioned to Completed', {
        refundId: refundRecord.id,
      });
    }
  }
}

// Singleton export — dependencies are the concrete implementations
export const paymentService = new PaymentService(
  new CustomerOrderRepository(),
  new StripeWebhookEventRepository()
);
```

### Key details

- **Direct `prisma` usage in event handlers**: `handlePaymentIntentSucceeded`, `handlePaymentIntentFailed`, and `handleChargeRefunded` use `prisma` directly instead of going through `ICustomerOrderRepository`. This is pragmatic: the repository's `updateStatus` method doesn't expose a Stripe-field update path, and `updateStripeFields` / direct Prisma avoids adding more methods to the interface. Document this tradeoff.
- **`charge.refunds.data` iteration**: A single charge event may contain multiple Stripe refunds. The loop handles each independently.
- **`prisma.refund.findFirst`**: The refund domain repo doesn't expose `findByPaymentProviderReference`. Using direct Prisma here is acceptable because `paymentService` is the only consumer of this query and adding it to `IRefundRepository` would violate ISP (no other service needs it).
- **Error in event handler swallowed**: Per spec, Stripe expects a `200` even when business logic fails. Errors are logged and the event is still persisted to avoid reprocessing loops.
- **`intent.latest_charge`**: Type is `string | Stripe.Charge | null` — handle both expanded and non-expanded forms.

### Unit tests: `paymentService.test.ts`

File: `backend/src/application/services/__tests__/paymentService.test.ts`

Mock strategy — add these at the top of the test file:

```typescript
jest.mock('../../../infrastructure/stripe/stripeClient', () => ({
  stripe: {
    paymentIntents: { create: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  },
}));

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    customerOrder: { update: jest.fn(), findUnique: jest.fn() },
    refund: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mockTx)),
  },
}));
```

Test cases (minimum for 90% coverage):

| Describe | Test case |
|---|---|
| `getConfig` | returns publishableKey and mode from env |
| `createPaymentIntent` | returns clientSecret and stripePaymentIntentId on success |
| `createPaymentIntent` | throws PaymentGatewayUnavailableError when Stripe throws |
| `createPaymentIntent` | throws PaymentGatewayUnavailableError when intent.client_secret is null |
| `createPaymentIntent` | uses correct idempotency key format `order:{orderNumber}:pi` |
| `createPaymentIntent` | converts totalAmount via toStripeAmount (mocked) |
| `handleWebhookEvent` | throws PaymentWebhookSignatureInvalidError on bad signature |
| `handleWebhookEvent` | returns early (no-op) if event already in StripeWebhookEvent |
| `handleWebhookEvent` | persists event to StripeWebhookEvent after processing |
| `handleWebhookEvent` | dispatches payment_intent.succeeded to handler |
| `handleWebhookEvent` | dispatches payment_intent.payment_failed to handler |
| `handleWebhookEvent` | dispatches charge.refunded to handler |
| `handleWebhookEvent` | does not throw if handler throws (swallows error, still persists event) |
| `handlePaymentIntentSucceeded` | sets status=Paid, paymentStatus=Paid, paidAt for PendingPayment order |
| `handlePaymentIntentSucceeded` | no-op if order already Paid |
| `handlePaymentIntentSucceeded` | logs warning and returns if order not found |
| `handlePaymentIntentSucceeded` | stores stripeChargeId from intent.latest_charge (string form) |
| `handlePaymentIntentFailed` | sets paymentStatus=Failed, status unchanged |
| `handlePaymentIntentFailed` | logs warning and returns if order not found |
| `handleChargeRefunded` | transitions Processing refund to Completed |
| `handleChargeRefunded` | recalculates paymentStatus to Refunded when fully refunded |
| `handleChargeRefunded` | recalculates paymentStatus to PartiallyRefunded for partial |
| `handleChargeRefunded` | no-op if refund already Completed |
| `handleChargeRefunded` | logs warning and skips if refund not found by paymentProviderReference |

ESLint note: prefix `_err` in `catch (_err)` blocks, use `unknown` not `any` for caught errors.

---

## 12. `backend/src/application/services/checkoutService.ts` (UPDATE)

### What to change

The current `createOrder` creates the order in a transaction and returns the Prisma row. We need to:
1. After the transaction commits, call `paymentService.createPaymentIntent(order)`.
2. If Stripe succeeds: update `stripePaymentIntentId` on the order in DB, return `{ order, clientSecret }`.
3. If Stripe fails (`PaymentGatewayUnavailableError`): delete the order from DB and re-throw.

#### 12a. Update return type for `createOrder` and `guestCheckout`

Add a new return type interface before the `CheckoutService` class:

```typescript
export interface CheckoutResult {
  order: {
    id?: number;
    orderNumber: string;
    customerId: number;
    status: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    subtotalAmount: string;
    shippingAmount: string;
    discountAmount: string;
    totalAmount: string;
    currency: string;
    shippingAddressSnapshot: Record<string, unknown>;
    billingAddressSnapshot: Record<string, unknown>;
    createdAt?: Date;
    items: Array<{
      id?: number;
      productVariantId: number;
      productNameSnapshot: string;
      variantSnapshot: Record<string, unknown>;
      skuSnapshot: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
    }>;
  };
  clientSecret: string;
}
```

#### 12b. Update `createOrder` method signature and body

Change the return type from `async createOrder(input: CheckoutInput)` to `async createOrder(input: CheckoutInput): Promise<CheckoutResult>`.

At the end of `createOrder`, **after** the `prisma.$transaction(...)` call that produces `order`, add:

```typescript
// Call Stripe to create PaymentIntent. If it fails, rollback by deleting the order.
let clientSecret: string;
let stripePaymentIntentId: string;
try {
  const piResult = await paymentService.createPaymentIntent({
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount.toString(),
    currency: order.currency ?? 'EUR',
  } as CustomerOrder);
  clientSecret = piResult.clientSecret;
  stripePaymentIntentId = piResult.stripePaymentIntentId;
} catch (err) {
  // Rollback: delete the order that was just created
  await prisma.customerOrder.delete({ where: { id: order.id } }).catch(() => {
    // Best-effort cleanup — log if delete also fails
    logger.error('Failed to rollback order after Stripe error', { orderId: order.id });
  });
  throw err; // Re-throws PaymentGatewayUnavailableError
}

// Persist stripePaymentIntentId on the order
await prisma.customerOrder.update({
  where: { id: order.id },
  data: { stripePaymentIntentId },
});

return { order: order as CheckoutResult['order'], clientSecret };
```

#### 12c. Import additions

At the top of `checkoutService.ts`, add:

```typescript
import { paymentService } from './paymentService';
import { CustomerOrder } from '../../domain/models/customerOrder';
import { logger } from '../../infrastructure/logger';
```

#### 12d. Update `guestCheckout`

`guestCheckout` calls `this.createOrder(...)` and returns its result. Since `createOrder` now returns `Promise<CheckoutResult>`, `guestCheckout` returns the same type. No logic change needed — just propagate the return.

### Key details

- **Circular dependency risk**: `checkoutService.ts` imports `paymentService.ts` which imports `CustomerOrderRepository`. This is fine because they are in different layers. However, if `paymentService` were to import `checkoutService`, there would be a circular dependency. The current design avoids that.
- **Deletion on rollback**: `prisma.customerOrder.delete` cascades to `CustomerOrderItem` (schema has `onDelete: Cascade` on `customerOrderId`). So items are also deleted.
- **Rollback catch**: The `.catch(() => ...)` prevents the delete failure from masking the original Stripe error.
- **`order.totalAmount`**: In the current code, `order` is the raw Prisma return value from `tx.customerOrder.create`, which returns a `Prisma.CustomerOrder` (with `Decimal` for totalAmount, not a string). Use `order.totalAmount.toString()` when constructing the partial `CustomerOrder` for `createPaymentIntent`.

### Unit tests update: `checkoutService.test.ts`

The existing checkout service tests (if any exist) need updating. If no test exists yet:

File: `backend/src/application/services/__tests__/checkoutService.test.ts`

Add mocks at the top:

```typescript
jest.mock('../paymentService', () => ({
  paymentService: {
    createPaymentIntent: jest.fn(),
  },
}));

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    productVariant: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn(), create: jest.fn() },
    customerOrder: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mockTx)),
  },
}));
```

Additional test cases to add (beyond existing coverage):

| Test case |
|---|
| `createOrder` returns `{ order, clientSecret }` on Stripe success |
| `createOrder` persists `stripePaymentIntentId` via `customerOrder.update` |
| `createOrder` deletes order and throws `PaymentGatewayUnavailableError` when Stripe fails |
| `createOrder` uses idempotency key `order:{orderNumber}:pi` |
| `guestCheckout` passes `clientSecret` through |
| Rollback delete failure is logged but original error is still thrown |

---

## 13. `backend/src/application/services/refundService.ts` (UPDATE)

### What to change

The `updateStatus` method must call `stripe.refunds.create` when the transition is `Pending → Processing`.

#### 13a. Add imports

```typescript
import { stripe } from '../../infrastructure/stripe/stripeClient';
import { toStripeAmount } from '../../infrastructure/stripe/toStripeAmount';
import { RefundStripeError } from '../validator';
```

#### 13b. Update `updateStatus` method

Inside the `prisma.$transaction` callback, after the existing status transition check (`isValidRefundTransition` call), add handling for the `Pending → Processing` Stripe call **before** the Prisma update:

```typescript
// IMPORTANT: Get the full refund first (we need amount and customerOrderId)
const existing = await tx.refund.findUnique({
  where: { id },
  select: { id: true, status: true, customerOrderId: true, amount: true },
});
```

Then, when the transition is `Pending → Processing`:

```typescript
let resolvedPaymentProviderReference = paymentProviderReference;

if (existing.status === 'Pending' && newStatus === 'Processing') {
  // Look up CustomerOrder.stripePaymentIntentId
  const order = await tx.customerOrder.findUnique({
    where: { id: existing.customerOrderId },
    select: { stripePaymentIntentId: true, currency: true },
  });

  if (!order?.stripePaymentIntentId) {
    throw new RefundStripeError(
      'Cannot create Stripe refund: order has no stripePaymentIntentId'
    );
  }

  const amountDecimal = new Decimal(existing.amount.toString());
  const currency = order.currency ?? 'EUR';

  let stripeRefund: Stripe.Refund;
  try {
    stripeRefund = await stripe.refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        amount: toStripeAmount(amountDecimal, currency),
      },
      { idempotencyKey: `refund:${existing.id}` }
    );
  } catch (err) {
    logger.error('Stripe refund creation failed', {
      refundId: existing.id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new RefundStripeError();
  }

  resolvedPaymentProviderReference = stripeRefund.id;
}
```

Then the existing `tx.refund.update` call uses `resolvedPaymentProviderReference` instead of `paymentProviderReference`.

#### 13c. Add Stripe import to type-only section

```typescript
import type Stripe from 'stripe';
```

Or use `import Stripe from 'stripe';` (non-type import if you need the class for error checking). Use `type` import if only using the type annotation for `stripeRefund`.

#### 13d. Import `logger`

```typescript
import { logger } from '../../infrastructure/logger';
```

### Key details

- **Validation before Stripe call**: The existing `isValidRefundTransition` check (throwing `RefundTransitionInvalidError`) runs first. The Stripe call only happens after that passes.
- **`REFUND_AMOUNT_EXCEEDS_BALANCE` guard**: This guard is in `create()`, not `updateStatus()`. When the admin transitions `Pending → Processing`, the refund amount was already validated at creation time. The Stripe refund amount is `existing.amount` from the DB, so no re-validation needed.
- **Idempotency key**: `refund:{refundId}` (numeric ID) ensures that retrying the same `Pending → Processing` transition sends the same idempotency key to Stripe.
- **`paymentProviderReference` conflict**: If the admin also passes `paymentProviderReference` in the request body AND we also set it from Stripe, we prioritize the Stripe value (`resolvedPaymentProviderReference = stripeRefund.id` overrides whatever was in the request body). Document this behavior clearly.
- **Transaction scope**: The Stripe API call happens inside `prisma.$transaction`. Prisma transactions use connection-level locks. The Stripe call is I/O and could take ~500ms. This is acceptable for MVP — the transaction holds the connection during the Stripe call. Alternative (more production-grade): call Stripe outside the transaction, then update inside. Defer optimization if needed.

### Unit tests update: `refundService.test.ts`

The existing refund service tests need extension or a new test file. If no test exists:

File: `backend/src/application/services/__tests__/refundService.test.ts`

Mock strategy:

```typescript
jest.mock('../../../infrastructure/stripe/stripeClient', () => ({
  stripe: {
    refunds: { create: jest.fn() },
  },
}));

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mockTx)),
  },
}));
```

Additional test cases:

| Test case |
|---|
| `updateStatus(Pending→Processing)` calls `stripe.refunds.create` with correct `payment_intent` and amount |
| `updateStatus(Pending→Processing)` stores Stripe refund id in `paymentProviderReference` |
| `updateStatus(Pending→Processing)` keeps refund in Pending and throws `RefundStripeError` when Stripe fails |
| `updateStatus(Pending→Processing)` uses idempotency key `refund:{refundId}` |
| `updateStatus(Pending→Processing)` throws `RefundStripeError` if order has no `stripePaymentIntentId` |
| `updateStatus(Pending→Cancelled)` does NOT call `stripe.refunds.create` |
| `updateStatus(Processing→Completed)` does NOT call `stripe.refunds.create` |
| Existing `REFUND_AMOUNT_EXCEEDS_BALANCE` guard test still passes (validated at create time) |

---

## 14. `backend/src/presentation/controllers/paymentController.ts` (NEW)

### What to create

```typescript
import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../application/services/paymentService';
import { PaymentWebhookSignatureInvalidError } from '../../application/validator';

export async function getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = paymentService.getConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      res
        .status(400)
        .json({
          success: false,
          error: { message: 'Missing Stripe-Signature header', code: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID' },
        });
      return;
    }

    // req.body is a Buffer because express.raw() is mounted on this route
    const rawBody = req.body as Buffer;
    await paymentService.handleWebhookEvent(rawBody, signature);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof PaymentWebhookSignatureInvalidError) {
      res
        .status(400)
        .json({
          success: false,
          error: { message: err.message, code: err.code },
        });
      return;
    }
    next(err);
  }
}
```

### Key details

- `_req` in `getConfig` — prefix unused param with `_` for ESLint compliance.
- `req.body as Buffer` — `express.raw({ type: 'application/json' })` middleware on the webhook route stores the raw body as `Buffer` on `req.body`. The type cast is necessary because Express types `req.body` as `any`.
- `PaymentWebhookSignatureInvalidError` is caught and returned as 400 directly (not via `next(err)`) to avoid the global error handler adding extra wrapping.
- All other errors go through `next(err)` to the global error handler.

### Unit tests: `paymentController.test.ts`

File: `backend/src/presentation/controllers/__tests__/paymentController.test.ts`

Mock strategy:

```typescript
jest.mock('../../../application/services/paymentService', () => ({
  paymentService: {
    getConfig: jest.fn(),
    handleWebhookEvent: jest.fn(),
  },
}));
```

Test cases:

| Test case |
|---|
| `getConfig` returns 200 with publishableKey and mode |
| `getConfig` response body does NOT contain any string starting with `sk_` |
| `handleWebhook` returns 400 when `Stripe-Signature` header is missing |
| `handleWebhook` returns 400 when `handleWebhookEvent` throws `PaymentWebhookSignatureInvalidError` |
| `handleWebhook` returns 200 when `handleWebhookEvent` succeeds |
| `handleWebhook` calls `next(err)` for non-signature errors |

Mocking `req` / `res` / `next`: use the same realistic Express mock pattern found in existing controller tests (e.g., `customerOrderController.test.ts`). Specifically: `const mockReq = { headers: {}, body: Buffer.from('{}') }`.

---

## 15. `backend/src/presentation/controllers/checkoutController.ts` (UPDATE)

### What to change

#### 15a. Update `toPublicOrder` to accept and pass through `clientSecret`

The function signature needs an optional second parameter:

```typescript
function toPublicOrder(
  order: NonNullable<CheckoutResult['order']>,
  clientSecret: string
) {
  return {
    // ... existing fields ...
    clientSecret,
  };
}
```

Or alternatively, change `toPublicOrder` to accept the full `CheckoutResult`:

```typescript
function toPublicOrder(result: CheckoutResult) {
  return {
    id: result.order.id,
    orderNumber: result.order.orderNumber,
    // ... other order fields ...
    clientSecret: result.clientSecret,
  };
}
```

The second approach is cleaner because `CheckoutResult` is already imported from `checkoutService.ts`.

**Critical**: The `toPublicOrder` serializer must NOT include `stripePaymentIntentId` or `stripeChargeId` in its output. These are internal Stripe identifiers that should only appear in admin responses. The existing admin order response (from `customerOrderAdminRoutes`) will include them naturally via the domain object — verify the admin serializer if one exists, or add explicit exclusion.

#### 15b. Update `guestCheckout` handler

Change:
```typescript
const order = await checkoutService.guestCheckout({...});
res.status(201).json({ success: true, data: toPublicOrder(order), message: 'Order created' });
```

To:
```typescript
const result = await checkoutService.guestCheckout({...});
res.status(201).json({ success: true, data: toPublicOrder(result), message: 'Order created' });
```

#### 15c. Update `authenticatedCheckout` handler similarly

Same change — use `result` instead of `order`, call `toPublicOrder(result)`.

#### 15d. Import `CheckoutResult`

```typescript
import { checkoutService, CheckoutResult } from '../../application/services/checkoutService';
```

### Key details

- The `clientSecret` must appear in the `201` response body so the frontend can initialize Stripe Elements.
- `stripePaymentIntentId` must NOT be in the public response. The Stripe intent id is only needed internally (stored in DB for webhook matching).
- Existing tests for `checkoutController` must be updated to mock `checkoutService.guestCheckout` and `checkoutService.createOrder` to return `{ order, clientSecret }` instead of just `order`.

---

## 16. `backend/src/routes/public/paymentRoutes.ts` (NEW)

### What to create

```typescript
import { Router } from 'express';
import { getConfig, handleWebhook } from '../../presentation/controllers/paymentController';

const router = Router();

// GET /api/public/payments/config — returns Stripe publishable key and mode
router.get('/config', getConfig);

// POST /api/public/payments/webhook — receives Stripe webhook events
// NOTE: express.raw() middleware is applied in index.ts BEFORE global express.json(),
// scoped to this specific path. The router itself does NOT apply any body parser here.
router.post('/webhook', handleWebhook);

export default router;
```

### Key details

- No authentication middleware — both endpoints are public.
- The `express.raw()` body parser is **not** applied inside this router. It is scoped in `index.ts` by path (see step 17). This is the correct pattern per the design decision.
- No rate limiter for the webhook route — Stripe's IP ranges are allowlisted at the infrastructure level. The `/config` route could have a rate limiter, but it returns static data so it is low risk for MVP.

---

## 17. `backend/src/index.ts` (UPDATE)

### What to change

This file has three separate concerns to update.

#### 17a. Add Stripe env vars to the startup validation

Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PUBLISHABLE_KEY` to the `requiredEnvVars` array so that startup fails fast if they are missing:

```typescript
const requiredEnvVars = ['DATABASE_URL', 'PORT', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PUBLISHABLE_KEY'];
```

If you prefer to only enforce Stripe vars in non-test environments (to keep Jest tests simpler), move them to the existing `productionRequiredVars` block and add a separate "non-test" guard:

```typescript
if (process.env.NODE_ENV !== 'test') {
  const stripeRequiredVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PUBLISHABLE_KEY'];
  for (const key of stripeRequiredVars) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

**Recommended**: use the `NODE_ENV !== 'test'` guard so existing Jest tests don't require Stripe env vars unless they explicitly import `stripeClient.ts`. Individual test files that test Stripe services should set `process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'` in a `beforeAll`.

#### 17b. Import payment routes

```typescript
import paymentPublicRoutes from './routes/public/paymentRoutes';
```

Place this import alongside the other public route imports.

#### 17c. Mount `express.raw()` BEFORE `express.json()` and register the payment route

This is the most critical change. The current middleware order in `index.ts` is:

```
app.use(cors(...))
app.use(express.json())      // ← global JSON parser
app.use(cookieParser(...))
```

Change this to:

```typescript
app.use(cors({ ... }));

// IMPORTANT: Mount express.raw() on the webhook path BEFORE express.json().
// Stripe signature verification requires the original raw body bytes.
// express.json() would replace req.body with a parsed object, breaking verification.
app.use(
  '/api/public/payments/webhook',
  express.raw({ type: 'application/json' })
);

app.use(express.json());
app.use(cookieParser(...));
```

#### 17d. Register the payment routes

In the `/api/public` routes section, add:

```typescript
app.use('/api/public/payments', paymentPublicRoutes);
```

Place this alongside the other public route registrations (after `checkoutPublicRoutes`).

### Key details

- **Ordering is critical**: `app.use('/api/public/payments/webhook', express.raw(...))` must appear BEFORE `app.use(express.json())`. If the order is reversed, `express.json()` runs first on all routes including the webhook, corrupting `req.body` before `express.raw()` can capture it.
- **Path specificity**: By mounting `express.raw` on the exact webhook path, all other routes continue to use `express.json()` normally. This avoids side-effects on all existing endpoints.
- **Test environment**: In Jest tests that import `app` from `index.ts`, the raw body middleware is already mounted. Tests for the webhook endpoint should send `Buffer.from(JSON.stringify(payload))` as the body to simulate Stripe's raw POST.

---

## Summary of ESLint / CI Requirements

| File | ESLint note |
|---|---|
| All new files | No `any` — use `unknown` for caught errors, proper types for Prisma results |
| `paymentService.ts` | `catch (_err)` in signature verification (unused error object) |
| `paymentController.ts` | `getConfig(_req, ...)` — unused `req` prefixed with `_` |
| Test files | `jest.mock(...)` must mirror module structure exactly; no `any` on mock fn args |
| `toStripeAmount.ts` | `_currency` unused param prefixed with `_` |

Verification commands:

```bash
cd backend
npm run lint
npm test -- --watchAll=false --testPathPattern="stripe|payment|checkout|refund"
npm test -- --watchAll=false --forceExit
```

---

## New `.env` variables (add to `.env.example`)

```
# Stripe Payment Gateway
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MODE=test
```

---

## Critical Architecture Notes

### Atomicity: Order creation + Stripe PaymentIntent

True DB-transaction atomicity is not possible with external Stripe API calls. The chosen pattern is:
1. Create order in Prisma transaction (commits immediately)
2. Call Stripe (external I/O, not inside transaction)
3. On Stripe failure: delete order from DB (manual rollback)
4. On Stripe success: update order with `stripePaymentIntentId`

This means there is a small window where an order exists in the DB without a `stripePaymentIntentId`. The `stripePaymentIntentId` field is nullable, so this is safe. The delete-on-failure covers the happy failure case.

### Webhook body middleware ordering

The most common regression risk in this feature. Any reorder of middleware in `index.ts` that moves `express.json()` before the raw middleware mount will silently break Stripe signature verification. The integration test that verifies webhook rejection on forged signature is the safety net.

### `stripePaymentIntentId` exposure policy

| Context | `stripePaymentIntentId` included? |
|---|---|
| `POST /api/public/checkout` response | NO — excluded by `toPublicOrder` serializer |
| `GET /api/public/account/orders` response | NO — excluded by public serializer |
| `GET /api/admin/customer-orders/:id` response | YES — full domain object |
| `Stripe-Signature` webhook log entry | NO — never log Stripe secret values |

### `charge.refunded` event flow

When Stripe delivers `charge.refunded`:
1. `paymentService.handleChargeRefunded` finds refund by `paymentProviderReference`
2. If `Processing` → transitions to `Completed` and recalculates `CustomerOrder.paymentStatus`
3. This mirrors what happens in `refundService.updateStatus(Processing→Completed)` but triggered by Stripe, not admin

This means `Completed` can be reached via two paths:
- Admin calls `PATCH /api/admin/refunds/:id/status` with `{ status: "Completed" }` → `refundService.updateStatus`
- `charge.refunded` webhook arrives → `paymentService.handleChargeRefunded`

Both paths run the `paymentStatus` recalculation. Both are idempotent (already-`Completed` refunds are skipped).
