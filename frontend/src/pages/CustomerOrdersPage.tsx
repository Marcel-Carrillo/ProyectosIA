import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Table, Form, Row, Col } from 'react-bootstrap';
import { customerOrderService } from '../services/customerOrderService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/admin/StatusBadge';
import { CustomerOrder, CustomerOrderStatus, PaymentStatus, FulfillmentStatus } from '../types/customerOrder';

const PAGE_SIZE = 20;

const ORDER_STATUSES: CustomerOrderStatus[] = [
  'PendingPayment', 'Paid', 'Processing', 'Completed', 'Cancelled', 'Refunded',
];
const PAYMENT_STATUSES: PaymentStatus[] = [
  'Pending', 'Authorized', 'Paid', 'Failed', 'Refunded', 'PartiallyRefunded',
];
const FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  'NotStarted', 'PendingSupplierOrder', 'SupplierOrderPlaced', 'PartiallyFulfilled', 'Fulfilled', 'Blocked', 'Cancelled',
];

const CustomerOrdersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get('paymentStatus') ?? '');
  const [fulfillmentFilter, setFulfillmentFilter] = useState(searchParams.get('fulfillmentStatus') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
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
    if (paymentFilter) params.set('paymentStatus', paymentFilter);
    if (fulfillmentFilter) params.set('fulfillmentStatus', fulfillmentFilter);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [searchInput, statusFilter, paymentFilter, fulfillmentFilter, page, setSearchParams]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await customerOrderService.list({
        search: debouncedSearch || undefined,
        status: (statusFilter as CustomerOrderStatus) || undefined,
        paymentStatus: (paymentFilter as PaymentStatus) || undefined,
        fulfillmentStatus: (fulfillmentFilter as FulfillmentStatus) || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setOrders(res.data.items);
      setTotal(res.data.total);
    } catch {
      setError('Unable to load customer orders. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, paymentFilter, fulfillmentFilter, page]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="h3 mb-0">Customer Orders</h1>
      </div>

      <Row className="g-2 mb-3">
        <Col xs={12} md={4}>
          <Form.Label className="small mb-1">Search</Form.Label>
          <Form.Control
            type="search"
            placeholder="Order #, customer name or email…"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            data-testid="order-search"
          />
        </Col>
        <Col xs={12} md={2}>
          <Form.Label className="small mb-1">Order status</Form.Label>
          <Form.Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Form.Select>
        </Col>
        <Col xs={12} md={2}>
          <Form.Label className="small mb-1">Payment</Form.Label>
          <Form.Select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Form.Select>
        </Col>
        <Col xs={12} md={2}>
          <Form.Label className="small mb-1">Fulfillment</Form.Label>
          <Form.Select value={fulfillmentFilter} onChange={(e) => { setFulfillmentFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {FULFILLMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Form.Select>
        </Col>
      </Row>

      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {!loading && !error && orders.length === 0 && (
        <p className="text-muted" data-testid="orders-empty">No customer orders found.</p>
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          <div className="d-none d-md-block">
            <Table responsive hover className="align-middle">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Order</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/customer-orders/${order.id}`} data-testid={`order-link-${order.id}`}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>
                      {order.customer
                        ? `${order.customer.firstName} ${order.customer.lastName}`
                        : `Customer #${order.customerId}`}
                    </td>
                    <td>{order.totalAmount} {order.currency}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td><StatusBadge status={order.paymentStatus} /></td>
                    <td><StatusBadge status={order.fulfillmentStatus} /></td>
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
                  <Link to={`/customer-orders/${order.id}`}>{order.orderNumber}</Link>
                </div>
                <div className="small text-muted mb-2">
                  {order.totalAmount} {order.currency} · {new Date(order.createdAt).toLocaleDateString()}
                </div>
                <div className="d-flex flex-wrap gap-1">
                  <StatusBadge status={order.status} />
                  <StatusBadge status={order.paymentStatus} />
                  <StatusBadge status={order.fulfillmentStatus} />
                </div>
              </div>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default CustomerOrdersPage;
