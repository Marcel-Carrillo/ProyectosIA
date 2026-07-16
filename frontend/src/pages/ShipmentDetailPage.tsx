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
import { adminStatusLabel } from '../utils/adminStatusLabels';

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
          <span className="visually-hidden">Cargando…</span>
        </Spinner>
      </Container>
    );
  }

  if (error || !shipment) {
    return (
      <Container className="py-4">
        <Alert variant="danger">{error ?? 'Envío no encontrado.'}</Alert>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Volver
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
          ← Volver
        </Button>
        <h2 className="mb-0">Envío #{shipment.id}</h2>
        <Badge bg={SHIPMENT_STATUS_COLORS[shipment.status]} className="fs-6">
          {adminStatusLabel(shipment.status)}
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
              <strong>Detalles del envío</strong>
            </Card.Header>
            <Card.Body>
              <dl className="row mb-0">
                <dt className="col-sm-5">Pedido de cliente</dt>
                <dd className="col-sm-7">
                  <Button
                    variant="link"
                    className="p-0"
                    onClick={() => navigate(`/customer-orders/${shipment.customerOrderId}`)}
                  >
                    #{shipment.customerOrderId}
                    {shipment.customerOrder && ` — ${shipment.customerOrder.orderNumber}`}
                  </Button>
                </dd>

                {shipment.supplierOrderId && (
                  <>
                    <dt className="col-sm-5">Pedido a proveedor</dt>
                    <dd className="col-sm-7">
                      <Button
                        variant="link"
                        className="p-0"
                        onClick={() => navigate(`/supplier-orders/${shipment.supplierOrderId}`)}
                      >
                        #{shipment.supplierOrderId}
                      </Button>
                    </dd>
                  </>
                )}

                <dt className="col-sm-5">Transportista</dt>
                <dd className="col-sm-7">{shipment.carrier ?? '—'}</dd>

                <dt className="col-sm-5">N.º de seguimiento</dt>
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

                <dt className="col-sm-5">Fecha de envío</dt>
                <dd className="col-sm-7">{fmt(shipment.shippedAt)}</dd>

                <dt className="col-sm-5">Fecha de entrega</dt>
                <dd className="col-sm-7">{fmt(shipment.deliveredAt)}</dd>

                <dt className="col-sm-5">Creado</dt>
                <dd className="col-sm-7">{fmt(shipment.createdAt)}</dd>

                <dt className="col-sm-5">Actualizado</dt>
                <dd className="col-sm-7">{fmt(shipment.updatedAt)}</dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={6}>
          <Card>
            <Card.Header>
              <strong>Transiciones de estado</strong>
            </Card.Header>
            <Card.Body>
              {nextStatuses.length === 0 ? (
                <p className="text-muted mb-0">
                  Este envío está en un estado terminal: <strong>{adminStatusLabel(shipment.status)}</strong>. No se permiten más transiciones.
                </p>
              ) : (
                <>
                  <p className="text-muted small mb-3">
                    Actual: <Badge bg={SHIPMENT_STATUS_COLORS[shipment.status]}>{adminStatusLabel(shipment.status)}</Badge>
                    {' '}→ transiciones permitidas:
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
                        → {adminStatusLabel(s)}
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
