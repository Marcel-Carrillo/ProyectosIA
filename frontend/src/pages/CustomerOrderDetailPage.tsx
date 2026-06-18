import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Table, Card, Row, Col } from 'react-bootstrap';
import {
  customerOrderService,
  extractCustomerOrderErrorMessage,
} from '../services/customerOrderService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import StatusBadge from '../components/admin/StatusBadge';
import OrderStatusControl from '../components/admin/OrderStatusControl';
import { CustomerOrder, UpdateCustomerOrderStatusInput } from '../types/customerOrder';

const formatAddress = (addr: CustomerOrder['shippingAddressSnapshot']) =>
  [addr.streetLine1, addr.streetLine2, addr.city, addr.province, addr.postalCode, addr.country]
    .filter(Boolean)
    .join(', ');

const CustomerOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId || Number.isNaN(orderId)) {
      setError('Invalid order id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await customerOrderService.getById(orderId);
      setOrder(res.data);
    } catch {
      setError('Unable to load customer order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const handleStatusSave = async (update: UpdateCustomerOrderStatusInput) => {
    if (!order) return;
    setSaving(true);
    setStatusError('');
    try {
      const res = await customerOrderService.updateStatus(order.id, update);
      setOrder(res.data);
    } catch (err) {
      setStatusError(extractCustomerOrderErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!order) return null;

  return (
    <div className="admin-page">
      <p className="mb-3">
        <Link to="/customer-orders">← Back to orders</Link>
      </p>

      <div className="admin-page-header mb-3">
        <h1 className="h3 mb-0">{order.orderNumber}</h1>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <StatusBadge status={order.status} data-testid="detail-badge-order" />
          <StatusBadge status={order.paymentStatus} data-testid="detail-badge-payment" />
          <StatusBadge status={order.fulfillmentStatus} data-testid="detail-badge-fulfillment" />
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="h6">Customer</Card.Title>
              {order.customer ? (
                <>
                  <div>{order.customer.firstName} {order.customer.lastName}</div>
                  <div className="small text-muted">{order.customer.email}</div>
                  <Link to={`/customers`} className="small">View customers</Link>
                </>
              ) : (
                <div>Customer #{order.customerId}</div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="h6">Totals</Card.Title>
              <div>Subtotal: {order.subtotalAmount} {order.currency}</div>
              <div>Shipping: {order.shippingAmount} {order.currency}</div>
              <div>Discount: {order.discountAmount} {order.currency}</div>
              <div className="fw-semibold">Total: {order.totalAmount} {order.currency}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title className="h6">Shipping address</Card.Title>
              <div className="small">{formatAddress(order.shippingAddressSnapshot)}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title className="h6">Billing address</Card.Title>
              <div className="small">{formatAddress(order.billingAddressSnapshot)}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Body>
          <Card.Title className="h6">Line items</Card.Title>
          <Table responsive size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Total</th>
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
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title className="h6">Update statuses</Card.Title>
          <OrderStatusControl
            order={order}
            saving={saving}
            error={statusError}
            onSave={handleStatusSave}
          />
        </Card.Body>
      </Card>
    </div>
  );
};

export default CustomerOrderDetailPage;
