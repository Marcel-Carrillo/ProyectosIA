import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Table, Form, Row, Col } from 'react-bootstrap';
import { returnRequestService } from '../services/returnRequestService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/admin/StatusBadge';
import { ReturnRequest, ReturnRequestStatus } from '../types/returnRequest';

const PAGE_SIZE = 20;

const RETURN_REQUEST_STATUSES: ReturnRequestStatus[] = [
  'Requested', 'Approved', 'Rejected', 'Received', 'Refunded', 'Cancelled',
];

const ReturnRequestsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [orderFilter, setOrderFilter] = useState(searchParams.get('customerOrderId') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);

  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (orderFilter) params.set('customerOrderId', orderFilter);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [statusFilter, orderFilter, page, setSearchParams]);

  const fetchReturnRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await returnRequestService.getAll({
        status: (statusFilter as ReturnRequestStatus) || undefined,
        customerOrderId: orderFilter ? Number(orderFilter) : undefined,
        page,
        limit: PAGE_SIZE,
      });
      setReturnRequests(result.items);
      setTotal(result.total);
    } catch {
      setError('Unable to load return requests. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, orderFilter, page]);

  useEffect(() => {
    void fetchReturnRequests();
  }, [fetchReturnRequests]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="h3 mb-0">Return Requests</h1>
      </div>

      <Row className="g-2 mb-3">
        <Col xs={12} md={3}>
          <Form.Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Filter by status"
            data-testid="select-status-filter"
          >
            <option value="">All statuses</option>
            {RETURN_REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={12} md={3}>
          <Form.Control
            type="number"
            placeholder="Filter by Order ID"
            value={orderFilter}
            onChange={(e) => { setOrderFilter(e.target.value); setPage(1); }}
            data-testid="input-order-filter"
          />
        </Col>
      </Row>

      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}

      {!loading && !error && (
        <>
          <Table hover responsive>
            <thead>
              <tr>
                <th>ID</th>
                <th>Order ID</th>
                <th>Item ID</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Requested</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {returnRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">No return requests found.</td>
                </tr>
              ) : (
                returnRequests.map((r) => (
                  <tr key={r.id} data-testid={`return-request-row-${r.id}`}>
                    <td>#{r.id}</td>
                    <td>
                      <Link to={`/customer-orders/${r.customerOrderId}`}>
                        #{r.customerOrderId}
                      </Link>
                    </td>
                    <td>#{r.customerOrderItemId}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-truncate" style={{ maxWidth: 200 }}>{r.reason}</td>
                    <td>{new Date(r.requestedAt).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/return-requests/${r.id}`} className="btn btn-sm btn-outline-primary">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ReturnRequestsPage;
