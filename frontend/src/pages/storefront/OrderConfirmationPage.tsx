import React from 'react';
import { Container } from 'react-bootstrap';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PublicOrder } from '../../types/auth';

const OrderConfirmationPage: React.FC = () => {
  const { orderNumber } = useParams();
  const location = useLocation();
  const order = (location.state as { order?: PublicOrder } | null)?.order;

  return (
    <Container className="py-4 text-center" style={{ maxWidth: 560 }}>
      <h1 className="h4 mb-3">Thank you for your order</h1>
      <p>Order number: <strong>{order?.orderNumber ?? orderNumber}</strong></p>
      {order && <p>Total: €{order.totalAmount}</p>}
      <div className="d-flex gap-3 justify-content-center mt-4">
        <Link to="/catalog">Continue shopping</Link>
        <Link to="/account/orders">My orders</Link>
      </div>
    </Container>
  );
};

export default OrderConfirmationPage;
