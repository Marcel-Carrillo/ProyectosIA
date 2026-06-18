import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Row, Col } from 'react-bootstrap';
import { refundService } from '../services/refundService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import StatusBadge from '../components/admin/StatusBadge';
import RefundStatusControl from '../components/admin/RefundStatusControl';
import { Refund, UpdateRefundStatusInput } from '../types/refund';

const RefundDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const refundId = Number(id);

  const [refund, setRefund] = useState<Refund | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRefund = useCallback(async () => {
    if (!refundId || Number.isNaN(refundId)) {
      setError('Invalid refund id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await refundService.getById(refundId);
      setRefund(data);
    } catch {
      setError('Unable to load refund.');
    } finally {
      setLoading(false);
    }
  }, [refundId]);

  useEffect(() => {
    void loadRefund();
  }, [loadRefund]);

  const handleStatusSave = async (update: UpdateRefundStatusInput) => {
    if (!refund) return;
    setSaving(true);
    setStatusError('');
    try {
      const updated = await refundService.updateStatus(refund.id, update);
      setRefund(updated);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update refund status.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!refund) return null;

  return (
    <div className="admin-page">
      <p className="mb-3">
        <Link to="/refunds">← Back to refunds</Link>
      </p>

      <div className="admin-page-header mb-3">
        <h1 className="h3 mb-0">Refund #{refund.id}</h1>
        <div className="mt-2">
          <StatusBadge status={refund.status} data-testid="detail-badge-refund" />
        </div>
      </div>

      <Row>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>Details</Card.Header>
            <Card.Body>
              <dl className="row mb-0">
                <dt className="col-sm-5">Customer Order</dt>
                <dd className="col-sm-7">
                  <Link to={`/customer-orders/${refund.customerOrderId}`}>
                    #{refund.customerOrderId}
                  </Link>
                </dd>

                <dt className="col-sm-5">Amount</dt>
                <dd className="col-sm-7">€{parseFloat(refund.amount).toFixed(2)}</dd>

                <dt className="col-sm-5">Reason</dt>
                <dd className="col-sm-7">{refund.reason ?? '—'}</dd>

                <dt className="col-sm-5">Return Request ID</dt>
                <dd className="col-sm-7">{refund.returnRequestId ?? '—'}</dd>

                <dt className="col-sm-5">Payment Reference</dt>
                <dd className="col-sm-7">{refund.paymentProviderReference ?? '—'}</dd>

                <dt className="col-sm-5">Created</dt>
                <dd className="col-sm-7">{new Date(refund.createdAt).toLocaleString()}</dd>

                <dt className="col-sm-5">Processed At</dt>
                <dd className="col-sm-7">
                  {refund.processedAt ? new Date(refund.processedAt).toLocaleString() : '—'}
                </dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>Update Status</Card.Header>
            <Card.Body>
              <RefundStatusControl
                refund={refund}
                saving={saving}
                error={statusError}
                onSave={handleStatusSave}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RefundDetailPage;
