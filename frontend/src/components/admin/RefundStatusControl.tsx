import React from 'react';
import { Form, Button } from 'react-bootstrap';
import { Refund, RefundStatus, UpdateRefundStatusInput, REFUND_TRANSITIONS } from '../../types/refund';
import StatusBadge from './StatusBadge';

type RefundStatusControlProps = {
  refund: Refund;
  saving: boolean;
  error?: string;
  onSave: (update: UpdateRefundStatusInput) => void;
};

const RefundStatusControl: React.FC<RefundStatusControlProps> = ({
  refund,
  saving,
  error,
  onSave,
}) => {
  const [status, setStatus] = React.useState<RefundStatus>(refund.status);
  const [paymentProviderReference, setPaymentProviderReference] = React.useState(
    refund.paymentProviderReference ?? ''
  );

  React.useEffect(() => {
    setStatus(refund.status);
    setPaymentProviderReference(refund.paymentProviderReference ?? '');
  }, [refund]);

  const allowedTransitions = REFUND_TRANSITIONS[refund.status] ?? [];
  const isTerminal = allowedTransitions.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const update: UpdateRefundStatusInput = { status };
    if (paymentProviderReference.trim()) {
      update.paymentProviderReference = paymentProviderReference.trim();
    }
    onSave(update);
  };

  if (isTerminal) {
    return (
      <div data-testid="refund-status-control">
        <div className="small text-muted mb-1">Status</div>
        <StatusBadge status={refund.status} data-testid="badge-refund-status" />
        <p className="text-muted small mt-2">This refund is in a terminal state and cannot be updated.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} data-testid="refund-status-control">
      <div className="mb-3">
        <div className="small text-muted mb-1">Current Status</div>
        <StatusBadge status={refund.status} data-testid="badge-refund-status" />
      </div>
      <div className="mb-3">
        <Form.Label className="small">New Status</Form.Label>
        <Form.Select
          value={status}
          onChange={(e) => setStatus(e.target.value as RefundStatus)}
          data-testid="select-refund-status"
        >
          <option value={refund.status}>{refund.status} (current)</option>
          {allowedTransitions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Form.Select>
      </div>
      <div className="mb-3">
        <Form.Label className="small">Payment Provider Reference</Form.Label>
        <Form.Control
          value={paymentProviderReference}
          onChange={(e) => setPaymentProviderReference(e.target.value)}
          placeholder="e.g. PAY-123456"
          maxLength={150}
          data-testid="input-payment-provider-reference"
        />
      </div>
      {error && <div className="text-danger small mb-2">{error}</div>}
      <Button
        type="submit"
        variant="primary"
        disabled={saving || status === refund.status}
        data-testid="btn-save-refund-status"
      >
        {saving ? 'Saving…' : 'Update status'}
      </Button>
    </form>
  );
};

export default RefundStatusControl;
