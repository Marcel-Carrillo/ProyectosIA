import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Row, Col } from 'react-bootstrap';
import { returnRequestService } from '../services/returnRequestService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import StatusBadge from '../components/admin/StatusBadge';
import ReturnRequestStatusControl from '../components/admin/ReturnRequestStatusControl';
import { ReturnRequest, UpdateReturnRequestStatusInput } from '../types/returnRequest';

const ReturnRequestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const returnRequestId = Number(id);

  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadReturnRequest = useCallback(async () => {
    if (!returnRequestId || Number.isNaN(returnRequestId)) {
      setError('Invalid return request id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await returnRequestService.getById(returnRequestId);
      setReturnRequest(data);
    } catch {
      setError('Unable to load return request.');
    } finally {
      setLoading(false);
    }
  }, [returnRequestId]);

  useEffect(() => {
    void loadReturnRequest();
  }, [loadReturnRequest]);

  const handleStatusSave = async (update: UpdateReturnRequestStatusInput) => {
    if (!returnRequest) return;
    setSaving(true);
    setStatusError('');
    try {
      const updated = await returnRequestService.updateStatus(returnRequest.id, update);
      setReturnRequest(updated);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update return request status.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!returnRequest) return null;

  return (
    <div className="admin-page">
      <p className="mb-3">
        <Link to="/return-requests">← Back to return requests</Link>
      </p>

      <div className="admin-page-header mb-3">
        <h1 className="h3 mb-0">Return Request #{returnRequest.id}</h1>
        <div className="mt-2">
          <StatusBadge status={returnRequest.status} />
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
                  <Link to={`/customer-orders/${returnRequest.customerOrderId}`}>
                    #{returnRequest.customerOrderId}
                  </Link>
                </dd>

                <dt className="col-sm-5">Order Item ID</dt>
                <dd className="col-sm-7">#{returnRequest.customerOrderItemId}</dd>

                <dt className="col-sm-5">Reason</dt>
                <dd className="col-sm-7">{returnRequest.reason}</dd>

                <dt className="col-sm-5">Requested At</dt>
                <dd className="col-sm-7">{new Date(returnRequest.requestedAt).toLocaleString()}</dd>

                <dt className="col-sm-5">Approved At</dt>
                <dd className="col-sm-7">
                  {returnRequest.approvedAt ? new Date(returnRequest.approvedAt).toLocaleString() : '—'}
                </dd>

                <dt className="col-sm-5">Rejected At</dt>
                <dd className="col-sm-7">
                  {returnRequest.rejectedAt ? new Date(returnRequest.rejectedAt).toLocaleString() : '—'}
                </dd>

                <dt className="col-sm-5">Received At</dt>
                <dd className="col-sm-7">
                  {returnRequest.receivedAt ? new Date(returnRequest.receivedAt).toLocaleString() : '—'}
                </dd>

                <dt className="col-sm-5">Created</dt>
                <dd className="col-sm-7">{new Date(returnRequest.createdAt).toLocaleString()}</dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>Update Status</Card.Header>
            <Card.Body>
              <ReturnRequestStatusControl
                returnRequest={returnRequest}
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

export default ReturnRequestDetailPage;
