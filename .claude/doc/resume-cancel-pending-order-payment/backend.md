# Backend Implementation Plan — resume-cancel-pending-order-payment

Grounded in the actual current source (read in full before writing this plan):
`backend/src/application/services/checkoutService.ts`, `paymentService.ts`, `customerOrderService.ts`,
`backend/src/presentation/controllers/customerAccountController.ts`, `backend/src/routes/public/accountRoutes.ts`,
`backend/src/application/validator.ts`, `backend/src/infrastructure/stripe/{stripeClient,toStripeAmount}.ts`,
`backend/src/middleware/errorHandler.ts`, `backend/src/domain/models/customerOrder.ts`,
`backend/src/domain/repositories/customerOrderRepository.ts`, `backend/src/infrastructure/repositories/customerOrderRepository.ts`,
and existing tests `backend/src/application/services/__tests__/{paymentService,customerOrderService}.test.ts`,
`backend/src/routes/public/__tests__/customerOrderIsolation.test.ts`.

No Prisma schema changes. No new repository interface methods needed — `ICustomerOrderRepository` already exposes
`findById`, `updateStatus`, `updateStripeFields`, which is everything the new service methods need.

---

## 1. `backend/src/application/validator.ts`

Add near the other `CUSTOMER_ORDER_STATUSES`/`PAID_ORDER_STATUSES` constants (after line 332, before `validateAddressSnapshotField`), and add the two new error classes in the "Stripe / Payment error classes" section at the bottom (after `RefundStripeError`, currently ending line 977).

### New constant

```ts
const PAYABLE_PAYMENT_STATUSES = new Set(['Pending', 'Failed']);
```

### `validatePendingOrderPayable(order)`

```ts
export function validatePendingOrderPayable(order: { status: string; paymentStatus: string }): void {
  if (order.status !== 'PendingPayment' || !PAYABLE_PAYMENT_STATUSES.has(order.paymentStatus)) {
    throw new OrderNotPayableError();
  }
}
```
- Passes only when `status === 'PendingPayment'` AND `paymentStatus` is `'Pending'` or `'Failed'`.
- Throws `OrderNotPayableError` for every other combination (covers `Paid`, `Processing`, `Completed`, `Cancelled`, `Refunded` status, and any non-payable `paymentStatus`).
- Matches spec scenario "Resume payment rejected for an order that is not payable" (`spec.md` lines 14-16).

### `validatePendingOrderCancellable(order)`

```ts
export function validatePendingOrderCancellable(order: { status: string }): void {
  if (order.status === 'Cancelled') return; // idempotent — already cancelled, caller short-circuits before this is even called
  if (order.status !== 'PendingPayment') {
    throw new OrderNotCancellableError();
  }
}
```
- Takes only `status` (not `paymentStatus`) — matches `tasks.md` 1.2 wording, whose throw list (`Paid/Processing/Completed/Refunded`) is composed of `CustomerOrderStatus` values, not `PaymentStatus` values.
- Passes for `PendingPayment` and (no-op) for `Cancelled`; throws `OrderNotCancellableError` for `Paid`, `Processing`, `Completed`, `Refunded`.
- This function is the **pre-check** run once against the order fetched at the top of `cancelPendingOrder` (before hitting Stripe/DB). The **race-safe recheck** inside the Prisma transaction (see §4) is separate and re-reads `paymentStatus` fresh from the DB per `design.md` Decision 3 — do not conflate the two.

### New typed errors (append after `RefundStripeError`, ~line 977)

```ts
export class OrderNotPayableError extends Error {
  readonly code = 'ORDER_NOT_PAYABLE' as const;
  readonly status = 409;

  constructor(message = 'Order is not in a payable state') {
    super(message);
    this.name = 'OrderNotPayableError';
    Object.setPrototypeOf(this, OrderNotPayableError.prototype);
  }
}

export class OrderNotCancellableError extends Error {
  readonly code = 'ORDER_NOT_CANCELLABLE' as const;
  readonly status = 409;

  constructor(message = 'Order is not in a cancellable state') {
    super(message);
    this.name = 'OrderNotCancellableError';
    Object.setPrototypeOf(this, OrderNotCancellableError.prototype);
  }
}

export class PaymentIntentAlreadyCapturedError extends Error {
  readonly code = 'PAYMENT_INTENT_ALREADY_CAPTURED' as const;
  readonly status = 409;

  constructor(message = 'PaymentIntent is already captured and cannot be cancelled') {
    super(message);
    this.name = 'PaymentIntentAlreadyCapturedError';
    Object.setPrototypeOf(this, PaymentIntentAlreadyCapturedError.prototype);
  }
}
```

Exact same shape as the existing `PaymentGatewayUnavailableError`/`RefundStripeError` pattern (readonly `code` literal, readonly `status`, `Object.setPrototypeOf`).

`PaymentIntentAlreadyCapturedError` is an **internal, payment-layer-only** error: it is thrown by `paymentService.cancelPaymentIntent` and always caught inside `customerOrderService.cancelPendingOrder`, which translates it into `OrderNotCancellableError` after performing the compensating rollback (§4). It must never reach the controller/errorHandler directly — do **not** add it to `errorHandler.ts`. Add a one-line comment above its class saying exactly this, so a future reader doesn't "helpfully" wire it into the error handler.

`OrderNotPayableError` and `OrderNotCancellableError` **do** need `errorHandler.ts` wiring (§2) since they can legitimately reach the controller.

---

## 2. `backend/src/middleware/errorHandler.ts` — map new typed errors

Add the import (extend the existing `customerOrderRepository`-sourced import block is NOT right — these two errors live in `validator.ts`, not the repository file). Add a new named import near the top, next to the existing `ValidationError, TranslationLocaleInvalidError` import (line 2):

```ts
import {
  ValidationError,
  TranslationLocaleInvalidError,
  OrderNotPayableError,
  OrderNotCancellableError,
} from '../application/validator';
```

Add the two `else if` branches in `globalErrorHandler`, right after the existing `OrderNumberConflictError` branch (line 138-139) and before `OrderStatusTransitionInvalidError` (line 140), keeping them grouped with the other `CustomerOrder`-related mappings:

```ts
  } else if (err instanceof OrderNumberConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof OrderNotPayableError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof OrderNotCancellableError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof OrderStatusTransitionInvalidError) {
```

This follows the exact `statusCode = X; code = err.code; message = err.message;` one-liner style used for every other typed error in this file — no new pattern introduced.

---

## 3. `backend/src/application/services/paymentService.ts`

Add two public methods to the `PaymentService` class, after `createPaymentIntent` (currently ending line 74) and before `handleWebhookEvent` (line 76). No new imports needed beyond what's already imported (`Stripe`, `Decimal`, `stripe`, `toStripeAmount`, `PaymentGatewayUnavailableError`, `logger`) plus one new import:

```ts
import {
  PaymentGatewayUnavailableError,
  PaymentWebhookSignatureInvalidError,
  PaymentIntentAlreadyCapturedError,
} from '../validator';
```

### New constant (top of file, alongside the class or just above it)

```ts
const RESUMABLE_PAYMENT_INTENT_STATUSES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
]);
```

### `resumePaymentIntent(order)`

```ts
async resumePaymentIntent(
  order: CustomerOrder
): Promise<{ clientSecret: string; stripePaymentIntentId: string; reused: boolean }> {
  const amount = toStripeAmount(new Decimal(order.totalAmount), order.currency);

  if (order.stripePaymentIntentId) {
    let existing: Stripe.PaymentIntent;
    try {
      existing = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    } catch (err) {
      logger.error('Stripe PaymentIntent retrieve failed', {
        orderId: order.id,
        stripePaymentIntentId: order.stripePaymentIntentId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new PaymentGatewayUnavailableError();
    }

    if (RESUMABLE_PAYMENT_INTENT_STATUSES.has(existing.status) && existing.amount === amount) {
      if (!existing.client_secret) {
        throw new PaymentGatewayUnavailableError('PaymentIntent missing client_secret');
      }
      return { clientSecret: existing.client_secret, stripePaymentIntentId: existing.id, reused: true };
    }
  }

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
      { idempotencyKey: `order:${order.id}:pi:resume:${Date.now()}` }
    );
  } catch (err) {
    logger.error('Stripe PaymentIntent resume-create failed', {
      orderNumber: order.orderNumber,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new PaymentGatewayUnavailableError();
  }

  if (!intent.client_secret) {
    throw new PaymentGatewayUnavailableError('PaymentIntent missing client_secret');
  }

  return { clientSecret: intent.client_secret, stripePaymentIntentId: intent.id, reused: false };
}
```

Key points grounded in the existing `createPaymentIntent` (lines 38-74) pattern:
- Same `toStripeAmount(new Decimal(...), currency)` call, same `try/catch → PaymentGatewayUnavailableError` wrapping, same `client_secret` null-guard, same `metadata` shape, same `automatic_payment_methods: { enabled: true }`.
- Idempotency key is **distinct** from checkout's `order:${order.id}:pi` (line 56): `order:${order.id}:pi:resume:${Date.now()}` — exactly the format in `design.md` Decision 2 / `tasks.md` 2.1.
- `reused: boolean` in the return lets `customerOrderService` decide whether to persist a new `stripePaymentIntentId` (only when `reused === false`) — this method itself does **not** touch Prisma, matching how `createPaymentIntent` never persists either (the caller, `checkoutService.createOrder`, does the `prisma.customerOrder.update` at lines 196-199).
- If `order.stripePaymentIntentId` is `null` (never had one, or previously cleared), skip `retrieve` entirely and go straight to create — this naturally satisfies "missing" from the design's reissue trigger list.
- A `retrieve` failure (network/Stripe-down) is treated as `PaymentGatewayUnavailableError`, **not** as "missing → reissue" — reissuing on a transient Stripe outage would risk creating a duplicate/orphaned PI once Stripe recovers with the old PI still valid. This is a plan decision not explicit in `design.md`; call it out in the PR description if it surprises anyone.

### `cancelPaymentIntent(stripePaymentIntentId)`

```ts
async cancelPaymentIntent(stripePaymentIntentId: string): Promise<void> {
  try {
    await stripe.paymentIntents.cancel(stripePaymentIntentId);
  } catch (err) {
    const stripeErr = err as { code?: string };
    if (stripeErr?.code === 'payment_intent_unexpected_state') {
      throw new PaymentIntentAlreadyCapturedError();
    }
    logger.error('Stripe PaymentIntent cancel failed', {
      stripePaymentIntentId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new PaymentGatewayUnavailableError();
  }
}
```
- Stripe's Node SDK raises `StripeInvalidRequestError` with `.code === 'payment_intent_unexpected_state'` when you try to cancel a PI that's already `succeeded`/`canceled` — this is the "already captured/not cancellable" signal design.md refers to. Detect it structurally (`stripeErr?.code`) rather than importing `Stripe.errors.StripeInvalidRequestError` so unit tests can mock a plain `{ code: '...' }` rejection exactly like the existing tests mock `mockCreatePI`/`mockConstructEvent` (no real Stripe error classes needed).
- Any other Stripe failure (network, auth, etc.) still falls back to `PaymentGatewayUnavailableError`, consistent with every other Stripe call in this file.

---

## 4. `backend/src/application/services/customerOrderService.ts`

### Import additions (extend the existing import block, lines 12-19)

```ts
import {
  validateCustomerOrderCreateData,
  validateCustomerOrderStatusUpdate,
  validatePendingOrderPayable,
  validatePendingOrderCancellable,
  OrderNotCancellableError,
  PaymentIntentAlreadyCapturedError,
  ValidationError,
} from '../validator';
import { paymentService } from './paymentService';
```

`paymentService` is the existing singleton exported at `paymentService.ts` line 260 (`export const paymentService = new PaymentService(new CustomerOrderRepository(), new StripeWebhookEventRepository());`) — reuse it exactly as `checkoutService.ts` already does (`import { paymentService } from './paymentService';`, line 9). No new instantiation, no circular import risk (`paymentService.ts` does not import `customerOrderService.ts`).

### `getOrCreatePaymentSession(customerId, orderId)`

```ts
async getOrCreatePaymentSession(
  customerId: number,
  orderId: number
): Promise<{ order: CustomerOrder; clientSecret: string }> {
  const order = await this.repo.findById(orderId);
  if (!order || order.customerId !== customerId) {
    throw new CustomerOrderNotFoundError();
  }

  validatePendingOrderPayable(order);

  const { clientSecret, stripePaymentIntentId, reused } = await paymentService.resumePaymentIntent(order);

  if (!reused) {
    await this.repo.updateStripeFields(order.id!, { stripePaymentIntentId });
    order.stripePaymentIntentId = stripePaymentIntentId;
  }

  return { order, clientSecret };
}
```
- Ownership check mirrors the existing `getOrderById` controller pattern (`prisma.customerOrder.findFirst({ where: { id, customerId } })`, `customerAccountController.ts` lines 124-127), but done in the service via `this.repo.findById(orderId)` + manual `order.customerId !== customerId` comparison — this avoids adding a new `findByIdForCustomer` method to `ICustomerOrderRepository` (interface stays minimal, per `backend-developer.md` guidance to keep repository contracts minimal).
- `CustomerOrderNotFoundError` for both "does not exist" and "belongs to someone else" (never leak existence via 403) — matches `design.md` Decision 4 and the existing `customerOrderIsolation.test.ts` expectation (`404` + `CUSTOMER_ORDER_NOT_FOUND`, lines 59-69).
- `updateStripeFields` is the existing repo method (`ICustomerOrderRepository` line 74-77, implemented at `infrastructure/repositories/customerOrderRepository.ts` lines 304-328) — reused as-is, no changes needed there.

### `cancelPendingOrder(customerId, orderId)`

```ts
async cancelPendingOrder(customerId: number, orderId: number): Promise<CustomerOrder> {
  const order = await this.repo.findById(orderId);
  if (!order || order.customerId !== customerId) {
    throw new CustomerOrderNotFoundError();
  }

  if (order.status === 'Cancelled') {
    return order; // idempotent — no DB write, no Stripe call
  }

  validatePendingOrderCancellable(order);

  const priorStatus = order.status;
  const priorFulfillmentStatus = order.fulfillmentStatus;

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.customerOrder.findUnique({
      where: { id: order.id },
      select: { status: true, paymentStatus: true },
    });
    if (!fresh) throw new CustomerOrderNotFoundError();

    // Webhook-race guard (design.md Decision 3): re-verify paymentStatus immediately
    // before committing. Only Pending/Failed may proceed to Cancelled.
    if (fresh.status !== 'PendingPayment' || fresh.paymentStatus === 'Paid') {
      throw new OrderNotCancellableError();
    }

    await tx.customerOrder.update({
      where: { id: order.id },
      data: { status: 'Cancelled', fulfillmentStatus: 'Cancelled', cancelledAt: new Date() },
    });
  });

  if (order.stripePaymentIntentId) {
    try {
      await paymentService.cancelPaymentIntent(order.stripePaymentIntentId);
    } catch (err) {
      // Compensating rollback: the local Cancelled state must not stand if Stripe
      // could not actually cancel the PaymentIntent.
      await prisma.customerOrder.update({
        where: { id: order.id },
        data: { status: priorStatus, fulfillmentStatus: priorFulfillmentStatus, cancelledAt: null },
      });
      if (err instanceof PaymentIntentAlreadyCapturedError) {
        throw new OrderNotCancellableError();
      }
      throw err; // PaymentGatewayUnavailableError (503) bubbles as-is
    }
  }

  return (await this.repo.findById(orderId)) as CustomerOrder;
}
```

Notes grounded in the actual codebase:
- **Transaction shape**: uses `prisma.$transaction(async (tx) => {...})` directly, exactly like `checkoutService.createOrder` (lines 140-175) and `paymentService.handleChargeRefunded` (lines 211-251) already do — `prisma` is already imported at the top of `customerOrderService.ts` (line 2) for the `create()` method's `customer`/`productVariant` lookups, so no new import is required. This is a deliberate, precedented deviation from going through `this.repo` for this one operation, because the interface (`ICustomerOrderRepository`) has no transactional "re-check-then-update" primitive and adding one just for this case would over-fit the interface to a single caller.
- The **recheck inside the transaction** reads `paymentStatus`/`status` fresh via `tx.customerOrder.findUnique` (bypassing the `order` object fetched before the transaction, which may be stale) — this is the literal implementation of `design.md` Decision 3(a)/(b).
- Re-check condition `fresh.status !== 'PendingPayment' || fresh.paymentStatus === 'Paid'` is intentionally slightly broader than "only check paymentStatus" — it also guards the case where `status` alone flipped (paranoia against future code paths), while still centering on `paymentStatus === 'Paid'` per the design doc wording. `webhookhandlePaymentIntentSucceeded` (paymentService.ts lines 139-147) sets `status` and `paymentStatus` to `'Paid'` in the **same** `update` call, so in practice these two fields never diverge — either check alone would catch the race.
- **Rollback**: after the transaction commits, the Stripe cancel call happens outside it (matches Decision 3's "Stripe-side call happens after the DB transaction commits"). If `cancelPaymentIntent` throws `PaymentIntentAlreadyCapturedError`, the code performs a **compensating update** back to the prior `status`/`fulfillmentStatus` and clears `cancelledAt`, then re-throws as `OrderNotCancellableError` (409) — matching spec scenario "Cancellation rejected when Stripe reports the PaymentIntent as already captured" (`spec.md` lines 37-39).
- If `cancelPaymentIntent` throws the generic `PaymentGatewayUnavailableError` instead (Stripe outage, not "already captured"), the plan **also rolls back** the local cancellation (so the DB and Stripe never disagree about cancellation state) and re-throws the original error, which the controller's `next(err)` will map to `503`. This generic-failure rollback is not explicitly in `design.md`/`tasks.md` (which only mention the already-captured case) — flag this as an implementation decision worth a one-line mention in the PR description.
- Final `this.repo.findById(orderId)` re-fetch returns the authoritative post-cancellation row (picks up `cancelledAt`, etc.) rather than mutating the in-memory `order` object by hand.
- Idempotent-already-cancelled check happens **before** calling `validatePendingOrderCancellable`, so the validator's own "passes idempotently for Cancelled" behavior (§1) is technically redundant with this early return — that's intentional defense-in-depth per `tasks.md` 1.2, not a bug.

### New singleton export (bottom of file — currently the file has no singleton export, only `export class CustomerOrderService`)

```ts
import { CustomerOrderRepository } from '../../infrastructure/repositories/customerOrderRepository';
// ... (merge into the existing import from this path, which currently only imports CustomerOrderNotFoundError)

export const customerOrderService = new CustomerOrderService(new CustomerOrderRepository());
```

This is a **new addition** — today only `presentation/controllers/customerOrderController.ts` (the *admin* controller) instantiates `new CustomerOrderService(new CustomerOrderRepository())` itself (line 15); there is no reusable singleton. Since `customerAccountController.ts` (the *public/customer* controller, §5) now also needs a `CustomerOrderService` instance, export a singleton here — matching the existing pattern used by `checkoutService` (`export const checkoutService = new CheckoutService();`) and `paymentService` (`export const paymentService = new PaymentService(...)`). Do **not** touch the admin `customerOrderController.ts`'s own instantiation — out of scope for this change, leave it as-is to avoid an unrelated diff.

---

## 5. `backend/src/presentation/controllers/customerAccountController.ts`

### Import addition (top of file)

```ts
import { customerOrderService } from '../../application/services/customerOrderService';
```

### New handlers (add after `getOrderById`, currently ending line 133, before `setup2fa`)

```ts
export async function resumeOrderPayment(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { order, clientSecret } = await customerOrderService.getOrCreatePaymentSession(
      req.customer!.customerId,
      id
    );
    res.json({
      success: true,
      data: { order: toPublicOrder(order), clientSecret },
      message: 'Payment session created',
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string, 10);
    const order = await customerOrderService.cancelPendingOrder(req.customer!.customerId, id);
    res.json({ success: true, data: toPublicOrder(order), message: 'Order cancelled' });
  } catch (err) {
    next(err);
  }
}
```

- Both handlers follow the **exact** shape of `getOrderById` (lines 121-133): `parseInt(req.params.id as string, 10)`, `req.customer!.customerId`, `try { ... } catch (err) { next(err); }`, `res.json({ success: true, data, message })`.
- **Reuses `toPublicOrder`** (the existing local function, lines 8-61) unmodified — it already omits `stripePaymentIntentId`/`stripeChargeId` (never selects them into the returned object), satisfying the "never expose Stripe identifiers" requirement for both new endpoints without any changes to that mapper. The `CustomerOrder` domain-model instance returned by the service is structurally compatible with `toPublicOrder`'s parameter type (all fields it reads — `id`, `orderNumber`, `status`, `paymentStatus`, `fulfillmentStatus`, the four `Decimal`-like amount fields, `currency`, snapshots, `createdAt`, `items[]` — exist on `CustomerOrder`/`CustomerOrderItem`, and `string` already has a `.toString()` method so the `{ toString(): string }` duck-typed fields type-check fine).
- `resumeOrderPayment`'s response body is `{ order: toPublicOrder(order), clientSecret }` (an object wrapping both), not a bare order — this matches spec.md's "returns 200 with the existing PaymentIntent's client_secret and the order's public details" (needs both in one payload) and gives the frontend a single response shape to destructure (`res.data.order`, `res.data.clientSecret`).

---

## 6. `backend/src/routes/public/accountRoutes.ts`

### Import addition (extend the existing named import from `customerAccountController`, lines 3-11)

```ts
import {
  getProfile,
  updateProfile,
  listOrders,
  getOrderById,
  resumeOrderPayment,
  cancelOrder,
  setup2fa,
  confirm2fa,
  disable2fa,
} from '../../presentation/controllers/customerAccountController';
```

### Route registration (insert right after `router.get('/orders/:id', getOrderById);`, line 39)

```ts
router.get('/orders', listOrders);
router.get('/orders/:id', getOrderById);
router.post('/orders/:id/payment-session', resumeOrderPayment);
router.post('/orders/:id/cancel', cancelOrder);
```

Both new routes sit under the router-level `router.use(accountLimiter)` (line 33) and `router.use(requireCustomerAuth)` (line 34) already applied to the whole router — no per-route middleware needed, exactly like every other route in this file. No new rate limiter is introduced, per `design.md`'s explicit trade-off ("Rate limiting reuses the existing generic `accountLimiter`").

---

## 7. Test file plan

Existing test files to extend (found via search — do **not** create new files at these paths, they already exist):
- `backend/src/application/validator.test.ts` (general validator tests — or add a new focused file `backend/src/application/__tests__/validator.pendingOrder.test.ts` following the existing split-by-domain convention already used for `validator.supplier.test.ts`, `validator.customerOrder.test.ts`, `validator.shipment.test.ts`, `validator.returnRequest.test.ts`, `validator.supplierOrder.test.ts` under `backend/src/application/__tests__/`. **Recommendation: create `validator.pendingOrder.test.ts` in that `__tests__` folder** — it matches the established per-domain split better than piling into the flat top-level `validator.test.ts`.)
- `backend/src/application/services/__tests__/paymentService.test.ts` (already exists, read in full above — extend it, same file, same `jest.mock()` blocks already in place for `stripeClient` and `prismaClient`).
- `backend/src/application/services/__tests__/customerOrderService.test.ts` (already exists, read in full above — extend it; will need a **new** `jest.mock('../paymentService', ...)` block since this file currently does not mock `paymentService` at all, and the new methods call `paymentService.resumePaymentIntent`/`cancelPaymentIntent`).

### 7.1 `validator.pendingOrder.test.ts` — new file

```ts
import {
  validatePendingOrderPayable,
  validatePendingOrderCancellable,
  OrderNotPayableError,
  OrderNotCancellableError,
} from '../validator';
```

**`validatePendingOrderPayable`**
- passes when `status: 'PendingPayment', paymentStatus: 'Pending'`
- passes when `status: 'PendingPayment', paymentStatus: 'Failed'`
- throws `OrderNotPayableError` when `status: 'PendingPayment', paymentStatus: 'Paid'`
- throws `OrderNotPayableError` when `status: 'Paid'` (any paymentStatus)
- throws `OrderNotPayableError` when `status: 'Cancelled'`
- throws `OrderNotPayableError` when `status: 'Processing'`, `'Completed'`, `'Refunded'` (table-driven `it.each`)
- error has `code === 'ORDER_NOT_PAYABLE'` and `status === 409`

**`validatePendingOrderCancellable`**
- passes (no throw) when `status: 'PendingPayment'`
- passes (no throw, idempotent) when `status: 'Cancelled'`
- throws `OrderNotCancellableError` when `status: 'Paid'`
- throws `OrderNotCancellableError` when `status: 'Processing'`
- throws `OrderNotCancellableError` when `status: 'Completed'`
- throws `OrderNotCancellableError` when `status: 'Refunded'`
- error has `code === 'ORDER_NOT_CANCELLABLE'` and `status === 409`

### 7.2 `paymentService.test.ts` — add `describe('resumePaymentIntent', ...)` and `describe('cancelPaymentIntent', ...)`

Extend the existing `jest.mock('../../../infrastructure/stripe/stripeClient', ...)` block (lines 21-26) to also stub `retrieve` and `cancel`:
```ts
const mockRetrievePI = jest.fn();
const mockCancelPI = jest.fn();
jest.mock('../../../infrastructure/stripe/stripeClient', () => ({
  stripe: {
    paymentIntents: {
      create: (...args: unknown[]) => mockCreatePI(...args),
      retrieve: (...args: unknown[]) => mockRetrievePI(...args),
      cancel: (...args: unknown[]) => mockCancelPI(...args),
    },
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
  },
}));
```

**`resumePaymentIntent`**
- reuses existing PI: `stripePaymentIntentId` set, `retrieve` resolves `{ status: 'requires_payment_method', amount: 2999, id: 'pi_1', client_secret: 'secret_1' }`, order `totalAmount: '29.99'` → returns `{ clientSecret: 'secret_1', stripePaymentIntentId: 'pi_1', reused: true }`; `mockCreatePI` NOT called
- reuses existing PI when status is `requires_confirmation` (table-driven with `requires_action` too, `it.each`)
- reissues when existing PI status is `canceled` → `mockCreatePI` called, `reused: false`
- reissues when existing PI amount no longer matches `order.totalAmount` (e.g. PI `amount: 1000` vs order `totalAmount: '29.99'` → 2999) → `mockCreatePI` called
- reissues when `order.stripePaymentIntentId` is `null` → `retrieve` never called, `mockCreatePI` called directly
- new PI uses idempotency key `order:{id}:pi:resume:{timestamp}` — mock `Date.now` (`jest.spyOn(Date, 'now').mockReturnValue(1700000000000)`) and assert `mockCreatePI` called with `expect.objectContaining({ idempotencyKey: 'order:1:pi:resume:1700000000000' })`
- throws `PaymentGatewayUnavailableError` when `retrieve` rejects
- throws `PaymentGatewayUnavailableError` when reused PI is payable/amount-matches but `client_secret` is `null`
- throws `PaymentGatewayUnavailableError` when `create` rejects (reissue path)
- throws `PaymentGatewayUnavailableError` when reissued PI has `client_secret: null`

**`cancelPaymentIntent`**
- calls `stripe.paymentIntents.cancel(stripePaymentIntentId)` and resolves with no return value on success
- throws `PaymentIntentAlreadyCapturedError` when Stripe rejects with `{ code: 'payment_intent_unexpected_state' }`
- throws `PaymentGatewayUnavailableError` when Stripe rejects with a generic/other error (e.g. `{ message: 'network error' }` with no `code`)

### 7.3 `customerOrderService.test.ts` — add `describe('getOrCreatePaymentSession', ...)` and `describe('cancelPendingOrder', ...)`

Add a new mock block for `paymentService` (this file currently has none — only mocks `prismaClient` for `customer`/`productVariant`):
```ts
const mockResumePaymentIntent = jest.fn();
const mockCancelPaymentIntent = jest.fn();
jest.mock('../paymentService', () => ({
  paymentService: {
    resumePaymentIntent: (...args: unknown[]) => mockResumePaymentIntent(...args),
    cancelPaymentIntent: (...args: unknown[]) => mockCancelPaymentIntent(...args),
  },
}));
```
Extend the existing `jest.mock('../../../infrastructure/prismaClient', ...)` block (lines 13-18) to add `customerOrder.findUnique`, `customerOrder.update`, and `$transaction`:
```ts
const mockOrderFindUnique = jest.fn();
const mockOrderUpdate = jest.fn();
jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    customer: { findUnique: (...args: unknown[]) => mockCustomerFindUnique(...args) },
    productVariant: { findUnique: (...args: unknown[]) => mockVariantFindUnique(...args) },
    customerOrder: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      update: (...args: unknown[]) => mockOrderUpdate(...args),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ customerOrder: { findUnique: mockOrderFindUnique, update: mockOrderUpdate } })
    ),
  },
}));
```

**`getOrCreatePaymentSession`**
- happy path, reuse: `mockRepo.findById` resolves owned `PendingPayment`/`Pending` order; `mockResumePaymentIntent` resolves `{ clientSecret: 'cs_1', stripePaymentIntentId: 'pi_1', reused: true }` → returns `{ order, clientSecret: 'cs_1' }`; `mockRepo.updateStripeFields` NOT called
- happy path, reissue: `mockResumePaymentIntent` resolves `{ ..., reused: false }` → `mockRepo.updateStripeFields` called with `(order.id, { stripePaymentIntentId })`
- throws `CustomerOrderNotFoundError` when `mockRepo.findById` resolves `null`
- throws `CustomerOrderNotFoundError` when order's `customerId` does not match the calling `customerId` (cross-customer, mirrors `customerOrderIsolation.test.ts`'s expectations at the route level)
- throws `OrderNotPayableError` when order `status !== 'PendingPayment'`
- throws `OrderNotPayableError` when order `paymentStatus === 'Paid'`
- propagates `PaymentGatewayUnavailableError` if `resumePaymentIntent` rejects (no swallowing)

**`cancelPendingOrder`**
- happy path: owned `PendingPayment` order, `stripePaymentIntentId` set; transaction's `mockOrderFindUnique` resolves `{ status: 'PendingPayment', paymentStatus: 'Pending' }`; `mockOrderUpdate` resolves; `mockCancelPaymentIntent` resolves → asserts `mockOrderUpdate` called with `data: expect.objectContaining({ status: 'Cancelled', fulfillmentStatus: 'Cancelled', cancelledAt: expect.any(Date) })`, `mockCancelPaymentIntent` called with the order's `stripePaymentIntentId`, and the final returned order reflects `Cancelled`
- happy path with no `stripePaymentIntentId` on the order (edge case: order somehow has none) → `mockCancelPaymentIntent` NOT called, DB update still happens
- idempotent: order already `status: 'Cancelled'` → returns the same order unchanged; `$transaction`, `mockOrderUpdate`, `mockCancelPaymentIntent` all NOT called
- throws `CustomerOrderNotFoundError` for non-existent order (`mockRepo.findById` → `null`)
- throws `CustomerOrderNotFoundError` for another customer's order (`customerId` mismatch)
- throws `OrderNotCancellableError` for order whose outer `status` is `Paid`/`Processing`/`Completed`/`Refunded` (pre-transaction `validatePendingOrderCancellable` guard rejects before any DB/Stripe call — assert `mockOrderFindUnique`/`$transaction` never entered, or entered zero times)
- **webhook race**: outer order object says `PendingPayment`/`Pending`, but the transaction's `mockOrderFindUnique` resolves `{ status: 'Paid', paymentStatus: 'Paid' }` (simulating the webhook winning the race) → throws `OrderNotCancellableError`; `mockOrderUpdate` (the Cancelled write) NOT called; `mockCancelPaymentIntent` NOT called (never reached, since the transaction throws before it)
- **Stripe-captured rollback**: transaction succeeds (`mockOrderUpdate` called once for the Cancelled write), then `mockCancelPaymentIntent` rejects with `PaymentIntentAlreadyCapturedError` → asserts `mockOrderUpdate` called a **second** time with the compensating rollback (`data: expect.objectContaining({ status: <prior status>, fulfillmentStatus: <prior fulfillmentStatus>, cancelledAt: null })`), and the method rejects with `OrderNotCancellableError`
- **generic Stripe failure rollback**: same as above but `mockCancelPaymentIntent` rejects with `PaymentGatewayUnavailableError` → asserts the same compensating rollback update happens, and the method rejects with `PaymentGatewayUnavailableError` (not `OrderNotCancellableError` — the original error type is preserved)

### Verification commands (per `docs/backend-standards.md` § ESLint/CI + `backend-developer.md`)

```bash
cd backend
npm run lint
npm test -- --watchAll=false --testPathPattern=validator.pendingOrder
npm test -- --watchAll=false --testPathPattern=paymentService
npm test -- --watchAll=false --testPathPattern=customerOrderService
npm run build   # or: npx tsc --noEmit
```

### Note on controller/route-level tests (not strictly required by tasks.md groups 1-3, flagged for completeness)

There is currently **no** `customerAccountController.test.ts` or dedicated route test for `accountRoutes.ts` in the repo (confirmed via glob search — only `customerOrderIsolation.test.ts` exercises `/api/public/account/orders` at the supertest/integration level, and only for the existing `GET` routes). `tasks.md` step 6.1 asks to review — not necessarily create — controller/route tests for overlap. Given the ownership/404 behavior is a repeat of an already-tested pattern (`customerOrderIsolation.test.ts` lines 59-69), a lightweight addition worth considering during implementation (not mandated by this plan) is extending that same integration test file with two more cases: buyer A gets `404` on both `POST .../payment-session` and `POST .../cancel` for buyer B's order. This is optional polish, not a gap in the required test plan above.
