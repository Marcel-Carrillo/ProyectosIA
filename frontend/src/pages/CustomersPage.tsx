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

  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [toEdit, setToEdit] = useState<Customer | null>(null);

  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [addressesCustomer, setAddressesCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
      setError('No se pudieron cargar los clientes. Intente de nuevo más tarde.');
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
      void fetchCustomers();
    } catch (err) {
      const code = extractCustomerErrorCode(err);
      if (code === 'CUSTOMER_HAS_ORDERS') {
        setDeleteError('Este cliente no puede eliminarse porque tiene pedidos.');
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
        <h1 className="h3 mb-0">Clientes</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)} data-testid="btn-new-customer">
          Nuevo cliente
        </Button>
      </div>

      <Row className="g-2 mb-3 align-items-end">
        <Col xs={12} md={9}>
          <Form.Label className="small mb-1">Buscar</Form.Label>
          <Form.Control
            type="search"
            placeholder="Buscar por nombre o correo electrónico…"
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
            Restablecer
          </Button>
        </Col>
      </Row>

      {loading && (
        <div data-testid="loading-state">
          <LoadingSpinner />
        </div>
      )}
      {!loading && error && <ErrorAlert message={error} />}
      {!loading && !error && customers.length === 0 && (
        <Alert variant="info" data-testid="empty-state">
          No se encontraron clientes.
        </Alert>
      )}

      {!loading && !error && customers.length > 0 && (
        <>
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
                    Direcciones
                  </Button>
                  <Button
                    variant="outline-primary"
                    className="admin-touch-btn"
                    onClick={() => setToEdit(c)}
                    data-testid={`btn-edit-${c.id}`}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="admin-touch-btn"
                    onClick={() => setToDelete(c)}
                    data-testid={`btn-delete-${c.id}`}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="d-none d-lg-block admin-table-wrap">
            <Table hover data-testid="customers-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Apellidos</th>
                  <th>Correo electrónico</th>
                  <th>Teléfono</th>
                  <th>Creado</th>
                  <th>Acciones</th>
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
                        Direcciones
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        onClick={() => setToEdit(c)}
                        data-testid={`btn-edit-${c.id}`}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => setToDelete(c)}
                        data-testid={`btn-delete-${c.id}`}
                      >
                        Eliminar
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

      <CustomerFormModal
        show={showCreate}
        onHide={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          void fetchCustomers();
        }}
      />

      <CustomerFormModal
        show={toEdit !== null}
        onHide={() => setToEdit(null)}
        initial={toEdit ?? undefined}
        onSuccess={() => {
          setToEdit(null);
          void fetchCustomers();
        }}
      />

      <Modal show={toDelete !== null} onHide={() => setToDelete(null)} fullscreen="sm-down">
        <Modal.Header closeButton>
          <Modal.Title>Eliminar cliente</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          {!deleteError && (
            <>
              ¿Está seguro de que desea eliminar permanentemente a &quot;{toDelete?.firstName}{' '}
              {toDelete?.lastName}&quot;? Esta acción no se puede deshacer.
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setToDelete(null); setDeleteError(''); }}>
            Cancelar
          </Button>
          {!deleteError && (
            <Button
              variant="danger"
              disabled={deleting}
              onClick={handleDelete}
              data-testid="btn-confirm-delete"
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      <CustomerAddressesSection
        customer={addressesCustomer}
        onHide={() => setAddressesCustomer(null)}
      />
    </div>
  );
};

export default CustomersPage;
