import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';

const Layout: React.FC = () => {
  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="/products">Admin</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
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
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container className="mt-4">
        <Outlet />
      </Container>
    </>
  );
};

export default Layout;
