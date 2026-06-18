import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Table,
  Badge,
  Button,
  Form,
  Modal,
  Spinner,
  Alert,
  Card,
} from 'react-bootstrap';
import {
  Shipment,
  ShipmentStatus,
  SHIPMENT_STATUS_COLORS,
  CreateShipmentRequest,
} from '../types/shipment';
import {
  shipmentService,
  extractShipmentErrorMessage,
} from '../services/shipmentService';

const STATUSES: ShipmentStatus[] = ['Pending', 'Shipped', 'InTransit', 'Delivered', 'Failed', 'Returned'];

const ShipmentsPage: React.FC = () => {
  const navigate = useNavigate();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustomerOrderId, setFilterCustomerOrderId] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState<CreateShipmentRequest>({
    customerOrderId: 0,
    supplierOrderId: null,
    carrier: null,
    trackingNumber: null,
    trackingUrl: null,
  });

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        pageSize,
        ...(filterStatus && { status: filterStatus as ShipmentStatus }),
        ...(filterCustomerOrderId && { customerOrderId: parseInt(filterCustomerOrderId, 10) }),
      };
      const resp = await shipmentService.list(params);
      setShipments(resp.data.items);
      setTotal(resp.data.total);
    } catch (err) {
      setError(extractShipmentErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterStatus, filterCustomerOrderId]);

  useEffect(() => {
    void fetchShipments();
  }, [fetchShipments]);

  const handleCreate = async () => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      await shipmentService.create(form);
      setShowCreate(false);
      setForm({ customerOrderId: 0, supplierOrderId: null, carrier: null, trackingNumber: null, trackingUrl: null });
      void fetchShipments();
    } catch (err) {
      setCreateError(extractShipmentErrorMessage(err));
    } finally {
      setCreateLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Container fluid className="py-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="mb-0">Shipments</h2>
        </Col>
        <Col xs="auto">
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + New Shipment
          </Button>
        </Col>
      </Row>

      <Row className="mb-3 g-2">
        <Col xs={12} md={4}>
          <Form.Select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={12} md={4}>
          <Form.Control
            type="number"
            placeholder="Filter by Customer Order ID"
            value={filterCustomerOrderId}
            onChange={(e) => { setFilterCustomerOrderId(e.target.value); setPage(1); }}
          />
        </Col>
        <Col xs={12} md="auto">
          <Button variant="outline-secondary" onClick={() => { setFilterStatus(''); setFilterCustomerOrderId(''); setPage(1); }}>
            Clear
          </Button>
        </Col>
      </Row>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="d-none d-md-block">
            <Table striped hover responsive>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer Order</th>
                  <th>Carrier</th>
                  <th>Tracking</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No shipments found.
                    </td>
                  </tr>
                ) : (
                  shipments.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>#{s.customerOrderId}</td>
                      <td>{s.carrier ?? '—'}</td>
                      <td>
                        {s.trackingNumber ? (
                          s.trackingUrl ? (
                            <a href={s.trackingUrl} target="_blank" rel="noreferrer">
                              {s.trackingNumber}
                            </a>
                          ) : (
                            s.trackingNumber
                          )
                        ) : '—'}
                      </td>
                      <td>
                        <Badge bg={SHIPMENT_STATUS_COLORS[s.status]}>{s.status}</Badge>
                      </td>
                      <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => navigate(`/admin/shipments/${s.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="d-md-none">
            {shipments.length === 0 ? (
              <p className="text-center text-muted py-4">No shipments found.</p>
            ) : (
              shipments.map((s) => (
                <Card key={s.id} className="mb-3">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong>Shipment #{s.id}</strong>
                      <Badge bg={SHIPMENT_STATUS_COLORS[s.status]}>{s.status}</Badge>
                    </div>
                    <p className="mb-1 text-muted small">Customer Order: #{s.customerOrderId}</p>
                    {s.carrier && <p className="mb-1 text-muted small">Carrier: {s.carrier}</p>}
                    {s.trackingNumber && (
                      <p className="mb-1 text-muted small">
                        Tracking:{' '}
                        {s.trackingUrl ? (
                          <a href={s.trackingUrl} target="_blank" rel="noreferrer">
                            {s.trackingNumber}
                          </a>
                        ) : (
                          s.trackingNumber
                        )}
                      </p>
                    )}
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="mt-2"
                      onClick={() => navigate(`/admin/shipments/${s.id}`)}
                    >
                      View Details
                    </Button>
                  </Card.Body>
                </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center gap-2 mt-3">
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="align-self-center small">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal show={showCreate} onHide={() => setShowCreate(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Shipment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {createError && <Alert variant="danger">{createError}</Alert>}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Customer Order ID *</Form.Label>
              <Form.Control
                type="number"
                value={form.customerOrderId || ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customerOrderId: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Supplier Order ID</Form.Label>
              <Form.Control
                type="number"
                value={form.supplierOrderId ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    supplierOrderId: e.target.value ? parseInt(e.target.value, 10) : null,
                  }))
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Carrier</Form.Label>
              <Form.Control
                value={form.carrier ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value || null }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tracking Number</Form.Label>
              <Form.Control
                value={form.trackingNumber ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, trackingNumber: e.target.value || null }))
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tracking URL</Form.Label>
              <Form.Control
                value={form.trackingUrl ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, trackingUrl: e.target.value || null }))
                }
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleCreate()}
            disabled={createLoading || !form.customerOrderId}
          >
            {createLoading ? 'Creating…' : 'Create'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ShipmentsPage;
