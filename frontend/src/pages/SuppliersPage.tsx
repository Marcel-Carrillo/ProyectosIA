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

const SuppliersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [toEdit, setToEdit] = useState<Supplier | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Supplier | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  // Debounce the search field (400ms); the status filter is immediate.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Keep the URL query string in sync.
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (searchInput) params.set('search', searchInput);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [statusFilter, searchInput, page, setSearchParams]);

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

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };
  const handleReset = () => {
    setSearchInput('');
    setStatusFilter('');
    setPage(1);
  };

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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="h3 mb-0">Suppliers</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)} data-testid="btn-new-supplier">
          New supplier
        </Button>
      </div>

      <Row className="g-2 mb-3 align-items-end">
        <Col xs={12} md={5}>
          <Form.Label className="small mb-1">Search</Form.Label>
          <Form.Control
            type="search"
            placeholder="Search by name…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="filter-search"
          />
        </Col>
        <Col xs={12} md={4}>
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

      {loading && (
        <div data-testid="loading-state">
          <LoadingSpinner />
        </div>
      )}
      {!loading && error && <ErrorAlert message={error} />}
      {!loading && !error && suppliers.length === 0 && (
        <Alert variant="info" data-testid="empty-state">
          No suppliers found.
        </Alert>
      )}

      {!loading && !error && suppliers.length > 0 && (
        <>
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
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
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
        </>
      )}

      {!loading && !error && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <SupplierFormModal
        show={showCreate}
        onHide={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          fetchSuppliers();
        }}
      />

      <SupplierFormModal
        show={toEdit !== null}
        onHide={() => setToEdit(null)}
        initial={toEdit ?? undefined}
        onSuccess={() => {
          setToEdit(null);
          fetchSuppliers();
        }}
      />

      <Modal show={toDeactivate !== null} onHide={() => setToDeactivate(null)} fullscreen="sm-down">
        <Modal.Header closeButton>
          <Modal.Title>Deactivate supplier</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deactivateError && <Alert variant="danger">{deactivateError}</Alert>}
          Are you sure you want to deactivate &quot;{toDeactivate?.name}&quot;? Their status will be
          set to Inactive. This can be undone by editing the supplier.
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
    </div>
  );
};

export default SuppliersPage;
