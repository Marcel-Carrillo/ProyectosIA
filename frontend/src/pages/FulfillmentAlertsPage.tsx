import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Table, Badge, Button, Form, Spinner, Alert, Card } from 'react-bootstrap';
import { FulfillmentAlert } from '../types/fulfillmentAlert';
import { fulfillmentAlertService } from '../services/fulfillmentAlertService';

const ALERT_TYPE_LABELS: Record<string, string> = {
  SupplierOrderGenerationFailed: 'Generación de pedido a proveedor fallida',
  CjPushFailed: 'Envío a CJ Dropshipping fallido',
  CjStatusSyncFailed: 'Sincronización de estado fallida',
  ShipmentTransitionSkipped: 'Transición de envío omitida',
  CarrierAllowListExhausted: 'Sin transportista permitido disponible',
};

const FulfillmentAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<FulfillmentAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fulfillmentAlertService.list({
        page,
        pageSize,
        ...(showResolved ? {} : { resolved: false }),
      });
      setAlerts(resp.data.items);
      setTotal(resp.data.total);
    } catch {
      setError('No se pudieron cargar las alertas de automatización.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, showResolved]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Container fluid className="py-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="mb-0">Alertas de automatización</h2>
        </Col>
        <Col xs="auto">
          <Form.Check
            type="switch"
            id="switch-show-resolved-alerts"
            label="Mostrar resueltas"
            checked={showResolved}
            onChange={(e) => {
              setShowResolved(e.target.checked);
              setPage(1);
            }}
          />
        </Col>
      </Row>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Cargando…</span>
          </Spinner>
        </div>
      ) : (
        <>
          <div className="d-none d-md-block">
            <Table striped hover responsive data-testid="alerts-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Pedido de cliente</th>
                  <th>Pedido a proveedor</th>
                  <th>Motivo</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No hay alertas.
                    </td>
                  </tr>
                ) : (
                  alerts.map((a) => (
                    <tr key={a.id} data-testid={`alert-row-${a.id}`}>
                      <td>{a.id}</td>
                      <td>
                        <Badge bg="danger">{ALERT_TYPE_LABELS[a.type] ?? a.type}</Badge>
                      </td>
                      <td>
                        {a.customerOrderId ? (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => navigate(`/customer-orders/${a.customerOrderId}`)}
                            data-testid={`alert-customer-order-link-${a.id}`}
                          >
                            #{a.customerOrderId}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {a.supplierOrderId ? (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => navigate(`/supplier-orders/${a.supplierOrderId}`)}
                            data-testid={`alert-supplier-order-link-${a.id}`}
                          >
                            #{a.supplierOrderId}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{a.message}</td>
                      <td>{new Date(a.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className="d-md-none">
            {alerts.length === 0 ? (
              <p className="text-center text-muted py-4">No hay alertas.</p>
            ) : (
              alerts.map((a) => (
                <Card key={a.id} className="mb-3" data-testid={`alert-card-${a.id}`}>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong>Alerta #{a.id}</strong>
                      <Badge bg="danger">{ALERT_TYPE_LABELS[a.type] ?? a.type}</Badge>
                    </div>
                    <p className="mb-1 text-muted small">{a.message}</p>
                    {a.customerOrderId && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2"
                        onClick={() => navigate(`/customer-orders/${a.customerOrderId}`)}
                      >
                        Pedido #{a.customerOrderId}
                      </Button>
                    )}
                    {a.supplierOrderId && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => navigate(`/supplier-orders/${a.supplierOrderId}`)}
                      >
                        Pedido proveedor #{a.supplierOrderId}
                      </Button>
                    )}
                  </Card.Body>
                </Card>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="d-flex justify-content-center gap-2 mt-3">
              <Button variant="outline-secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="align-self-center small">
                Página {page} de {totalPages}
              </span>
              <Button variant="outline-secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </Container>
  );
};

export default FulfillmentAlertsPage;
