# Frontend Implementation Plan — refund-management (KAN-20)

## Important Notes for Implementors

- **No React Query**: `@tanstack/react-query` is NOT installed. `tasks.md` §7.3 refers to "React Query hooks" but the project standard is `useState` + `useEffect`. All hooks in `useRefunds.ts` must use the established custom-hook pattern (same as this project's other pages), not React Query.
- **No new library installs**: Do not add any dependencies.
- **Create Refund form**: Implemented as an inline Bootstrap `Modal` inside `CustomerOrderDetailPage.tsx`, not a dedicated page or route. This avoids adding `/refunds/create` to the router and keeps user context on the order.
- **Admin-only UI**: All refund pages and components are under the admin `Layout` route tree. No storefront code is touched.
- **State machine transitions**: The frontend enforces valid transitions by deriving allowed next states from the `REFUND_TRANSITIONS` constant defined in `types/refund.ts`. The backend is the authoritative guard; the frontend merely hides invalid buttons.

---

## File 1 — `frontend/src/types/refund.ts` (CREATE NEW)

### Purpose
Single source of truth for all TypeScript types related to refunds. Mirrors the pattern in `customerOrder.ts`.

### Types and Interfaces

```typescript
export type RefundStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

// State machine: maps each status to its allowed next statuses.
// Terminal states (Completed, Failed, Cancelled) map to empty arrays.
export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  Pending:    ['Processing', 'Cancelled'],
  Processing: ['Completed', 'Failed', 'Cancelled'],
  Completed:  [],
  Failed:     [],
  Cancelled:  [],
};

export interface Refund {
  id: number;
  customerOrderId: number;
  returnRequestId: number | null;
  amount: string;             // Prisma Decimal serialised as string
  reason: string | null;
  status: RefundStatus;
  paymentProviderReference: string | null;
  processedAt: string | null; // ISO date string, set when Completed
  createdAt: string;
  updatedAt: string;
}

export interface CreateRefundPayload {
  customerOrderId: number;
  amount: number;             // Sent as number; backend validates > 0
  returnRequestId?: number | null;
  reason?: string;            // max 500 chars
  paymentProviderReference?: string; // max 150 chars
}

export interface UpdateRefundStatusPayload {
  status: RefundStatus;
  paymentProviderReference?: string; // max 150 chars
}

export interface RefundQueryParams {
  page?: number;
  limit?: number;
  customerOrderId?: number;
  status?: RefundStatus;
}

export interface RefundListData {
  items: Refund[];
  total: number;
  page: number;
  limit: number;
}

export interface RefundListResponse {
  success: boolean;
  data: RefundListData;
  message: string;
}

export interface RefundResponse {
  success: boolean;
  data: Refund;
  message: string;
}

export interface RefundAdminApiError {
  success: false;
  error: { message: string; code: string };
}
```

### Notes
- `amount` is typed as `string` on `Refund` (backend sends Prisma Decimal as string) but as `number` on `CreateRefundPayload` (sent to backend).
- `REFUND_TRANSITIONS` is exported so `RefundStatusControl` can derive allowed buttons without duplicating logic.

---

## File 2 — `frontend/src/services/refundService.ts` (REPLACE STUB)

### Purpose
Centralize all HTTP calls to `/api/admin/refunds`. Replaces the current stub that throws `Error('Not implemented')`.

### Key Implementation Details

```typescript
import axios, { AxiosError } from 'axios';
import {
  RefundQueryParams,
  RefundListResponse,
  RefundResponse,
  CreateRefundPayload,
  UpdateRefundStatusPayload,
  RefundAdminApiError,
} from '../types/refund';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/refunds`;

// Maps backend error codes to user-friendly messages.
export function mapRefundError(code: string): string {
  switch (code) {
    case 'REFUND_NOT_FOUND':            return 'Refund not found.';
    case 'CUSTOMER_ORDER_NOT_FOUND':    return 'Customer order not found.';
    case 'REFUND_ORDER_NOT_PAID':       return 'This order is not eligible for a refund (must be Paid or PartiallyRefunded).';
    case 'REFUND_AMOUNT_EXCEEDS_BALANCE': return 'Refund amount exceeds the refundable balance for this order.';
    case 'REFUND_TRANSITION_INVALID':   return 'This status transition is not allowed.';
    case 'VALIDATION_ERROR':            return 'Please check the form fields and try again.';
    default:                            return 'An unexpected error occurred. Please try again.';
  }
}

export function extractRefundErrorMessage(error: unknown): string {
  const code = (error as AxiosError<RefundAdminApiError>).response?.data?.error?.code;
  return mapRefundError(code ?? '');
}

export const refundService = {
  list: async (params?: RefundQueryParams): Promise<RefundListResponse> => {
    const response = await axios.get<RefundListResponse>(ADMIN_BASE, { params });
    return response.data;
  },

  getById: async (id: number): Promise<RefundResponse> => {
    const response = await axios.get<RefundResponse>(`${ADMIN_BASE}/${id}`);
    return response.data;
  },

  create: async (payload: CreateRefundPayload): Promise<RefundResponse> => {
    const response = await axios.post<RefundResponse>(ADMIN_BASE, payload);
    return response.data;
  },

  updateStatus: async (id: number, payload: UpdateRefundStatusPayload): Promise<RefundResponse> => {
    const response = await axios.patch<RefundResponse>(`${ADMIN_BASE}/${id}/status`, payload);
    return response.data;
  },
};
```

### Notes
- Pattern is identical to `customerOrderService.ts` — same axios pattern, same error-mapping helpers.
- No try-catch inside service functions: errors propagate to callers (pages/hooks) which handle them.

---

## File 3 — `frontend/src/hooks/useRefunds.ts` (CREATE NEW — new directory)

### Purpose
Custom React hooks that encapsulate async state for refund operations. The `hooks/` directory does not yet exist and must be created.

### Implementation Detail

**NOT React Query** — uses `useState` + `useEffect` following the project pattern. The hook signatures match what `tasks.md` specified; only the implementation differs.

```typescript
// useRefunds — for the list page
export function useRefunds(filters?: RefundQueryParams): {
  refunds: Refund[];
  total: number;
  loading: boolean;
  error: string;
  reload: () => void;
}
// Internally: useState for refunds/total/loading/error
// useEffect calls refundService.list(filters) on mount and when filters change
// reload: exposes a counter state that triggers a re-fetch via useEffect dependency

// useRefund — for the detail page
export function useRefund(id: number): {
  refund: Refund | null;
  loading: boolean;
  error: string;
  reload: () => void;
}
// Internally: useState + useEffect calling refundService.getById(id)

// useCreateRefund — imperative mutation hook (called on form submit, not on mount)
export function useCreateRefund(): {
  create: (payload: CreateRefundPayload) => Promise<Refund>;
  creating: boolean;
  createError: string;
}
// Internally: useState for creating/createError
// create() sets creating=true, calls refundService.create(), sets creating=false
// Throws on error after setting createError so the caller can also handle navigation

// useUpdateRefundStatus — imperative mutation hook (called from RefundStatusControl)
export function useUpdateRefundStatus(): {
  updateStatus: (id: number, payload: UpdateRefundStatusPayload) => Promise<Refund>;
  updating: boolean;
  updateError: string;
}
// Same pattern as useCreateRefund but calls refundService.updateStatus(id, payload)
```

### Notes
- Hooks call `extractRefundErrorMessage` from the service to convert Axios errors to readable strings.
- `useRefunds` and `useRefund` accept a `reload` counter in their `useEffect` deps array, giving callers a way to force a re-fetch after mutations.
- Pages can choose to use these hooks OR call the service directly (e.g., `CustomerOrderDetailPage` calls `refundService.create()` directly inside the modal submit handler to keep the flow self-contained).

---

## File 4 — `frontend/src/pages/RefundsPage.tsx` (REPLACE STUB)

### Purpose
Functional admin list page for refunds. Replaces the "Coming soon" stub.

### Props
None — standalone page component (`React.FC`).

### State
```typescript
const [refunds, setRefunds] = useState<Refund[]>([]);
const [total, setTotal]     = useState(0);
const [loading, setLoading] = useState(true);
const [error, setError]     = useState('');
const [page, setPage]       = useState(1);
const [statusFilter, setStatusFilter]           = useState<RefundStatus | ''>('');
const [orderIdFilter, setOrderIdFilter]         = useState('');
```

### Layout and Components
- Page title: `<h1 className="h3">Refunds</h1>`
- **Filter bar** (`Row` with `Col`s):
  - `Form.Select` for `status` filter — options: empty ("All statuses"), then each `RefundStatus` value
  - `Form.Control` (type="text") for `customerOrderId` — apply filter on blur or button click
  - "Apply" `Button` that triggers `setPage(1)` and re-fetch
- **Table** (`Table responsive striped`):
  - Columns: `#` (ID), `Order ID`, `Amount`, `Status`, `Created At`, `Actions`
  - Each row renders `StatusBadge` for status
  - "View" link in Actions column: `<Link to={`/refunds/${refund.id}`}>View</Link>`
  - `data-testid="refund-row-{id}"` on each `<tr>`
- **Pagination**: simple Prev / page N / Next `Button` group; disable Prev at page 1, disable Next when `page * 10 >= total`
- **Loading state**: `<LoadingSpinner />` (existing component)
- **Error state**: `<ErrorAlert message={error} />` (existing component)

### Data Fetching
`useEffect` watching `[page, statusFilter, orderIdFilter]` — calls `refundService.list({ page, limit: 10, ...(statusFilter && { status: statusFilter }), ...(orderIdFilter && { customerOrderId: Number(orderIdFilter) }) })`.

### Notes
- Do NOT add a "Create Refund" button here — creation is initiated from `CustomerOrderDetailPage`.
- Mobile responsive: on `xs` screens the table becomes horizontally scrollable via `Table responsive`.

---

## File 5 — `frontend/src/pages/RefundDetailPage.tsx` (CREATE NEW)

### Purpose
Detail page for a single refund. Displays all fields and embeds `RefundStatusControl`.

### Route
`/refunds/:id` (to be added in `App.tsx`)

### State
```typescript
const { id } = useParams<{ id: string }>();
const refundId = Number(id);

const [refund, setRefund]     = useState<Refund | null>(null);
const [loading, setLoading]   = useState(true);
const [error, setError]       = useState('');
const [statusError, setStatusError] = useState('');
const [saving, setSaving]     = useState(false);
```

### Layout and Components
- `<Link to="/refunds">← Back to Refunds</Link>`
- Page heading: `Refund #${refund.id}` + `StatusBadge` for current status
- **Details Card** (`Card`):
  - Order ID (with `Link` to `/customer-orders/${refund.customerOrderId}`)
  - Amount
  - Reason (or "—" if null)
  - Payment Provider Reference (or "—" if null)
  - Return Request ID (or "—" if null)
  - Created At (formatted date)
  - Processed At (formatted date, shown only when not null)
- **Update Status Card** (`Card`):
  - Title: "Update Status"
  - Contains `<RefundStatusControl refund={refund} saving={saving} error={statusError} onSave={handleStatusSave} />`
- `handleStatusSave(payload: UpdateRefundStatusPayload)`:
  - `setSaving(true)`, clear `statusError`
  - Call `refundService.updateStatus(refund.id, payload)`
  - On success: `setRefund(res.data)`, `setSaving(false)`
  - On error: `setStatusError(extractRefundErrorMessage(err))`, `setSaving(false)`

### Notes
- `data-testid="refund-detail-status-badge"` on the heading `StatusBadge`.
- If `refund.status` is terminal (`Completed`, `Failed`, `Cancelled`), `RefundStatusControl` renders no buttons — the parent still renders the Card (control handles this gracefully).

---

## File 6 — `frontend/src/components/admin/RefundStatusControl.tsx` (CREATE NEW)

### Purpose
Renders the valid next-state transition buttons for a refund. Mirrors the structure of `SupplierOrderStatusControl.tsx` but uses state-machine-aware buttons instead of a free `Form.Select`.

### Props
```typescript
type RefundStatusControlProps = {
  refund: Refund;
  saving: boolean;
  error?: string;
  onSave: (payload: UpdateRefundStatusPayload) => void;
};
```

### State
```typescript
const [paymentProviderReference, setPaymentProviderReference] = useState(
  refund.paymentProviderReference ?? ''
);
```

Reset `paymentProviderReference` when `refund` prop changes (via `useEffect` on `refund.id`).

### Rendering Logic

```
const allowedNextStates = REFUND_TRANSITIONS[refund.status]; // from types/refund.ts

if (allowedNextStates.length === 0) {
  // Terminal state — render a read-only message
  return <p className="text-muted small">This refund is in a terminal state and cannot be advanced.</p>
}
```

For each `nextState` in `allowedNextStates`:
- Render a `Button` with:
  - `variant` mapping: `Processing → 'outline-primary'`, `Completed → 'success'`, `Failed → 'outline-danger'`, `Cancelled → 'outline-secondary'`
  - `disabled={saving}`
  - `onClick`: calls `onSave({ status: nextState, ...(paymentProviderReference && { paymentProviderReference }) })`
  - `data-testid={`btn-refund-transition-${nextState.toLowerCase()}`}`

Below the buttons:
- `Form.Control` (text) for `paymentProviderReference`, label "Payment provider reference (optional)", `maxLength={150}`
- If `error`: `<div className="text-danger small mt-2">{error}</div>`

### Notes
- No `<form>` wrapper — each button is an individual action, not a form submission.
- The optional `paymentProviderReference` field is always visible so admins can record a gateway reference when advancing to `Completed`.
- `data-testid="refund-status-control"` on the root `div`.

---

## File 7 — Create Refund Form (INLINE MODAL in `CustomerOrderDetailPage.tsx`)

### Decision: Modal, not a dedicated route

A Bootstrap `Modal` opened from `CustomerOrderDetailPage` is the correct choice because:
1. The form only has 3 fields (amount, reason, paymentProviderReference) — too small to warrant a full page.
2. Pre-filling `customerOrderId` from the parent order requires no URL query parameters.
3. Success navigation to `RefundDetailPage` is handled with `useNavigate` after the API call resolves.
4. Consistent with `CustomerFormModal` and other admin modals in the project.

**No new file needed** — the modal lives inside `CustomerOrderDetailPage.tsx`.

### Modal State (additions to CustomerOrderDetailPage)
```typescript
const navigate = useNavigate();        // add import
const [showRefundModal, setShowRefundModal] = useState(false);
const [refundAmount, setRefundAmount]       = useState('');
const [refundReason, setRefundReason]       = useState('');
const [refundPaymentRef, setRefundPaymentRef] = useState('');
const [refundCreating, setRefundCreating]   = useState(false);
const [refundCreateError, setRefundCreateError] = useState('');
```

### Visibility Guard
```typescript
const canCreateRefund =
  order != null &&
  (order.paymentStatus === 'Paid' || order.paymentStatus === 'PartiallyRefunded');
```

### Submit Handler
```typescript
const handleCreateRefund = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!order) return;
  setRefundCreating(true);
  setRefundCreateError('');
  try {
    const res = await refundService.create({
      customerOrderId: order.id,
      amount: parseFloat(refundAmount),
      ...(refundReason    && { reason: refundReason }),
      ...(refundPaymentRef && { paymentProviderReference: refundPaymentRef }),
    });
    setShowRefundModal(false);
    navigate(`/refunds/${res.data.id}`);
  } catch (err) {
    setRefundCreateError(extractRefundErrorMessage(err));   // import from refundService
  } finally {
    setRefundCreating(false);
  }
};
```

### JSX Additions

**Button placement**: after the "Supplier orders" Card, before the "Update statuses" Card.

```tsx
{canCreateRefund && (
  <div className="mb-3">
    <button
      type="button"
      className="btn btn-outline-success"
      onClick={() => {
        setRefundAmount('');
        setRefundReason('');
        setRefundPaymentRef('');
        setRefundCreateError('');
        setShowRefundModal(true);
      }}
      data-testid="btn-create-refund"
    >
      Create Refund
    </button>
  </div>
)}
```

**Modal JSX** (added after the last `Card`, before `</div>`):

```tsx
<Modal show={showRefundModal} onHide={() => setShowRefundModal(false)}>
  <Modal.Header closeButton>
    <Modal.Title>Create Refund — Order {order?.orderNumber}</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Form id="refund-create-form" onSubmit={(e) => void handleCreateRefund(e)}>
      <Form.Group className="mb-3">
        <Form.Label>Amount *</Form.Label>
        <Form.Control
          type="number"
          step="0.01"
          min="0.01"
          required
          value={refundAmount}
          onChange={(e) => setRefundAmount(e.target.value)}
          data-testid="input-refund-amount"
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Reason</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          maxLength={500}
          value={refundReason}
          onChange={(e) => setRefundReason(e.target.value)}
          data-testid="input-refund-reason"
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Payment provider reference</Form.Label>
        <Form.Control
          type="text"
          maxLength={150}
          value={refundPaymentRef}
          onChange={(e) => setRefundPaymentRef(e.target.value)}
          data-testid="input-refund-payment-ref"
        />
      </Form.Group>
      {refundCreateError && (
        <div className="text-danger small">{refundCreateError}</div>
      )}
    </Form>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowRefundModal(false)}>
      Cancel
    </Button>
    <Button
      type="submit"
      form="refund-create-form"
      variant="primary"
      disabled={refundCreating}
      data-testid="btn-submit-refund"
    >
      {refundCreating ? 'Creating…' : 'Create Refund'}
    </Button>
  </Modal.Footer>
</Modal>
```

### New Imports for CustomerOrderDetailPage
```typescript
import { useNavigate } from 'react-router-dom';     // already has Link, add useNavigate
import { Modal, Button, Form } from 'react-bootstrap'; // Modal is new
import { refundService, extractRefundErrorMessage } from '../services/refundService';
```

---

## File 8 — `frontend/src/App.tsx` (MODIFY)

### Change
Add one import and one `<Route>` inside the existing admin panel `<Route path="/" element={<Layout />}>` block.

### Diff Description

**Add import** (after existing import for `RefundsPage`):
```typescript
import RefundDetailPage from './pages/RefundDetailPage';
```

**Add route** (after the existing `refunds` route at line 60, before `*`):
```tsx
<Route path="refunds/:id" element={<RefundDetailPage />} />
```

### Result
The admin routes block will then have:
```tsx
<Route path="refunds"    element={<RefundsPage />} />
<Route path="refunds/:id" element={<RefundDetailPage />} />
```

---

## File 9 — `frontend/src/components/admin/StatusBadge.tsx` (MODIFY)

### Purpose
Add Bootstrap variant mappings for refund statuses (and fill gaps for customer order / payment statuses that currently fall through to the `'secondary'` default).

### Change: Extend the `VARIANT` record

```typescript
const VARIANT: Record<string, string> = {
  // Product statuses (existing)
  Draft:    'secondary',
  Active:   'success',
  Inactive: 'warning',
  Archived: 'dark',
  // Supplier-only status (existing)
  Blocked:  'danger',

  // Customer order statuses (new)
  PendingPayment:    'warning',
  Paid:              'success',
  Processing:        'primary',
  Completed:         'success',
  Cancelled:         'secondary',
  Refunded:          'info',

  // Payment statuses (new)
  Pending:           'warning',
  Authorized:        'primary',
  Failed:            'danger',
  PartiallyRefunded: 'info',

  // Fulfillment statuses (new)
  NotStarted:             'secondary',
  PendingSupplierOrder:   'warning',
  SupplierOrderPlaced:    'primary',
  PartiallyFulfilled:     'info',
  Fulfilled:              'success',

  // Supplier order statuses (new)
  Requested:  'primary',
  Confirmed:  'info',
  OutOfStock: 'danger',
  Shipped:    'warning',
  Delivered:  'success',
};
```

### Notes
- Some status names collide across domains (e.g., `Cancelled`, `Completed`, `Processing`, `Pending`) — this is intentional; they share the same visual style, which is consistent UX.
- The `RefundStatus` values `Failed`, `Pending`, `Processing`, `Completed`, `Cancelled` are all covered by the entries above.
- `data-testid` support is already present via `{...rest}` passthrough — no change needed there.

---

## Summary of Files

| File | Action | Key Deliverable |
|------|--------|-----------------|
| `frontend/src/types/refund.ts` | CREATE | `Refund`, `RefundStatus`, `REFUND_TRANSITIONS`, payload/response types |
| `frontend/src/services/refundService.ts` | REPLACE | Axios calls to `/api/admin/refunds`, error mapping helpers |
| `frontend/src/hooks/useRefunds.ts` | CREATE | `useRefunds`, `useRefund`, `useCreateRefund`, `useUpdateRefundStatus` (useState/useEffect, no React Query) |
| `frontend/src/pages/RefundsPage.tsx` | REPLACE | Paginated list with status + orderID filters |
| `frontend/src/pages/RefundDetailPage.tsx` | CREATE | Detail view + `RefundStatusControl` embed |
| `frontend/src/components/admin/RefundStatusControl.tsx` | CREATE | State-machine-aware transition buttons |
| `frontend/src/pages/CustomerOrderDetailPage.tsx` | MODIFY | `canCreateRefund` guard, inline Bootstrap Modal with form |
| `frontend/src/App.tsx` | MODIFY | Add `refunds/:id` route + `RefundDetailPage` import |
| `frontend/src/components/admin/StatusBadge.tsx` | MODIFY | Add variant entries for all order/refund statuses |

## Implementation Order

1. `types/refund.ts` — no dependencies
2. `services/refundService.ts` — depends on types
3. `components/admin/StatusBadge.tsx` — independent, needed by multiple components
4. `hooks/useRefunds.ts` — depends on types + service
5. `components/admin/RefundStatusControl.tsx` — depends on types + StatusBadge
6. `pages/RefundDetailPage.tsx` — depends on types + service + RefundStatusControl + StatusBadge
7. `pages/RefundsPage.tsx` — depends on types + service + StatusBadge
8. `pages/CustomerOrderDetailPage.tsx` — add modal, depends on service
9. `App.tsx` — wire routing last
