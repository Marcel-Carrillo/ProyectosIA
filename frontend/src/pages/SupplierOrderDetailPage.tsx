import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Table, Card } from 'react-bootstrap';
import {
  supplierOrderService,
  extractSupplierOrderErrorMessage,
} from '../services/supplierOrderService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import StatusBadge from '../components/admin/StatusBadge';
import SupplierOrderStatusControl from '../components/admin/SupplierOrderStatusControl';
import { SupplierOrder, UpdateSupplierOrderStatusInput } from '../types/supplierOrder';

const SupplierOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);

  const [order, setOrder] = useState<SupplierOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId || Number.isNaN(orderId)) {
      setError('Identificador de pedido a proveedor no válido.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await supplierOrderService.getById(orderId);
      setOrder(res.data);
    } catch {
      setError('No se pudo cargar el pedido a proveedor.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const handleStatusSave = async (update: UpdateSupplierOrderStatusInput) => {
    if (!order) return;
    setSaving(true);
    setStatusError('');
    try {
      const res = await supplierOrderService.updateStatus(order.id, update);
      setOrder(res.data);
    } catch (err) {
      setStatusError(extractSupplierOrderErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!order) return null;

  return (
    <div className="admin-page">
      <p className="mb-3">
        <Link to="/supplier-orders">← Volver a pedidos a proveedores</Link>
      </p>

      <div className="admin-page-header mb-3">
        <h1 className="h3 mb-0">{order.supplierOrderNumber}</h1>
        <div className="mt-2">
          <StatusBadge status={order.status} data-testid="detail-badge-supplier-order" />
        </div>
      </div>

      <Card className="mb-4">
        <Card.Body>
          <div>Pedido del cliente:{' '}
            <Link to={`/customer-orders/${order.customerOrderId}`}>
              {order.customerOrder?.orderNumber ?? `#${order.customerOrderId}`}
            </Link>
          </div>
          <div>Proveedor: {order.supplier?.name ?? `Proveedor #${order.supplierId}`}</div>
          {order.trackingNumber && <div>Seguimiento: {order.trackingNumber}</div>}
          {order.trackingUrl && (
            <div>
              <a href={order.trackingUrl} target="_blank" rel="noreferrer">Enlace de seguimiento</a>
            </div>
          )}
          {order.internalNotes && <div className="small text-muted mt-2">{order.internalNotes}</div>}
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Body>
          <Card.Title className="h6">Líneas del pedido</Card.Title>
          <Table responsive size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Ref.</th>
                <th>Cant.</th>
                <th>Coste</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(order.items ?? []).map((item) => (
                <tr key={item.id}>
                  <td>{item.supplierReferenceSnapshot ?? '—'}</td>
                  <td>{item.quantity}</td>
                  <td>{item.supplierCost}</td>
                  <td><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title className="h6">Actualizar estado</Card.Title>
          <SupplierOrderStatusControl
            order={order}
            saving={saving}
            error={statusError}
            onSave={handleStatusSave}
          />
        </Card.Body>
      </Card>
    </div>
  );
};

export default SupplierOrderDetailPage;
