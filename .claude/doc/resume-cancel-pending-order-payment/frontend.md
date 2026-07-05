# Frontend Implementation Plan — resume-cancel-pending-order-payment

Grounded in the actual current code (read in full before writing this plan):
- `frontend/src/services/customerAuthService.ts`
- `frontend/src/pages/storefront/AccountOrderDetailPage.tsx`
- `frontend/src/pages/storefront/AccountOrdersPage.tsx`
- `frontend/src/pages/storefront/CheckoutPage.tsx`
- `frontend/src/components/storefront/PaymentForm.tsx`
- `frontend/src/components/storefront/AccountLayout.tsx`
- `frontend/src/services/paymentService.ts`
- `frontend/src/types/auth.ts`
- `frontend/src/i18n/locales/{es,en}/account.json`
- `frontend/src/test-utils/renderWithI18n.tsx`
- `frontend/src/components/storefront/__tests__/PaymentForm.test.tsx`
- `frontend/src/pages/storefront/__tests__/OrderConfirmationPage.test.tsx`, `AccountPage.test.tsx`
- `docs/frontend-standards.md` (Stripe/Elements, i18n, Testing Standards, Admin customer-order panel patterns sections)
- backend contracts described in `openspec/changes/resume-cancel-pending-order-payment/design.md` and `specs/pending-order-payment-actions/spec.md`

**Important correction vs. the task brief:** the storefront (`frontend/src/pages/storefront/**`) does **not** use React Bootstrap anywhere. It is 100% custom presentational markup styled with `storefront-*` BEM-ish classes (`storefront-btn--primary/secondary/text/ghost`, `storefront-account__*`, etc. — see `frontend/src/styles/storefront.css`). React Bootstrap (`Container/Row/Col/Card/Button/Form/Alert`) is only used in the **admin** area (`frontend/src/pages/*.tsx`, `frontend/src/components/admin/*`), which is a separate, hardcoded-Spanish, no-i18n surface (per `docs/frontend-standards.md` § Internationalisation: "Admin components must never call `useTranslation`"). Since this feature lives entirely in the storefront/account area, the plan below uses the storefront's own custom-markup confirmation pattern (mirroring how `CookiePreferencesModal`/admin "delete guard" toggle button visibility — see `docs/frontend-standards.md` § Admin customer-order panel patterns: "delete confirmation modal hides the 'Confirm delete' button... only 'Close' remains") instead of a React Bootstrap `<Modal>`. No new dependency, no new file is required for this — it is an inline conditional block using existing CSS classes.

Assumed backend response envelopes (per `design.md`, mirroring the existing `res.json({ success, data, message })` convention in `customerAccountController.ts` and the existing `getOrderById` handler which returns `data: toPublicOrder(order)` directly, not wrapped in `{ order }`):
- `POST /api/public/account/orders/:id/payment-session` → `{ success: true, data: { order: <PublicOrder>, clientSecret: string }, message }`
- `POST /api/public/account/orders/:id/cancel` → `{ success: true, data: <PublicOrder>, message }` (same shape as `getOrderById`)
- Errors → `{ success: false, error: { code: 'ORDER_NOT_PAYABLE' | 'ORDER_NOT_CANCELLABLE' | 'CUSTOMER_ORDER_NOT_FOUND', message } }`, same `AxiosError<AuthApiError>` shape already used by `extractCustomerAuthError`.

If the backend agent's plan lands on a different envelope for `/cancel` (e.g. `{ order }` wrapper), only the one line unwrapping `res.data.data` in `cancelOrder()` needs adjusting — flag this at integration time.

---

## 1. `frontend/src/services/customerAuthService.ts`

Current file (126 lines) has no imports of `PublicOrder`; `getMyOrder`/`listMyOrders` both type their return as `unknown`/`unknown[]` and let the caller cast. Follow that exact minimal-typing convention — do **not** introduce a new strict `OrderDetail`/`PublicOrder` type dependency here, to stay consistent with `getMyOrder`.

Add after `getMyOrder` (after line 117), before `extractCustomerAuthError`:

```typescript
export async function resumeOrderPayment(id: number): Promise<{ order: unknown; clientSecret: string }> {
  const res = await axios.post<{ data: { order: unknown; clientSecret: string } }>(
    `${API_BASE}/api/public/account/orders/${id}/payment-session`,
    {},
    { headers: authHeaders() }
  );
  return res.data.data;
}

export async function cancelOrder(id: number): Promise<unknown> {
  const res = await axios.post<{ data: unknown }>(
    `${API_BASE}/api/public/account/orders/${id}/cancel`,
    {},
    { headers: authHeaders() }
  );
  return res.data.data;
}
```

Both follow the exact existing pattern used by `getMyOrder`/`listMyOrders`: `axios` call against `API_BASE` (not `AUTH_BASE`, since these are `/account/*` endpoints like `getMyOrder`/`getProfile`), `headers: authHeaders()`, no manual try/catch (errors propagate as `AxiosError` to the caller, exactly as `getMyOrder` does today — `AccountOrderDetailPage.tsx` already does the try/catch at the call site via `.catch()`).

Add a new error-code extractor, **separate from** `extractCustomerAuthError`. Do not extend `extractCustomerAuthError` itself — that function hardcodes English strings and is scoped to login/register flows; the storefront's i18n rule (`docs/frontend-standards.md` § i18n: "Never place UI strings in module-level constants") means order-action error messages must be resolved via `t()` in the component, not hardcoded in the service. So the service should only extract the **code**, and the page maps code → translated string:

```typescript
export function extractOrderActionErrorCode(error: unknown): string {
  return (error as AxiosError<AuthApiError>).response?.data?.error?.code ?? 'UNKNOWN_ERROR';
}
```

This reuses the already-imported `AxiosError`/`AuthApiError` types (no new imports needed).

---

## 2. `frontend/src/pages/storefront/AccountOrderDetailPage.tsx`

Current file is 144 lines: functional component, local `OrderDetail`/`OrderItem` interfaces, single `order`/`error` state, one `useEffect` calling `getMyOrder`.

### New imports (add to the top, alongside existing ones)

```typescript
import { useNavigate } from 'react-router-dom'; // add to existing `{ Link, useParams }` import
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { getMyOrder, resumeOrderPayment, cancelOrder, extractOrderActionErrorCode } from '../../services/customerAuthService';
import { getStripeConfig } from '../../services/paymentService';
import PaymentForm from '../../components/storefront/PaymentForm';
```
(`getMyOrder` is already imported — just extend that same import line with the three new named exports.)

### New state (inside the component, after the existing `order`/`error` state)

```typescript
const navigate = useNavigate();
const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
const [clientSecret, setClientSecret] = useState<string | null>(null);
const [showPayment, setShowPayment] = useState(false);
const [resuming, setResuming] = useState(false);
const [showCancelConfirm, setShowCancelConfirm] = useState(false);
const [cancelling, setCancelling] = useState(false);
const [actionError, setActionError] = useState('');
```

### New effect: lazily load Stripe only when the order is payable

Mirrors `CheckoutPage.tsx`'s `useEffect(() => { getStripeConfig().then(...) }, [])`, but gated on order status so it doesn't fire for orders that will never need it:

```typescript
useEffect(() => {
  if (order?.status !== 'PendingPayment' || stripePromise) return;
  getStripeConfig()
    .then(({ publishableKey }) => setStripePromise(loadStripe(publishableKey)))
    .catch(() => setActionError(t('orderDetail.errors.resumeFailed')));
}, [order?.status, stripePromise, t]);
```

### New handlers (place after the existing `useEffect`, before the `if (error)` early return)

```typescript
const refreshOrder = () => {
  if (!id) return;
  getMyOrder(Number(id)).then((data) => setOrder(data as OrderDetail));
};

const handleResumePayment = async () => {
  if (!order) return;
  setActionError('');
  setResuming(true);
  try {
    const result = await resumeOrderPayment(order.id);
    setClientSecret(result.clientSecret);
    setShowPayment(true);
  } catch (err) {
    const code = extractOrderActionErrorCode(err);
    setActionError(t(`orderDetail.errors.${code}`, { defaultValue: t('orderDetail.errors.resumeFailed') }));
  } finally {
    setResuming(false);
  }
};

const handlePaymentSuccess = () => {
  // Same async-confirmation pattern as CheckoutPage.tsx: paymentStatus only flips to
  // Paid via the Stripe webhook, so hand off to OrderConfirmationPage's existing poller
  // instead of assuming success synchronously.
  navigate(`/order-confirmation/${order!.orderNumber}`, {
    state: { order: { orderNumber: order!.orderNumber, totalAmount: order!.totalAmount }, paymentStatus: 'processing' },
  });
};

const handlePaymentError = (message: string) => {
  setActionError(message); // Stripe.js error text is already localized by Stripe; display as-is, same as CheckoutPage
};

const openCancelConfirm = () => { setActionError(''); setShowCancelConfirm(true); };
const dismissCancelConfirm = () => setShowCancelConfirm(false);

const confirmCancelOrder = async () => {
  if (!order) return;
  setActionError('');
  setCancelling(true);
  try {
    const updated = await cancelOrder(order.id);
    setOrder(updated as OrderDetail);
    setShowCancelConfirm(false);
    setShowPayment(false);
    setClientSecret(null);
  } catch (err) {
    const code = extractOrderActionErrorCode(err);
    setActionError(t(`orderDetail.errors.${code}`, { defaultValue: t('orderDetail.errors.cancelFailed') }));
    setShowCancelConfirm(false);
  } finally {
    setCancelling(false);
  }
};
```

`refreshOrder` is defined but only `confirmCancelOrder`'s direct `setOrder(updated as OrderDetail)` is actually needed for cancel (backend already returns the updated order) — `refreshOrder` is not required for the resume path (resume navigates away). Keep `refreshOrder` only if the cancel endpoint's response shape ends up NOT returning a full updated order (fallback: call it instead of `setOrder(updated as OrderDetail)`); otherwise drop it to avoid dead code.

### JSX changes

Insert a new conditional actions block **right after** the existing `storefront-account__order-meta` div (after line 85) and **before** the items table:

```tsx
{order.status === 'PendingPayment' && (
  <div className="storefront-account__actions" data-testid="pending-order-actions">
    {actionError && (
      <p className="storefront-account__alert storefront-account__alert--error" role="alert" data-testid="order-action-error">
        {actionError}
      </p>
    )}

    {!showPayment && !showCancelConfirm && (
      <>
        <button
          type="button"
          className="storefront-btn storefront-btn--primary"
          data-testid="btn-resume-payment"
          onClick={handleResumePayment}
          disabled={resuming}
        >
          {resuming ? t('orderDetail.actions.resuming') : t('orderDetail.actions.completePayment')}
        </button>
        <button
          type="button"
          className="storefront-btn storefront-btn--ghost"
          data-testid="btn-cancel-order"
          onClick={openCancelConfirm}
        >
          {t('orderDetail.actions.cancelOrder')}
        </button>
      </>
    )}

    {showCancelConfirm && (
      <div className="storefront-account__confirm" role="alertdialog" aria-labelledby="cancel-order-confirm-title" data-testid="cancel-order-confirm">
        <p id="cancel-order-confirm-title">{t('orderDetail.actions.cancelConfirm')}</p>
        <div className="storefront-account__confirm-actions">
          <button
            type="button"
            className="storefront-btn storefront-btn--ghost"
            data-testid="btn-confirm-cancel"
            onClick={confirmCancelOrder}
            disabled={cancelling}
          >
            {cancelling ? t('orderDetail.actions.cancelling') : t('orderDetail.actions.confirmCancel')}
          </button>
          <button
            type="button"
            className="storefront-btn storefront-btn--text"
            data-testid="btn-dismiss-cancel"
            onClick={dismissCancelConfirm}
            disabled={cancelling}
          >
            {t('orderDetail.actions.keepOrder')}
          </button>
        </div>
      </div>
    )}

    {showPayment && clientSecret && stripePromise && (
      <div className="storefront-account__payment-panel" data-testid="resume-payment-panel">
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm orderNumber={order.orderNumber} onSuccess={handlePaymentSuccess} onError={handlePaymentError} />
        </Elements>
        <button
          type="button"
          className="storefront-btn storefront-btn--text"
          onClick={() => { setShowPayment(false); setClientSecret(null); }}
        >
          {t('orderDetail.actions.backToOrder')}
        </button>
      </div>
    )}
  </div>
)}
```

Notes:
- Both actions and the confirm block are gated on `order.status === 'PendingPayment'` at the outer level — per spec scenario "Actions hidden for a non-pending status", nothing renders once status changes (e.g. after cancel succeeds, `order.status` becomes `'Cancelled'` and the whole block disappears on re-render).
- No CSS changes are strictly required: `storefront-btn--primary/ghost/text` and `storefront-account__alert--error` already exist in `storefront.css`. Two new (currently undefined) classes are referenced for layout only — `storefront-account__actions`, `storefront-account__confirm`, `storefront-account__confirm-actions`, `storefront-account__payment-panel`. These need a few lines of flex/gap CSS added to `frontend/src/styles/storefront.css` near the existing `.storefront-account__*` rules (implementation detail, not part of this plan's scope, but flag it as a follow-up small CSS addition — without it the buttons will still render and be fully functional/testable, just unstyled/stacked).

---

## 3. `frontend/src/pages/storefront/AccountOrdersPage.tsx`

Current file (71 lines): each order row is a **single outer `<Link>`** wrapping the whole `<li>` content (lines 50–59). Adding a second interactive quick-action **inside** that same `<Link>` would produce invalid/nested interactive HTML (`<a><a>...</a></a>`), so the quick action must be a **sibling** of the outer `<Link>`, not a child.

Import addition: none needed — `Link` and `orderStatusLabel` are already imported; no new service call needed here (the quick action just navigates to the existing detail route, per the task: "linking to the order detail page").

Change the `<li>` render (lines 49–61) from:

```tsx
<li key={order.id}>
  <Link to={`/account/orders/${order.id}`} className="storefront-account__list-item">
    ...
  </Link>
</li>
```

to:

```tsx
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
```

Notes:
- `orderBadgeClass('PendingPayment')` already resolves to `storefront-account__badge--pending` (its `.toLowerCase().includes('pend')` check already matches `pendingpayment`) — the badge already visually distinguishes pending orders today; no change needed there. The new element is purely the **quick action link**, not a new badge variant.
- Two sibling `<Link>`s inside one `<li>` avoids nested-interactive-element a11y/HTML-validity issues while satisfying "linking to the order detail page".
- `storefront-account__list-cta` is a new, purely cosmetic class (e.g. small margin-top / block display) — same follow-up CSS note as above.

---

## 4. i18n — `frontend/src/i18n/locales/{es,en}/account.json`

Both files currently share identical key structure (only string values differ). Add to **both**, without touching any existing keys.

### Inside `orderDetail` (extend the existing object — currently has `title`, `titleWithNumber`, `back`, `errors`, `table`):

**`es/account.json`** — replace the existing `"errors": { "load": "..." }` block and add `"actions"`:

```json
"orderDetail": {
  "title": "Detalle del pedido",
  "titleWithNumber": "Pedido {{orderNumber}}",
  "back": "← Volver a pedidos",
  "actions": {
    "completePayment": "Completar pago",
    "resuming": "Preparando pago…",
    "cancelOrder": "Cancelar pedido",
    "cancelConfirm": "¿Seguro que quieres cancelar este pedido? Esta acción no se puede deshacer.",
    "confirmCancel": "Sí, cancelar pedido",
    "cancelling": "Cancelando…",
    "keepOrder": "No, mantener pedido",
    "backToOrder": "← Volver al pedido"
  },
  "errors": {
    "load": "No se pudo cargar el detalle del pedido.",
    "resumeFailed": "No se pudo iniciar el pago. Inténtalo de nuevo.",
    "cancelFailed": "No se pudo cancelar el pedido. Inténtalo de nuevo.",
    "ORDER_NOT_PAYABLE": "Este pedido ya no se puede pagar.",
    "ORDER_NOT_CANCELLABLE": "Este pedido ya no se puede cancelar.",
    "CUSTOMER_ORDER_NOT_FOUND": "No se encontró el pedido."
  },
  "table": { "...": "unchanged" }
}
```

**`en/account.json`** — mirror:

```json
"orderDetail": {
  "title": "Order details",
  "titleWithNumber": "Order {{orderNumber}}",
  "back": "← Back to orders",
  "actions": {
    "completePayment": "Complete payment",
    "resuming": "Preparing payment…",
    "cancelOrder": "Cancel order",
    "cancelConfirm": "Are you sure you want to cancel this order? This action cannot be undone.",
    "confirmCancel": "Yes, cancel order",
    "cancelling": "Cancelling…",
    "keepOrder": "No, keep order",
    "backToOrder": "← Back to order"
  },
  "errors": {
    "load": "Could not load order details.",
    "resumeFailed": "Could not start payment. Please try again.",
    "cancelFailed": "Could not cancel the order. Please try again.",
    "ORDER_NOT_PAYABLE": "This order can no longer be paid.",
    "ORDER_NOT_CANCELLABLE": "This order can no longer be cancelled.",
    "CUSTOMER_ORDER_NOT_FOUND": "Order not found."
  },
  "table": { "...": "unchanged" }
}
```

(The `"..."` placeholders above indicate "keep existing content" — do **not** literally write `"...": "unchanged"` into the file; leave the existing `table` object exactly as-is.)

### Inside `orders` (extend the existing object — currently has `title`, `panelTitle`, `empty`, `errors`):

**es**: add `"resumePayment": "Completar pago"`
**en**: add `"resumePayment": "Complete payment"`

(No separate "pending notice" text key is needed — the existing status badge already renders `t('status.PendingPayment')` = "Pago pendiente" / "Pending payment" via `orderStatusLabel`, which already satisfies "indicator". The new `orders.resumePayment` key is only for the quick-action link label.)

No changes needed to `frontend/src/i18n/index.ts` or `frontend/src/test-utils/renderWithI18n.tsx` — the `account` namespace is already registered in both; adding keys to an existing namespace's JSON files is automatically picked up.

---

## 5. Test files

### 5a. New file: `frontend/src/pages/storefront/__tests__/AccountOrderDetailPage.test.tsx`

Does not currently exist — create it. Follow the exact conventions from `OrderConfirmationPage.test.tsx` (MemoryRouter + Routes for the `:id` param, `jest.mock` of services) and `AccountPage.test.tsx` (`renderWithI18n`, mocked `CustomerAuthContext`) and `PaymentForm.test.tsx` (Stripe mock shape).

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import AccountOrderDetailPage from '../AccountOrderDetailPage';

const mockGetMyOrder = jest.fn();
const mockResumeOrderPayment = jest.fn();
const mockCancelOrder = jest.fn();

jest.mock('../../../services/customerAuthService', () => ({
  getMyOrder: (...args: unknown[]) => mockGetMyOrder(...args),
  resumeOrderPayment: (...args: unknown[]) => mockResumeOrderPayment(...args),
  cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
  extractOrderActionErrorCode: (error: unknown) =>
    (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code ?? 'UNKNOWN_ERROR',
}));

jest.mock('../../../services/paymentService', () => ({
  getStripeConfig: jest.fn().mockResolvedValue({ publishableKey: 'pk_test_123', mode: 'test' }),
}));

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn().mockResolvedValue({}),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children, options }: any) => (
    <div data-testid="elements-mock" data-clientsecret={options?.clientSecret}>{children}</div>
  ),
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: jest.fn() }),
  useElements: () => ({}),
}));

jest.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ customer: { firstName: 'Ana', lastName: 'García', email: 'ana@example.com' }, logout: jest.fn() }),
}));

const pendingOrder = {
  id: 1,
  orderNumber: 'ORD-001',
  status: 'PendingPayment',
  paymentStatus: 'Pending',
  fulfillmentStatus: 'Pending',
  subtotalAmount: '29.99',
  shippingAmount: '0',
  discountAmount: '0',
  totalAmount: '29.99',
  currency: 'EUR',
  createdAt: new Date().toISOString(),
  items: [],
};

function renderPage() {
  return renderWithI18n(
    <MemoryRouter initialEntries={['/account/orders/1']}>
      <Routes>
        <Route path="/account/orders/:id" element={<AccountOrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { lng: 'en' }
  );
}

describe('AccountOrderDetailPage — pending payment actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows Complete payment and Cancel order actions for a PendingPayment order', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    renderPage();
    expect(await screen.findByTestId('btn-resume-payment')).toBeInTheDocument();
    expect(await screen.findByTestId('btn-cancel-order')).toBeInTheDocument();
  });

  it('hides both actions for a non-pending order (Paid)', async () => {
    mockGetMyOrder.mockResolvedValue({ ...pendingOrder, status: 'Paid' });
    renderPage();
    expect(await screen.findByText('ORD-001')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-resume-payment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-cancel-order')).not.toBeInTheDocument();
  });

  it('resume flow success: mounts Elements/PaymentForm with the returned clientSecret', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    mockResumeOrderPayment.mockResolvedValue({ order: pendingOrder, clientSecret: 'secret_abc' });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-resume-payment'));
    expect(await screen.findByTestId('resume-payment-panel')).toBeInTheDocument();
    expect(screen.getByTestId('elements-mock')).toHaveAttribute('data-clientsecret', 'secret_abc');
    expect(mockResumeOrderPayment).toHaveBeenCalledWith(1);
  });

  it('resume flow error: shows mapped message for ORDER_NOT_PAYABLE', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    mockResumeOrderPayment.mockRejectedValue({ response: { data: { error: { code: 'ORDER_NOT_PAYABLE' } } } });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-resume-payment'));
    expect(await screen.findByTestId('order-action-error')).toHaveTextContent(/no longer be paid/i);
  });

  it('cancel flow success: confirming calls cancelOrder and re-renders with Cancelled status (actions disappear)', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    mockCancelOrder.mockResolvedValue({ ...pendingOrder, status: 'Cancelled', fulfillmentStatus: 'Cancelled' });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-cancel-order'));
    fireEvent.click(await screen.findByTestId('btn-confirm-cancel'));
    await waitFor(() => expect(mockCancelOrder).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-cancel-order')).not.toBeInTheDocument();
  });

  it('cancel flow error: shows mapped message for ORDER_NOT_CANCELLABLE and keeps order pending', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    mockCancelOrder.mockRejectedValue({ response: { data: { error: { code: 'ORDER_NOT_CANCELLABLE' } } } });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-cancel-order'));
    fireEvent.click(await screen.findByTestId('btn-confirm-cancel'));
    expect(await screen.findByTestId('order-action-error')).toHaveTextContent(/no longer be cancelled/i);
    expect(await screen.findByTestId('btn-cancel-order')).toBeInTheDocument(); // still pending, action still offered
  });

  it('cancel flow cancelled by user: dismissing confirmation does not call cancelOrder', async () => {
    mockGetMyOrder.mockResolvedValue(pendingOrder);
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-cancel-order'));
    fireEvent.click(await screen.findByTestId('btn-dismiss-cancel'));
    expect(mockCancelOrder).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cancel-order-confirm')).not.toBeInTheDocument();
    expect(await screen.findByTestId('btn-cancel-order')).toBeInTheDocument();
  });
});
```

All async assertions use `findBy*` (never `waitFor` + `getBy*`), per `docs/frontend-standards.md` § ESLint Configuration / `testing-library/prefer-find-by`.

### 5b. New file: `frontend/src/pages/storefront/__tests__/AccountOrdersPage.test.tsx`

Does not currently exist — create it.

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import AccountOrdersPage from '../AccountOrdersPage';

const mockListMyOrders = jest.fn();

jest.mock('../../../services/customerAuthService', () => ({
  listMyOrders: (...args: unknown[]) => mockListMyOrders(...args),
}));

jest.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ customer: { firstName: 'Ana', lastName: 'García', email: 'ana@example.com' }, logout: jest.fn() }),
}));

function renderPage() {
  return renderWithI18n(
    <MemoryRouter>
      <AccountOrdersPage />
    </MemoryRouter>,
    { lng: 'en' }
  );
}

describe('AccountOrdersPage — pending payment indicator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a quick action linking to the order detail page for PendingPayment orders', async () => {
    mockListMyOrders.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-001', totalAmount: '29.99', status: 'PendingPayment' },
    ]);
    renderPage();
    const cta = await screen.findByTestId('resume-cta-1');
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/account/orders/1');
  });

  it('hides the quick action for non-pending orders', async () => {
    mockListMyOrders.mockResolvedValue([
      { id: 2, orderNumber: 'ORD-002', totalAmount: '19.99', status: 'Paid' },
    ]);
    renderPage();
    expect(await screen.findByText('ORD-002')).toBeInTheDocument();
    expect(screen.queryByTestId('resume-cta-2')).not.toBeInTheDocument();
  });
});
```

### Verification step (include in every test-file section, per `ai-specs/agents/frontend-developer.md`)

Run `cd frontend && npx eslint src --ext .ts,.tsx` before considering the test files complete — confirms no `testing-library/prefer-find-by` violations and no unused-import issues from the new mocks/imports.

---

## Summary of files touched

| File | Change |
|---|---|
| `frontend/src/services/customerAuthService.ts` | add `resumeOrderPayment(id)`, `cancelOrder(id)`, `extractOrderActionErrorCode(error)` |
| `frontend/src/pages/storefront/AccountOrderDetailPage.tsx` | add Stripe-lazy-load effect, resume/cancel state + handlers, conditional actions/confirm/payment-panel JSX |
| `frontend/src/pages/storefront/AccountOrdersPage.tsx` | add sibling quick-action `<Link>` per pending order row |
| `frontend/src/i18n/locales/es/account.json` | add `orderDetail.actions`, extend `orderDetail.errors`, add `orders.resumePayment` |
| `frontend/src/i18n/locales/en/account.json` | mirror the above in English |
| `frontend/src/pages/storefront/__tests__/AccountOrderDetailPage.test.tsx` | new — 7 test cases |
| `frontend/src/pages/storefront/__tests__/AccountOrdersPage.test.tsx` | new — 2 test cases |
| `frontend/src/styles/storefront.css` | optional follow-up: minor layout rules for `.storefront-account__actions/__confirm/__confirm-actions/__payment-panel/__list-cta` (functional without it, just unstyled) |

No changes needed to `frontend/src/i18n/index.ts`, `frontend/src/test-utils/renderWithI18n.tsx`, `frontend/src/App.tsx` (no new routes), or any admin file.
