# Frontend Implementation Plan — supplier-management (KAN-15)

> Covers tasks.md sections 7, 8, 9, and 13.
> Reference template: `admin-product-panel` (ProductsPage + adminProductService + ProductFormModal).
> Stubs to implement **in place** (never create duplicates):
> - `frontend/src/pages/SuppliersPage.tsx`
> - `frontend/src/services/supplierService.ts`

---

## 0. Pre-implementation checklist

- Branch `feature/supplier-management` must exist (task 0.1 done before any file is touched).
- If working from a git worktree on Windows, see Windows --testMatch caveat in section 5.
- Route `/suppliers` is **already wired** in `App.tsx` under the admin `Layout` — no routing change is needed (task 9.3 is done).

---

## 1. File inventory

| Action | File | Task |
|--------|------|------|
| CREATE | `frontend/src/types/supplier.ts` | 7.1 |
| IMPLEMENT stub | `frontend/src/services/supplierService.ts` | 7.2 |
| MODIFY shared | `frontend/src/components/admin/StatusBadge.tsx` | 8.1 |
| IMPLEMENT stub | `frontend/src/pages/SuppliersPage.tsx` | 8.1–8.2 |
| CREATE | `frontend/src/components/admin/SupplierFormModal.tsx` | 9.1–9.2 |
| NO CHANGE | `frontend/src/App.tsx` | 9.3 (already done) |
| CREATE | `frontend/src/pages/__tests__/SuppliersPage.test.tsx` | 10.1 / 11 |
| CREATE | `frontend/src/components/admin/__tests__/SupplierFormModal.test.tsx` | 10.1 / 11 |
| EXTEND stub | `frontend/cypress/e2e/suppliers.cy.ts` | 13.4 |

---

## 2. Task 7.1 — `frontend/src/types/supplier.ts` (CREATE NEW)

Mirror `frontend/src/types/product.ts`. No imports from product types needed — these are independent.

```typescript
// ─── Status ─────────────────────────────────────────────────────────────────

export type SupplierStatus = 'Active' | 'Inactive' | 'Blocked';

// ─── Domain entity ───────────────────────────────────────────────────────────

export interface Supplier {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  notes: string | null;          // internal-only field; never render in public views
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Query params (GET /api/admin/suppliers) ─────────────────────────────────

export interface SupplierQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: SupplierStatus;
}

// ─── Write payloads ──────────────────────────────────────────────────────────

/** POST /api/admin/suppliers — name is required; status defaults to Active server-side */
export interface CreateSupplierInput {
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: SupplierStatus;      // omit to let backend default to Active
}

/** PATCH /api/admin/suppliers/:id — all fields optional */
export interface UpdateSupplierInput {
  name?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: SupplierStatus;
}

// ─── List envelope ───────────────────────────────────────────────────────────

export interface SupplierListResult {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierListResponse {
  success: boolean;
  data: SupplierListResult;
  message: string;
}

// ─── Single-item envelope ────────────────────────────────────────────────────

export interface SupplierResponse {
  success: boolean;
  data: Supplier;
  message: string;
}

// ─── Error envelope ──────────────────────────────────────────────────────────

/** Backend error shape from globalErrorHandler — same contract as AdminApiError in product.ts */
export interface SupplierAdminApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
```

**Notes:**
- `notes` is internal-only; include it in admin types but document the invariant that it must never be rendered in any customer-facing component.
- `status` in `CreateSupplierInput` is optional because the backend defaults to `Active`.

---

## 3. Task 7.2 — `frontend/src/services/supplierService.ts` (IMPLEMENT STUB)

Replace the entire stub content. Mirror `adminProductService.ts` exactly in structure.

The stub exports `supplierService` with methods `getAll`, `getById`, `create`, `update`, `delete`. The new implementation renames these to align with the admin contract (`list`, `getById`, `create`, `update`, `softDelete`) and adds error helpers.

```typescript
import axios, { AxiosError } from 'axios';
import {
  SupplierQueryParams,
  SupplierListResponse,
  SupplierResponse,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierAdminApiError,
} from '../types/supplier';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/suppliers`;

// ─── Error-code → UI-message mapping ─────────────────────────────────────────

export function mapSupplierError(code: string): string {
  switch (code) {
    case 'SUPPLIER_NOT_FOUND':
      return 'Supplier not found.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/** Extracts the backend error code from an unknown error and maps it to a UI message. */
export function extractSupplierErrorMessage(error: unknown): string {
  const code = (error as AxiosError<SupplierAdminApiError>).response?.data?.error?.code;
  return mapSupplierError(code ?? '');
}

// ─── Admin supplier CRUD ──────────────────────────────────────────────────────

export const supplierService = {
  list: async (params?: SupplierQueryParams): Promise<SupplierListResponse> => {
    try {
      const response = await axios.get<SupplierListResponse>(ADMIN_BASE, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw error;
    }
  },

  getById: async (id: number): Promise<SupplierResponse> => {
    try {
      const response = await axios.get<SupplierResponse>(`${ADMIN_BASE}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching supplier:', error);
      throw error;
    }
  },

  create: async (data: CreateSupplierInput): Promise<SupplierResponse> => {
    try {
      const response = await axios.post<SupplierResponse>(ADMIN_BASE, data);
      return response.data;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  },

  update: async (id: number, data: UpdateSupplierInput): Promise<SupplierResponse> => {
    try {
      const response = await axios.patch<SupplierResponse>(`${ADMIN_BASE}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }
  },

  /**
   * Soft-delete: calls DELETE /api/admin/suppliers/:id which sets status=Inactive.
   * The supplier row is preserved; no hard-delete ever occurs.
   */
  softDelete: async (id: number): Promise<void> => {
    try {
      await axios.delete(`${ADMIN_BASE}/${id}`);
    } catch (error) {
      console.error('Error soft-deleting supplier:', error);
      throw error;
    }
  },
};
```

**Notes:**
- `getAll` from the stub is replaced by `list` to match the admin convention.
- `delete` from the stub is replaced by `softDelete` to make the semantics explicit.
- The id parameter changes from `string` to `number` (mirrors `adminProductService.getById(id: number)`).

---

## 4. Modify shared component — `frontend/src/components/admin/StatusBadge.tsx`

The existing `StatusBadge` only accepts `ProductStatus` (`'Draft' | 'Active' | 'Inactive' | 'Archived'`). The supplier status `'Blocked'` is not in that union. To reuse the badge (per design decision D6), extend it to accept a union type.

**Change:** add `SupplierStatus` to the accepted status type and add the `Blocked` variant mapping.

```typescript
import React from 'react';
import { Badge } from 'react-bootstrap';
import { ProductStatus } from '../../types/product';
import { SupplierStatus } from '../../types/supplier';

export type StatusValue = ProductStatus | SupplierStatus;

type StatusBadgeProps = {
  status: StatusValue;
  'data-testid'?: string;
};

const VARIANT: Record<string, string> = {
  // Product statuses
  Draft: 'secondary',
  Active: 'success',
  Inactive: 'warning',
  Archived: 'dark',
  // Supplier-only status
  Blocked: 'danger',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, ...rest }) => (
  <Badge bg={VARIANT[status] ?? 'secondary'} data-testid={rest['data-testid']}>
    {status}
  </Badge>
);

export default StatusBadge;
```

**Why `Record<string, string>` instead of `Record<StatusValue, string>`:**
Using the union type as a Record key would require all four ProductStatus values AND all three SupplierStatus values to be present. Instead, use `Record<string, string>` with a fallback `?? 'secondary'` so adding new values in either domain cannot cause a runtime error.

**Backward compatibility:** All existing usages of `StatusBadge` with `ProductStatus` remain valid because `ProductStatus` is a subset of the new `StatusValue` union.

**Also update the existing `StatusBadge.test.tsx`** to add a test for `Blocked → bg-danger`:
```
['Blocked', 'bg-danger']
```
This verifies the supplier status renders correctly via the shared component.

---

## 5. Task 8.1–8.2 — `frontend/src/pages/SuppliersPage.tsx` (IMPLEMENT STUB)

Replace the stub entirely. Mirror `ProductsPage.tsx` faithfully, removing product-specific concerns (categories, sort/order, image) and substituting supplier-specific ones (contactName, status lifecycle, soft-delete confirm instead of hard-delete confirm).

### 5.1 State model

```typescript
// Filter state (URL-synced)
const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

// Data state
const [suppliers, setSuppliers] = useState<Supplier[]>([]);
const [total, setTotal] = useState(0);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

// Modal state
const [showCreate, setShowCreate] = useState(false);
const [toEdit, setToEdit] = useState<Supplier | null>(null);
const [toDeactivate, setToDeactivate] = useState<Supplier | null>(null);
const [deactivating, setDeactivating] = useState(false);
const [deactivateError, setDeactivateError] = useState('');
```

### 5.2 Effect hooks

```typescript
// Debounce search — 400ms to match ProductsPage
useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
  return () => clearTimeout(timer);
}, [searchInput]);

// URL sync — mirrors ProductsPage exactly
useEffect(() => {
  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (searchInput) params.set('search', searchInput);
  if (page > 1) params.set('page', String(page));
  setSearchParams(params, { replace: true });
}, [statusFilter, searchInput, page, setSearchParams]);

// Fetch — useCallback so ESLint exhaustive-deps is satisfied
const fetchSuppliers = useCallback(async () => {
  setLoading(true);
  setError('');
  try {
    const res = await supplierService.list({
      status: (statusFilter as SupplierStatus) || undefined,
      search: debouncedSearch || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
    setSuppliers(res.data.items);
    setTotal(res.data.total);
  } catch {
    setError('Unable to load suppliers. Please try again later.');
  } finally {
    setLoading(false);
  }
}, [statusFilter, debouncedSearch, page]);

useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);
```

### 5.3 Handlers

```typescript
const handleSearchChange = (value: string) => { setSearchInput(value); setPage(1); };
const handleStatusChange = (value: string) => { setStatusFilter(value); setPage(1); };
const handleReset = () => { setSearchInput(''); setStatusFilter(''); setPage(1); };

const handleDeactivate = async () => {
  if (!toDeactivate) return;
  setDeactivating(true);
  setDeactivateError('');
  try {
    await supplierService.softDelete(toDeactivate.id);
    setToDeactivate(null);
    fetchSuppliers();
  } catch (err) {
    setDeactivateError(extractSupplierErrorMessage(err));
  } finally {
    setDeactivating(false);
  }
};
```

### 5.4 JSX structure

Outer wrapper: `<div className="admin-page">` (same as ProductsPage).

**Header:**
```jsx
<div className="admin-page-header">
  <h1 className="h3 mb-0">Suppliers</h1>
  <Button variant="primary" onClick={() => setShowCreate(true)} data-testid="btn-new-supplier">
    New supplier
  </Button>
</div>
```

**Inline filter bar** (no separate component needed — simpler than ProductFilters since there is no category/sort):
```jsx
<Row className="g-2 mb-3 align-items-end">
  <Col xs={12} md={4}>
    <Form.Label className="small mb-1">Search</Form.Label>
    <Form.Control
      type="search"
      placeholder="Search by name…"
      value={searchInput}
      onChange={(e) => handleSearchChange(e.target.value)}
      data-testid="filter-search"
    />
  </Col>
  <Col xs={12} md={3}>
    <Form.Label className="small mb-1">Status</Form.Label>
    <Form.Select
      value={statusFilter}
      onChange={(e) => handleStatusChange(e.target.value)}
      data-testid="filter-status"
    >
      <option value="">All statuses</option>
      <option value="Active">Active</option>
      <option value="Inactive">Inactive</option>
      <option value="Blocked">Blocked</option>
    </Form.Select>
  </Col>
  <Col xs={12} md={2}>
    <Button
      variant="outline-secondary"
      className="w-100 admin-touch-btn"
      onClick={handleReset}
      data-testid="btn-filter-reset"
    >
      Reset
    </Button>
  </Col>
</Row>
```

**Loading / empty / error states:** Identical pattern to ProductsPage:
- `loading` → `<LoadingSpinner />` wrapped in `data-testid="loading-state"`
- `error` → `<ErrorAlert message={error} />`
- empty → `<Alert variant="info" data-testid="empty-state">No suppliers found.</Alert>`

**Responsive dual presentation:**

> Note: `ProductsPage.tsx` uses Bootstrap breakpoint `lg` (992px), not `md` (768px), for the table/card split (`d-lg-none` / `d-none d-lg-block`). This plan follows the existing implementation pattern for visual consistency. Tasks.md says "≥md" but the live implementation uses `lg`. Use `lg` to match the product panel exactly.

**Card list (mobile/tablet, hidden at lg+):**
```jsx
<div className="d-lg-none admin-card-list" data-testid="suppliers-card-list">
  {suppliers.map((s) => (
    <div key={s.id} className="admin-card-row" data-testid={`supplier-card-row-${s.id}`}>
      <div className="admin-card-row__header">
        <div className="flex-grow-1">
          <div className="fw-semibold">{s.name}</div>
          {s.contactName && <div className="admin-card-row__meta">{s.contactName}</div>}
          {s.contactEmail && <div className="admin-card-row__meta">{s.contactEmail}</div>}
          <StatusBadge status={s.status} />
        </div>
      </div>
      <div className="admin-card-row__actions">
        <Button
          variant="outline-primary"
          className="admin-touch-btn"
          onClick={() => setToEdit(s)}
          data-testid={`btn-edit-${s.id}`}
        >
          Edit
        </Button>
        <Button
          variant="outline-danger"
          className="admin-touch-btn"
          onClick={() => setToDeactivate(s)}
          data-testid={`btn-deactivate-${s.id}`}
          disabled={s.status === 'Inactive'}
        >
          Deactivate
        </Button>
      </div>
    </div>
  ))}
</div>
```

**Table (desktop, hidden below lg):**
```jsx
<div className="d-none d-lg-block admin-table-wrap">
  <Table hover data-testid="suppliers-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Contact Name</th>
        <th>Contact Email</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {suppliers.map((s) => (
        <tr key={s.id} data-testid={`supplier-row-${s.id}`}>
          <td>{s.name}</td>
          <td>{s.contactName ?? '—'}</td>
          <td>{s.contactEmail ?? '—'}</td>
          <td><StatusBadge status={s.status} /></td>
          <td>
            <Button
              size="sm"
              variant="outline-primary"
              className="me-2"
              onClick={() => setToEdit(s)}
              data-testid={`btn-edit-${s.id}`}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline-danger"
              onClick={() => setToDeactivate(s)}
              data-testid={`btn-deactivate-${s.id}`}
              disabled={s.status === 'Inactive'}
            >
              Deactivate
            </Button>
          </td>
        </tr>
      ))}
    </tbody>
  </Table>
</div>
```

**Pagination** (rendered when not in error state, mirrors ProductsPage):
```jsx
{!loading && !error && (
  <Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
)}
```

**Create modal:**
```jsx
<SupplierFormModal
  show={showCreate}
  onHide={() => setShowCreate(false)}
  onSuccess={() => { setShowCreate(false); fetchSuppliers(); }}
/>
```

**Edit modal:**
```jsx
<SupplierFormModal
  show={toEdit !== null}
  onHide={() => setToEdit(null)}
  initial={toEdit ?? undefined}
  onSuccess={() => { setToEdit(null); fetchSuppliers(); }}
/>
```

**Deactivate confirm modal:**
```jsx
<Modal show={toDeactivate !== null} onHide={() => setToDeactivate(null)} fullscreen="sm-down">
  <Modal.Header closeButton>
    <Modal.Title>Deactivate supplier</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    {deactivateError && <Alert variant="danger">{deactivateError}</Alert>}
    Are you sure you want to deactivate &quot;{toDeactivate?.name}&quot;?
    Their status will be set to Inactive. This can be undone by editing the supplier.
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setToDeactivate(null)}>
      Cancel
    </Button>
    <Button
      variant="danger"
      disabled={deactivating}
      onClick={handleDeactivate}
      data-testid="btn-confirm-deactivate"
    >
      {deactivating ? 'Deactivating…' : 'Deactivate'}
    </Button>
  </Modal.Footer>
</Modal>
```

**Import block** (top of `SuppliersPage.tsx`):
```typescript
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Button, Alert, Modal, Form, Row, Col } from 'react-bootstrap';
import { supplierService, extractSupplierErrorMessage } from '../services/supplierService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/admin/StatusBadge';
import SupplierFormModal from '../components/admin/SupplierFormModal';
import { Supplier, SupplierStatus } from '../types/supplier';

const PAGE_SIZE = 20;
```

---

## 6. Task 9.1–9.2 — `frontend/src/components/admin/SupplierFormModal.tsx` (CREATE NEW)

Mirror `ProductFormModal.tsx`. Supports both create (no `initial` prop) and edit (with `initial` prop).

### 6.1 Props

```typescript
type SupplierFormModalProps = {
  show: boolean;
  onHide: () => void;
  onSuccess: (supplier: Supplier) => void;
  initial?: Supplier;   // undefined = create mode; Supplier = edit mode
};
```

### 6.2 Internal form state

```typescript
type FormData = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  notes: string;
  status: SupplierStatus;
};

const EMPTY: FormData = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  notes: '',
  status: 'Active',
};
```

### 6.3 Effect — reset on open

```typescript
useEffect(() => {
  if (show) {
    if (initial) {
      setFormData({
        name: initial.name,
        contactName: initial.contactName ?? '',
        contactEmail: initial.contactEmail ?? '',
        contactPhone: initial.contactPhone ?? '',
        website: initial.website ?? '',
        notes: initial.notes ?? '',
        status: initial.status,
      });
    } else {
      setFormData(EMPTY);
    }
    setError('');
  }
}, [show, initial]);
```

### 6.4 Client validation (aligned with backend field limits)

Run before submitting. Set `error` state and return early if any rule fails:

| Field | Rule |
|-------|------|
| `name` | Required; trimmed length > 0; max 150 chars |
| `contactEmail` | If non-empty: must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; max 255 chars |
| `contactPhone` | If non-empty: max 30 chars |
| `website` | If non-empty: max 500 chars |
| `notes` | If non-empty: max 2000 chars |
| `status` | Must be one of `Active | Inactive | Blocked` (the select enforces this; validate defensively) |

### 6.5 Submit handler

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // … client validation …

  setSaving(true);
  setError('');
  try {
    let res: SupplierResponse;
    if (initial) {
      const payload: UpdateSupplierInput = {
        name: formData.name.trim(),
        contactName: formData.contactName || null,
        contactEmail: formData.contactEmail || null,
        contactPhone: formData.contactPhone || null,
        website: formData.website || null,
        notes: formData.notes || null,
        status: formData.status,
      };
      res = await supplierService.update(initial.id, payload);
    } else {
      const payload: CreateSupplierInput = {
        name: formData.name.trim(),
        contactName: formData.contactName || null,
        contactEmail: formData.contactEmail || null,
        contactPhone: formData.contactPhone || null,
        website: formData.website || null,
        notes: formData.notes || null,
        // status omitted to let backend default to Active
      };
      res = await supplierService.create(payload);
    }
    onSuccess(res.data);
  } catch (err) {
    setError(extractSupplierErrorMessage(err));
  } finally {
    setSaving(false);
  }
};
```

### 6.6 Form fields (JSX inside `<Modal.Body>`)

```jsx
{error && <Alert variant="danger">{error}</Alert>}

<Form.Group className="mb-3">
  <Form.Label>Name *</Form.Label>
  <Form.Control
    type="text"
    value={formData.name}
    onChange={(e) => handleChange('name', e.target.value)}
    data-testid="input-supplier-name"
  />
</Form.Group>

<Form.Group className="mb-3">
  <Form.Label>Contact name</Form.Label>
  <Form.Control
    type="text"
    value={formData.contactName}
    onChange={(e) => handleChange('contactName', e.target.value)}
    data-testid="input-supplier-contact-name"
  />
</Form.Group>

<Form.Group className="mb-3">
  <Form.Label>Contact email</Form.Label>
  <Form.Control
    type="email"
    value={formData.contactEmail}
    onChange={(e) => handleChange('contactEmail', e.target.value)}
    data-testid="input-supplier-contact-email"
  />
</Form.Group>

<Form.Group className="mb-3">
  <Form.Label>Contact phone</Form.Label>
  <Form.Control
    type="text"
    value={formData.contactPhone}
    onChange={(e) => handleChange('contactPhone', e.target.value)}
    data-testid="input-supplier-contact-phone"
  />
</Form.Group>

<Form.Group className="mb-3">
  <Form.Label>Website</Form.Label>
  <Form.Control
    type="text"
    value={formData.website}
    onChange={(e) => handleChange('website', e.target.value)}
    data-testid="input-supplier-website"
  />
</Form.Group>

{/* Status only in edit mode; on create, backend defaults to Active */}
{initial && (
  <Form.Group className="mb-3">
    <Form.Label>Status</Form.Label>
    <Form.Select
      value={formData.status}
      onChange={(e) => handleChange('status', e.target.value as SupplierStatus)}
      data-testid="select-supplier-status"
    >
      <option value="Active">Active</option>
      <option value="Inactive">Inactive</option>
      <option value="Blocked">Blocked</option>
    </Form.Select>
  </Form.Group>
)}

{/* Notes — internal; do not render this field on customer-facing views */}
<Form.Group className="mb-3">
  <Form.Label>Notes <span className="text-muted">(internal)</span></Form.Label>
  <Form.Control
    as="textarea"
    rows={3}
    value={formData.notes}
    onChange={(e) => handleChange('notes', e.target.value)}
    data-testid="input-supplier-notes"
  />
</Form.Group>
```

### 6.7 Modal wrapper

```jsx
<Modal
  show={show}
  onHide={onHide}
  fullscreen="sm-down"
  data-testid="modal-supplier-form"
>
  <Form onSubmit={handleSubmit}>
    <Modal.Header closeButton>
      <Modal.Title>{initial ? 'Edit supplier' : 'New supplier'}</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      {/* fields above */}
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onHide} data-testid="btn-modal-cancel">
        Cancel
      </Button>
      <Button
        type="submit"
        variant="primary"
        disabled={saving}
        data-testid="btn-modal-save"
      >
        {saving ? 'Saving…' : initial ? 'Save changes' : 'Create'}
      </Button>
    </Modal.Footer>
  </Form>
</Modal>
```

### 6.8 Import block

```typescript
import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { supplierService, extractSupplierErrorMessage } from '../../services/supplierService';
import {
  Supplier,
  SupplierStatus,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierResponse,
} from '../../types/supplier';
```

---

## 7. Task 9.3 — Route wiring (already done)

`frontend/src/App.tsx` already contains:
```tsx
import SuppliersPage from './pages/SuppliersPage';
// …
<Route path="/" element={<Layout />}>
  {/* … */}
  <Route path="suppliers" element={<SuppliersPage />} />
  {/* … */}
</Route>
```

**No change required.** Confirm by visual inspection that `SuppliersPage` is rendered inside the admin `Layout` (not `StorefrontLayout`). The isolation from the storefront is already correct.

---

## 8. Unit tests — `frontend/src/pages/__tests__/SuppliersPage.test.tsx` (CREATE NEW)

File path: `frontend/src/pages/__tests__/SuppliersPage.test.tsx`

Mirror `ProductsPage.test.tsx` exactly in structure (MemoryRouter wrapper, jest.mock at service level, `beforeEach(jest.clearAllMocks)`).

```typescript
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SuppliersPage from '../SuppliersPage';
import { Supplier } from '../../types/supplier';
import { supplierService } from '../../services/supplierService';

jest.mock('../../services/supplierService');
jest.mock('../../components/admin/SupplierFormModal', () => ({
  __esModule: true,
  default: ({ show }: { show: boolean }) =>
    show ? <div data-testid="mock-supplier-form-modal" /> : null,
}));

const mockedService = supplierService as jest.Mocked<typeof supplierService>;
```

**Helper factory:**
```typescript
const mockSupplier: Supplier = {
  id: 1,
  name: 'Acme Textiles',
  contactName: 'Alice',
  contactEmail: 'alice@acme.com',
  contactPhone: null,
  website: null,
  notes: null,
  status: 'Active',
  createdAt: '',
  updatedAt: '',
};

const listResult = (items: Supplier[]) => ({
  success: true,
  data: { items, total: items.length, page: 1, pageSize: 20 },
  message: '',
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/suppliers']}>
      <SuppliersPage />
    </MemoryRouter>,
  );
```

**Test cases:**

| Test | Description |
|------|-------------|
| `renders suppliers from the admin API` | Mock list returns one supplier; assert `suppliers-card-list` and `supplier-card-row-1` visible |
| `shows the empty state when there are no suppliers` | Mock list returns empty; assert `empty-state` |
| `shows an error message when the request fails` | Mock list rejects; assert "Unable to load suppliers" text |
| `status filter triggers a re-query with the selected value` | Change `filter-status` to `Inactive`; assert `supplierService.list` last called with `{ status: 'Inactive', page: 1 }` |
| `search change triggers a re-query after debounce` | Use `jest.useFakeTimers()`; change `filter-search`; advance timers 400ms; assert `list` called with `{ search: '...' }` |
| `reset clears filters and re-queries` | Set filters, click `btn-filter-reset`, assert `list` called with no status/search |
| `opens the create modal when New supplier is clicked` | Click `btn-new-supplier`; assert `mock-supplier-form-modal` visible |
| `opens and confirms the deactivate flow` | Mock list returns one supplier; click `btn-deactivate-1`; click `btn-confirm-deactivate`; assert `supplierService.softDelete` called with `1` |
| `shows error in deactivate modal when softDelete fails` | Mock softDelete to reject; complete deactivate flow; assert error message shown in modal |

---

## 9. Unit tests — `frontend/src/components/admin/__tests__/SupplierFormModal.test.tsx` (CREATE NEW)

File path: `frontend/src/components/admin/__tests__/SupplierFormModal.test.tsx`

Mirror `ProductFormModal.test.tsx`.

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import SupplierFormModal from '../SupplierFormModal';
import { Supplier } from '../../../types/supplier';
import { supplierService } from '../../../services/supplierService';

jest.mock('../../../services/supplierService', () => ({
  __esModule: true,
  supplierService: { create: jest.fn(), update: jest.fn() },
  extractSupplierErrorMessage: jest.requireActual('../../../services/supplierService').extractSupplierErrorMessage,
  mapSupplierError: jest.requireActual('../../../services/supplierService').mapSupplierError,
}));

const mocked = supplierService as jest.Mocked<typeof supplierService>;
```

**Helper for AxiosError:**
```typescript
const makeAxiosError = (code: string, status: number) => {
  const err = new axios.AxiosError('error');
  err.response = {
    data: { success: false, error: { code, message: 'x' } },
    status, statusText: '', headers: {}, config: {} as never,
  };
  return err;
};
```

**Test cases:**

| Test | Description |
|------|-------------|
| `shows validation error when name is empty` | Click save without filling name; assert "Name is required" in document |
| `shows validation error for invalid email` | Fill name, fill invalid contactEmail; click save; assert email-format error message |
| `creates a supplier and calls onSuccess` | Fill name, click save; assert `supplierService.create` called with `{ name: 'Acme', … }`; assert `onSuccess` called with returned supplier |
| `shows VALIDATION_ERROR from API mapped to UI message` | Mock create rejects with `makeAxiosError('VALIDATION_ERROR', 400)`; assert "check the form fields" message appears |
| `shows SUPPLIER_NOT_FOUND in edit mode` | Pass `initial` supplier; mock update rejects with `makeAxiosError('SUPPLIER_NOT_FOUND', 404)`; assert "not found" message |
| `edit mode pre-populates fields from initial prop` | Pass `initial` supplier; assert input values match supplier fields |
| `status select is visible in edit mode, hidden in create mode` | Render without `initial` → status select absent; render with `initial` → status select present |
| `submit button is disabled while saving` | Mock create returns a never-resolving promise; assert `btn-modal-save` is disabled during save |
| `resets form when modal reopens` | Close then reopen modal; assert name field is empty |

---

## 10. Cypress E2E — `frontend/cypress/e2e/suppliers.cy.ts` (EXTEND STUB)

Replace the `it.todo` stub with a full spec. Mirror `products.cy.ts` structure.

```typescript
describe('Suppliers', () => {
  const supplierName = `E2E Supplier ${Date.now()}`;

  it('supports full CRUD lifecycle with status controls', () => {
    cy.viewport(1280, 800);
    cy.visit('/suppliers');
    cy.get('[data-testid="btn-new-supplier"]').should('be.visible');

    // Create supplier
    cy.get('[data-testid="btn-new-supplier"]').click();
    cy.get('[data-testid="modal-supplier-form"]').should('be.visible');
    cy.get('[data-testid="input-supplier-name"]').type(supplierName);
    cy.get('[data-testid="input-supplier-contact-email"]').type('e2e@test.com');
    cy.get('[data-testid="btn-modal-save"]').click();
    cy.get('[data-testid="modal-supplier-form"]').should('not.exist');

    // Appears in list (desktop table)
    cy.get('[data-testid="suppliers-table"]').should('contain.text', supplierName);

    // Search by name
    cy.get('[data-testid="filter-search"]').clear().type(supplierName);
    cy.get('[data-testid="suppliers-table"]').should('contain.text', supplierName);
    cy.get('[data-testid="filter-search"]').clear();

    // Filter by status Active (should still be visible)
    cy.get('[data-testid="filter-status"]').select('Active');
    cy.get('[data-testid="suppliers-table"]').should('contain.text', supplierName);

    // Edit — change status to Blocked
    cy.get('[data-testid="suppliers-table"]')
      .contains(supplierName)
      .parents('tr')
      .find('[data-testid^="btn-edit-"]')
      .click();
    cy.get('[data-testid="modal-supplier-form"]').should('be.visible');
    cy.get('[data-testid="select-supplier-status"]').select('Blocked');
    cy.get('[data-testid="btn-modal-save"]').click();
    cy.get('[data-testid="modal-supplier-form"]').should('not.exist');

    // Filter by Blocked — should appear
    cy.get('[data-testid="filter-status"]').select('Blocked');
    cy.get('[data-testid="suppliers-table"]').should('contain.text', supplierName);

    // Deactivate (soft-delete confirm)
    cy.get('[data-testid="suppliers-table"]')
      .contains(supplierName)
      .parents('tr')
      .find('[data-testid^="btn-deactivate-"]')
      .click();
    cy.get('[data-testid="btn-confirm-deactivate"]').click();

    // Verify Inactive — filter to Inactive and confirm it's there
    cy.get('[data-testid="filter-status"]').select('Inactive');
    cy.get('[data-testid="suppliers-table"]').should('contain.text', supplierName);

    // Cleanup via API
    cy.get('[data-testid="suppliers-table"]')
      .contains(supplierName)
      .parents('tr')
      .find('[data-testid^="btn-edit-"]')
      .click();
    cy.get('[data-testid="modal-supplier-form"]').should('be.visible');
    // Extract id from data-testid to call DELETE
    cy.get('[data-testid^="btn-edit-"]')
      .first()
      .invoke('attr', 'data-testid')
      .then((tid) => {
        const id = tid?.replace('btn-edit-', '');
        cy.request('DELETE', `${Cypress.env('API_URL')}/api/admin/suppliers/${id}`);
      });
    cy.get('[data-testid="btn-modal-cancel"]').click();
  });

  it('shows no horizontal overflow at 360px (mobile)', () => {
    cy.viewport(360, 800);
    cy.visit('/suppliers');
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth);
    });
    // Card list visible, table hidden
    cy.get('[data-testid="suppliers-card-list"]').should('be.visible');
    cy.get('[data-testid="suppliers-table"]').should('not.be.visible');
  });

  it('shows no horizontal overflow at 768px (tablet)', () => {
    cy.viewport(768, 1024);
    cy.visit('/suppliers');
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth);
    });
  });

  it('shows no horizontal overflow at 1280px (desktop)', () => {
    cy.viewport(1280, 800);
    cy.visit('/suppliers');
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth);
    });
    // Table visible, card list hidden
    cy.get('[data-testid="suppliers-table"]').should('be.visible');
    cy.get('[data-testid="suppliers-card-list"]').should('not.be.visible');
  });
});
```

---

## 11. Endpoint contract summary

All calls target `/api/admin/suppliers`. No `/api/public/*` route exists for suppliers.

| Method | Path | Query / Body | Success | Error codes |
|--------|------|-------------|---------|-------------|
| GET | `/api/admin/suppliers` | `?page&pageSize&search&status` | 200 `{ success, data: { items, total, page, pageSize }, message }` | — |
| GET | `/api/admin/suppliers/:id` | — | 200 `{ success, data: Supplier, message }` | 404 SUPPLIER_NOT_FOUND, 400 VALIDATION_ERROR (non-numeric id) |
| POST | `/api/admin/suppliers` | `CreateSupplierInput` | 201 `{ success, data: Supplier, message }` | 400 VALIDATION_ERROR |
| PATCH | `/api/admin/suppliers/:id` | `UpdateSupplierInput` | 200 `{ success, data: Supplier, message }` | 400 VALIDATION_ERROR, 404 SUPPLIER_NOT_FOUND |
| DELETE | `/api/admin/suppliers/:id` | — | 200 success (sets status=Inactive) | 404 SUPPLIER_NOT_FOUND |

---

## 12. Data-testid inventory

All `data-testid` values used across components (for coordination with Cypress and RTL):

| data-testid | Element | Component |
|-------------|---------|-----------|
| `btn-new-supplier` | Create button | SuppliersPage |
| `filter-search` | Search input | SuppliersPage |
| `filter-status` | Status select | SuppliersPage |
| `btn-filter-reset` | Reset button | SuppliersPage |
| `loading-state` | Loading wrapper div | SuppliersPage |
| `empty-state` | Empty Alert | SuppliersPage |
| `suppliers-card-list` | Card list wrapper | SuppliersPage |
| `supplier-card-row-{id}` | Individual card | SuppliersPage |
| `suppliers-table` | Desktop Table | SuppliersPage |
| `supplier-row-{id}` | Table row | SuppliersPage |
| `btn-edit-{id}` | Edit button (card + table) | SuppliersPage |
| `btn-deactivate-{id}` | Deactivate button (card + table) | SuppliersPage |
| `btn-confirm-deactivate` | Confirm button in deactivate modal | SuppliersPage |
| `modal-supplier-form` | Form modal | SupplierFormModal |
| `input-supplier-name` | Name field | SupplierFormModal |
| `input-supplier-contact-name` | Contact name field | SupplierFormModal |
| `input-supplier-contact-email` | Contact email field | SupplierFormModal |
| `input-supplier-contact-phone` | Contact phone field | SupplierFormModal |
| `input-supplier-website` | Website field | SupplierFormModal |
| `input-supplier-notes` | Notes textarea | SupplierFormModal |
| `select-supplier-status` | Status select (edit only) | SupplierFormModal |
| `btn-modal-save` | Save/Create button | SupplierFormModal |
| `btn-modal-cancel` | Cancel button | SupplierFormModal |

---

## 13. Important implementation notes

### StatusBadge is a shared component — modify carefully
The change to `StatusBadge.tsx` is additive and backward-compatible, but it is a shared component used by `ProductsPage`, `ProductDetailPage`, and their tests. After modifying it, run all existing tests to confirm no regressions. The change to `VARIANT` from `Record<ProductStatus, string>` to `Record<string, string>` removes exhaustiveness checking — acceptable because a fallback `?? 'secondary'` guarantees runtime safety.

### Route already wired — do not touch App.tsx
The `/suppliers` route is already defined in `App.tsx` under the admin `Layout`. Editing it is not needed and risks introducing a regression.

### Status select hidden in create mode
On create, status is intentionally absent from the form — the backend defaults to `Active`. This prevents an admin from accidentally creating a supplier in a non-standard state. The status can be changed after creation via the edit modal. This is consistent with `ProductFormModal` not showing a status field on create.

### Deactivate vs Delete semantics
The "Deactivate" action calls `supplierService.softDelete()` (HTTP DELETE) which sets `status = Inactive`. The button label is "Deactivate" (not "Delete") to match the true semantics — a supplier is never physically removed. The confirm modal copy must reinforce this ("This can be undone by editing the supplier").

### notes field — internal only
The `notes` field is present in `SupplierFormModal` for admin use. It must never appear in any customer-facing component or storefront page. This is enforced by its absence from the `CreateSupplierInput` / `UpdateSupplierInput` on public service layers (which do not exist anyway — there is no public supplier service).

### Windows --testMatch caveat
When running RTL tests **from a git worktree path** (e.g., `.worktrees/feature/supplier-management`) on Windows, CRA's jest may report "No tests found" due to mixed path separators breaking micromatch globs. Fix:
```
CI=true npm test -- --watchAll=false --testMatch="**/src/**/*.test.{ts,tsx}"
```
This does NOT apply when running on the main checkout. Backend jest is not affected.

### PAGE_SIZE constant
Use `const PAGE_SIZE = 20` at module level, matching `ProductsPage.tsx`. The backend clamps `pageSize` at 100 — the frontend never needs to send more than 20 for the list view.

### Supplier-data isolation invariant
`SuppliersPage` and `SupplierFormModal` are admin-only components nested under the admin `Layout`. The `notes` field is labeled "(internal)" in the UI. No supplier fields should ever be imported into storefront components (`/pages/storefront/`, `/components/storefront/`). This constraint should be verified during code review as part of task 15.1.
