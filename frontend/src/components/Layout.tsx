import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import Seo from './storefront/Seo';

const Layout: React.FC = () => {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container fluid className="px-3 px-md-4">
          <Navbar.Brand href="/products">Admin</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav" className="admin-navbar-collapse">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/products">Products</Nav.Link>
              <Nav.Link as={NavLink} to="/categories">Categories</Nav.Link>
              <Nav.Link as={NavLink} to="/suppliers">Suppliers</Nav.Link>
              <Nav.Link as={NavLink} to="/customers">Customers</Nav.Link>
              <Nav.Link as={NavLink} to="/customer-orders">Customer Orders</Nav.Link>
              <Nav.Link as={NavLink} to="/supplier-orders">Supplier Orders</Nav.Link>
              <Nav.Link as={NavLink} to="/shipments">Shipments</Nav.Link>
              <Nav.Link as={NavLink} to="/return-requests">Return Requests</Nav.Link>
              <Nav.Link as={NavLink} to="/refunds">Refunds</Nav.Link>
            </Nav>
            <div className="d-flex align-items-center gap-2 text-white-50 small">
              {admin?.email && <span>{admin.email}</span>}
              <Button variant="outline-light" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <main className="admin-main">
        <Seo title="Admin | Mavile" noindex />
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
