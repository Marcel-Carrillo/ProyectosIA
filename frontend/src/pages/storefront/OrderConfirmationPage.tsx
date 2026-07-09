import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PublicOrder } from '../../types/auth';
import { getOrderPaymentStatus } from '../../services/paymentService';
import Seo from '../../components/storefront/Seo';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;

const OrderConfirmationPage: React.FC = () => {
  const { t } = useTranslation('checkout');
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const locationState = location.state as { order?: PublicOrder; paymentStatus?: string } | null;
  const order = locationState?.order;

  // Detect Stripe wallet redirect (Google Pay / PayPal via redirect: 'if_required')
  const searchParams = new URLSearchParams(window.location.search);
  const redirectStatus = searchParams.get('redirect_status');
  const fromStripeRedirect = redirectStatus === 'succeeded';
  const stripeRedirectFailed = redirectStatus === 'failed' || redirectStatus === 'canceled';

  const isPolling = locationState?.paymentStatus === 'processing' || fromStripeRedirect;

  const [paymentStatus, setPaymentStatus] = useState<string | null>(
    stripeRedirectFailed ? 'Failed' : (isPolling ? 'PendingPayment' : (order?.paymentStatus ?? null))
  );
  const [pollTimeout, setPollTimeout] = useState(false);
  const attemptsRef = useRef(0);

  // Clean Stripe redirect params from URL once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('payment_intent') || params.has('redirect_status')) {
      params.delete('payment_intent');
      params.delete('payment_intent_client_secret');
      params.delete('redirect_status');
      const newSearch = params.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (newSearch ? `?${newSearch}` : '')
      );
    }
  }, []);

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
    <div className="storefront-confirmation storefront-animate-fade-up">
      <Seo title={t('confirmation.seoTitle')} noindex />
      <p className="storefront-confirmation__eyebrow">Mavile</p>
      <h1 className="storefront-confirmation__title">
        {paid ? t('confirmation.paymentConfirmed') : t('confirmation.thankYou')}
      </h1>

      {stillWaiting && (
        <div className="storefront-confirmation__polling" data-testid="payment-polling">
          <span className="storefront-confirmation__spinner" aria-hidden />
          <span>{t('confirmation.confirmingPayment')}</span>
        </div>
      )}

      {paid && (
        <p className="storefront-confirmation__success" data-testid="payment-success">
          {t('confirmation.paymentReceived')}
        </p>
      )}

      {failed && (
        <p className="storefront-auth__error" data-testid="payment-failed">
          {t('confirmation.paymentFailedPrefix')}{' '}
          <Link to="/cart">{t('confirmation.paymentFailedLink')}</Link>{' '}
          {t('confirmation.paymentFailedSuffix')}
        </p>
      )}

      {pollTimeout && !paid && (
        <p className="storefront-confirmation__warning" data-testid="payment-timeout">
          {t('confirmation.timeoutPrefix')}{' '}
          <Link to="/account/orders">{t('confirmation.timeoutLink')}</Link>{' '}
          {t('confirmation.timeoutSuffix')}
        </p>
      )}

      <p className="storefront-confirmation__meta">
        {t('confirmation.orderNumber')} <strong>{displayOrderNumber}</strong>
      </p>
      {order && (
        <p className="storefront-confirmation__meta">
          {t('confirmation.total', { amount: order.totalAmount })}
        </p>
      )}

      <div className="storefront-confirmation__links">
        <Link to="/catalog" className="storefront-btn storefront-btn--text">{t('confirmation.continueShopping')}</Link>
        <Link to="/account/orders" className="storefront-btn storefront-btn--text">{t('confirmation.myOrders')}</Link>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
