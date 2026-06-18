import React, { useEffect, useState } from 'react';
import { Container, ListGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { listMyOrders } from '../../services/customerAuthService';

const AccountOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Array<{ id: number; orderNumber: string; totalAmount: string; status: string }>>([]);

  useEffect(() => {
    listMyOrders().then((items) => setOrders(items as typeof orders));
  }, []);

  return (
    <Container className="py-4">
      <h1 className="h4 mb-3">My orders</h1>
      <ListGroup>
        {orders.map((order) => (
          <ListGroup.Item key={order.id} action as={Link} to={`/account/orders/${order.id}`}>
            {order.orderNumber} — €{order.totalAmount} ({order.status})
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Container>
  );
};

export default AccountOrdersPage;
