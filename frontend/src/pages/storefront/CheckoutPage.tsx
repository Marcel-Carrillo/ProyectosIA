import React, { useMemo, useState } from 'react';
import { Alert, Button, Col, Container, Form, Row } from 'react-bootstrap';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { authenticatedCheckout, guestCheckout, validateCoupon } from '../../services/checkoutService';

const emptyAddress = {
  fullName: '',
  streetLine1: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Spain',
};

const CheckoutPage: React.FC = () => {
  const { items, clearCart } = useCart();
  const { isAuthenticated, customer } = useCustomerAuth();
  const navigate = useNavigate();

  const [guest, setGuest] = useState({ email: '', firstName: '', lastName: '', phone: '' });
  const [shipping, setShipping] = useState(emptyAddress);
  const [billing, setBilling] = useState(emptyAddress);
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + parseFloat(i.publicPrice) * i.quantity, 0),
    [items]
  );

  if (!items.length) return <Navigate to="/cart" replace />;

  const applyCoupon = async () => {
    if (!couponCode) return;
    const result = await validateCoupon(couponCode, subtotal.toFixed(2));
    if (result.valid && result.discountAmount) {
      setDiscount(parseFloat(result.discountAmount));
    } else {
      setDiscount(0);
      setError(result.reason ? `Coupon: ${result.reason}` : 'Invalid coupon');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = {
      items: items.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity })),
      shippingAddressSnapshot: shipping,
      billingAddressSnapshot: billing,
      shippingAmount: '0',
      couponCode: couponCode || undefined,
    };
    try {
      const order = isAuthenticated
        ? await authenticatedCheckout(payload)
        : await guestCheckout({
            ...payload,
            email: guest.email,
            firstName: guest.firstName,
            lastName: guest.lastName,
            phone: guest.phone || undefined,
          });
      clearCart();
      navigate(`/order-confirmation/${order.orderNumber}`, { state: { order } });
    } catch {
      setError('Checkout failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="py-4" style={{ maxWidth: 720 }}>
      <h1 className="h4 mb-3">Checkout</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form onSubmit={handleSubmit}>
        {!isAuthenticated && (
          <Row className="mb-3">
            <Col md={6}><Form.Control placeholder="Email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} required /></Col>
            <Col md={3}><Form.Control placeholder="First name" value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} required /></Col>
            <Col md={3}><Form.Control placeholder="Last name" value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} required /></Col>
          </Row>
        )}
        {isAuthenticated && customer && (
          <p className="text-muted small mb-3">Checking out as {customer.firstName} {customer.lastName} ({customer.email})</p>
        )}
        <h2 className="h6">Shipping address</h2>
        <Row className="g-2 mb-3">
          {Object.keys(emptyAddress).map((key) => (
            <Col md={6} key={key}>
              <Form.Control
                placeholder={key}
                value={shipping[key as keyof typeof emptyAddress]}
                onChange={(e) => setShipping({ ...shipping, [key]: e.target.value })}
                required
              />
            </Col>
          ))}
        </Row>
        <h2 className="h6">Billing address</h2>
        <Row className="g-2 mb-3">
          {Object.keys(emptyAddress).map((key) => (
            <Col md={6} key={`bill-${key}`}>
              <Form.Control
                placeholder={key}
                value={billing[key as keyof typeof emptyAddress]}
                onChange={(e) => setBilling({ ...billing, [key]: e.target.value })}
                required
              />
            </Col>
          ))}
        </Row>
        <Row className="g-2 mb-3 align-items-end">
          <Col><Form.Control placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} /></Col>
          <Col xs="auto"><Button type="button" variant="outline-secondary" onClick={applyCoupon}>Apply</Button></Col>
        </Row>
        <p>Subtotal: €{subtotal.toFixed(2)} · Discount: €{discount.toFixed(2)} · Total: €{(subtotal - discount).toFixed(2)}</p>
        <Button type="submit" disabled={submitting}>{submitting ? 'Placing order…' : 'Place order'}</Button>
      </Form>
    </Container>
  );
};

export default CheckoutPage;
