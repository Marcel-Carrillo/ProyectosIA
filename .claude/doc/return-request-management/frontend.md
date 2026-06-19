# Frontend Implementation Plan — return-request-management (KAN-25)

> Generated from reading: `ai-specs/agents/frontend-developer.md`, context session, design/specs/tasks, `docs/frontend-standards.md`, and all reference pattern files.

---

## Summary of files

| File | Action |
|------|--------|
| `frontend/src/types/returnRequest.ts` | CREATE — all types and constants |
| `frontend/src/services/returnRequestService.ts` | REPLACE stub — full axios implementation |
| `frontend/src/hooks/useReturnRequests.ts` | CREATE — list and single-item hooks |
| `frontend/src/pages/ReturnRequestsPage.tsx` | REPLACE stub — full list page |
| `frontend/src/pages/ReturnRequestDetailPage.tsx` | CREATE — detail page |
| `frontend/src/components/admin/ReturnRequestStatusControl.tsx` | CREATE — status control component |
| `frontend/src/pages/CustomerOrderDetailPage.tsx` | MODIFY — add Create Return modal + return requests section |
| `frontend/src/App.tsx` | MODIFY — add detail route |

---

## 1. `frontend/src/types/returnRequest.ts`

**Action:** Create new file.

**Pattern:** Mirror `frontend/src/types/refund.ts` exactly.

### Content

```typescript
export type ReturnRequestStatus =
  | 'Requested'
  | 'Approved'
  | 'Rejected'
  | 'Received'
  | 'Refunded'
  | 'Cancelled';

export interface ReturnRequest {
  id: number;
  customerOrderId: number;
  customerOrderItemId: number;
  reason: string;
  status: ReturnRequestStatus;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRequestListResult {
  items: ReturnRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface ReturnRequestListFilters {
  customerOrderId?: number;
  status?: ReturnRequestStatus;
  page?: number;
  limit?: number;
}

export interface CreateReturnRequestInput {
  customerOrderId: number;
  customerOrderItemId: number;
  reason: string;
}

export interface UpdateReturnRequestStatusInput {
  status: ReturnRequestStatus;
}

// RETURN_REQUEST_TRANSITIONS drives both the status control and the service
// 'Refunded' is intentionally removed from Received's transitions — the UI
// must NOT expose "Mark as Refunded" (reserved for KAN-20). The backend still
// accepts it; the UI just never sends it.
export const RETURN_REQUEST_TRANSITIONS: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
  Requested: ['Approved', 'Rejected', 'Cancelled'],
  Approved: ['Received', 'Cancelled'],
  Received: ['Cancelled'],   // Refunded omitted deliberately — see decision 3 in design.md
  Rejected: [],
  Refunded: [],
  Cancelled: [],
};
```

### Key points

- No `amount` or `paymentProviderReference` — those belong to `Refund`, not `ReturnRequest`.
- No `refundedAt` timestamp field — the state machine spec only defines `approvedAt`, `rejectedAt`, `receivedAt`.
- `RETURN_REQUEST_TRANSITIONS` is the single source of truth for what the UI exposes. Keep `Refunded` absent from the `Received` array here even though the backend accepts it.

---

## 2. `frontend/src/services/returnRequestService.ts`

**Action:** Replace the existing stub entirely.

**Pattern:** Exactly mirrors `frontend/src/services/refundService.ts`.

### Key imports

```typescript
import axios, { AxiosError } from 'axios';
import {
  ReturnRequest,
  ReturnRequestListResult,
  ReturnRequestListFilters,
  CreateReturnRequestInput,
  UpdateReturnRequestStatusInput,
} from '../types/returnRequest';
```

### Constants

```typescript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/return-requests`;
```

### `mapReturnRequestError(code: string): string`

Map all error codes from the context session to user-friendly messages:

| Code | Message |
|------|---------|
| `RETURN_REQUEST_NOT_FOUND` | `'Return request not found.'` |
| `CUSTOMER_ORDER_NOT_FOUND` | `'Customer order not found.'` |
| `CUSTOMER_ORDER_ITEM_NOT_FOUND` | `'Order item not found.'` |
| `RETURN_REQUEST_ORDER_CANCELLED` | `'Cannot create a return request: the order has been cancelled.'` |
| `RETURN_REQUEST_ITEM_MISMATCH` | `'The selected item does not belong to this order.'` |
| `RETURN_REQUEST_TRANSITION_INVALID` | `'This status change is not allowed.'` |
| `VALIDATION_ERROR` | `'Please check the form fields and try again.'` |
| default | `'An unexpected error occurred.'` |

### `handleAxiosError(err: AxiosError): never` (private)

Same pattern as `refundService.ts` — reads `err.response?.data.error.code`, maps it via `mapReturnRequestError`, throws.

### `returnRequestService` object — exported methods

```typescript
export const returnRequestService = {
  async getAll(filters: ReturnRequestListFilters = {}): Promise<ReturnRequestListResult>
  async getById(id: number): Promise<ReturnRequest>
  async create(input: CreateReturnRequestInput): Promise<ReturnRequest>
  async updateStatus(id: number, input: UpdateReturnRequestStatusInput): Promise<ReturnRequest>
};
```

- `getAll`: builds `params` object from non-undefined filter fields; `GET ADMIN_BASE`
- `getById`: `GET ADMIN_BASE/{id}`
- `create`: `POST ADMIN_BASE` with `input` body
- `updateStatus`: `PATCH ADMIN_BASE/{id}/status` with `input` body

All methods follow the try/catch pattern: catch AxiosError → `handleAxiosError`; rethrow anything else.

---

## 3. `frontend/src/hooks/useReturnRequests.ts`

**Action:** Create new file.

**Pattern:** Exactly mirrors `frontend/src/hooks/useRefunds.ts`.

### Exports

#### `useReturnRequests(filters: ReturnRequestListFilters = {})`

State:
- `result: ReturnRequestListResult | null`
- `loading: boolean` (initial `true`)
- `error: string | null`

Logic: `useCallback` wrapping `returnRequestService.getAll` keyed on `JSON.stringify(filters)`; `useEffect` that calls it when the callback changes.

Returns: `{ result, loading, error, refetch }`

#### `useReturnRequest(id: number | null)`

State:
- `returnRequest: ReturnRequest | null`
- `loading: boolean` (initial `false`)
- `error: string | null`

Logic: same as `useRefund` in `useRefunds.ts` — guard on null id.

Returns: `{ returnRequest, loading, error, refetch }`

### Gotcha

The list hook is not directly used in `ReturnRequestsPage` (the page manages its own state for URL sync), but it is available for any component that wants a simpler integration. The `useReturnRequest` single-item hook is also available but the detail page manages its own state manually like `RefundDetailPage` does.

---

## 4. `frontend/src/pages/ReturnRequestsPage.tsx`

**Action:** Replace stub entirely.

**Pattern:** Exactly mirrors `frontend/src/pages/RefundsPage.tsx`.

### Key imports

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Table, Form, Row, Col } from 'react-bootstrap';
import { returnRequestService } from '../services/returnRequestService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/admin/StatusBadge';
import { ReturnRequest, ReturnRequestStatus } from '../types/returnRequest';
```

### Constants

```typescript
const PAGE_SIZE = 20;

const RETURN_REQUEST_STATUSES: ReturnRequestStatus[] = [
  'Requested', 'Approved', 'Rejected', 'Received', 'Refunded', 'Cancelled'
];
```

### State

- `statusFilter: string` — init from `searchParams.get('status') ?? ''`
- `orderFilter: string` — init from `searchParams.get('customerOrderId') ?? ''`
- `page: number` — init from `searchParams.get('page')` parsed as int
- `returnRequests: ReturnRequest[]`
- `total: number`
- `loading: boolean`
- `error: string`

### URL sync effect

Same as `RefundsPage`: `useEffect` watching `statusFilter`, `orderFilter`, `page` → `setSearchParams`.

### Fetch effect

`fetchReturnRequests` via `useCallback` calling `returnRequestService.getAll({ status, customerOrderId, page, limit: PAGE_SIZE })`.

### Table columns

| Header | Value |
|--------|-------|
| ID | `#{r.id}` |
| Order ID | `<Link to="/customer-orders/{r.customerOrderId}">#{r.customerOrderId}</Link>` |
| Item ID | `#{r.customerOrderItemId}` |
| Status | `<StatusBadge status={r.status} />` |
| Reason | `r.reason` truncated to `maxWidth: 200` with `text-truncate` class |
| Requested | `new Date(r.requestedAt).toLocaleDateString()` |
| (actions) | `<Link to="/return-requests/{r.id}" className="btn btn-sm btn-outline-primary">View</Link>` |

### Empty state

`<td colSpan={7}>No return requests found.</td>`

### Filter controls

Two `Col` elements in a `Row g-2 mb-3`:
1. `Form.Select` for `status` — `data-testid="select-status-filter"` — "All statuses" default option + map `RETURN_REQUEST_STATUSES`
2. `Form.Control type="number"` for `customerOrderId` — `data-testid="input-order-filter"` — placeholder "Filter by Order ID"

On filter change: reset `page` to 1.

---

## 5. `frontend/src/pages/ReturnRequestDetailPage.tsx`

**Action:** Create new file.

**Pattern:** Exactly mirrors `frontend/src/pages/RefundDetailPage.tsx`.

### Key imports

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Row, Col } from 'react-bootstrap';
import { returnRequestService } from '../services/returnRequestService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import StatusBadge from '../components/admin/StatusBadge';
import ReturnRequestStatusControl from '../components/admin/ReturnRequestStatusControl';
import { ReturnRequest, UpdateReturnRequestStatusInput } from '../types/returnRequest';
```

### State

- `returnRequest: ReturnRequest | null`
- `loading: boolean`
- `error: string`
- `statusError: string`
- `saving: boolean`

### Load function

`loadReturnRequest` via `useCallback` on `returnRequestId`:
- Guard: `if (!returnRequestId || Number.isNaN(returnRequestId))` → `setError('Invalid return request id.')`
- Try: `returnRequestService.getById(returnRequestId)` → `setReturnRequest(data)`
- Catch: `setError('Unable to load return request.')`

### Status save handler

`handleStatusSave(update: UpdateReturnRequestStatusInput)`:
- `returnRequestService.updateStatus(returnRequest.id, update)`
- On success: `setReturnRequest(updated)`
- On error: `setStatusError(err.message)`

### JSX structure

```
<div className="admin-page">
  <Link to="/return-requests">← Back to return requests</Link>

  <div className="admin-page-header mb-3">
    <h1 className="h3 mb-0">Return Request #{returnRequest.id}</h1>
    <StatusBadge status={returnRequest.status} />
  </div>

  <Row>
    <Col md={6}>
      <Card className="mb-4">
        <Card.Header>Details</Card.Header>
        <Card.Body>
          <dl className="row mb-0">
            <dt>Customer Order</dt>
            <dd><Link to="/customer-orders/{id}">#{id}</Link></dd>

            <dt>Order Item ID</dt>
            <dd>#{returnRequest.customerOrderItemId}</dd>

            <dt>Reason</dt>
            <dd>{returnRequest.reason}</dd>

            <dt>Requested At</dt>
            <dd>{new Date(returnRequest.requestedAt).toLocaleString()}</dd>

            <dt>Approved At</dt>
            <dd>{returnRequest.approvedAt ? toLocaleString() : '—'}</dd>

            <dt>Rejected At</dt>
            <dd>{returnRequest.rejectedAt ? toLocaleString() : '—'}</dd>

            <dt>Received At</dt>
            <dd>{returnRequest.receivedAt ? toLocaleString() : '—'}</dd>

            <dt>Created</dt>
            <dd>{new Date(returnRequest.createdAt).toLocaleString()}</dd>
          </dl>
        </Card.Body>
      </Card>
    </Col>

    <Col md={6}>
      <Card className="mb-4">
        <Card.Header>Update Status</Card.Header>
        <Card.Body>
          <ReturnRequestStatusControl
            returnRequest={returnRequest}
            saving={saving}
            error={statusError}
            onSave={handleStatusSave}
          />
        </Card.Body>
      </Card>
    </Col>
  </Row>
</div>
```

### Gotcha

`RefundDetailPage` uses `refund.processedAt` and `refund.amount` in the details card. The return request detail has different timestamp fields (`approvedAt`, `rejectedAt`, `receivedAt`). Do not carry those refund-specific fields over.

---

## 6. `frontend/src/components/admin/ReturnRequestStatusControl.tsx`

**Action:** Create new file.

**Pattern:** Mirrors `frontend/src/components/admin/RefundStatusControl.tsx`.

### Key imports

```typescript
import React from 'react';
import { Form, Button } from 'react-bootstrap';
import {
  ReturnRequest,
  ReturnRequestStatus,
  UpdateReturnRequestStatusInput,
  RETURN_REQUEST_TRANSITIONS,
} from '../../types/returnRequest';
import StatusBadge from './StatusBadge';
```

### Props type

```typescript
type ReturnRequestStatusControlProps = {
  returnRequest: ReturnRequest;
  saving: boolean;
  error?: string;
  onSave: (update: UpdateReturnRequestStatusInput) => void;
};
```

### Component structure

```typescript
const ReturnRequestStatusControl: React.FC<ReturnRequestStatusControlProps> = ({
  returnRequest, saving, error, onSave
}) => {
  const [status, setStatus] = React.useState<ReturnRequestStatus>(returnRequest.status);

  React.useEffect(() => {
    setStatus(returnRequest.status);
  }, [returnRequest]);

  const allowedTransitions = RETURN_REQUEST_TRANSITIONS[returnRequest.status] ?? [];
  const isTerminal = allowedTransitions.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ status });
  };

  if (isTerminal) {
    return (
      <div data-testid="return-request-status-control">
        <div className="small text-muted mb-1">Status</div>
        <StatusBadge status={returnRequest.status} />
        <p className="text-muted small mt-2">
          This return request is in a terminal state and cannot be updated.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} data-testid="return-request-status-control">
      <div className="mb-3">
        <div className="small text-muted mb-1">Current Status</div>
        <StatusBadge status={returnRequest.status} />
      </div>
      <div className="mb-3">
        <Form.Label className="small">New Status</Form.Label>
        <Form.Select
          value={status}
          onChange={(e) => setStatus(e.target.value as ReturnRequestStatus)}
          data-testid="select-return-request-status"
        >
          <option value={returnRequest.status}>{returnRequest.status} (current)</option>
          {allowedTransitions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Form.Select>
      </div>
      {error && <div className="text-danger small mb-2">{error}</div>}
      <Button
        type="submit"
        variant="primary"
        disabled={saving || status === returnRequest.status}
        data-testid="btn-save-return-request-status"
      >
        {saving ? 'Saving…' : 'Update status'}
      </Button>
    </form>
  );
};
```

### Key differences from `RefundStatusControl`

- No `paymentProviderReference` field — return requests do not have that.
- The `Received` state shows only `['Cancelled']` in the select (because `RETURN_REQUEST_TRANSITIONS.Received = ['Cancelled']`). `Refunded` is intentionally excluded from the UI constants even though the backend accepts the transition. This is the enforcement point for decision 3.
- If the admin somehow reaches a return request in `Refunded` state (set by KAN-20 automation), the component will show "terminal state" message, which is correct.

---

## 7. `frontend/src/pages/CustomerOrderDetailPage.tsx`

**Action:** Modify existing file.

This is the most complex modification. Two distinct additions are needed.

### 7a. New imports to add

```typescript
import { returnRequestService } from '../services/returnRequestService';
import { ReturnRequest } from '../types/returnRequest';
```

### 7b. New state variables (add to the existing state block)

```typescript
const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
const [showReturnModal, setShowReturnModal] = useState(false);
const [selectedReturnItem, setSelectedReturnItem] = useState<CustomerOrderItem | null>(null);
const [returnReason, setReturnReason] = useState('');
const [returnSubmitting, setReturnSubmitting] = useState(false);
const [returnError, setReturnError] = useState('');
```

### 7c. Extend `loadOrder` — add return request fetch

Inside `loadOrder`, after the existing `setRefunds(refundRes.items)` line:

```typescript
const returnRes = await returnRequestService.getAll({ customerOrderId: orderId });
setReturnRequests(returnRes.items);
```

### 7d. New handler — `handleCreateReturn`

```typescript
const handleCreateReturn = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!order || !selectedReturnItem) return;
  setReturnSubmitting(true);
  setReturnError('');
  try {
    const created = await returnRequestService.create({
      customerOrderId: order.id,
      customerOrderItemId: selectedReturnItem.id,
      reason: returnReason.trim(),
    });
    setReturnRequests((prev) => [created, ...prev]);
    setShowReturnModal(false);
    setReturnReason('');
    setSelectedReturnItem(null);
  } catch (err) {
    setReturnError(err instanceof Error ? err.message : 'Failed to create return request.');
  } finally {
    setReturnSubmitting(false);
  }
};
```

### 7e. Derived variable

```typescript
const canCreateReturn = order != null && order.status !== 'Cancelled';
```

### 7f. Modify the Line items table

The existing Line items table (`<Card className="mb-4">` with `<Card.Title>Line items</Card.Title>`) currently renders:

```
| Product | SKU | Qty | Unit | Total |
```

Add an **Actions** column (no header text) as the last column. Show the header cell only when `canCreateReturn` is true.

```tsx
<thead>
  <tr>
    <th>Product</th>
    <th>SKU</th>
    <th>Qty</th>
    <th>Unit</th>
    <th>Total</th>
    {canCreateReturn && <th></th>}
  </tr>
</thead>
<tbody>
  {(order.items ?? []).map((item) => (
    <tr key={item.id}>
      <td>{item.productNameSnapshot}</td>
      <td>{item.skuSnapshot}</td>
      <td>{item.quantity}</td>
      <td>{item.unitPrice}</td>
      <td>{item.totalPrice}</td>
      {canCreateReturn && (
        <td>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => { setSelectedReturnItem(item); setShowReturnModal(true); }}
            data-testid={`btn-create-return-${item.id}`}
          >
            Create Return
          </button>
        </td>
      )}
    </tr>
  ))}
</tbody>
```

### 7g. Add Return Requests section card

Add a new `<Card className="mb-4">` after the Refunds card (the refunds card ends around line 315 in the current file):

```tsx
<Card className="mb-4">
  <Card.Body>
    <div className="d-flex justify-content-between align-items-center mb-3">
      <Card.Title className="h6 mb-0">Return Requests</Card.Title>
      <Link
        to={`/return-requests?customerOrderId=${order.id}`}
        className="small"
        data-testid="link-return-requests-filter"
      >
        View all for this order
      </Link>
    </div>
    {returnRequests.length === 0 ? (
      <p className="text-muted small mb-0">No return requests yet.</p>
    ) : (
      <Table responsive size="sm" className="mb-0">
        <thead>
          <tr>
            <th>ID</th>
            <th>Item ID</th>
            <th>Status</th>
            <th>Reason</th>
            <th>Requested</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {returnRequests.map((rr) => (
            <tr key={rr.id}>
              <td>#{rr.id}</td>
              <td>#{rr.customerOrderItemId}</td>
              <td><StatusBadge status={rr.status} /></td>
              <td className="text-truncate" style={{ maxWidth: 160 }}>{rr.reason}</td>
              <td>{new Date(rr.requestedAt).toLocaleDateString()}</td>
              <td>
                <Link
                  to={`/return-requests/${rr.id}`}
                  className="btn btn-sm btn-outline-secondary"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    )}
  </Card.Body>
</Card>
```

### 7h. Create Return Modal

Add at the bottom of the JSX (after the existing Refund Modal `</Modal>`):

```tsx
<Modal show={showReturnModal} onHide={() => { setShowReturnModal(false); setReturnReason(''); setReturnError(''); }}>
  <Modal.Header closeButton>
    <Modal.Title>Create Return Request</Modal.Title>
  </Modal.Header>
  <form onSubmit={(e) => void handleCreateReturn(e)}>
    <Modal.Body>
      {selectedReturnItem && (
        <div className="mb-3 p-2 bg-light rounded small">
          <div><strong>Item:</strong> {selectedReturnItem.productNameSnapshot}</div>
          <div><strong>SKU:</strong> {selectedReturnItem.skuSnapshot}</div>
        </div>
      )}
      <Form.Group className="mb-3">
        <Form.Label>Reason <span className="text-danger">*</span></Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          maxLength={500}
          value={returnReason}
          onChange={(e) => setReturnReason(e.target.value)}
          required
          data-testid="input-return-reason"
        />
        <Form.Text className="text-muted">{returnReason.length}/500</Form.Text>
      </Form.Group>
      {returnError && <div className="text-danger small">{returnError}</div>}
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={() => { setShowReturnModal(false); setReturnReason(''); setReturnError(''); }}>
        Cancel
      </Button>
      <Button
        type="submit"
        variant="primary"
        disabled={returnSubmitting || returnReason.trim().length === 0}
        data-testid="btn-submit-return"
      >
        {returnSubmitting ? 'Creating…' : 'Create return request'}
      </Button>
    </Modal.Footer>
  </form>
</Modal>
```

### Gotchas for `CustomerOrderDetailPage`

- The `CustomerOrderItem` type already has `id: number` (checked in `types/customerOrder.ts`). Use `item.id` as `customerOrderItemId`.
- The spec says "visible for orders whose status is not Cancelled" — use `order.status !== 'Cancelled'` (not `paymentStatus`). The column header cell must also be hidden when the button is hidden to keep the table layout clean.
- The return request list in this page is a snapshot loaded at mount. It updates when a new return request is created via the modal (optimistic prepend). There is no need to refetch the full order on return creation (unlike refund creation which refreshes the order for `paymentStatus`).
- The "View all for this order" link uses the `Link` component, not a `<a>` tag, for consistent React Router navigation.

---

## 8. `frontend/src/App.tsx`

**Action:** Modify existing file.

### Change 1 — Add import

After the existing `import ReturnRequestsPage from './pages/ReturnRequestsPage';` line (line 20), add:

```typescript
import ReturnRequestDetailPage from './pages/ReturnRequestDetailPage';
```

### Change 2 — Add route

After line 102 (the existing `<Route path="return-requests" element={<ReturnRequestsPage />} />`), add:

```tsx
<Route path="return-requests/:id" element={<ReturnRequestDetailPage />} />
```

The exact block in context:

```tsx
<Route path="return-requests" element={<ReturnRequestsPage />} />
<Route path="return-requests/:id" element={<ReturnRequestDetailPage />} />  {/* ADD THIS */}
<Route path="refunds" element={<RefundsPage />} />
```

---

## Cross-cutting notes

### `StatusBadge` component compatibility

`StatusBadge` at `frontend/src/components/admin/StatusBadge.tsx` accepts `status: string` (inferred from how other pages use it with multiple status union types). The `ReturnRequestStatus` values (`Requested`, `Approved`, `Rejected`, `Received`, `Refunded`, `Cancelled`) are plain strings and will work as-is. Verify that the `StatusBadge` variant mapping does not need to be extended — if it uses a lookup object, add entries for the new status strings. If it falls back to a default variant, no change is needed.

### `Pagination` component

Used identically to `RefundsPage`. Import from `'../components/Pagination'`. No changes to the component itself.

### `LoadingSpinner` and `ErrorAlert`

Both components are already imported in `RefundsPage` and `RefundDetailPage`. Use the same import paths in the new pages.

### Error handling in `CustomerOrderDetailPage`

The `loadOrder` function already has a single catch block that sets a top-level error. When adding the `returnRequestService.getAll` call inside `loadOrder`, it falls inside the same try/catch. This is consistent with how `refundService.getAll` is called. If the return request load fails, the whole page shows "Unable to load customer order" — acceptable for MVP.

### `data-testid` attributes

Follow the pattern established in `RefundsPage` and `RefundDetailPage`:
- `data-testid="select-status-filter"` on the status select
- `data-testid="input-order-filter"` on the order ID input
- `data-testid="return-request-row-{id}"` on table rows in the list page
- `data-testid="return-request-status-control"` on the status control wrapper
- `data-testid="select-return-request-status"` on the status select inside the control
- `data-testid="btn-save-return-request-status"` on the save button
- `data-testid="btn-create-return-{item.id}"` on each per-item button in the order detail
- `data-testid="btn-submit-return"` on the modal submit button
- `data-testid="link-return-requests-filter"` on the "View all for this order" link

### Implementation order

Implement in this order to avoid broken imports:
1. `types/returnRequest.ts`
2. `services/returnRequestService.ts`
3. `hooks/useReturnRequests.ts`
4. `components/admin/ReturnRequestStatusControl.tsx`
5. `pages/ReturnRequestDetailPage.tsx`
6. `pages/ReturnRequestsPage.tsx`
7. `pages/CustomerOrderDetailPage.tsx`
8. `App.tsx`
