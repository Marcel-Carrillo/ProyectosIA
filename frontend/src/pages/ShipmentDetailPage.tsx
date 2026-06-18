import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Button,
  Spinner,
  Alert,
} from 'react-bootstrap';
import {
  Shipment,
  ShipmentStatus,
  SHIPMENT_STATUS_COLORS,
  SHIPMENT_TRANSITIONS,
} from '../types/shipment';
import {
  shipmentService,
  extractShipmentErrorMessage,
} from '../services/shipmentService';

const ShipmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitionLoading, setTransitionLoading] = useState<ShipmentStatus | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await shipmentService.getById(parseInt(id ?? '0', 10));
        setShipment(resp.data);
      } catch (err) {
        setError(extractShipmentErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handleTransition = async (newStatus: ShipmentStatus) => {
    setTransitionLoading(newStatus);
    setTransitionError(null);
    try {
      const resp = await shipmentService.updateStatus(parseInt(id ?? '0', 10), { status: newStatus });
      setShipment(resp.data);
    } catch (err) {
      setTransitionError(extractShipmentErrorMessage(err));
    } finally {
      setTransitionLoading(null);
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading…</span>
        </Spinner>
      </Container>
    );
  }

  if (error || !shipment) {
    return (
      <Container className="py-4">
        <Alert variant="danger">{error ?? 'Shipment not found.'}</Alert>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Back
        </Button>
      </Container>
    );
  }

  const nextStatuses = SHIPMENT_TRANSITIONS[shipment.status];

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString() : '—';

  return (
    <Container className="py-4">
      <div className="d-flex align-items-center mb-4 gap-3">
        <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <h2 className="mb-0">Shipment #{shipment.id}</h2>
        <Badge bg={SHIPMENT_STATUS_COLORS[shipment.status]} className="fs-6">
          {shipment.status}
        </Badge>
      </div>

      {transitionError && (
        <Alert variant="danger" dismissible onClose={() => setTransitionError(null)}>
          {transitionError}
        </Alert>
      )}

      <Row className="g-4">
        <Col xs={12} md={6}>
          <Card>
            <Card.Header>
              <strong>Shipment Details</strong>
            </Card.Header>
            <Card.Body>
              <dl className="row mb-0">
                <dt className="col-sm-5">Customer Order</dt>
                <dd className="col-sm-7">
                  <Button
                    variant="link"
                    className="p-0"
                    onClick={() => navigate(`/admin/customer-orders/${shipment.customerOrderId}`)}
                  >
                    #{shipment.customerOrderId}
                    {shipment.customerOrder && ` — ${shipment.customerOrder.orderNumber}`}
                  </Button>
                </dd>

                {shipment.supplierOrderId && (
                  <>
                    <dt className="col-sm-5">Supplier Order</dt>
                    <dd className="col-sm-7">
                      <Button
                        variant="link"
                        className="p-0"
                        onClick={() => navigate(`/admin/supplier-orders/${shipment.supplierOrderId}`)}
                      >
                        #{shipment.supplierOrderId}
                      </Button>
                    </dd>
                  </>
                )}

                <dt className="col-sm-5">Carrier</dt>
                <dd className="col-sm-7">{shipment.carrier ?? '—'}</dd>

                <dt className="col-sm-5">Tracking #</dt>
                <dd className="col-sm-7">
                  {shipment.trackingNumber ? (
                    shipment.trackingUrl ? (
                      <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                        {shipment.trackingNumber}
                      </a>
                    ) : (
                      shipment.trackingNumber
                    )
                  ) : '—'}
                </dd>

                <dt className="col-sm-5">Shipped At</dt>
                <dd className="col-sm-7">{fmt(shipment.shippedAt)}</dd>

                <dt className="col-sm-5">Delivered At</dt>
                <dd className="col-sm-7">{fmt(shipment.deliveredAt)}</dd>

                <dt className="col-sm-5">Created</dt>
                <dd className="col-sm-7">{fmt(shipment.createdAt)}</dd>

                <dt className="col-sm-5">Updated</dt>
                <dd className="col-sm-7">{fmt(shipment.updatedAt)}</dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={6}>
          <Card>
            <Card.Header>
              <strong>Status Transitions</strong>
            </Card.Header>
            <Card.Body>
              {nextStatuses.length === 0 ? (
                <p className="text-muted mb-0">
                  This shipment is in a terminal state: <strong>{shipment.status}</strong>. No further transitions are allowed.
                </p>
              ) : (
                <>
                  <p className="text-muted small mb-3">
                    Current: <Badge bg={SHIPMENT_STATUS_COLORS[shipment.status]}>{shipment.status}</Badge>
                    {' '}→ allowed transitions:
                  </p>
                  <div className="d-flex flex-wrap gap-2">
                    {nextStatuses.map((s) => (
                      <Button
                        key={s}
                        variant={`outline-${SHIPMENT_STATUS_COLORS[s]}`}
                        size="sm"
                        disabled={transitionLoading !== null}
                        onClick={() => void handleTransition(s)}
                      >
                        {transitionLoading === s ? (
                          <Spinner animation="border" size="sm" className="me-1" />
                        ) : null}
                        → {s}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ShipmentDetailPage;
