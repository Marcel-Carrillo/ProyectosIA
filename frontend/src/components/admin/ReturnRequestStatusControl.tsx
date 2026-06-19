import React from 'react';
import { Form, Button } from 'react-bootstrap';
import {
  ReturnRequest,
  ReturnRequestStatus,
  UpdateReturnRequestStatusInput,
  RETURN_REQUEST_TRANSITIONS,
} from '../../types/returnRequest';
import StatusBadge from './StatusBadge';

type ReturnRequestStatusControlProps = {
  returnRequest: ReturnRequest;
  saving: boolean;
  error?: string;
  onSave: (update: UpdateReturnRequestStatusInput) => void;
};

const ReturnRequestStatusControl: React.FC<ReturnRequestStatusControlProps> = ({
  returnRequest,
  saving,
  error,
  onSave,
}) => {
  const [status, setStatus] = React.useState<ReturnRequestStatus>(returnRequest.status);

  React.useEffect(() => {
    setStatus(returnRequest.status);
  }, [returnRequest]);

  const allowedTransitions = RETURN_REQUEST_TRANSITIONS[returnRequest.status] ?? [];
  const isTerminal = allowedTransitions.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ status });
  };

  if (isTerminal) {
    return (
      <div data-testid="return-request-status-control">
        <div className="small text-muted mb-1">Status</div>
        <StatusBadge status={returnRequest.status} />
        <p className="text-muted small mt-2">
          This return request is in a terminal state and cannot be updated.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} data-testid="return-request-status-control">
      <div className="mb-3">
        <div className="small text-muted mb-1">Current Status</div>
        <StatusBadge status={returnRequest.status} />
      </div>
      <div className="mb-3">
        <Form.Label className="small">New Status</Form.Label>
        <Form.Select
          value={status}
          onChange={(e) => setStatus(e.target.value as ReturnRequestStatus)}
          data-testid="select-return-request-status"
        >
          <option value={returnRequest.status}>{returnRequest.status} (current)</option>
          {allowedTransitions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Form.Select>
      </div>
      {error && <div className="text-danger small mb-2">{error}</div>}
      <Button
        type="submit"
        variant="primary"
        disabled={saving || status === returnRequest.status}
        data-testid="btn-save-return-request-status"
      >
        {saving ? 'Saving…' : 'Update status'}
      </Button>
    </form>
  );
};

export default ReturnRequestStatusControl;
