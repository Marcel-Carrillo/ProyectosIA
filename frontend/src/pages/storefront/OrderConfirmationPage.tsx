import React, { useEffect, useRef, useState } from 'react';
import { Alert, Container, Spinner } from 'react-bootstrap';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PublicOrder } from '../../types/auth';
import { getOrderPaymentStatus } from '../../services/paymentService';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15; // 30 seconds

const OrderConfirmationPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const locationState = location.state as { order?: PublicOrder; paymentStatus?: string } | null;
  const order = locationState?.order;
  const isPolling = locationState?.paymentStatus === 'processing';

  const [paymentStatus, setPaymentStatus] = useState<string | null>(
    isPolling ? 'PendingPayment' : (order?.paymentStatus ?? null)
  );
  const [pollTimeout, setPollTimeout] = useState(false);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!isPolling || !orderNumber) return;
    const interval = setInterval(async () => {
      attemptsRef.current += 1;
      if (attemptsRef.current > POLL_MAX_ATTEMPTS) {
        clearInterval(interval);
        setPollTimeout(true);
        return;
      }
      const status = await getOrderPaymentStatus(orderNumber).catch(() => null);
      if (status) setPaymentStatus(status);
      if (status === 'Paid' || status === 'Failed') {
        clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPolling, orderNumber]);

  const displayOrderNumber = order?.orderNumber ?? orderNumber;
  const paid = paymentStatus === 'Paid';
  const failed = paymentStatus === 'Failed';
  const stillWaiting = isPolling && !paid && !failed && !pollTimeout;

  return (
    <Container className="py-4 text-center" style={{ maxWidth: 560 }}>
      <h1 className="h4 mb-3">
        {paid ? 'Payment confirmed!' : 'Thank you for your order'}
      </h1>

      {stillWaiting && (
        <div className="d-flex align-items-center justify-content-center gap-2 mb-3" data-testid="payment-polling">
          <Spinner animation="border" size="sm" />
          <span>Confirming payment…</span>
        </div>
      )}

      {paid && (
        <Alert variant="success" data-testid="payment-success">
          Your payment was received. We will ship your order shortly.
        </Alert>
      )}

      {failed && (
        <Alert variant="danger" data-testid="payment-failed">
          Payment failed. Please <Link to="/cart">return to cart</Link> and try again.
        </Alert>
      )}

      {pollTimeout && !paid && (
        <Alert variant="warning" data-testid="payment-timeout">
          Payment confirmation is taking longer than expected. Check your{' '}
          <Link to="/account/orders">order history</Link> for the latest status.
        </Alert>
      )}

      <p>Order number: <strong>{displayOrderNumber}</strong></p>
      {order && <p>Total: €{order.totalAmount}</p>}

      <div className="d-flex gap-3 justify-content-center mt-4">
        <Link to="/catalog">Continue shopping</Link>
        <Link to="/account/orders">My orders</Link>
      </div>
    </Container>
  );
};

export default OrderConfirmationPage;
