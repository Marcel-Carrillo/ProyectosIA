import React from 'react';
import { Button, Card, Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';

const AccountPage: React.FC = () => {
  const { customer, logout } = useCustomerAuth();

  return (
    <Container className="py-4" style={{ maxWidth: 560 }}>
      <Card>
        <Card.Body>
          <h1 className="h4">My account</h1>
          {customer && (
            <p className="mb-3">{customer.firstName} {customer.lastName}<br />{customer.email}</p>
          )}
          <div className="d-flex flex-wrap gap-2">
            <Link to="/account/profile" className="btn btn-outline-primary btn-sm">Profile</Link>
            <Link to="/account/orders" className="btn btn-outline-primary btn-sm">Orders</Link>
            <Link to="/account/wishlist" className="btn btn-outline-primary btn-sm">Wishlist</Link>
            <Link to="/account/security/2fa" className="btn btn-outline-primary btn-sm">2FA</Link>
            <Button variant="outline-secondary" size="sm" onClick={() => logout()}>Log out</Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AccountPage;
