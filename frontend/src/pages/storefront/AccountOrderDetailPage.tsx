import React, { useEffect, useState } from 'react';
import { Container, Table, Badge, Alert } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { getMyOrder } from '../../services/customerAuthService';

interface OrderItem {
  id: number;
  productNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  fulfillmentStatus: string;
}

interface OrderDetail {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotalAmount: string;
  shippingAmount: string;
  discountAmount: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  items?: OrderItem[];
}

const AccountOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getMyOrder(Number(id))
      .then((data) => setOrder(data as OrderDetail))
      .catch(() => setError('Could not load order details.'));
  }, [id]);

  if (error) return (
    <Container className="py-4">
      <Alert variant="danger">{error}</Alert>
      <Link to="/account/orders">← Back to my orders</Link>
    </Container>
  );

  if (!order) return (
    <Container className="py-4">
      <p className="text-muted">Loading…</p>
    </Container>
  );

  return (
    <Container className="py-4" style={{ maxWidth: 720 }}>
      <Link to="/account/orders" className="text-muted small">← Back to my orders</Link>
      <h1 className="h4 mt-3 mb-1">Order {order.orderNumber}</h1>
      <p className="text-muted small mb-4">
        {new Date(order.createdAt).toLocaleDateString()} &mdash;{' '}
        <Badge bg="secondary">{order.status}</Badge>{' '}
        <Badge bg="info" text="dark">{order.paymentStatus}</Badge>
      </p>

      {order.items && order.items.length > 0 && (
        <Table responsive className="mb-4">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="text-center">Qty</th>
              <th className="text-end">Unit</th>
              <th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productNameSnapshot}</td>
                <td className="text-muted small">{item.skuSnapshot}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-end">€{item.unitPrice}</td>
                <td className="text-end">€{item.totalPrice}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-end text-muted">Subtotal</td>
              <td className="text-end">€{order.subtotalAmount}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-end text-muted">Shipping</td>
              <td className="text-end">€{order.shippingAmount}</td>
            </tr>
            {parseFloat(order.discountAmount) > 0 && (
              <tr>
                <td colSpan={4} className="text-end text-muted">Discount</td>
                <td className="text-end text-success">-€{order.discountAmount}</td>
              </tr>
            )}
            <tr className="fw-semibold">
              <td colSpan={4} className="text-end">Total</td>
              <td className="text-end">€{order.totalAmount}</td>
            </tr>
          </tfoot>
        </Table>
      )}
    </Container>
  );
};

export default AccountOrderDetailPage;
