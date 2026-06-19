import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Table, Card, Row, Col, Modal, Button, Form } from 'react-bootstrap';
import {
  customerOrderService,
  extractCustomerOrderErrorMessage,
} from '../services/customerOrderService';
import { supplierOrderService } from '../services/supplierOrderService';
import { refundService } from '../services/refundService';
import { returnRequestService } from '../services/returnRequestService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import StatusBadge from '../components/admin/StatusBadge';
import OrderStatusControl from '../components/admin/OrderStatusControl';
import { CustomerOrder, UpdateCustomerOrderStatusInput, CustomerOrderItem } from '../types/customerOrder';
import { SupplierOrder } from '../types/supplierOrder';
import { Refund } from '../types/refund';
import { ReturnRequest } from '../types/returnRequest';

const formatAddress = (addr: CustomerOrder['shippingAddressSnapshot']) =>
  [addr.streetLine1, addr.streetLine2, addr.city, addr.province, addr.postalCode, addr.country]
    .filter(Boolean)
    .join(', ');

const CustomerOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [generateError, setGenerateError] = useState('');
  const [generateMessage, setGenerateMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundPayRef, setRefundPayRef] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState('');

  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState<CustomerOrderItem | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState('');

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
      const supplierRes = await supplierOrderService.listByCustomerOrder(orderId);
      setSupplierOrders(supplierRes.data.items);
      const refundRes = await refundService.getAll({ customerOrderId: orderId });
      setRefunds(refundRes.items);
      const returnRes = await returnRequestService.getAll({ customerOrderId: orderId });
      setReturnRequests(returnRes.items);
    } catch {
      setError('Unable to load customer order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const handleGenerateSupplierOrders = async () => {
    if (!order) return;
    setGenerating(true);
    setGenerateError('');
    setGenerateMessage('');
    try {
      const result = await customerOrderService.generateSupplierOrders(order.id);
      setSupplierOrders(result.data);
      setGenerateMessage(result.message);
      const refreshed = await customerOrderService.getById(order.id);
      setOrder(refreshed.data);
    } catch (err) {
      setGenerateError(extractCustomerOrderErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const isEligibleForGeneration =
    order != null &&
    (order.status === 'Paid' || order.status === 'Processing');

  const canCreateReturn = order != null && order.status !== 'Cancelled';

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

  const canCreateRefund =
    order != null &&
    (order.paymentStatus === 'Paid' || order.paymentStatus === 'PartiallyRefunded');

  const handleCreateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setRefundSubmitting(true);
    setRefundError('');
    try {
      const created = await refundService.create({
        customerOrderId: order.id,
        amount: refundAmount,
        reason: refundReason.trim() || null,
        paymentProviderReference: refundPayRef.trim() || null,
      });
      setRefunds((prev) => [created, ...prev]);
      const refreshed = await customerOrderService.getById(order.id);
      setOrder(refreshed.data);
      setShowRefundModal(false);
      setRefundAmount('');
      setRefundReason('');
      setRefundPayRef('');
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Failed to create refund.');
    } finally {
      setRefundSubmitting(false);
    }
  };

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
          </Table>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Body>
          <Card.Title className="h6">Supplier orders</Card.Title>
          {isEligibleForGeneration && (
            <div className="mb-3">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => void handleGenerateSupplierOrders()}
                disabled={generating}
                data-testid="btn-generate-supplier-orders"
              >
                {generating ? 'Generating…' : 'Generate supplier orders'}
              </button>
            </div>
          )}
          {generateMessage && <div className="text-success small mb-2">{generateMessage}</div>}
          {generateError && <div className="text-danger small mb-2">{generateError}</div>}
          {supplierOrders.length === 0 ? (
            <p className="text-muted small mb-0">No supplier orders yet.</p>
          ) : (
            <ul className="mb-0">
              {supplierOrders.map((so) => (
                <li key={so.id}>
                  <Link to={`/supplier-orders/${so.id}`}>{so.supplierOrderNumber}</Link>
                  {' '}
                  <StatusBadge status={so.status} />
                </li>
              ))}
            </ul>
          )}
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Card.Title className="h6 mb-0">Refunds</Card.Title>
            {canCreateRefund && (
              <Button
                size="sm"
                variant="outline-primary"
                onClick={() => setShowRefundModal(true)}
                data-testid="btn-create-refund"
              >
                Create refund
              </Button>
            )}
          </div>
          {refunds.length === 0 ? (
            <p className="text-muted small mb-0">No refunds yet.</p>
          ) : (
            <Table responsive size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>€{parseFloat(r.amount).toFixed(2)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.reason ?? '—'}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/refunds/${r.id}`} className="btn btn-sm btn-outline-secondary">
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

      <Modal show={showRefundModal} onHide={() => setShowRefundModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Refund</Modal.Title>
        </Modal.Header>
        <form onSubmit={(e) => void handleCreateRefund(e)}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Amount (€) <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                required
                data-testid="input-refund-amount"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Reason</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={500}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                data-testid="input-refund-reason"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Payment Provider Reference</Form.Label>
              <Form.Control
                type="text"
                maxLength={150}
                value={refundPayRef}
                onChange={(e) => setRefundPayRef(e.target.value)}
                placeholder="e.g. PAY-123456"
                data-testid="input-refund-pay-ref"
              />
            </Form.Group>
            {refundError && <div className="text-danger small">{refundError}</div>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowRefundModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={refundSubmitting}
              data-testid="btn-submit-refund"
            >
              {refundSubmitting ? 'Creating…' : 'Create refund'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal
        show={showReturnModal}
        onHide={() => { setShowReturnModal(false); setReturnReason(''); setReturnError(''); }}
      >
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
            <Button
              variant="secondary"
              onClick={() => { setShowReturnModal(false); setReturnReason(''); setReturnError(''); }}
            >
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
    </div>
  );
};

export default CustomerOrderDetailPage;
