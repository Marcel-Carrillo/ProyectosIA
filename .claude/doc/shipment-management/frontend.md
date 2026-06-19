# Frontend Implementation Plan — shipment-management (KAN-22 / KAN-35)

Generated from: `ai-specs/agents/frontend-developer.md`
Context: `.claude/sessions/context_session_shipment-management.md`

---

## Overview of changes

| File | Action |
|---|---|
| `frontend/src/types/shipment.ts` | CREATE — all TypeScript types |
| `frontend/src/services/shipmentService.ts` | REPLACE stub |
| `frontend/src/pages/ShipmentsPage.tsx` | REPLACE stub — list with filters, pagination, create modal |
| `frontend/src/pages/ShipmentDetailPage.tsx` | CREATE — detail with status transitions |
| `frontend/src/components/admin/ShipmentStatusControl.tsx` | CREATE — status-transition control (mirrors `RefundStatusControl`) |
| `frontend/src/App.tsx` | MODIFY — add `shipments/:id` route and import |
| `frontend/src/components/Layout.tsx` | NO CHANGE — "Shipments" nav item already present (line 29) |

---

## 1. `frontend/src/types/shipment.ts` (NEW)

**Pattern:** Mirror `frontend/src/types/supplierOrder.ts` structure; add transitions map and status colors from `frontend/src/types/refund.ts`.

### What to implement

```typescript
// Status union type — mirrors SupplierOrderStatus pattern
export type ShipmentStatus =
  | 'Pending'
  | 'Shipped'
  | 'InTransit'
  | 'Delivered'
  | 'Failed'
  | 'Returned';

// Domain entity
export interface Shipment {
  id: number;
  customerOrderId: number;
  supplierOrderId: number | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Embedded summaries returned by GET /:id
  customerOrder?: { id: number; orderNumber: string; status: string };
  supplierOrder?: { id: number; status: string } | null;
}

// List item (same shape — backend returns full object in list too)
export type ShipmentListItem = Shipment;

// Query params for list endpoint
export interface ShipmentQueryParams {
  page?: number;
  pageSize?: number;
  customerOrderId?: number;
  supplierOrderId?: number;
  status?: ShipmentStatus;
}

// Response envelopes — matches backend { success, data, message } pattern
export interface ShipmentListData {
  items: ShipmentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ShipmentListResponse {
  success: boolean;
  data: ShipmentListData;
  message: string;
}

export interface ShipmentResponse {
  success: boolean;
  data: Shipment;
  message: string;
}

// Request bodies
export interface CreateShipmentRequest {
  customerOrderId: number;
  supplierOrderId?: number | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}

export interface UpdateShipmentStatusRequest {
  status: ShipmentStatus;
}

// Error envelope
export interface ShipmentApiError {
  success: false;
  error: { message: string; code: string };
}

// State machine — used by ShipmentStatusControl
export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  Pending:   ['Shipped', 'Failed', 'Returned'],
  Shipped:   ['InTransit', 'Delivered', 'Failed', 'Returned'],
  InTransit: ['Delivered', 'Failed', 'Returned'],
  Delivered: [],
  Failed:    [],
  Returned:  [],
};

// Badge colors — fed to StatusBadge
export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  Pending:   'secondary',
  Shipped:   'primary',
  InTransit: 'info',
  Delivered: 'success',
  Failed:    'danger',
  Returned:  'warning',
};
```

### Key notes
- `ShipmentListItem` is an alias for `Shipment` — the backend returns the same shape in list and detail (per spec).
- `SHIPMENT_TRANSITIONS` is exported so `ShipmentStatusControl` can read allowed transitions without importing the service.
- `SHIPMENT_STATUS_COLORS` allows `StatusBadge` to receive a semantic color variant.
- All date fields are `string` (ISO 8601) — same as `SupplierOrder` pattern.

---

## 2. `frontend/src/services/shipmentService.ts` (REPLACE STUB)

**Pattern:** Mirror `frontend/src/services/supplierOrderService.ts` exactly.

### What to implement

```typescript
import axios, { AxiosError } from 'axios';
import {
  ShipmentQueryParams,
  ShipmentListResponse,
  ShipmentResponse,
  CreateShipmentRequest,
  UpdateShipmentStatusRequest,
  ShipmentApiError,
} from '../types/shipment';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/shipments`;

// Error code → human-readable message
export function mapShipmentError(code: string): string {
  switch (code) {
    case 'SHIPMENT_NOT_FOUND':
      return 'Shipment not found.';
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Customer order not found.';
    case 'SUPPLIER_ORDER_NOT_FOUND':
      return 'Supplier order not found.';
    case 'SHIPMENT_STATUS_TRANSITION_INVALID':
      return 'This status change is not allowed.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractShipmentErrorMessage(error: unknown): string {
  const code = (error as AxiosError<ShipmentApiError>).response?.data?.error?.code;
  return mapShipmentError(code ?? '');
}

export const shipmentService = {
  list: async (params?: ShipmentQueryParams): Promise<ShipmentListResponse> => {
    const response = await axios.get<ShipmentListResponse>(ADMIN_BASE, { params });
    return response.data;
  },

  getById: async (id: number): Promise<ShipmentResponse> => {
    const response = await axios.get<ShipmentResponse>(`${ADMIN_BASE}/${id}`);
    return response.data;
  },

  create: async (data: CreateShipmentRequest): Promise<ShipmentResponse> => {
    const response = await axios.post<ShipmentResponse>(ADMIN_BASE, data);
    return response.data;
  },

  updateStatus: async (
    id: number,
    data: UpdateShipmentStatusRequest
  ): Promise<ShipmentResponse> => {
    const response = await axios.patch<ShipmentResponse>(`${ADMIN_BASE}/${id}/status`, data);
    return response.data;
  },

  listByCustomerOrder: async (customerOrderId: number): Promise<ShipmentListResponse> => {
    const response = await axios.get<ShipmentListResponse>(ADMIN_BASE, {
      params: { customerOrderId, pageSize: 100 },
    });
    return response.data;
  },

  listBySupplierOrder: async (supplierOrderId: number): Promise<ShipmentListResponse> => {
    const response = await axios.get<ShipmentListResponse>(ADMIN_BASE, {
      params: { supplierOrderId, pageSize: 100 },
    });
    return response.data;
  },
};
```

### Service calls
- `GET /api/admin/shipments` — `list(params?)`
- `GET /api/admin/shipments/:id` — `getById(id)`
- `POST /api/admin/shipments` — `create(data)`
- `PATCH /api/admin/shipments/:id/status` — `updateStatus(id, { status })`

### Error handling
- `mapShipmentError` converts backend error codes to user-facing strings.
- `extractShipmentErrorMessage` unwraps the Axios error response to retrieve the code.
- All service methods let errors propagate (no try-catch inside service) — components handle them, same as `supplierOrderService`.

---

## 3. `frontend/src/pages/ShipmentsPage.tsx` (REPLACE STUB)

**Pattern:** Mirror `frontend/src/pages/RefundsPage.tsx` (simpler filter set, no debounced search) with the dual desktop-table / mobile-card layout from `SupplierOrdersPage.tsx`.

### Component structure

```
ShipmentsPage
  state:
    searchParams / setSearchParams   (URL sync)
    statusFilter: string             ('' = all)
    customerOrderFilter: string      (numeric string)
    supplierOrderFilter: string      (numeric string)
    page: number
    shipments: ShipmentListItem[]
    total: number
    loading: boolean
    error: string
    showCreateModal: boolean
    createError: string
    creating: boolean
    createForm: CreateShipmentRequest  (controlled form state)
  
  hooks:
    useSearchParams                  (URL sync, same as RefundsPage)
    useCallback(fetchShipments)      (depends on filters + page)
    useEffect → void fetchShipments()
    useEffect → sync filters to URL params
  
  handlers:
    fetchShipments()                 (calls shipmentService.list)
    handleCreateSubmit()             (calls shipmentService.create, refreshes list)
    handleCreateFormChange(field, value)
  
  JSX:
    <div className="admin-page">
      <div className="admin-page-header"> (title + Create button)
      <Row className="g-2 mb-3"> (filter row)
        <Col> status dropdown
        <Col> customerOrderId number input
        <Col> supplierOrderId number input
      <LoadingSpinner /> (conditional)
      <ErrorAlert /> (conditional)
      empty state paragraph
      
      desktop table (d-none d-md-block):
        <Table responsive hover>
          thead: ID, Customer Order, Supplier Order, Carrier, Tracking #, Status, Created, (action)
          tbody: rows with <Link> to /shipments/:id
      
      mobile card list (d-md-none admin-card-list):
        card per shipment with id link + status badge + createdAt
      
      <Pagination />
      
      Create Shipment <Modal>:
        Form fields: customerOrderId (required), supplierOrderId, carrier, trackingNumber, trackingUrl
        Submit button (disabled while creating)
        Error message
```

### State

| State variable | Type | Init | Purpose |
|---|---|---|---|
| `statusFilter` | `string` | from URL or `''` | Filter dropdown |
| `customerOrderFilter` | `string` | from URL or `''` | Numeric text input |
| `supplierOrderFilter` | `string` | from URL or `''` | Numeric text input |
| `page` | `number` | from URL or `1` | Current page |
| `shipments` | `ShipmentListItem[]` | `[]` | List data |
| `total` | `number` | `0` | Total count for pagination |
| `loading` | `boolean` | `true` | Loading state |
| `error` | `string` | `''` | Fetch error message |
| `showCreateModal` | `boolean` | `false` | Modal visibility |
| `createForm` | `CreateShipmentRequest` | `{ customerOrderId: 0 }` | Controlled form |
| `createError` | `string` | `''` | Create error message |
| `creating` | `boolean` | `false` | Submit in progress |

### Service calls and error handling
- `fetchShipments`: wraps `shipmentService.list({ status, customerOrderId, supplierOrderId, page, pageSize: 20 })` in try/catch; sets `error` on catch.
- `handleCreateSubmit`: wraps `shipmentService.create(createForm)` in try/catch; on success closes modal and calls `fetchShipments()`; on error calls `extractShipmentErrorMessage` and sets `createError`.

### Key implementation notes
- Filter inputs reset `page` to 1 on change (same as `SupplierOrdersPage`).
- `customerOrderId` and `supplierOrderId` filters use `type="number"` inputs (not text) — convert to `Number` or `undefined` when calling service.
- "Customer Order" column renders as `<Link to="/customer-orders/{id}">#{id}</Link>`; "Supplier Order" column is `—` if `null`.
- "Tracking #" column shows the raw `trackingNumber` string (truncated if needed); the full link is in the detail page.
- Status badge uses the existing `<StatusBadge status={shipment.status} />` component.
- The Create modal uses `React.Modal` from React Bootstrap (`<Modal show={showCreateModal} onHide={...}>`).
- The modal form must clear `createForm` and `createError` when closed.
- `createForm.customerOrderId` must be validated client-side: must be a positive integer before allowing submit (disable button otherwise).
- Responsive: table hidden on mobile (`d-none d-md-block`), card list shown (`d-md-none admin-card-list`) — same dual-render pattern as `SupplierOrdersPage`.
- Imports: `LoadingSpinner`, `ErrorAlert`, `Pagination`, `StatusBadge` (all existing components).
- `data-testid` attributes: `select-status-filter`, `input-customer-order-filter`, `input-supplier-order-filter`, `btn-create-shipment`, `shipment-row-{id}`, `shipment-link-{id}`.

### Statuses array
```typescript
const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'Pending', 'Shipped', 'InTransit', 'Delivered', 'Failed', 'Returned',
];
```

---

## 4. `frontend/src/pages/ShipmentDetailPage.tsx` (NEW)

**Pattern:** Mirror `frontend/src/pages/RefundDetailPage.tsx` structure; delegate status control to a new `ShipmentStatusControl` component.

### Component structure

```
ShipmentDetailPage
  params: id (useParams)
  state:
    shipment: Shipment | null
    loading: boolean
    error: string
    statusError: string
    saving: boolean
  
  hooks:
    useParams<{ id: string }>
    useCallback(loadShipment)
    useEffect → void loadShipment()
  
  handlers:
    loadShipment()       (calls shipmentService.getById)
    handleStatusSave()   (calls shipmentService.updateStatus, refreshes shipment)
  
  JSX:
    early returns: <LoadingSpinner />, <ErrorAlert />, null
    
    <div className="admin-page">
      <p><Link to="/shipments">← Back to shipments</Link></p>
      
      <div className="admin-page-header mb-3">
        <h1 className="h3">Shipment #{shipment.id}</h1>
        <StatusBadge status={shipment.status} />
      
      <Row>
        <Col md={6}>
          <Card "Details">
            <dl className="row">
              Customer Order  → Link to /customer-orders/:id
              Supplier Order  → Link to /supplier-orders/:id  (or "—" if null)
              Carrier         → {shipment.carrier ?? '—'}
              Tracking #      → text or <a href={trackingUrl}> if present
              Status          → <StatusBadge />
              Shipped At      → formatted date or '—'
              Delivered At    → formatted date or '—'
              Created         → formatted date
        
        <Col md={6}>
          <Card "Update Status">
            <ShipmentStatusControl
              shipment={shipment}
              saving={saving}
              error={statusError}
              onSave={handleStatusSave}
            />
```

### State

| Variable | Type | Init |
|---|---|---|
| `shipment` | `Shipment \| null` | `null` |
| `loading` | `boolean` | `true` |
| `error` | `string` | `''` |
| `statusError` | `string` | `''` |
| `saving` | `boolean` | `false` |

### Service calls and error handling
- `loadShipment`: validates `id` is numeric, calls `shipmentService.getById(id)` — reads `res.data` from the `ShipmentResponse` envelope; sets `error` on catch.
- `handleStatusSave(update)`: calls `shipmentService.updateStatus(shipment.id, update)`, then calls `setShipment(res.data)` to refresh inline; sets `statusError` via `extractShipmentErrorMessage` on catch.

### Key implementation notes
- Guard: if `id` is `NaN`, set `error = 'Invalid shipment id.'` and return early.
- Tracking number: if `shipment.trackingUrl` is set, render tracking number as `<a href={trackingUrl} target="_blank" rel="noreferrer">{trackingNumber}</a>`; otherwise render plain text.
- Supplier Order link: only render if `shipment.supplierOrderId !== null`.
- Dates: format with `new Date(date).toLocaleString()` (same as `RefundDetailPage`).
- `data-testid` attributes: `detail-badge-shipment`, `link-customer-order`, `link-supplier-order`, `tracking-link`.

---

## 5. `frontend/src/components/admin/ShipmentStatusControl.tsx` (NEW)

**Pattern:** Mirror `frontend/src/components/admin/RefundStatusControl.tsx` exactly.

### What to implement

```typescript
type ShipmentStatusControlProps = {
  shipment: Shipment;
  saving: boolean;
  error?: string;
  onSave: (update: UpdateShipmentStatusRequest) => void;
};
```

### Component logic

1. Local state: `status: ShipmentStatus` — initialised from `shipment.status`, synced via `useEffect` when `shipment` changes.
2. Compute `allowedTransitions = SHIPMENT_TRANSITIONS[shipment.status]`.
3. `isTerminal = allowedTransitions.length === 0`.
4. If terminal: render read-only `StatusBadge` + "This shipment is in a terminal state and cannot be updated." message.
5. Otherwise: render `<form>` with:
   - Current status: `<StatusBadge />`
   - New status `<Form.Select>`: first option is current status `(current)`, remaining options are `allowedTransitions`.
   - Error message if `error` is set.
   - Submit button: disabled when `saving || status === shipment.status`.
6. On submit: call `onSave({ status })`.

### Key notes
- `SHIPMENT_TRANSITIONS` imported from `../../../types/shipment` (relative from `components/admin/`).
- No additional fields beyond `status` (unlike `RefundStatusControl` which has `paymentProviderReference`). Shipment status transitions only need the new `status` value.
- `data-testid` attributes: `shipment-status-control`, `badge-shipment-status`, `select-shipment-status`, `btn-save-shipment-status`.

---

## 6. `frontend/src/App.tsx` (MODIFY)

### Current state (already confirmed by reading the file)
- Line 18: `import ShipmentsPage from './pages/ShipmentsPage';` — **already present**
- Line 99: `<Route path="shipments" element={<ShipmentsPage />} />` — **already present**
- No import or route exists for `ShipmentDetailPage`

### Changes required

**Add import** (after `SupplierOrderDetailPage` import, before `ReturnRequestsPage`):
```typescript
import ShipmentDetailPage from './pages/ShipmentDetailPage';
```

**Add route** (immediately after the `shipments` route at line 99):
```tsx
<Route path="shipments/:id" element={<ShipmentDetailPage />} />
```

### Key notes
- The route path must be `shipments/:id` (no leading slash) because it is a child of the `<Route path="/" element={<RequireAdminAuth><Layout /></RequireAdminAuth>}>` parent.
- No changes needed to the parent `<Route>` or `RequireAdminAuth` wrapper.
- No changes needed to `Layout.tsx` — the "Shipments" nav item (`<Nav.Link as={NavLink} to="/shipments">Shipments</Nav.Link>`) is already present at line 29.

---

## 7. `frontend/src/components/Layout.tsx` (NO CHANGE)

Already has `<Nav.Link as={NavLink} to="/shipments">Shipments</Nav.Link>` at line 29.

No modifications required.

---

## Dependency map

```
types/shipment.ts
  └── services/shipmentService.ts
        ├── pages/ShipmentsPage.tsx
        └── pages/ShipmentDetailPage.tsx
              └── components/admin/ShipmentStatusControl.tsx
                    └── types/shipment.ts (SHIPMENT_TRANSITIONS)

App.tsx
  ├── pages/ShipmentsPage.tsx       (route: shipments)
  └── pages/ShipmentDetailPage.tsx  (route: shipments/:id)  ← ADD
```

---

## Existing components reused (no changes)

| Component | Path | Used in |
|---|---|---|
| `StatusBadge` | `components/admin/StatusBadge` | ShipmentsPage, ShipmentDetailPage, ShipmentStatusControl |
| `LoadingSpinner` | `components/LoadingSpinner` | ShipmentsPage, ShipmentDetailPage |
| `ErrorAlert` | `components/ErrorAlert` | ShipmentsPage, ShipmentDetailPage |
| `Pagination` | `components/Pagination` | ShipmentsPage |

---

## Implementation order (for the parent agent)

1. Create `frontend/src/types/shipment.ts`
2. Replace `frontend/src/services/shipmentService.ts`
3. Create `frontend/src/components/admin/ShipmentStatusControl.tsx`
4. Replace `frontend/src/pages/ShipmentsPage.tsx`
5. Create `frontend/src/pages/ShipmentDetailPage.tsx`
6. Modify `frontend/src/App.tsx` (add import + route for `ShipmentDetailPage`)

---

## Critical notes for the implementer

- **URL env var**: use `process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000'` (same as `supplierOrderService`). Do NOT hardcode the base URL.
- **Response envelope**: `getById` returns `ShipmentResponse { success, data: Shipment, message }`. Access via `res.data` in `ShipmentDetailPage` (same as `SupplierOrderDetailPage`), not just `res`.
- **List response**: `list()` returns `ShipmentListResponse { success, data: { items, total, page, pageSize }, message }`. Access items via `res.data.items` and total via `res.data.total` (same pattern as `SupplierOrdersPage`).
- **`refundService.getById` discrepancy**: `RefundDetailPage` calls `refundService.getById` which returns `Refund` directly (not wrapped in `{ data }`). `shipmentService.getById` follows the supplier order pattern and returns `ShipmentResponse` with a `.data` property. The detail page must call `res.data` to extract the shipment.
- **Create modal reset**: on modal close OR on successful create, reset `createForm` to `{ customerOrderId: 0 }` and `createError` to `''`.
- **Terminal state guard**: in `ShipmentStatusControl`, check `SHIPMENT_TRANSITIONS[shipment.status].length === 0` — `Delivered`, `Failed`, and `Returned` are all terminal.
- **`shippedAt` / `deliveredAt`**: only show in the detail page `<dl>` when non-null; use `'—'` otherwise.
- **No supplier internal data**: tracking fields (`carrier`, `trackingNumber`, `trackingUrl`) are customer-visible per design — safe to display in admin UI.
- **PageSize constant**: use `PAGE_SIZE = 20` (same as `SupplierOrdersPage` and `RefundsPage`).
- **Test IDs**: include `data-testid` on all interactive/display elements — required for Playwright E2E in task 15.
