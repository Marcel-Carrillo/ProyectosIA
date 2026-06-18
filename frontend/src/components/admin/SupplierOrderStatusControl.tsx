import React from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';
import {
  SupplierOrder,
  SupplierOrderStatus,
  UpdateSupplierOrderStatusInput,
} from '../../types/supplierOrder';
import StatusBadge from './StatusBadge';

const SUPPLIER_ORDER_STATUSES: SupplierOrderStatus[] = [
  'Draft',
  'Requested',
  'Confirmed',
  'OutOfStock',
  'Shipped',
  'Delivered',
  'Cancelled',
];

type SupplierOrderStatusControlProps = {
  order: SupplierOrder;
  saving: boolean;
  error?: string;
  onSave: (update: UpdateSupplierOrderStatusInput) => void;
};

const SupplierOrderStatusControl: React.FC<SupplierOrderStatusControlProps> = ({
  order,
  saving,
  error,
  onSave,
}) => {
  const [status, setStatus] = React.useState(order.status);
  const [trackingNumber, setTrackingNumber] = React.useState(order.trackingNumber ?? '');
  const [trackingUrl, setTrackingUrl] = React.useState(order.trackingUrl ?? '');

  React.useEffect(() => {
    setStatus(order.status);
    setTrackingNumber(order.trackingNumber ?? '');
    setTrackingUrl(order.trackingUrl ?? '');
  }, [order]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const update: UpdateSupplierOrderStatusInput = { status };
    if (trackingNumber !== (order.trackingNumber ?? '')) update.trackingNumber = trackingNumber;
    if (trackingUrl !== (order.trackingUrl ?? '')) update.trackingUrl = trackingUrl;
    onSave(update);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="supplier-order-status-control">
      <Row className="g-3 mb-3">
        <Col md={4}>
          <div className="small text-muted mb-1">Status</div>
          <StatusBadge status={order.status} data-testid="badge-supplier-order-status" />
          <Form.Select
            className="mt-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as SupplierOrderStatus)}
            data-testid="select-supplier-order-status"
          >
            {SUPPLIER_ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Form.Select>
        </Col>
        <Col md={4}>
          <Form.Label className="small">Tracking number</Form.Label>
          <Form.Control
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            data-testid="input-tracking-number"
          />
        </Col>
        <Col md={4}>
          <Form.Label className="small">Tracking URL</Form.Label>
          <Form.Control
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            data-testid="input-tracking-url"
          />
        </Col>
      </Row>
      {error && <div className="text-danger small mb-2">{error}</div>}
      <Button type="submit" variant="primary" disabled={saving} data-testid="btn-save-supplier-status">
        {saving ? 'Saving…' : 'Update status'}
      </Button>
    </form>
  );
};

export default SupplierOrderStatusControl;
