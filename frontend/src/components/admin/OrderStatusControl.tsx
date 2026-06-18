import React from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';
import {
  CustomerOrder,
  CustomerOrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  UpdateCustomerOrderStatusInput,
} from '../../types/customerOrder';
import StatusBadge from './StatusBadge';

const ORDER_STATUSES: CustomerOrderStatus[] = [
  'PendingPayment',
  'Paid',
  'Processing',
  'Completed',
  'Cancelled',
  'Refunded',
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  'Pending',
  'Authorized',
  'Paid',
  'Failed',
  'Refunded',
  'PartiallyRefunded',
];

const FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  'NotStarted',
  'PendingSupplierOrder',
  'SupplierOrderPlaced',
  'PartiallyFulfilled',
  'Fulfilled',
  'Blocked',
  'Cancelled',
];

type OrderStatusControlProps = {
  order: CustomerOrder;
  saving: boolean;
  error?: string;
  onSave: (update: UpdateCustomerOrderStatusInput) => void;
};

const OrderStatusControl: React.FC<OrderStatusControlProps> = ({
  order,
  saving,
  error,
  onSave,
}) => {
  const [status, setStatus] = React.useState(order.status);
  const [paymentStatus, setPaymentStatus] = React.useState(order.paymentStatus);
  const [fulfillmentStatus, setFulfillmentStatus] = React.useState(order.fulfillmentStatus);

  React.useEffect(() => {
    setStatus(order.status);
    setPaymentStatus(order.paymentStatus);
    setFulfillmentStatus(order.fulfillmentStatus);
  }, [order]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const update: UpdateCustomerOrderStatusInput = {};
    if (status !== order.status) update.status = status;
    if (paymentStatus !== order.paymentStatus) update.paymentStatus = paymentStatus;
    if (fulfillmentStatus !== order.fulfillmentStatus) update.fulfillmentStatus = fulfillmentStatus;
    if (Object.keys(update).length === 0) return;
    onSave(update);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="order-status-control">
      <Row className="g-3 mb-3">
        <Col md={4}>
          <div className="small text-muted mb-1">Order status</div>
          <StatusBadge status={order.status} data-testid="badge-order-status" />
          <Form.Select
            className="mt-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as CustomerOrderStatus)}
            data-testid="select-order-status"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={4}>
          <div className="small text-muted mb-1">Payment status</div>
          <StatusBadge status={order.paymentStatus} data-testid="badge-payment-status" />
          <Form.Select
            className="mt-2"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
            data-testid="select-payment-status"
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={4}>
          <div className="small text-muted mb-1">Fulfillment status</div>
          <StatusBadge status={order.fulfillmentStatus} data-testid="badge-fulfillment-status" />
          <Form.Select
            className="mt-2"
            value={fulfillmentStatus}
            onChange={(e) => setFulfillmentStatus(e.target.value as FulfillmentStatus)}
            data-testid="select-fulfillment-status"
          >
            {FULFILLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Form.Select>
        </Col>
      </Row>
      {error && <div className="text-danger small mb-2">{error}</div>}
      <Button type="submit" variant="primary" disabled={saving} data-testid="btn-save-status">
        {saving ? 'Saving…' : 'Update statuses'}
      </Button>
    </form>
  );
};

export default OrderStatusControl;
