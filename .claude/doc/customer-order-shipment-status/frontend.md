# Frontend Implementation Plan: customer-order-shipment-status

Read first: `.claude/sessions/context_session_customer-order-shipment-status.md`, `openspec/changes/customer-order-shipment-status/design.md`, `specs/customer-order-shipping-status/spec.md`, `tasks.md`. This plan covers tasks 4.x and 5.x (frontend UI + tests) only. Backend contract (owned by a separate plan) is assumed to deliver exactly what `design.md` Decisions 1–5 specify.

No React Bootstrap is used anywhere in the storefront — confirmed in `AccountOrderDetailPage.tsx`/`AccountOrdersPage.tsx`, both plain JSX with `storefront-*` BEM-ish classes. Continue that pattern; do not introduce `react-bootstrap` imports.

---

## 1. `frontend/src/pages/storefront/AccountOrderDetailPage.tsx`

### 1.1 New/changed TypeScript interfaces (currently lines 17–40)

Current:
```ts
interface OrderItem {
  id: number;
  productNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  fulfillmentStatus: string;
}

interface OrderDetail {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotalAmount: string;
  shippingAmount: string;
  discountAmount: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  items?: OrderItem[];
}
```

Change to:
```ts
interface Shipment {
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

interface OrderItem {
  id: number;
  productNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface OrderDetail {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  shipments?: Shipment[];
  subtotalAmount: string;
  shippingAmount: string;
  discountAmount: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  items?: OrderItem[];
}
```

Notes:
- Remove `fulfillmentStatus` from both interfaces (backend no longer returns it — `design.md` Decision 4). Grep confirms the current file never renders `item.fulfillmentStatus` or `order.fulfillmentStatus` anywhere in JSX, so removing the field is a pure type-level cleanup with zero JSX impact.
- `shippingStatus` typed as plain `string` (not a literal union) to match the existing convention in this file — `status` and `paymentStatus` are also plain `string`, not unions, even though the backend enum is closed. Keep consistent; do not introduce a union type here unless the reviewer wants stricter typing.
- `shipments` is optional (`?`) because the type is shared conceptually with the list endpoint's leaner payload, and defensively in case of any transient/legacy response — but per Decision 5 the detail endpoint always includes it. Guard with `order.shipments && order.shipments.length > 0` in JSX regardless.
- Field nullability (`string | null`) matches `design.md`'s explicit whitelist shape: `{ status, carrier, trackingNumber, trackingUrl, shippedAt, deliveredAt }` — `carrier`/`trackingNumber`/`trackingUrl` are admin-entered optional fields on `Shipment`, `shippedAt`/`deliveredAt` are only set once that lifecycle event has occurred.

### 1.2 `orderBadgeClass` helper (lines 42–51) — recommended extension

Current function only special-cases `deliver|complet|paid` → success and `pend|process|ship` → pending; anything else (including the literal new value `"Problem"`) falls through to the bare `storefront-account__badge` (neutral/gray) class. This is not visually wrong (task 4.2 only says "reusing `orderBadgeClass`"), but a `Problem` shipping status rendering as a neutral gray badge undersells that something needs the customer's attention. Recommended minimal, additive change (does not alter behavior for any existing status string, since `"problem"` cannot match any existing branch):

```ts
function orderBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'problem') {
    return 'storefront-account__badge storefront-account__badge--error';
  }
  if (normalized.includes('deliver') || normalized.includes('complet') || normalized.includes('paid')) {
    return 'storefront-account__badge storefront-account__badge--success';
  }
  if (normalized.includes('pend') || normalized.includes('process') || normalized.includes('ship')) {
    return 'storefront-account__badge storefront-account__badge--pending';
  }
  return 'storefront-account__badge';
}
```

This same function is duplicated verbatim in `AccountOrdersPage.tsx` (lines 8–17) — apply the identical edit there too, so the two pages render `Problem` identically (see §2.2 below).

New CSS needed in `frontend/src/styles/storefront.css`, immediately after `.storefront-account__badge--pending` (lines 2420–2424), mirroring the existing `--success`/`--pending` pattern and using the project's existing `--color-error` design token (already used at line 2494 `.storefront-account__remove-btn:hover`):

```css
.storefront-account__badge--error {
  border-color: #f0b8b8;
  color: var(--color-error);
  background: var(--color-error-bg);
}
```

`--color-error` / `--color-error-bg` are already defined in `src/index.css` and already used in this same file (`.storefront-account__confirm` uses `--color-error-bg`, `.storefront-account__remove-btn:hover` uses `--color-error`) — reusing them keeps the new badge visually consistent with existing error/destructive UI without inventing new colors, satisfying the "colors from `src/index.css`" rule.

**If the implementer chooses not to add this CSS/JS change**, `Problem` will still render correctly and pass all listed tests (badge just uses the plain gray class) — flag this as optional polish, not a blocking requirement, since it isn't in `tasks.md` 4.x explicitly. But it is recommended because a shipping "Problem" that looks identical to "Preparing" defeats the UX purpose of this feature.

### 1.3 New "Shipping" section — exact insertion point and JSX

Current structure (line numbers as read):
- Lines 163–167: `storefront-account__order-meta` block (date, status badge, payment badge).
- Lines 169–256: `{order.status === 'PendingPayment' && (...)}` pending-payment actions block.
- Line 258 onward: `{order.items && order.items.length > 0 && (...)}` items table.

Insert the new Shipping section **as a sibling immediately after the closing `)}` of the pending-payment block (after line 256) and before the items-table block (before line 258)**. Because the two blocks are gated on exactly opposite conditions (`status === 'PendingPayment'` vs. `status !== 'PendingPayment'`), they are mutually exclusive — never rendered at the same time — so there is no visual collision regardless of which one is written first in JSX source order. Placing the new block right after the existing one keeps the diff minimal (pure insertion, no need to touch the existing block) and preserves the intended reading order: meta → (pending actions OR shipping info) → items table.

Exact insertion (new code, to be placed between line 256 `)}` and line 258 `{order.items && ...`):

```tsx
      {order.status !== 'PendingPayment' && (
        <div className="storefront-account__shipping" data-testid="shipping-section">
          <h2 className="storefront-account__panel-title">{t('orderDetail.shipping.title')}</h2>
          <div className="storefront-account__order-meta">
            <span
              className={orderBadgeClass(order.shippingStatus)}
              data-testid="shipping-status-badge"
            >
              {orderStatusLabel(t, order.shippingStatus)}
            </span>
          </div>

          {order.shipments && order.shipments.length > 0 && (
            <ul className="storefront-account__shipping-list">
              {order.shipments.map((shipment, index) => (
                <li
                  key={index}
                  className="storefront-account__shipping-item"
                  data-testid={`shipment-item-${index}`}
                >
                  {shipment.carrier && (
                    <span className="storefront-account__shipping-carrier">{shipment.carrier}</span>
                  )}
                  {shipment.trackingUrl && (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="storefront-account__tracking-link"
                      data-testid={`tracking-link-${index}`}
                    >
                      {shipment.trackingNumber || t('orderDetail.shipping.trackPackage')}
                    </a>
                  )}
                  {shipment.shippedAt && (
                    <span className="storefront-account__shipping-date">
                      {t('orderDetail.shipping.shippedOn', {
                        date: new Date(shipment.shippedAt).toLocaleDateString(),
                      })}
                    </span>
                  )}
                  {shipment.deliveredAt && (
                    <span className="storefront-account__shipping-date">
                      {t('orderDetail.shipping.deliveredOn', {
                        date: new Date(shipment.deliveredAt).toLocaleDateString(),
                      })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
```

Notes on this JSX:
- `key={index}` is acceptable here: `react-app` ESLint config (see `frontend/package.json` `eslintConfig.extends`) does **not** enable `react/no-array-index-key`, and the whitelisted shipment DTO has no stable client-usable id (per `design.md` Decision 2, `id` is deliberately excluded from the customer-safe payload) — index-as-key is the only option and is safe since the list isn't reordered/filtered client-side.
- `shipment.carrier`/`trackingUrl`/`trackingNumber`/`shippedAt`/`deliveredAt` are all nullable — each rendered fragment is individually guarded, so a shipment with e.g. only `status: 'Shipped'` and no carrier/tracking yet still renders (empty `<li>` body except whatever fields are present) without runtime errors.
- The tracking `<a>` uses `target="_blank" rel="noopener noreferrer"` since `trackingUrl` points to an external carrier site — standard security practice for external links, consistent with not exposing `window.opener`.
- `data-testid="shipping-section"` on the wrapper lets tests assert presence/absence in one query. `data-testid="shipping-status-badge"` isolates the badge from the two other badges already in `order-meta` (order status, payment status) so tests can target it unambiguously (there are now 3 elements matching `orderBadgeClass`-generated classes on the page: order status badge, payment status badge, shipping status badge — the `data-testid` disambiguates).
- Reuses `orderStatusLabel(t, ...)` and `orderBadgeClass(...)` exactly as the task requires — no new label-resolution logic.

### 1.4 No changes needed to `useEffect`/handlers

`getMyOrder(...).then((data) => setOrder(data as OrderDetail))` (line 70–72) needs no change — the `as OrderDetail` cast picks up the new fields automatically once the interface is extended; the backend is expected to include `shippingStatus`/`shipments` on every detail response once its side ships. No new state, no new effects, no new service calls are needed — this section is purely rendered from the same `order` object already fetched.

---

## 2. `frontend/src/pages/storefront/AccountOrdersPage.tsx`

### 2.1 List item type (currently inline at line 21)

Current:
```ts
const [orders, setOrders] = useState<Array<{ id: number; orderNumber: string; totalAmount: string; status: string }>>([]);
```

Change to:
```ts
const [orders, setOrders] = useState<Array<{
  id: number;
  orderNumber: string;
  totalAmount: string;
  status: string;
  shippingStatus: string;
}>>([]);
```

Per `design.md` Decision 5, the list endpoint always includes `shippingStatus` (but not the full `shipments[]`) — so this field is not optional here.

### 2.2 `orderBadgeClass` helper (lines 8–17)

Apply the identical extension described in §1.2 above (add the `normalized === 'problem'` branch before the `deliver|complet|paid` check), so `Problem` renders identically on both pages. This is a duplicated helper (not shared/extracted) matching the existing pattern in the codebase — do not extract it into a shared util as part of this change (out of scope; would touch both files' import statements for a cosmetic refactor not requested by `tasks.md`).

### 2.3 Shipping-status badge in the list — exact insertion point

Current list item JSX (lines 49–70):
```tsx
              return (
                <li key={order.id}>
                  <Link to={`/account/orders/${order.id}`} className="storefront-account__list-item">
                    <div>
                      <span className="storefront-account__list-primary">{order.orderNumber}</span>
                      <p className="storefront-account__list-secondary">{statusLabel}</p>
                    </div>
                    <div className="storefront-account__list-meta">
                      <span className="storefront-account__list-price">€{order.totalAmount}</span>
                      <span className={orderBadgeClass(order.status)}>{statusLabel}</span>
                    </div>
                  </Link>
                  {order.status === 'PendingPayment' && (
                    <Link
                      to={`/account/orders/${order.id}`}
                      className="storefront-btn storefront-btn--text storefront-account__list-cta"
                      data-testid={`resume-cta-${order.id}`}
                    >
                      {t('orders.resumePayment')}
                    </Link>
                  )}
                </li>
              );
```

Change to (insert the shipping badge as an additional `<span>` inside `storefront-account__list-meta`, right after the existing order-status badge `<span>`, and add the shipping-status badge's own gate `order.status !== 'PendingPayment'` — this coexists with, does not replace, the existing status badge and the existing "Complete payment"/resume-cta link, which are gated the opposite way):

```tsx
              return (
                <li key={order.id}>
                  <Link to={`/account/orders/${order.id}`} className="storefront-account__list-item">
                    <div>
                      <span className="storefront-account__list-primary">{order.orderNumber}</span>
                      <p className="storefront-account__list-secondary">{statusLabel}</p>
                    </div>
                    <div className="storefront-account__list-meta">
                      <span className="storefront-account__list-price">€{order.totalAmount}</span>
                      <span className={orderBadgeClass(order.status)}>{statusLabel}</span>
                      {order.status !== 'PendingPayment' && (
                        <span
                          className={orderBadgeClass(order.shippingStatus)}
                          data-testid={`shipping-badge-${order.id}`}
                        >
                          {orderStatusLabel(t, order.shippingStatus)}
                        </span>
                      )}
                    </div>
                  </Link>
                  {order.status === 'PendingPayment' && (
                    <Link
                      to={`/account/orders/${order.id}`}
                      className="storefront-btn storefront-btn--text storefront-account__list-cta"
                      data-testid={`resume-cta-${order.id}`}
                    >
                      {t('orders.resumePayment')}
                    </Link>
                  )}
                </li>
              );
```

Notes:
- `data-testid={`shipping-badge-${order.id}`}` mirrors the existing `resume-cta-${order.id}` naming convention already used in this same file for the pending-payment CTA — keeps test-id conventions consistent within the file.
- Because `order.status !== 'PendingPayment'` and `order.status === 'PendingPayment'` are exact opposite gates on the same field, exactly one of {shipping badge, resume CTA} renders per order — this is the "alongside, not replacing" requirement satisfied structurally, not just by convention.
- No new CSS class is strictly required for layout (the badge reuses `.storefront-account__badge*`), but since `storefront-account__list-meta` is a flex container (per `.storefront-account__list-meta` CSS, line ~2361), two adjacent `<span>` badges will already lay out side-by-side/stacked per existing flex rules — verify visually in `/verify` or manual dev-server check after implementation, but no plan-time CSS change is required here (unlike the `--error` badge variant in §1.2, which is a genuinely new class).

---

## 3. i18n: `frontend/src/i18n/locales/{es,en}/account.json`

### 3.1 `status` block — add three new keys (both files)

Current `status` block (identical shape in both locales, only values differ) ends with `"Refunded"`. Add `Preparing`, `InTransit`, `Problem` — placed here (not alphabetized; matches this file's existing non-alphabetical key ordering).

**`es/account.json`** (edit inside the existing `"status"` object, lines 131–142):
```json
  "status": {
    "Paid": "Pagado",
    "PendingPayment": "Pago pendiente",
    "Failed": "Fallido",
    "Pending": "Pendiente",
    "Processing": "En proceso",
    "Preparing": "Preparando",
    "Shipped": "Enviado",
    "InTransit": "En tránsito",
    "Delivered": "Entregado",
    "Problem": "Incidencia",
    "Cancelled": "Cancelado",
    "Completed": "Completado",
    "Refunded": "Reembolsado"
  }
```

**`en/account.json`** (edit inside the existing `"status"` object, lines 131–142):
```json
  "status": {
    "Paid": "Paid",
    "PendingPayment": "Pending payment",
    "Failed": "Failed",
    "Pending": "Pending",
    "Processing": "Processing",
    "Preparing": "Preparing",
    "Shipped": "Shipped",
    "InTransit": "In transit",
    "Delivered": "Delivered",
    "Problem": "Issue",
    "Cancelled": "Cancelled",
    "Completed": "Completed",
    "Refunded": "Refunded"
  }
```

`orderStatusLabel(t, status)` does `t(\`status.${status}\`, { defaultValue: status })` — since `shippingStatus` values (`Preparing|Shipped|InTransit|Delivered|Problem`) are looked up in the exact same `status.*` namespace as order/payment status (`Paid|PendingPayment|...`), and none of the keys collide (`Shipped`/`Delivered` already existed and are reused as-is per the task description — no duplicate-key risk), this single flat `status` object correctly serves all three badge kinds (order status, payment status, shipping status) with zero code branching.

### 3.2 `orderDetail` block — add a `shipping` sub-object (both files)

Add a new `"shipping"` key as a sibling of `"table"` inside `"orderDetail"` (after the `table` block, before the closing `}` of `orderDetail` — i.e. right after line 98 `}` that closes `table`, before line 99 `}` that closes `orderDetail`).

**`es/account.json`**, inside `orderDetail`, after the `table` object:
```json
    "shipping": {
      "title": "Envío",
      "trackPackage": "Seguir envío"
    }
```
(and add a trailing comma after the `table` object's closing `}` at line 98 to accommodate the new sibling key.)

Also add two interpolation keys used by the JSX in §1.3 (`shippedOn`, `deliveredOn`), nested under the same `shipping` object:
```json
    "shipping": {
      "title": "Envío",
      "trackPackage": "Seguir envío",
      "shippedOn": "Enviado el {{date}}",
      "deliveredOn": "Entregado el {{date}}"
    }
```

**`en/account.json`**, same structure:
```json
    "shipping": {
      "title": "Shipping",
      "trackPackage": "Track package",
      "shippedOn": "Shipped on {{date}}",
      "deliveredOn": "Delivered on {{date}}"
    }
```

Full resulting `orderDetail` block shape for both files (for clarity, showing the edit in context — `es` shown, `en` mirrors with English strings):
```json
  "orderDetail": {
    "title": "Detalle del pedido",
    "titleWithNumber": "Pedido {{orderNumber}}",
    "back": "← Volver a pedidos",
    "actions": { "...": "... (unchanged)" },
    "errors": { "...": "... (unchanged)" },
    "table": { "...": "... (unchanged)" },
    "shipping": {
      "title": "Envío",
      "trackPackage": "Seguir envío",
      "shippedOn": "Enviado el {{date}}",
      "deliveredOn": "Entregado el {{date}}"
    }
  },
```

Task 4.4 only explicitly asks for a "short Shipping section heading key" — the plan adds `trackPackage`/`shippedOn`/`deliveredOn` too because the JSX in §1.3 references them (`t('orderDetail.shipping.trackPackage')`, `t('orderDetail.shipping.shippedOn', {...})`, `t('orderDetail.shipping.deliveredOn', {...})`); omitting them would make those `t()` calls fall back to raw key strings with no `defaultValue`, which is a silent i18n bug. Both `es` and `en` files must be updated together (the project has no fallback-only-in-one-locale convention — `fallbackLng: 'es'` per `docs/frontend-standards.md`, but tests explicitly render with `lng: 'en'`, so `en/account.json` must have real strings, not rely on Spanish fallback).

---

## 4. Test plan: `frontend/src/pages/storefront/__tests__/AccountOrderDetailPage.test.tsx`

### 4.1 Existing state to preserve

7 existing tests all pass today, driven by `mockGetMyOrder.mockResolvedValue(pendingOrder)` or a variant (`{ ...pendingOrder, status: 'Paid' }`, `{ ...pendingOrder, status: 'Cancelled', ... }`). `pendingOrder` (lines 50–63) currently has `fulfillmentStatus: 'NotStarted'` and no `shippingStatus`/`shipments` fields.

**Backward compatibility check**: `pendingOrder` is a plain untyped object literal; it flows into the component via `getMyOrder(...).then((data) => setOrder(data as OrderDetail))` — a type **assertion** (`as`), not a structural type check, so:
- Extra properties (`fulfillmentStatus`, now removed from the `OrderDetail` interface per §1.1) on the mock object are **not** a TypeScript error — `as` assertions don't run excess-property checks. No existing test fixture needs to change to compile.
- Missing properties (`shippingStatus`, `shipments` — not present on `pendingOrder` today) are also not a TypeScript error for the same reason (an `as` cast doesn't require the source object to satisfy the target type). At runtime, `order.shippingStatus` will simply be `undefined` for the 7 existing tests unless a test explicitly needs the new section — and since all 7 existing tests exercise `status === 'PendingPayment'` or a non-`'Paid'`/`'Cancelled'` variant that never asserts on `shippingStatus`, `orderStatusLabel(t, undefined)` is never called by any of the 7 pre-existing tests **except** the one test that already switches to `status: 'Paid'` (test 2, "hides both actions for a non-pending order (Paid)") — that test will now, with the new JSX, additionally render the Shipping section (since `'Paid' !== 'PendingPayment'`) with `order.shippingStatus === undefined`. `orderStatusLabel(t, undefined)` → `t('status.undefined', { defaultValue: undefined })` → i18next returns `undefined` as the default is itself `undefined`... **this is worth flagging explicitly**:

  **Action required**: extend `pendingOrder`'s spread in that specific existing test (or add `shippingStatus` to the base `pendingOrder` fixture) so the Shipping section doesn't render with an `undefined` label in a pre-existing test. Simplest safe fix: add `shippingStatus: 'Preparing'` and `shipments: []` to the base `pendingOrder` fixture object itself (lines 50–63) — since `pendingOrder`'s default `status` is `'PendingPayment'`, the Shipping section stays hidden for the majority of tests that use `pendingOrder` as-is (gated on `status !== 'PendingPayment'`), and the one test that overrides `status: 'Paid'` will then have a defined, valid `shippingStatus: 'Preparing'` to render — assert nothing new in that test (it doesn't currently check shipping content), but it will no longer render an undefined label. This is a **one-line addition to the existing fixture**, not a breaking change to any assertion.

  Updated fixture (lines 50–63), diff-style:
  ```ts
  const pendingOrder = {
    id: 1,
    orderNumber: 'ORD-001',
    status: 'PendingPayment',
    paymentStatus: 'Pending',
    shippingStatus: 'Preparing',
    shipments: [],
    subtotalAmount: '29.99',
    shippingAmount: '0',
    discountAmount: '0',
    totalAmount: '29.99',
    currency: 'EUR',
    createdAt: new Date().toISOString(),
    items: [],
  };
  ```
  (`fulfillmentStatus: 'NotStarted'` removed — no longer part of the interface and never asserted on by any existing test; safe to delete. If preferred, it can also be left in harmlessly since it's just extra data on an untyped object — but removing it keeps the fixture honest relative to the real API contract post-change.)

  Also check the "cancel flow success" test (line 118–126): `mockCancelOrder.mockResolvedValue({ ...pendingOrder, status: 'Cancelled', fulfillmentStatus: 'Cancelled' })` — with `pendingOrder` now including `shippingStatus: 'Preparing'`, the spread carries it through unchanged (still `'Preparing'`), and `status: 'Cancelled' !== 'PendingPayment'` is true, so the Shipping section **will** render after cancel-success in this test. It renders harmlessly (badge + no shipments list since `shipments: []`) and the test's only assertion is `expect(screen.queryByTestId('btn-cancel-order')).not.toBeInTheDocument()` — unaffected. No change needed to this test beyond the shared fixture edit above. Leave the stray `fulfillmentStatus: 'Cancelled'` override in place or remove it; either way it's inert (excess property, not read by any code).

### 4.2 New test cases to add (new `describe` block, e.g. `describe('AccountOrderDetailPage - shipping status', () => { ... })`, appended after the existing `describe` block, same file)

```tsx
describe('AccountOrderDetailPage - shipping status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStripeConfig.mockResolvedValue({ publishableKey: 'pk_test_123', mode: 'test' });
    mockLoadStripe.mockResolvedValue({});
  });

  it('hides the shipping section while the order is PendingPayment', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    renderPage();
    expect(await screen.findByTestId('btn-resume-payment')).toBeInTheDocument();
    expect(screen.queryByTestId('shipping-section')).not.toBeInTheDocument();
  });

  it('shows the shipping badge and a tracking link for a Paid order with a Shipped shipment', async () => {
    mockGetMyOrder.mockResolvedValue({
      ...pendingOrder,
      status: 'Paid',
      shippingStatus: 'Shipped',
      shipments: [
        {
          status: 'Shipped',
          carrier: 'GLS',
          trackingNumber: 'GLS123456',
          trackingUrl: 'https://tracking.example.com/GLS123456',
          shippedAt: '2026-07-01T00:00:00.000Z',
          deliveredAt: null,
        },
      ],
    });
    renderPage();
    expect(await screen.findByTestId('shipping-section')).toBeInTheDocument();
    expect(screen.getByTestId('shipping-status-badge')).toHaveTextContent(/shipped/i);
    const trackingLink = screen.getByTestId('tracking-link-0');
    expect(trackingLink).toHaveAttribute('href', 'https://tracking.example.com/GLS123456');
    expect(trackingLink).toHaveTextContent('GLS123456');
  });

  it('shows Problem status when a shipment is Failed', async () => {
    mockGetMyOrder.mockResolvedValue({
      ...pendingOrder,
      status: 'Paid',
      shippingStatus: 'Problem',
      shipments: [
        {
          status: 'Failed',
          carrier: 'GLS',
          trackingNumber: null,
          trackingUrl: null,
          shippedAt: null,
          deliveredAt: null,
        },
      ],
    });
    renderPage();
    expect(await screen.findByTestId('shipping-status-badge')).toHaveTextContent(/issue/i);
  });
});
```

Notes:
- All three follow `testing-library/prefer-find-by` (`findByTestId` on the first assertion after render; subsequent synchronous `getByTestId` calls on the same already-resolved render are fine per the existing file's own pattern — see the existing "resume flow success" test, which does `await screen.findByTestId('btn-resume-payment')` once, then plain `screen.getByTestId(...)` afterward).
- Test 2 asserts `/shipped/i` against the **English** label ("Shipped") since `renderPage()` uses `renderWithI18n(..., { lng: 'en' })` (line 72) — matches `en/account.json`'s `status.Shipped: "Shipped"` (pre-existing key, unchanged).
- Test 3 asserts `/issue/i` matching the new `en/account.json` `status.Problem: "Issue"` string proposed in §3.1. If the implementer picks different English wording for `Problem`, update this regex to match — keep them in sync.
- `mockLoadStripe`/`mockGetStripeConfig` mocks are configured in `beforeEach` here too (module-level `const` + explicit `.mockResolvedValue()` per test, not inline in the `jest.mock(...)` factory) — this matches the file's existing pattern exactly (see lines 77–81) and avoids the CRA `resetMocks: true` gotcha (mock factories in `jest.mock()` must return plain function delegates like `(...args) => mockX(...args)`; the actual resolved-value configuration must happen in `beforeEach`/test body, because `resetMocks: true` wipes `mockResolvedValue` configuration between tests but does not replace the `jest.fn()` instances themselves — the existing file already does this correctly, just continue the pattern, do not switch to inline `.mockResolvedValue()` inside `jest.mock()`).
- None of these three tests touch `resumeOrderPayment`/`cancelOrder` — no new mocks are needed; `shippingStatus`/`shipments` arrive as plain fields on the object returned by the already-mocked `getMyOrder`.

### 4.3 Verification

Run `npx eslint src --ext .ts,.tsx` in `frontend/` after adding these tests (per `docs/frontend-standards.md` "ESLint Configuration" / `ai-specs/agents/frontend-developer.md` RTL standards) and `CI=true npm test -- --testPathPattern=AccountOrderDetailPage` (or equivalent) to confirm 7 (updated) + 3 (new) = 10 tests pass.

---

## 5. Test plan: `frontend/src/pages/storefront/__tests__/AccountOrdersPage.test.tsx`

### 5.1 Existing state to preserve

2 existing tests use `mockListMyOrders.mockResolvedValue([{ id, orderNumber, totalAmount, status }])` — no `shippingStatus` field on either fixture object today.

**Backward compatibility check**: `AccountOrdersPage`'s `orders` state is typed inline (`useState<Array<{...}>>`) and populated via `listMyOrders().then((items) => setOrders(items as typeof orders))` (line 26) — again an `as` assertion, so missing `shippingStatus` on the two existing fixtures is not a compile error. At runtime:
- Test 1 (`status: 'PendingPayment'`): the new shipping badge is gated on `order.status !== 'PendingPayment'`, which is `false` here, so the badge never renders and `order.shippingStatus` (`undefined`) is never read. **No change needed to this test's fixture.**
- Test 2 (`status: 'Paid'`): `'Paid' !== 'PendingPayment'` is `true`, so with the new JSX this order **will** render a shipping badge, calling `orderStatusLabel(t, undefined)` since the fixture has no `shippingStatus`. Same `undefined`-label problem as §4.1.

  **Action required**: add `shippingStatus: 'Preparing'` (or any valid value) to test 2's fixture object:
  ```ts
  mockListMyOrders.mockResolvedValue([
    { id: 2, orderNumber: 'ORD-002', totalAmount: '19.99', status: 'Paid', shippingStatus: 'Preparing' },
  ]);
  ```
  This is a one-field addition to an existing fixture; the test's existing assertions (`findByText('ORD-002')`, `queryByTestId('resume-cta-2')` absent) are unaffected and still pass — it doesn't yet assert anything about the shipping badge, which is fine since that's covered by the new tests below.

### 5.2 New test cases to add (new `describe` block appended after the existing one)

```tsx
describe('AccountOrdersPage - shipping status badge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a shipping-status badge for non-pending orders', async () => {
    mockListMyOrders.mockResolvedValue([
      { id: 3, orderNumber: 'ORD-003', totalAmount: '49.99', status: 'Paid', shippingStatus: 'Shipped' },
    ]);
    renderPage();
    expect(await screen.findByTestId('shipping-badge-3')).toHaveTextContent(/shipped/i);
  });

  it('hides the shipping-status badge for PendingPayment orders', async () => {
    mockListMyOrders.mockResolvedValue([
      { id: 4, orderNumber: 'ORD-004', totalAmount: '15.00', status: 'PendingPayment', shippingStatus: 'Preparing' },
    ]);
    renderPage();
    expect(await screen.findByTestId('resume-cta-4')).toBeInTheDocument();
    expect(screen.queryByTestId('shipping-badge-4')).not.toBeInTheDocument();
  });
});
```

Notes:
- Uses fresh `id`s (3, 4) distinct from the existing tests' `id`s (1, 2) — not required for isolation (each test has its own `mockListMyOrders.mockResolvedValue` call and RTL unmounts between tests), but avoids any confusion when reading test output/data-testids side by side.
- First assertion in each test is `findBy*` per `testing-library/prefer-find-by` — consistent with the existing 2 tests in this file (which already use `findByTestId`/`findByText`).
- No `beforeEach` mock re-configuration is needed beyond `jest.clearAllMocks()` since `mockListMyOrders` is configured freshly inside each `it(...)` body (matches the existing file's pattern exactly — see lines 32–51).

### 5.3 Verification

Run `npx eslint src --ext .ts,.tsx` and the AccountOrdersPage test file; confirm 2 (updated) + 2 (new) = 4 tests pass.

---

## 6. Summary of all files touched by this plan

| File | Change |
|---|---|
| `frontend/src/pages/storefront/AccountOrderDetailPage.tsx` | Add `Shipment` interface; remove `fulfillmentStatus` from `OrderItem`/`OrderDetail`; add `shippingStatus`/`shipments` to `OrderDetail`; extend `orderBadgeClass` with `problem` case; insert new Shipping section JSX after the pending-payment-actions block |
| `frontend/src/pages/storefront/AccountOrdersPage.tsx` | Add `shippingStatus` to inline list-item type; extend `orderBadgeClass` with `problem` case; render shipping badge in `storefront-account__list-meta`, gated on `status !== 'PendingPayment'` |
| `frontend/src/styles/storefront.css` | Add `.storefront-account__badge--error` (optional but recommended, after line 2424) |
| `frontend/src/i18n/locales/es/account.json` | Add `status.Preparing`/`InTransit`/`Problem`; add `orderDetail.shipping.{title,trackPackage,shippedOn,deliveredOn}` |
| `frontend/src/i18n/locales/en/account.json` | Same keys, English strings |
| `frontend/src/pages/storefront/__tests__/AccountOrderDetailPage.test.tsx` | Add `shippingStatus: 'Preparing'`/`shipments: []` to base `pendingOrder` fixture; add new `describe('AccountOrderDetailPage - shipping status', ...)` block with 3 tests |
| `frontend/src/pages/storefront/__tests__/AccountOrdersPage.test.tsx` | Add `shippingStatus: 'Preparing'` to the existing `'Paid'` fixture; add new `describe('AccountOrdersPage - shipping status badge', ...)` block with 2 tests |

Total test count after this change: `AccountOrderDetailPage.test.tsx` 7 → 10; `AccountOrdersPage.test.tsx` 2 → 4. No existing assertions change in meaning; two existing fixtures gain one harmless extra field each to avoid an `undefined`-label render in the new always-rendered (once non-pending) Shipping UI.

Do not forget: `npx tsc --noEmit` and `npx eslint src --ext .ts,.tsx` (both from `frontend/`) must pass before this is considered done, per `tasks.md` 4.5 and `ai-specs/agents/frontend-developer.md`'s RTL/ESLint standards.
