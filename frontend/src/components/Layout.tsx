import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import Seo from './storefront/Seo';
import i18n from '../i18n';

const Layout: React.FC = () => {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void i18n.changeLanguage('es');
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container fluid className="px-3 px-md-4">
          <Navbar.Brand href="/products">Administración</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav" className="admin-navbar-collapse">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/products">Productos</Nav.Link>
              <Nav.Link as={NavLink} to="/categories">Categorías</Nav.Link>
              <Nav.Link as={NavLink} to="/suppliers">Proveedores</Nav.Link>
              <Nav.Link as={NavLink} to="/customers">Clientes</Nav.Link>
              <Nav.Link as={NavLink} to="/customer-orders">Pedidos de clientes</Nav.Link>
              <Nav.Link as={NavLink} to="/supplier-orders">Pedidos a proveedores</Nav.Link>
              <Nav.Link as={NavLink} to="/shipments">Envíos</Nav.Link>
              <Nav.Link as={NavLink} to="/return-requests">Solicitudes de devolución</Nav.Link>
              <Nav.Link as={NavLink} to="/refunds">Reembolsos</Nav.Link>
            </Nav>
            <div className="d-flex align-items-center gap-2 text-white-50 small">
              {admin?.email && <span>{admin.email}</span>}
              <Button variant="outline-light" size="sm" onClick={handleLogout}>
                Cerrar sesión
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <main className="admin-main">
        <Seo title="Administración | Mavile" noindex />
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
