import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Table, Form, Row, Col } from 'react-bootstrap';
import { supplierOrderService } from '../services/supplierOrderService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/admin/StatusBadge';
import { SupplierOrder, SupplierOrderStatus } from '../types/supplierOrder';

const PAGE_SIZE = 20;

const SUPPLIER_ORDER_STATUSES: SupplierOrderStatus[] = [
  'Draft', 'Requested', 'Confirmed', 'OutOfStock', 'Shipped', 'Delivered', 'Cancelled',
];

const SupplierOrdersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [customerOrderFilter, setCustomerOrderFilter] = useState(searchParams.get('customerOrderId') ?? '');
  const [supplierFilter, setSupplierFilter] = useState(searchParams.get('supplierId') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchInput) params.set('search', searchInput);
    if (statusFilter) params.set('status', statusFilter);
    if (customerOrderFilter) params.set('customerOrderId', customerOrderFilter);
    if (supplierFilter) params.set('supplierId', supplierFilter);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [searchInput, statusFilter, customerOrderFilter, supplierFilter, page, setSearchParams]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await supplierOrderService.list({
        search: debouncedSearch || undefined,
        status: (statusFilter as SupplierOrderStatus) || undefined,
        customerOrderId: customerOrderFilter ? Number(customerOrderFilter) : undefined,
        supplierId: supplierFilter ? Number(supplierFilter) : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setOrders(res.data.items);
      setTotal(res.data.total);
    } catch {
      setError('Unable to load supplier orders. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, customerOrderFilter, supplierFilter, page]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="h3 mb-0">Supplier Orders</h1>
      </div>

      <Row className="g-2 mb-3">
        <Col xs={12} md={3}>
          <Form.Label className="small mb-1">Search</Form.Label>
          <Form.Control
            type="search"
            placeholder="Supplier order #…"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            data-testid="supplier-order-search"
          />
        </Col>
        <Col xs={12} md={2}>
          <Form.Label className="small mb-1">Status</Form.Label>
          <Form.Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {SUPPLIER_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Form.Select>
        </Col>
        <Col xs={12} md={2}>
          <Form.Label className="small mb-1">Customer order ID</Form.Label>
          <Form.Control
            type="number"
            min={1}
            value={customerOrderFilter}
            onChange={(e) => { setCustomerOrderFilter(e.target.value); setPage(1); }}
          />
        </Col>
        <Col xs={12} md={2}>
          <Form.Label className="small mb-1">Supplier ID</Form.Label>
          <Form.Control
            type="number"
            min={1}
            value={supplierFilter}
            onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
          />
        </Col>
      </Row>

      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {!loading && !error && orders.length === 0 && (
        <p className="text-muted" data-testid="supplier-orders-empty">No supplier orders found.</p>
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          <div className="d-none d-md-block">
            <Table responsive hover className="align-middle">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer order</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/supplier-orders/${order.id}`} data-testid={`supplier-order-link-${order.id}`}>
                        {order.supplierOrderNumber}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/customer-orders/${order.customerOrderId}`}>
                        {order.customerOrder?.orderNumber ?? `#${order.customerOrderId}`}
                      </Link>
                    </td>
                    <td>{order.supplier?.name ?? `Supplier #${order.supplierId}`}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="d-md-none admin-card-list">
            {orders.map((order) => (
              <div key={order.id} className="admin-card-item p-3 mb-2 border rounded">
                <div className="fw-semibold">
                  <Link to={`/supplier-orders/${order.id}`}>{order.supplierOrderNumber}</Link>
                </div>
                <div className="small text-muted mb-2">
                  {new Date(order.createdAt).toLocaleDateString()}
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default SupplierOrdersPage;
