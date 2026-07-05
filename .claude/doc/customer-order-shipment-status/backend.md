# Backend Implementation Plan: customer-order-shipment-status

Scope: `backend/` only. No Prisma schema changes (confirmed: `Shipment` model at
`backend/prisma/schema.prisma:253-272` already has everything needed — `status String`,
`carrier String?`, `trackingNumber String?`, `trackingUrl String?`, `shippedAt DateTime?`,
`deliveredAt DateTime?`, plus `supplierOrderId Int?`/`supplierOrder` which must never be
selected/returned on this code path).

All changes are read-side, concentrated in one file:
`backend/src/presentation/controllers/customerAccountController.ts` (currently 199 lines).
No changes to `backend/src/routes/public/accountRoutes.ts` (no new routes).

---

## 1. `deriveShippingStatus(shipments)`

**Placement:** co-located in `customerAccountController.ts`, matching the existing pattern
where `toPublicOrder` is a local helper in this same file (design.md Decision 2 explicitly
calls for co-location, and there is no existing "helpers" module for this controller to
justify a new file). **Deviation from today's `toPublicOrder` (which is unexported):** this
function, `toPublicShipment`, and `toPublicOrder` must all become `export`ed (change
`function toPublicOrder(` at line 9 to `export function toPublicOrder(`), because there is
no existing unit-test file for this controller and the codebase's established precedent for
testing allow-list mappers is to export them directly and import them in a test file (see
`backend/src/presentation/serializers/shipmentSerializer.ts`'s `serializeShipment` and its
sibling pattern in `backend/src/presentation/serializers/__tests__/publicReview.test.ts`
importing `serializePublicReview`/`serializeOwnReview` directly — no prisma mocking needed
for pure mapper tests). This avoids inventing a new file/module the codebase has no
precedent for.

**Add near the top of the file** (after the existing imports, before `toPublicOrder`, i.e.
after line 7):

```ts
import { ShipmentStatus } from '../../domain/models/shipment';

export type CustomerShippingStatus = 'Preparing' | 'Shipped' | 'InTransit' | 'Delivered' | 'Problem';

export function deriveShippingStatus(shipments: Array<{ status: ShipmentStatus }>): CustomerShippingStatus {
  if (shipments.length === 0 || shipments.every((s) => s.status === 'Pending')) {
    return 'Preparing';
  }
  if (shipments.some((s) => s.status === 'Failed' || s.status === 'Returned')) {
    return 'Problem';
  }
  if (shipments.every((s) => s.status === 'Delivered')) {
    return 'Delivered';
  }
  if (shipments.some((s) => s.status === 'InTransit')) {
    return 'InTransit';
  }
  if (shipments.some((s) => s.status === 'Shipped')) {
    return 'Shipped';
  }
  return 'Preparing';
}
```

**Precedence notes matching design.md Decision 1 exactly (first match wins, in this order):**
1. empty array OR every shipment `Pending` → `Preparing`
2. any `Failed`/`Returned` → `Problem` (checked *before* Delivered, so one bad shipment beats an otherwise-all-delivered order)
3. every shipment (non-empty, guaranteed by step 1 already returning) `Delivered` → `Delivered`
4. any `InTransit` → `InTransit`
5. any `Shipped` → `Shipped`
6. fallback → `Preparing` (covers mixed states matching none of the above, e.g. `[Pending, Delivered]` — one delivered + one still pending is not "every Delivered" and not any of Failed/Returned/InTransit/Shipped, so per the literal spec it falls back to `Preparing`; this is intentional per design.md's stated precedence, not a bug — cover it explicitly in tests, see §5)

**Type mismatch to handle at call sites:** Prisma's `Shipment.status` column is `String`
(schema.prisma:262: `status String @default("Pending")`), not a native enum, so a
Prisma-returned row's `status` field types as `string`, not the `ShipmentStatus` literal
union. At both call sites in `listOrders`/`getOrderById`/`toPublicOrder`, cast once when
invoking: `deriveShippingStatus((order.shipments ?? []) as Array<{ status: ShipmentStatus }>)`.
Do not weaken the function's own parameter type to `string` — keeping it typed to
`ShipmentStatus` is what makes the precedence-case unit tests exhaustive/meaningful (exact
match against design.md's `ShipmentStatus` union: `Pending | Shipped | InTransit | Delivered
| Failed | Returned`, per `backend/src/domain/models/shipment.ts:1-7`).

---

## 2. `toPublicShipment(shipment)`

**Add directly below `deriveShippingStatus`, still in `customerAccountController.ts`:**

```ts
export function toPublicShipment(shipment: {
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
}) {
  return {
    status: shipment.status,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
  };
}
```

**Why this is a real allow-list, not just a type annotation:** the parameter type
deliberately omits `id`, `customerOrderId`, `supplierOrderId`, `supplierOrder` — but because
TypeScript performs structural typing on variables (not object literals), a caller could
still pass a full Prisma `Shipment` row (which *does* have those extra fields) and it would
type-check fine. The actual safety comes from the **return statement**, which explicitly
enumerates exactly 6 fields and never spreads (`...shipment`) or forwards anything else. This
is the same allow-list technique already used in `shipmentSerializer.ts`'s
`serializeShipment` (which does the opposite — it *deliberately* includes
`supplierOrderId`/`supplierOrder`, confirming that file is the wrong pattern to reuse here)
and in `publicReview.ts`'s `serializePublicReview`.

Do **not** import or reuse anything from `backend/src/presentation/serializers/shipmentSerializer.ts`
— confirmed it returns `supplierOrderId: shipment.supplierOrderId` and
`supplierOrder: shipment.supplierOrder` (lines 23, 33), which is exactly what must never
reach the customer-facing response.

---

## 3. Changes to `toPublicOrder`

**Current signature/behavior (lines 9-62):** one function, called from 4 places —
`listOrders` (line 114, via `items.map(toPublicOrder)`), `getOrderById` (line 130),
`resumeOrderPayment` (line 145), `cancelOrder` (line 157). The latter two pass a
`CustomerOrder` *domain model* instance (from `customerOrderService`), cast via
`order as unknown as Parameters<typeof toPublicOrder>[0]` — that domain model
(`backend/src/domain/models/customerOrder.ts:87-155`) has **no `shipments` field at all**
(only `items?: CustomerOrderItem[]`), and these two endpoints only ever operate on orders in
`PendingPayment` (enforced by `validatePendingOrderPayable`/`validatePendingOrderCancellable`
before either function runs), so in practice `order.shipments` will be `undefined` there —
which is consistent with design.md Decision 6 (shipping status is only meaningful once
`status !== 'PendingPayment'`).

**Recommendation: keep a single `toPublicOrder` function with an `options` parameter,
rather than splitting into two functions.** Splitting into `toPublicOrderSummary`/
`toPublicOrderDetail` would duplicate the amounts/address/items-mapping logic identically
in two places for no benefit — the *only* difference between list and detail shape is
whether the `shipments` array key is present. An options flag keeps one source of truth and
matches tasks.md 2.3's wording ("wire it into `toPublicOrder`" — singular).

**New signature:**

```ts
function toPublicOrder(
  order: {
    id: number;
    orderNumber: string;
    customerId: number;
    status: string;
    paymentStatus: string;
    subtotalAmount: { toString(): string };
    shippingAmount: { toString(): string };
    discountAmount: { toString(): string };
    totalAmount: { toString(): string };
    currency: string;
    shippingAddressSnapshot: unknown;
    billingAddressSnapshot: unknown;
    createdAt: Date;
    items?: Array<{
      id: number;
      productVariantId: number;
      productNameSnapshot: string;
      variantSnapshot: unknown;
      skuSnapshot: string;
      quantity: number;
      unitPrice: { toString(): string };
      totalPrice: { toString(): string };
    }>;
    shipments?: Array<{
      status: string;
      carrier: string | null;
      trackingNumber: string | null;
      trackingUrl: string | null;
      shippedAt: Date | null;
      deliveredAt: Date | null;
    }>;
  },
  options: { includeShipments?: boolean } = {}
) {
  const shipments = order.shipments ?? [];
  const shippingStatus = deriveShippingStatus(shipments as Array<{ status: ShipmentStatus }>);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    shippingStatus,
    subtotalAmount: order.subtotalAmount.toString(),
    shippingAmount: order.shippingAmount.toString(),
    discountAmount: order.discountAmount.toString(),
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    shippingAddressSnapshot: order.shippingAddressSnapshot,
    billingAddressSnapshot: order.billingAddressSnapshot,
    createdAt: order.createdAt,
    items: order.items?.map((item) => ({
      id: item.id,
      productVariantId: item.productVariantId,
      productNameSnapshot: item.productNameSnapshot,
      variantSnapshot: item.variantSnapshot,
      skuSnapshot: item.skuSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
    })),
    ...(options.includeShipments !== false && { shipments: shipments.map(toPublicShipment) }),
  };
}
```

**Exact removals (confirmed at these current line numbers before edit):**
- Line 15: remove `fulfillmentStatus: string;` from the order-level input type.
- Line 33: remove `fulfillmentStatus: string;` from the item input type.
- Line 41: remove `fulfillmentStatus: order.fulfillmentStatus,` from the returned object.
- Line 59: remove `fulfillmentStatus: item.fulfillmentStatus,` from the item mapping.

**Default behavior of `includeShipments`:** default to **including** `shipments` (i.e. the
key is present unless `options.includeShipments === false`). This makes `getOrderById`,
`resumeOrderPayment`, and `cancelOrder` all keep today's call signature `toPublicOrder(order)`
unchanged and automatically detail-shaped (per design.md Decision 5, detail gets the full
array; list is the one exception that must opt out). Only `listOrders` needs an explicit
call-site change.

**Call-site changes:**
- `listOrders` (line 114): change `items.map(toPublicOrder)` to
  `items.map((order) => toPublicOrder(order, { includeShipments: false }))`.
- `getOrderById` (line 130): no signature change needed — `toPublicOrder(order)` already
  includes `shipments` by default once the Prisma `include` is updated (§4).
- `resumeOrderPayment` (line 145) / `cancelOrder` (line 157): no change needed. The existing
  cast `order as unknown as Parameters<typeof toPublicOrder>[0]` still works because
  `shipments` is optional in the new type; `order.shipments` will simply be `undefined` →
  `shipments ?? []` → `shippingStatus: 'Preparing'`, `shipments: []` in the response. This is
  correct: these two endpoints only ever act on `PendingPayment` orders, which by definition
  have no shipments yet.

---

## 4. Prisma `include`/`select` changes

**`listOrders` (currently line 108) and `getOrderById` (currently line 127)** both currently
have:
```ts
include: { items: true },
```

**Change both to:**
```ts
include: {
  items: true,
  shipments: {
    select: {
      status: true,
      carrier: true,
      trackingNumber: true,
      trackingUrl: true,
      shippedAt: true,
      deliveredAt: true,
    },
  },
},
```

This is a standard Prisma "include a relation, but scope its own columns via a nested
`select`" pattern — valid alongside a sibling `items: true`. Critically, **`id`,
`customerOrderId`, and `supplierOrderId` are never listed in the nested `select`, so Prisma
never fetches them from the database for this code path at all** — this is the
defense-in-depth layer design.md Decision 3 calls for, independent of the `toPublicShipment`
allow-list in the application layer. Even if a future engineer mistakenly bypasses
`toPublicShipment` (e.g. spreads `...shipment` directly), the leaked object still would not
contain `supplierOrderId`, because it was never selected from Postgres.

This is identical in both `listOrders` and `getOrderById` — same `include` shape in both
places; only the second argument to `toPublicOrder` differs (§3).

---

## 5. Test file plan

### 5a. New unit test file: `backend/src/presentation/controllers/__tests__/customerAccountController.test.ts`

No existing test file for this controller exists yet (confirmed via glob). Follow the
project's `describe('[ComponentName] - [methodName]')` structure
(`docs/backend-standards.md` §Testing Standards, lines 1141-1250) and the pure-function
testing precedent from `backend/src/presentation/serializers/__tests__/publicReview.test.ts`
(no prisma mocking needed — `deriveShippingStatus`/`toPublicShipment`/`toPublicOrder` are
pure functions once exported per §1).

```ts
import {
  deriveShippingStatus,
  toPublicShipment,
  toPublicOrder,
} from '../customerAccountController';
```

**`describe('customerAccountController - deriveShippingStatus')`** — one `it` per
design.md Decision 1 precedence case, mirroring tasks.md 1.1:
- `should return Preparing when shipments array is empty`
- `should return Preparing when every shipment is Pending`
- `should return Problem when any shipment is Failed, regardless of other statuses` — case with `[{status:'Delivered'}, {status:'Failed'}]`
- `should return Problem when any shipment is Returned, regardless of other statuses` — case with `[{status:'Shipped'}, {status:'Returned'}]`
- `should return Delivered when every shipment is Delivered and array is non-empty`
- `should return InTransit when any shipment is InTransit and no Problem and not all Delivered` — cases: `[{status:'Pending'},{status:'InTransit'}]` and `[{status:'InTransit'},{status:'Delivered'}]` (not all delivered)
- `should return Shipped when any shipment is Shipped and no Problem/InTransit and not all Delivered` — cases: `[{status:'Pending'},{status:'Shipped'}]` and `[{status:'Shipped'},{status:'Delivered'}]`
- `should prioritize InTransit over Shipped when both are present` — `[{status:'Shipped'},{status:'InTransit'}]` → `InTransit`
- `should fall back to Preparing for a mixed state matching no other rule` — `[{status:'Pending'},{status:'Delivered'}]` → `Preparing` (documents the literal fallback behavior called out in §1)

**`describe('customerAccountController - toPublicShipment')`** (tasks.md 2.1):
- `should expose only the customer-safe allow-list of fields` — assert
  `Object.keys(toPublicShipment(fixture)).sort()` equals
  `['carrier','deliveredAt','shippedAt','status','trackingNumber','trackingUrl'].sort()`
- `should never emit supplierOrderId, supplierOrder, id, or customerOrderId even when present on the input` —
  build a fixture object literal with extra fields (`{ id: 1, customerOrderId: 5, supplierOrderId: 99, supplierOrder: { id: 99, status: 'Draft' }, status: 'Shipped', carrier: 'DHL', trackingNumber: 'X1', trackingUrl: 'https://t', shippedAt: new Date(), deliveredAt: null }` — note this needs an `as any`/loose cast since the object literal has excess properties relative to the function's parameter type, or build it as a typed superset variable first), call `toPublicShipment`, then
  `expect(JSON.stringify(result)).not.toContain('supplierOrderId')`,
  `.not.toContain('supplierOrder')`, `.not.toContain('customerOrderId')`.
  (Same idiom as `publicReview.test.ts`'s "never emits customerId..." test.)

**`describe('customerAccountController - toPublicOrder')`** (tasks.md 2.1/2.2):
- `should not include fulfillmentStatus at the order level even if present on the input row` —
  pass a fixture order with an extra `fulfillmentStatus: 'Blocked'` property (loosely typed/cast, since it's no longer part of the declared input type), assert `'fulfillmentStatus' in result === false`.
- `should not include fulfillmentStatus on any item even if present on the input row` — same idea for an item with `fulfillmentStatus: 'Fulfilled'`.
- `should always include shippingStatus derived from the order's shipments` — order with one `Shipped` shipment → `result.shippingStatus === 'Shipped'`.
- `should include shippingStatus as Preparing when order.shipments is undefined` (covers the `resumeOrderPayment`/`cancelOrder` call shape) — no `shipments` key on input at all.
- `should include a shipments array by default (detail shape)` — call `toPublicOrder(order)` with no options, assert `result.shipments` is an array and each entry only has the 6 allow-listed keys (reuse the `Object.keys` assertion from the `toPublicShipment` tests).
- `should omit the shipments array when includeShipments is false (list shape)` — call
  `toPublicOrder(order, { includeShipments: false })`, assert `'shipments' in result === false`.
- `should never leak supplierOrderId/supplierOrder through toPublicOrder's shipments mapping` —
  order fixture with a shipment containing `supplierOrderId: 42`; assert
  `JSON.stringify(toPublicOrder(order))` does not contain `'supplierOrderId'`/`'supplierOrder'`.

Use `jest.clearAllMocks()` in `beforeEach` per the standards template even though these are
pure functions with no mocks — keep the file structurally consistent with the rest of the
suite (see `docs/backend-standards.md` lines 1155-1158).

### 5b. Extend `backend/src/routes/public/__tests__/customerOrderIsolation.test.ts` (tasks.md group 3)

This is a real-DB integration test (via `supertest` + the actual `app`, following
`checkoutIntegration.test.ts`'s precedent of importing
`{ prisma } from '../../../infrastructure/prismaClient'` directly for fixture setup — no
mocking in this file today, and it must stay that way).

**Required setup change:** `tokenB` is currently a `const` local only inside `beforeAll`
(line 20) and never exposed outside it. Promote it to an outer `let tokenB: string;`
(alongside the existing `let tokenA: string; let orderIdB: number;` at lines 10-11) and
assign it inside `beforeAll` (`tokenB = regB.body.data.accessToken;` instead of
`const tokenB = ...`), since the new tests need to authenticate **as the order's owner**
(buyer B), not just as the non-owner (buyer A) like the existing tests do.

**Fixture creation (new, inside `beforeAll` or a dedicated `beforeAll`/`it` for this group),
using `prisma` directly** — a `Shipment.supplierOrderId` FK requires a real `SupplierOrder`
row, which in turn requires a real `Supplier` row (schema.prisma:187-206, 28-41):

```ts
const supplier = await prisma.supplier.create({ data: { name: 'Test Supplier' } });
const supplierOrder = await prisma.supplierOrder.create({
  data: {
    supplierOrderNumber: `SO-TEST-${Date.now()}`,
    customerOrderId: orderIdB,
    supplierId: supplier.id,
  },
});
await prisma.shipment.create({
  data: {
    customerOrderId: orderIdB,
    supplierOrderId: supplierOrder.id, // non-null on purpose — this is what must never leak
    status: 'Shipped',
    carrier: 'DHL',
    trackingNumber: 'TRACK123',
    trackingUrl: 'https://track.example.com/TRACK123',
    shippedAt: new Date(),
  },
});
```

Guard this with the same `if (!orderIdB) return;`-style early exit already used by the other
tests in this file (checkout can fail to produce a variant/product in some CI seed states).

**New tests to add:**
- `it('buyer B (owner) sees shippingStatus and whitelisted shipment fields on their own order, with no supplier data anywhere')`:
  `GET /api/public/account/orders/:orderIdB` with `Authorization: Bearer ${tokenB}`; assert
  `res.status === 200`; assert `res.body.data.shippingStatus === 'Shipped'`; assert
  `res.body.data.shipments` is an array with the fixture's `carrier`/`trackingNumber`/
  `trackingUrl` present; assert `JSON.stringify(res.body)` does **not** contain
  `'supplierOrderId'` and does **not** contain `'supplierOrder'` anywhere in the full
  response body (order-level or nested) — this is the core regression test from tasks.md 3.1.
- `it('buyer B sees fulfillmentStatus is no longer present on their own order or its items')`:
  same response body; assert `!('fulfillmentStatus' in res.body.data)` and, if `items` is
  present, assert none of `res.body.data.items` contain `fulfillmentStatus`.
- `it('list endpoint includes shippingStatus but omits the shipments array')` (tasks.md 3.2):
  `GET /api/public/account/orders` as buyer B; find the item matching `orderIdB`; assert it
  has `shippingStatus === 'Shipped'` and `!('shipments' in item)`.
- Leave the existing 3 isolation tests (`unauthenticated`, `buyer A cannot read`, `cannot
  resume payment`, `cannot cancel`) untouched — they still assert 404s and are unaffected by
  this change; they implicitly continue to prove the new fields never leak cross-customer
  either, since a 404 response has no `data` body at all.

### 5c. Verification commands (per backend-developer agent standards)

```
cd backend && npm run lint && npm test -- --watchAll=false --testPathPattern=customerAccountController
cd backend && npm test -- --watchAll=false --testPathPattern=customerOrderIsolation
cd backend && npm run test:coverage
```

Lint note: no new unused params are introduced by this plan (no new Express handler
signatures), so the "prefix unused params with `_`" convention from
`docs/backend-standards.md` doesn't directly apply here — but double-check `toPublicShipment`'s
parameter isn't flagged as `no-explicit-any` (it isn't — it's a fully-typed inline object
type, no `any` used anywhere in this plan).

---

## Out-of-scope reminders for this plan (handled elsewhere per tasks.md)

- `docs/data-model.md` (`CustomerOrder`/`Shipment` sections) and `docs/api-spec.yml`
  (`PublicOrder`/`PublicOrderItem` schemas, `fulfillmentStatus` removal) updates are tasks.md
  group 10 — not implemented by this backend code plan, but must land in the same PR.
- Frontend changes (`AccountOrderDetailPage.tsx`, `AccountOrdersPage.tsx`, i18n) are a
  separate frontend-developer plan (tasks.md groups 4-5).
