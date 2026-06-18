# Frontend Implementation Plan: Customer Management (KAN-17)

## Overview

This plan covers 9 files. Two are replacements (stub/placeholder → full implementation), four are new, and three are new test files. All patterns mirror the supplier-management feature exactly. Read each section in order — later files depend on types and services defined in earlier ones.

**Do not build or run the dev server.** Follow this plan file-by-file, test after each file group.

---

## File 1: `frontend/src/types/customer.ts` (NEW)

**Action:** Create from scratch.

```typescript
export type AddressType = 'Shipping' | 'Billing';

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: number;
  customerId: number;
  type: AddressType;
  fullName: string;
  phone: string | null;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

/** POST /api/admin/customers — firstName, lastName, email required. */
export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}

/** PATCH /api/admin/customers/:id — all fields optional. */
export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
}

export interface CustomerListResult {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerListResponse {
  success: boolean;
  data: CustomerListResult;
  message: string;
}

export interface CustomerResponse {
  success: boolean;
  data: Customer;
  message: string;
}

export interface CustomerAdminApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/** POST /api/admin/customers/:customerId/addresses — required fields per spec. */
export interface CreateCustomerAddressInput {
  type: AddressType;
  fullName: string;
  phone?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

/** PATCH /api/admin/customers/:customerId/addresses/:addressId — all optional. */
export interface UpdateCustomerAddressInput {
  type?: AddressType;
  fullName?: string;
  phone?: string | null;
  streetLine1?: string;
  streetLine2?: string | null;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

export interface AddressListResponse {
  success: boolean;
  data: CustomerAddress[];
  message: string;
}

export interface AddressResponse {
  success: boolean;
  data: CustomerAddress;
  message: string;
}
```

**Notes:**
- `Customer` intentionally has no `status` field — customers are not deactivated, they are hard-deleted.
- `CustomerAddress` has `customerId` as a field because it comes back in API responses and is used for ownership checks in the UI.
- `AddressType` is a union type, same pattern as `SupplierStatus`.
- `CustomerAdminApiError` mirrors `SupplierAdminApiError` exactly.

---

## File 2: `frontend/src/services/customerService.ts` (REPLACE stub)

**Action:** Replace the entire file. The current content is a non-functional stub with `throw new Error('Not implemented')`.

```typescript
import axios, { AxiosError } from 'axios';
import {
  CustomerQueryParams,
  CustomerListResponse,
  CustomerResponse,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerAdminApiError,
  CreateCustomerAddressInput,
  UpdateCustomerAddressInput,
  AddressListResponse,
  AddressResponse,
} from '../types/customer';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/customers`;

// ─── Error-code → UI-message mapping ─────────────────────────────────────────

export function mapCustomerError(code: string): string {
  switch (code) {
    case 'CUSTOMER_NOT_FOUND':
      return 'Customer not found.';
    case 'CUSTOMER_EMAIL_CONFLICT':
      return 'A customer with this email already exists.';
    case 'CUSTOMER_HAS_ORDERS':
      return 'This customer cannot be deleted because they have orders.';
    case 'ADDRESS_NOT_FOUND':
      return 'Address not found.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/** Extracts the backend error code from an unknown error and maps it to a UI message. */
export function extractCustomerErrorMessage(error: unknown): string {
  const code = (error as AxiosError<CustomerAdminApiError>).response?.data?.error?.code;
  return mapCustomerError(code ?? '');
}

/** Returns the raw backend error code, or empty string if not present. */
export function extractCustomerErrorCode(error: unknown): string {
  return (error as AxiosError<CustomerAdminApiError>).response?.data?.error?.code ?? '';
}

// ─── Admin customer CRUD ─────────────────────────────────────────────────────
// Security invariant: customers are admin-only. There is no public customer
// endpoint and this module never references supplier cost/credential fields.

export const customerService = {
  list: async (params?: CustomerQueryParams): Promise<CustomerListResponse> => {
    try {
      const response = await axios.get<CustomerListResponse>(ADMIN_BASE, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  },

  getById: async (id: number): Promise<CustomerResponse> => {
    try {
      const response = await axios.get<CustomerResponse>(`${ADMIN_BASE}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  },

  create: async (data: CreateCustomerInput): Promise<CustomerResponse> => {
    try {
      const response = await axios.post<CustomerResponse>(ADMIN_BASE, data);
      return response.data;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  },

  update: async (id: number, data: UpdateCustomerInput): Promise<CustomerResponse> => {
    try {
      const response = await axios.patch<CustomerResponse>(`${ADMIN_BASE}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },

  /**
   * Hard delete: DELETE /api/admin/customers/:id physically removes the record.
   * Returns 204 on success. Returns 409 CUSTOMER_HAS_ORDERS if blocked.
   * On success the response body is empty (204), so return void.
   */
  delete: async (id: number): Promise<void> => {
    try {
      await axios.delete(`${ADMIN_BASE}/${id}`);
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },

  // ─── Address sub-resource ────────────────────────────────────────────────

  listAddresses: async (customerId: number): Promise<AddressListResponse> => {
    try {
      const response = await axios.get<AddressListResponse>(
        `${ADMIN_BASE}/${customerId}/addresses`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching addresses:', error);
      throw error;
    }
  },

  createAddress: async (
    customerId: number,
    data: CreateCustomerAddressInput
  ): Promise<AddressResponse> => {
    try {
      const response = await axios.post<AddressResponse>(
        `${ADMIN_BASE}/${customerId}/addresses`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error creating address:', error);
      throw error;
    }
  },

  updateAddress: async (
    customerId: number,
    addressId: number,
    data: UpdateCustomerAddressInput
  ): Promise<AddressResponse> => {
    try {
      const response = await axios.patch<AddressResponse>(
        `${ADMIN_BASE}/${customerId}/addresses/${addressId}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  },

  deleteAddress: async (customerId: number, addressId: number): Promise<void> => {
    try {
      await axios.delete(`${ADMIN_BASE}/${customerId}/addresses/${addressId}`);
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  },
};
```

**Notes:**
- `extractCustomerErrorCode` is new (not in supplierService) — it returns the raw code so the page can branch on `CUSTOMER_HAS_ORDERS` vs generic error.
- `delete` returns `Promise<void>` (204 No Content), unlike suppliers where softDelete returns the updated supplier record.
- Address methods follow the nested URL pattern `/api/admin/customers/:customerId/addresses`.
- `ADMIN_BASE` points to `/api/admin/customers` (not `/api/customers`) — spec requires admin-only access.

---

## File 3: `frontend/src/pages/CustomersPage.tsx` (REPLACE placeholder)

**Action:** Replace the entire file (current content is the "Coming soon" placeholder).

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Button, Alert, Modal, Form, Row, Col } from 'react-bootstrap';
import {
  customerService,
  extractCustomerErrorMessage,
  extractCustomerErrorCode,
} from '../services/customerService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';
import CustomerFormModal from '../components/admin/CustomerFormModal';
import CustomerAddressesSection from '../components/admin/CustomerAddressesSection';
import { Customer } from '../types/customer';

const PAGE_SIZE = 20;

const CustomersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── Filter / pagination state ─────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  // ─── Data state ────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ─── Create / Edit modal state ─────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [toEdit, setToEdit] = useState<Customer | null>(null);

  // ─── Delete confirmation modal state ──────────────────────────────────────
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ─── Addresses section state ───────────────────────────────────────────────
  const [addressesCustomer, setAddressesCustomer] = useState<Customer | null>(null);

  // Debounce search field 400ms; resets to page 1.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Keep URL query string in sync.
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchInput) params.set('search', searchInput);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [searchInput, page, setSearchParams]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await customerService.list({
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setCustomers(res.data.items);
      setTotal(res.data.total);
    } catch {
      setError('Unable to load customers. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleReset = () => {
    setSearchInput('');
    setPage(1);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await customerService.delete(toDelete.id);
      setToDelete(null);
      fetchCustomers();
    } catch (err) {
      const code = extractCustomerErrorCode(err);
      if (code === 'CUSTOMER_HAS_ORDERS') {
        setDeleteError('This customer cannot be deleted because they have orders.');
      } else {
        setDeleteError(extractCustomerErrorMessage(err));
      }
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="h3 mb-0">Customers</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)} data-testid="btn-new-customer">
          New customer
        </Button>
      </div>

      {/* ─── Filters ──────────────────────────────────────────────────────── */}
      <Row className="g-2 mb-3 align-items-end">
        <Col xs={12} md={9}>
          <Form.Label className="small mb-1">Search</Form.Label>
          <Form.Control
            type="search"
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="filter-search"
          />
        </Col>
        <Col xs={12} md={3}>
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

      {/* ─── Loading / error / empty ───────────────────────────────────────── */}
      {loading && (
        <div data-testid="loading-state">
          <LoadingSpinner />
        </div>
      )}
      {!loading && error && <ErrorAlert message={error} />}
      {!loading && !error && customers.length === 0 && (
        <Alert variant="info" data-testid="empty-state">
          No customers found.
        </Alert>
      )}

      {/* ─── Data: mobile cards + desktop table ───────────────────────────── */}
      {!loading && !error && customers.length > 0 && (
        <>
          {/* Mobile card list */}
          <div className="d-lg-none admin-card-list" data-testid="customers-card-list">
            {customers.map((c) => (
              <div key={c.id} className="admin-card-row" data-testid={`customer-card-row-${c.id}`}>
                <div className="admin-card-row__header">
                  <div className="flex-grow-1">
                    <div className="fw-semibold">
                      {c.firstName} {c.lastName}
                    </div>
                    <div className="admin-card-row__meta">{c.email}</div>
                    {c.phone && <div className="admin-card-row__meta">{c.phone}</div>}
                  </div>
                </div>
                <div className="admin-card-row__actions">
                  <Button
                    variant="outline-secondary"
                    className="admin-touch-btn"
                    onClick={() => setAddressesCustomer(c)}
                    data-testid={`btn-addresses-${c.id}`}
                  >
                    Addresses
                  </Button>
                  <Button
                    variant="outline-primary"
                    className="admin-touch-btn"
                    onClick={() => setToEdit(c)}
                    data-testid={`btn-edit-${c.id}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="admin-touch-btn"
                    onClick={() => setToDelete(c)}
                    data-testid={`btn-delete-${c.id}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="d-none d-lg-block admin-table-wrap">
            <Table hover data-testid="customers-table">
              <thead>
                <tr>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} data-testid={`customer-row-${c.id}`}>
                    <td>{c.firstName}</td>
                    <td>{c.lastName}</td>
                    <td>{c.email}</td>
                    <td>{c.phone ?? '—'}</td>
                    <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-2"
                        onClick={() => setAddressesCustomer(c)}
                        data-testid={`btn-addresses-${c.id}`}
                      >
                        Addresses
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        onClick={() => setToEdit(c)}
                        data-testid={`btn-edit-${c.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => setToDelete(c)}
                        data-testid={`btn-delete-${c.id}`}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}

      {!loading && !error && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* ─── Create modal ──────────────────────────────────────────────────── */}
      <CustomerFormModal
        show={showCreate}
        onHide={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          fetchCustomers();
        }}
      />

      {/* ─── Edit modal ────────────────────────────────────────────────────── */}
      <CustomerFormModal
        show={toEdit !== null}
        onHide={() => setToEdit(null)}
        initial={toEdit ?? undefined}
        onSuccess={() => {
          setToEdit(null);
          fetchCustomers();
        }}
      />

      {/* ─── Delete confirmation modal ─────────────────────────────────────── */}
      <Modal show={toDelete !== null} onHide={() => setToDelete(null)} fullscreen="sm-down">
        <Modal.Header closeButton>
          <Modal.Title>Delete customer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          {!deleteError && (
            <>
              Are you sure you want to permanently delete &quot;{toDelete?.firstName}{' '}
              {toDelete?.lastName}&quot;? This action cannot be undone.
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setToDelete(null); setDeleteError(''); }}>
            Cancel
          </Button>
          {!deleteError && (
            <Button
              variant="danger"
              disabled={deleting}
              onClick={handleDelete}
              data-testid="btn-confirm-delete"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* ─── Addresses section modal ────────────────────────────────────────── */}
      <CustomerAddressesSection
        customer={addressesCustomer}
        onHide={() => setAddressesCustomer(null)}
      />
    </div>
  );
};

export default CustomersPage;
```

**Notes:**
- No status filter: customers have no Active/Inactive/Blocked lifecycle.
- `handleDelete` branches on `CUSTOMER_HAS_ORDERS` (shows the blocked message) vs other errors (shows generic message). The confirm button is hidden once `deleteError` is set so the user reads the message and must cancel.
- `fetchCustomers` is called with `void` (ignoring the returned promise) in event handlers — same pattern as `SuppliersPage`.
- `createdAt` is formatted with `toLocaleDateString()` for the table; the raw ISO string is not shown directly.
- Both `btn-addresses-${c.id}` buttons (card + table row) share the same `data-testid` prefix, same pattern as edit/delete.

---

## File 4: `frontend/src/components/admin/CustomerFormModal.tsx` (NEW)

**Action:** Create new file.

```typescript
import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import {
  customerService,
  extractCustomerErrorMessage,
} from '../../services/customerService';
import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from '../../types/customer';

type CustomerFormModalProps = {
  show: boolean;
  onHide: () => void;
  onSuccess: (customer: Customer) => void;
  initial?: Customer; // undefined = create mode; Customer = edit mode
};

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const EMPTY: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  show,
  onHide,
  onSuccess,
  initial,
}) => {
  const [formData, setFormData] = useState<FormData>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form state whenever the modal opens.
  useEffect(() => {
    if (show) {
      if (initial) {
        setFormData({
          firstName: initial.firstName,
          lastName: initial.lastName,
          email: initial.email,
          phone: initial.phone ?? '',
        });
      } else {
        setFormData(EMPTY);
      }
      setError('');
    }
  }, [show, initial]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const email = formData.email.trim();

    if (!firstName) return 'First name is required.';
    if (firstName.length > 100) return 'First name must not exceed 100 characters.';
    if (!lastName) return 'Last name is required.';
    if (lastName.length > 100) return 'Last name must not exceed 100 characters.';
    if (!email) return 'Email is required.';
    if (!EMAIL_REGEX.test(email)) return 'Email must be a valid email address.';
    if (email.length > 255) return 'Email must not exceed 255 characters.';
    if (formData.phone && formData.phone.length > 30)
      return 'Phone must not exceed 30 characters.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      let res;
      if (initial) {
        const payload: UpdateCustomerInput = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone || null,
        };
        res = await customerService.update(initial.id, payload);
      } else {
        const payload: CreateCustomerInput = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone || null,
        };
        res = await customerService.create(payload);
      }
      onSuccess(res.data);
    } catch (err) {
      setError(extractCustomerErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} fullscreen="sm-down" data-testid="modal-customer-form">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{initial ? 'Edit customer' : 'New customer'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>First name *</Form.Label>
            <Form.Control
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              data-testid="input-customer-first-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Last name *</Form.Label>
            <Form.Control
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              data-testid="input-customer-last-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email *</Form.Label>
            <Form.Control
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              data-testid="input-customer-email"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Phone</Form.Label>
            <Form.Control
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              data-testid="input-customer-phone"
            />
          </Form.Group>
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
  );
};

export default CustomerFormModal;
```

**Notes:**
- `onSuccess` receives the created/updated `Customer` object — same signature as `SupplierFormModal`.
- The `email` input uses `type="email"` for browser-level validation hint, but client-side `EMAIL_REGEX` validation runs on submit regardless (same as supplier pattern).
- There is no status field — customers have no status lifecycle.
- `phone || null` converts empty string to `null` before sending to API.

---

## File 5: `frontend/src/components/admin/CustomerAddressesSection.tsx` (NEW)

**Action:** Create new file. This is a modal triggered from `CustomersPage` that shows the full address list for one customer and allows Add/Edit/Delete per address.

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Alert, Table } from 'react-bootstrap';
import {
  customerService,
  extractCustomerErrorMessage,
} from '../../services/customerService';
import CustomerAddressFormModal from './CustomerAddressFormModal';
import { Customer, CustomerAddress } from '../../types/customer';

type CustomerAddressesSectionProps = {
  customer: Customer | null; // null = hidden
  onHide: () => void;
};

const CustomerAddressesSection: React.FC<CustomerAddressesSectionProps> = ({
  customer,
  onHide,
}) => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Add / Edit modal state
  const [showAdd, setShowAdd] = useState(false);
  const [toEditAddress, setToEditAddress] = useState<CustomerAddress | null>(null);

  // Delete state
  const [toDeleteAddress, setToDeleteAddress] = useState<CustomerAddress | null>(null);
  const [deletingAddress, setDeletingAddress] = useState(false);
  const [deleteAddressError, setDeleteAddressError] = useState('');

  const fetchAddresses = useCallback(async () => {
    if (!customer) return;
    setLoading(true);
    setError('');
    try {
      const res = await customerService.listAddresses(customer.id);
      setAddresses(res.data);
    } catch {
      setError('Unable to load addresses. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    if (customer) {
      fetchAddresses();
    } else {
      setAddresses([]);
      setError('');
    }
  }, [customer, fetchAddresses]);

  const handleDeleteAddress = async () => {
    if (!customer || !toDeleteAddress) return;
    setDeletingAddress(true);
    setDeleteAddressError('');
    try {
      await customerService.deleteAddress(customer.id, toDeleteAddress.id);
      setToDeleteAddress(null);
      fetchAddresses();
    } catch (err) {
      setDeleteAddressError(extractCustomerErrorMessage(err));
    } finally {
      setDeletingAddress(false);
    }
  };

  // Reset internal state when the outer modal closes.
  const handleHide = () => {
    setShowAdd(false);
    setToEditAddress(null);
    setToDeleteAddress(null);
    setDeleteAddressError('');
    onHide();
  };

  return (
    <>
      <Modal
        show={customer !== null}
        onHide={handleHide}
        size="lg"
        fullscreen="sm-down"
        data-testid="modal-customer-addresses"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Addresses — {customer?.firstName} {customer?.lastName}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {!loading && !error && addresses.length === 0 && (
            <Alert variant="info" data-testid="addresses-empty-state">
              No addresses on file.
            </Alert>
          )}
          {!loading && !error && addresses.length > 0 && (
            <Table hover size="sm" data-testid="addresses-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Full Name</th>
                  <th>Street</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {addresses.map((a) => (
                  <tr key={a.id} data-testid={`address-row-${a.id}`}>
                    <td>{a.type}</td>
                    <td>{a.fullName}</td>
                    <td>
                      {a.streetLine1}
                      {a.streetLine2 ? `, ${a.streetLine2}` : ''}
                    </td>
                    <td>{a.city}</td>
                    <td>{a.country}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        onClick={() => setToEditAddress(a)}
                        data-testid={`btn-edit-address-${a.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => setToDeleteAddress(a)}
                        data-testid={`btn-delete-address-${a.id}`}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={() => setShowAdd(true)}
            data-testid="btn-add-address"
          >
            Add address
          </Button>
          <Button variant="secondary" onClick={handleHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add address modal */}
      {customer && (
        <CustomerAddressFormModal
          show={showAdd}
          onHide={() => setShowAdd(false)}
          customerId={customer.id}
          onSuccess={() => {
            setShowAdd(false);
            fetchAddresses();
          }}
        />
      )}

      {/* Edit address modal */}
      {customer && (
        <CustomerAddressFormModal
          show={toEditAddress !== null}
          onHide={() => setToEditAddress(null)}
          customerId={customer.id}
          initial={toEditAddress ?? undefined}
          onSuccess={() => {
            setToEditAddress(null);
            fetchAddresses();
          }}
        />
      )}

      {/* Delete address confirmation modal */}
      <Modal
        show={toDeleteAddress !== null}
        onHide={() => { setToDeleteAddress(null); setDeleteAddressError(''); }}
        fullscreen="sm-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete address</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteAddressError && <Alert variant="danger">{deleteAddressError}</Alert>}
          {!deleteAddressError && (
            <>Are you sure you want to delete this address? This action cannot be undone.</>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => { setToDeleteAddress(null); setDeleteAddressError(''); }}
          >
            Cancel
          </Button>
          {!deleteAddressError && (
            <Button
              variant="danger"
              disabled={deletingAddress}
              onClick={handleDeleteAddress}
              data-testid="btn-confirm-delete-address"
            >
              {deletingAddress ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CustomerAddressesSection;
```

**Notes:**
- `customer` prop is the signal to open/close the modal (null = hidden, Customer = open). This keeps state ownership in `CustomersPage` and avoids prop drilling a boolean `show` separately.
- `fetchAddresses` is gated on `customer !== null` so it never fires when closed.
- `handleHide` resets all sub-modal state before calling `onHide` — prevents stale modal state if the parent re-opens the section for a different customer.
- Nested modals (`CustomerAddressFormModal`, delete confirm) are conditionally rendered only when `customer` is truthy to avoid rendering issues.

---

## File 6: `frontend/src/components/admin/CustomerAddressFormModal.tsx` (NEW)

**Action:** Create new file.

```typescript
import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import {
  customerService,
  extractCustomerErrorMessage,
} from '../../services/customerService';
import {
  CustomerAddress,
  AddressType,
  CreateCustomerAddressInput,
  UpdateCustomerAddressInput,
} from '../../types/customer';

type CustomerAddressFormModalProps = {
  show: boolean;
  onHide: () => void;
  customerId: number;
  onSuccess: (address: CustomerAddress) => void;
  initial?: CustomerAddress; // undefined = create mode; CustomerAddress = edit mode
};

type FormData = {
  type: AddressType;
  fullName: string;
  phone: string;
  streetLine1: string;
  streetLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

const EMPTY: FormData = {
  type: 'Shipping',
  fullName: '',
  phone: '',
  streetLine1: '',
  streetLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: '',
};

const CustomerAddressFormModal: React.FC<CustomerAddressFormModalProps> = ({
  show,
  onHide,
  customerId,
  onSuccess,
  initial,
}) => {
  const [formData, setFormData] = useState<FormData>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      if (initial) {
        setFormData({
          type: initial.type,
          fullName: initial.fullName,
          phone: initial.phone ?? '',
          streetLine1: initial.streetLine1,
          streetLine2: initial.streetLine2 ?? '',
          city: initial.city,
          province: initial.province,
          postalCode: initial.postalCode,
          country: initial.country,
        });
      } else {
        setFormData(EMPTY);
      }
      setError('');
    }
  }, [show, initial]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    if (!formData.fullName.trim()) return 'Full name is required.';
    if (formData.fullName.length > 150) return 'Full name must not exceed 150 characters.';
    if (!formData.streetLine1.trim()) return 'Street line 1 is required.';
    if (formData.streetLine1.length > 150) return 'Street line 1 must not exceed 150 characters.';
    if (formData.streetLine2 && formData.streetLine2.length > 150)
      return 'Street line 2 must not exceed 150 characters.';
    if (!formData.city.trim()) return 'City is required.';
    if (formData.city.length > 100) return 'City must not exceed 100 characters.';
    if (!formData.province.trim()) return 'Province is required.';
    if (formData.province.length > 100) return 'Province must not exceed 100 characters.';
    if (!formData.postalCode.trim()) return 'Postal code is required.';
    if (formData.postalCode.length > 20) return 'Postal code must not exceed 20 characters.';
    if (!formData.country.trim()) return 'Country is required.';
    if (formData.country.length > 100) return 'Country must not exceed 100 characters.';
    if (formData.phone && formData.phone.length > 30)
      return 'Phone must not exceed 30 characters.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      let res;
      if (initial) {
        const payload: UpdateCustomerAddressInput = {
          type: formData.type,
          fullName: formData.fullName.trim(),
          phone: formData.phone || null,
          streetLine1: formData.streetLine1.trim(),
          streetLine2: formData.streetLine2 || null,
          city: formData.city.trim(),
          province: formData.province.trim(),
          postalCode: formData.postalCode.trim(),
          country: formData.country.trim(),
        };
        res = await customerService.updateAddress(customerId, initial.id, payload);
      } else {
        const payload: CreateCustomerAddressInput = {
          type: formData.type,
          fullName: formData.fullName.trim(),
          phone: formData.phone || null,
          streetLine1: formData.streetLine1.trim(),
          streetLine2: formData.streetLine2 || null,
          city: formData.city.trim(),
          province: formData.province.trim(),
          postalCode: formData.postalCode.trim(),
          country: formData.country.trim(),
        };
        res = await customerService.createAddress(customerId, payload);
      }
      onSuccess(res.data);
    } catch (err) {
      setError(extractCustomerErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      fullscreen="sm-down"
      data-testid="modal-customer-address-form"
    >
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{initial ? 'Edit address' : 'New address'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Type *</Form.Label>
            <Form.Select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value as AddressType)}
              data-testid="select-address-type"
            >
              <option value="Shipping">Shipping</option>
              <option value="Billing">Billing</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Full name *</Form.Label>
            <Form.Control
              type="text"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              data-testid="input-address-full-name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Phone</Form.Label>
            <Form.Control
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              data-testid="input-address-phone"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Street line 1 *</Form.Label>
            <Form.Control
              type="text"
              value={formData.streetLine1}
              onChange={(e) => handleChange('streetLine1', e.target.value)}
              data-testid="input-address-street-line-1"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Street line 2</Form.Label>
            <Form.Control
              type="text"
              value={formData.streetLine2}
              onChange={(e) => handleChange('streetLine2', e.target.value)}
              data-testid="input-address-street-line-2"
            />
          </Form.Group>

          <Row>
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Form.Label>City *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  data-testid="input-address-city"
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Province *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.province}
                  onChange={(e) => handleChange('province', e.target.value)}
                  data-testid="input-address-province"
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Postal code *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  data-testid="input-address-postal-code"
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Country *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  data-testid="input-address-country"
                />
              </Form.Group>
            </Col>
          </Row>
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
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add address'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CustomerAddressFormModal;
```

**Notes:**
- `customerId` is passed as a prop (not read from URL params) — the modal is always opened from within the context of a specific customer.
- `type` defaults to `'Shipping'` in `EMPTY` — the most common address type.
- `streetLine2`, `phone` are optional; trimmed to `null` if empty before sending to API.
- City/Province in one row, PostalCode/Country in another row — uses Bootstrap responsive grid for a cleaner layout on desktop.

---

## File 7: `frontend/src/pages/__tests__/CustomersPage.test.tsx` (NEW)

**Action:** Create new file. Follow `SuppliersPage.test.tsx` exactly.

```typescript
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomersPage from '../CustomersPage';
import { Customer } from '../../types/customer';
import {
  customerService,
  extractCustomerErrorMessage,
  mapCustomerError,
  extractCustomerErrorCode,
} from '../../services/customerService';

jest.mock('../../services/customerService', () => {
  const actual = jest.requireActual('../../services/customerService');
  return {
    __esModule: true,
    customerService: {
      list: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      listAddresses: jest.fn(),
      createAddress: jest.fn(),
      updateAddress: jest.fn(),
      deleteAddress: jest.fn(),
    },
    extractCustomerErrorMessage: actual.extractCustomerErrorMessage,
    mapCustomerError: actual.mapCustomerError,
    extractCustomerErrorCode: actual.extractCustomerErrorCode,
  };
});

jest.mock('../../components/admin/CustomerFormModal', () => ({
  __esModule: true,
  default: ({ show }: { show: boolean }) =>
    show ? <div data-testid="mock-customer-form-modal" /> : null,
}));

jest.mock('../../components/admin/CustomerAddressesSection', () => ({
  __esModule: true,
  default: ({ customer }: { customer: Customer | null }) =>
    customer ? <div data-testid="mock-addresses-section" /> : null,
}));

const mockedService = customerService as jest.Mocked<typeof customerService>;

const mockCustomer: Customer = {
  id: 1,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const listResult = (items: Customer[]) => ({
  success: true,
  data: { items, total: items.length, page: 1, pageSize: 20 },
  message: '',
});

const makeAxiosError = (code: string, status: number) => {
  const axios = jest.requireActual('axios');
  const err = new axios.AxiosError('error');
  err.response = {
    data: { success: false, error: { code, message: 'x' } },
    status,
    statusText: '',
    headers: {},
    config: {} as never,
  };
  return err;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/customers']}>
      <CustomersPage />
    </MemoryRouter>
  );

describe('CustomersPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders customers from the admin API', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    expect(await screen.findByTestId('customer-card-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('customers-table')).toHaveTextContent('Jane');
  });

  it('shows the empty state when there are no customers', async () => {
    mockedService.list.mockResolvedValue(listResult([]));
    renderPage();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    mockedService.list.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/unable to load customers/i)).toBeInTheDocument();
  });

  it('re-queries after the search debounce', async () => {
    jest.useFakeTimers();
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    fireEvent.change(screen.getByTestId('filter-search'), { target: { value: 'jane' } });
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() =>
      expect(mockedService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'jane' })
      )
    );
    jest.useRealTimers();
  });

  it('reset clears search and re-queries', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    await waitFor(() => expect(mockedService.list).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('filter-search'), { target: { value: 'jane' } });
    fireEvent.click(screen.getByTestId('btn-filter-reset'));
    await waitFor(() =>
      expect(mockedService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined })
      )
    );
  });

  it('opens the create modal when New customer is clicked', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    expect(await screen.findByTestId('customer-card-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-new-customer'));
    expect(screen.getByTestId('mock-customer-form-modal')).toBeInTheDocument();
  });

  it('opens the edit modal when Edit is clicked', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-edit-1')[0]);
    expect(screen.getByTestId('mock-customer-form-modal')).toBeInTheDocument();
  });

  it('opens the addresses section when Addresses is clicked', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-addresses-1')[0]);
    expect(screen.getByTestId('mock-addresses-section')).toBeInTheDocument();
  });

  it('confirms the delete flow and calls delete', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    mockedService.delete.mockResolvedValue(undefined);
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-delete-1')[0]);
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    await waitFor(() => expect(mockedService.delete).toHaveBeenCalledWith(1));
  });

  it('shows CUSTOMER_HAS_ORDERS message on 409 delete and hides confirm button', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    mockedService.delete.mockRejectedValue(makeAxiosError('CUSTOMER_HAS_ORDERS', 409));
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-delete-1')[0]);
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    expect(
      await screen.findByText(/this customer cannot be deleted because they have orders/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('btn-confirm-delete')).not.toBeInTheDocument();
  });

  it('shows a generic error in the delete modal when delete fails with an unknown code', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    mockedService.delete.mockRejectedValue(new Error('network fail'));
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-delete-1')[0]);
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    expect(await screen.findByText(/unexpected error/i)).toBeInTheDocument();
  });
});
```

**Notes:**
- `CustomerAddressesSection` is mocked because it owns its own async state and loading logic — same pattern as `SupplierFormModal` in the supplier tests.
- `makeAxiosError` re-uses `jest.requireActual('axios')` to construct a real `AxiosError` without importing axios at the top level — this avoids TypeScript module resolution issues in test files.
- The "confirm button hidden after 409" assertion tests the UX branching logic specific to customers (suppliers never have this scenario).
- `mockedService.delete.mockResolvedValue(undefined)` — `delete` returns `Promise<void>`, so `undefined` is correct.
- All async assertions use `findBy*` (not `getBy*`) per the project ESLint rule.

---

## File 8: `frontend/src/components/admin/__tests__/CustomerFormModal.test.tsx` (NEW)

**Action:** Create new file. Mirror `SupplierFormModal.test.tsx` exactly.

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import CustomerFormModal from '../CustomerFormModal';
import { Customer } from '../../../types/customer';
import { customerService } from '../../../services/customerService';

jest.mock('../../../services/customerService', () => {
  const actual = jest.requireActual('../../../services/customerService');
  return {
    __esModule: true,
    customerService: { create: jest.fn(), update: jest.fn() },
    extractCustomerErrorMessage: actual.extractCustomerErrorMessage,
    mapCustomerError: actual.mapCustomerError,
    extractCustomerErrorCode: actual.extractCustomerErrorCode,
  };
});

const mocked = customerService as unknown as {
  create: jest.Mock;
  update: jest.Mock;
};

const makeAxiosError = (code: string, status: number) => {
  const err = new axios.AxiosError('error');
  err.response = {
    data: { success: false, error: { code, message: 'x' } },
    status,
    statusText: '',
    headers: {},
    config: {} as never,
  };
  return err;
};

const existing: Customer = {
  id: 7,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+34600000000',
  createdAt: '',
  updatedAt: '',
};

const noop = () => undefined;

describe('CustomerFormModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a validation error when first name is empty', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it('shows a validation error when last name is empty', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
  });

  it('shows a validation error when email is empty', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });

  it('shows a validation error for an invalid email format', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });

  it('creates a customer and calls onSuccess', async () => {
    mocked.create.mockResolvedValue({ success: true, data: existing, message: '' });
    const onSuccess = jest.fn();
    render(<CustomerFormModal show onHide={noop} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Jane', email: 'jane@example.com' })
      )
    );
    expect(onSuccess).toHaveBeenCalledWith(existing);
  });

  it('maps CUSTOMER_EMAIL_CONFLICT from the API to a UI message', async () => {
    mocked.create.mockRejectedValue(makeAxiosError('CUSTOMER_EMAIL_CONFLICT', 409));
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/customer with this email already exists/i)).toBeInTheDocument();
  });

  it('maps VALIDATION_ERROR from the API to a UI message', async () => {
    mocked.create.mockRejectedValue(makeAxiosError('VALIDATION_ERROR', 400));
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/check the form fields/i)).toBeInTheDocument();
  });

  it('shows CUSTOMER_NOT_FOUND in edit mode', async () => {
    mocked.update.mockRejectedValue(makeAxiosError('CUSTOMER_NOT_FOUND', 404));
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} initial={existing} />);
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/customer not found/i)).toBeInTheDocument();
  });

  it('pre-populates fields from the initial customer in edit mode', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} initial={existing} />);
    expect(screen.getByTestId('input-customer-first-name')).toHaveValue('Jane');
    expect(screen.getByTestId('input-customer-email')).toHaveValue('jane@example.com');
  });

  it('disables the save button while saving', async () => {
    let resolve!: (v: unknown) => void;
    mocked.create.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() => expect(screen.getByTestId('btn-modal-save')).toBeDisabled());
    resolve({ success: true, data: existing, message: '' });
  });
});
```

---

## File 9: `frontend/src/components/admin/__tests__/CustomerAddressFormModal.test.tsx` (NEW)

**Action:** Create new file.

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import CustomerAddressFormModal from '../CustomerAddressFormModal';
import { CustomerAddress } from '../../../types/customer';
import { customerService } from '../../../services/customerService';

jest.mock('../../../services/customerService', () => {
  const actual = jest.requireActual('../../../services/customerService');
  return {
    __esModule: true,
    customerService: { createAddress: jest.fn(), updateAddress: jest.fn() },
    extractCustomerErrorMessage: actual.extractCustomerErrorMessage,
    mapCustomerError: actual.mapCustomerError,
    extractCustomerErrorCode: actual.extractCustomerErrorCode,
  };
});

const mocked = customerService as unknown as {
  createAddress: jest.Mock;
  updateAddress: jest.Mock;
};

const makeAxiosError = (code: string, status: number) => {
  const err = new axios.AxiosError('error');
  err.response = {
    data: { success: false, error: { code, message: 'x' } },
    status,
    statusText: '',
    headers: {},
    config: {} as never,
  };
  return err;
};

const existingAddress: CustomerAddress = {
  id: 10,
  customerId: 1,
  type: 'Shipping',
  fullName: 'Jane Doe',
  phone: null,
  streetLine1: 'Main Street 10',
  streetLine2: null,
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
  createdAt: '',
  updatedAt: '',
};

const noop = () => undefined;
const CUSTOMER_ID = 1;

// Helper to fill all required fields
const fillRequiredFields = () => {
  fireEvent.change(screen.getByTestId('input-address-full-name'), {
    target: { value: 'Jane Doe' },
  });
  fireEvent.change(screen.getByTestId('input-address-street-line-1'), {
    target: { value: 'Main Street 10' },
  });
  fireEvent.change(screen.getByTestId('input-address-city'), {
    target: { value: 'Malaga' },
  });
  fireEvent.change(screen.getByTestId('input-address-province'), {
    target: { value: 'Malaga' },
  });
  fireEvent.change(screen.getByTestId('input-address-postal-code'), {
    target: { value: '29001' },
  });
  fireEvent.change(screen.getByTestId('input-address-country'), {
    target: { value: 'Spain' },
  });
};

describe('CustomerAddressFormModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders in create mode with Shipping as the default type', () => {
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    expect(screen.getByTestId('select-address-type')).toHaveValue('Shipping');
    expect(screen.getByTestId('input-address-full-name')).toHaveValue('');
  });

  it('shows a validation error when full name is empty', () => {
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
    expect(mocked.createAddress).not.toHaveBeenCalled();
  });

  it('shows a validation error when street line 1 is empty', () => {
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    fireEvent.change(screen.getByTestId('input-address-full-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/street line 1 is required/i)).toBeInTheDocument();
  });

  it('creates an address and calls onSuccess', async () => {
    mocked.createAddress.mockResolvedValue({
      success: true,
      data: existingAddress,
      message: '',
    });
    const onSuccess = jest.fn();
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={onSuccess}
      />
    );
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.createAddress).toHaveBeenCalledWith(
        CUSTOMER_ID,
        expect.objectContaining({ streetLine1: 'Main Street 10', city: 'Malaga' })
      )
    );
    expect(onSuccess).toHaveBeenCalledWith(existingAddress);
  });

  it('maps VALIDATION_ERROR from the API to a UI message', async () => {
    mocked.createAddress.mockRejectedValue(makeAxiosError('VALIDATION_ERROR', 400));
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/check the form fields/i)).toBeInTheDocument();
  });

  it('pre-populates fields from the initial address in edit mode', () => {
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
        initial={existingAddress}
      />
    );
    expect(screen.getByTestId('input-address-full-name')).toHaveValue('Jane Doe');
    expect(screen.getByTestId('input-address-city')).toHaveValue('Malaga');
    expect(screen.getByTestId('select-address-type')).toHaveValue('Shipping');
  });

  it('calls updateAddress (not createAddress) in edit mode', async () => {
    mocked.updateAddress.mockResolvedValue({
      success: true,
      data: existingAddress,
      message: '',
    });
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
        initial={existingAddress}
      />
    );
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.updateAddress).toHaveBeenCalledWith(
        CUSTOMER_ID,
        existingAddress.id,
        expect.objectContaining({ city: 'Malaga' })
      )
    );
    expect(mocked.createAddress).not.toHaveBeenCalled();
  });

  it('disables the save button while saving', async () => {
    let resolve!: (v: unknown) => void;
    mocked.createAddress.mockReturnValue(new Promise((r) => (resolve = r)));
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() => expect(screen.getByTestId('btn-modal-save')).toBeDisabled());
    resolve({ success: true, data: existingAddress, message: '' });
  });
});
```

---

## data-testid Reference Table

| Element | testid |
|---|---|
| New customer button | `btn-new-customer` |
| Search filter input | `filter-search` |
| Reset filter button | `btn-filter-reset` |
| Loading state wrapper | `loading-state` |
| Empty state alert | `empty-state` |
| Desktop table | `customers-table` |
| Desktop table row | `customer-row-{id}` |
| Mobile card row | `customer-card-row-{id}` |
| Edit button (both views) | `btn-edit-{id}` |
| Delete button (both views) | `btn-delete-{id}` |
| Addresses button (both views) | `btn-addresses-{id}` |
| Confirm delete button | `btn-confirm-delete` |
| Customer form modal | `modal-customer-form` |
| Customer form: first name | `input-customer-first-name` |
| Customer form: last name | `input-customer-last-name` |
| Customer form: email | `input-customer-email` |
| Customer form: phone | `input-customer-phone` |
| Form modal cancel button | `btn-modal-cancel` |
| Form modal save button | `btn-modal-save` |
| Addresses modal | `modal-customer-addresses` |
| Addresses empty state | `addresses-empty-state` |
| Addresses table | `addresses-table` |
| Address table row | `address-row-{id}` |
| Edit address button | `btn-edit-address-{id}` |
| Delete address button | `btn-delete-address-{id}` |
| Add address button | `btn-add-address` |
| Confirm delete address button | `btn-confirm-delete-address` |
| Address form modal | `modal-customer-address-form` |
| Address form: type select | `select-address-type` |
| Address form: full name | `input-address-full-name` |
| Address form: phone | `input-address-phone` |
| Address form: street line 1 | `input-address-street-line-1` |
| Address form: street line 2 | `input-address-street-line-2` |
| Address form: city | `input-address-city` |
| Address form: province | `input-address-province` |
| Address form: postal code | `input-address-postal-code` |
| Address form: country | `input-address-country` |

---

## Critical Reminders for Implementation

1. **findBy\* in all tests** — The project ESLint rule requires `findBy*` for any element that appears after an async operation. Never use `getBy*` for elements rendered post-fetch.

2. **Hard delete, not soft delete** — `customerService.delete` calls `DELETE /api/admin/customers/:id` (returns 204, `Promise<void>`). There is no "deactivate" concept for customers.

3. **CUSTOMER_HAS_ORDERS branching** — In `CustomersPage.handleDelete`, extract the error code with `extractCustomerErrorCode` first. If it is `'CUSTOMER_HAS_ORDERS'`, set the specific message and hide the confirm button so the user can only Cancel.

4. **No status field anywhere** — Customers have no `status` lifecycle. Do not add any status select, StatusBadge, or status filter to any customer component.

5. **Address ownership** — `CustomerAddressesSection` always passes `customer.id` to all address service calls. The address form modal receives `customerId` as a prop — it does not read it from URL params.

6. **Email uniqueness** — The `CUSTOMER_EMAIL_CONFLICT` (409) error message must be "A customer with this email already exists." — this is what the test asserts with `/customer with this email already exists/i`.

7. **No supplier data** — No component in this feature references `supplierId`, `supplierReference`, or `supplierCost`. These fields must never appear in any customer or address response or component output.

8. **Routing and navigation** — `App.tsx` and `Layout.tsx` already have `/customers` registered. Do not modify them.
