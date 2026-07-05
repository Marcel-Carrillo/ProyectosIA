import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import AccountLayout from '../../components/storefront/AccountLayout';
import {
  getMyOrder,
  resumeOrderPayment,
  cancelOrder,
  extractOrderActionErrorCode,
} from '../../services/customerAuthService';
import { getStripeConfig } from '../../services/paymentService';
import PaymentForm from '../../components/storefront/PaymentForm';
import { orderStatusLabel } from '../../utils/orderStatusLabel';

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

function orderBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('deliver') || normalized.includes('complet') || normalized.includes('paid')) {
    return 'storefront-account__badge storefront-account__badge--success';
  }
  if (normalized.includes('pend') || normalized.includes('process') || normalized.includes('ship')) {
    return 'storefront-account__badge storefront-account__badge--pending';
  }
  return 'storefront-account__badge';
}

const AccountOrderDetailPage: React.FC = () => {
  const { t } = useTranslation('account');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');
  const stripeConfigRequested = useRef(false);

  useEffect(() => {
    if (!id) return;
    getMyOrder(Number(id))
      .then((data) => setOrder(data as OrderDetail))
      .catch(() => setError(t('orderDetail.errors.load')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (order?.status !== 'PendingPayment' || stripeConfigRequested.current) return;
    stripeConfigRequested.current = true;
    getStripeConfig()
      .then(({ publishableKey }) => setStripePromise(loadStripe(publishableKey)))
      .catch(() => setActionError(t('orderDetail.errors.resumeFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

  const handleResumePayment = async () => {
    if (!order) return;
    setActionError('');
    setResuming(true);
    try {
      const result = await resumeOrderPayment(order.id);
      setClientSecret(result.clientSecret);
      setShowPayment(true);
    } catch (err) {
      const code = extractOrderActionErrorCode(err);
      setActionError(t(`orderDetail.errors.${code}`, { defaultValue: t('orderDetail.errors.resumeFailed') }));
    } finally {
      setResuming(false);
    }
  };

  const handlePaymentSuccess = () => {
    navigate(`/order-confirmation/${order!.orderNumber}`, {
      state: {
        order: { orderNumber: order!.orderNumber, totalAmount: order!.totalAmount },
        paymentStatus: 'processing',
      },
    });
  };

  const handlePaymentError = (message: string) => {
    setActionError(message);
  };

  const openCancelConfirm = () => {
    setActionError('');
    setShowCancelConfirm(true);
  };
  const dismissCancelConfirm = () => setShowCancelConfirm(false);

  const confirmCancelOrder = async () => {
    if (!order) return;
    setActionError('');
    setCancelling(true);
    try {
      const updated = await cancelOrder(order.id);
      setOrder(updated as OrderDetail);
      setShowCancelConfirm(false);
      setShowPayment(false);
      setClientSecret(null);
    } catch (err) {
      const code = extractOrderActionErrorCode(err);
      setActionError(t(`orderDetail.errors.${code}`, { defaultValue: t('orderDetail.errors.cancelFailed') }));
      setShowCancelConfirm(false);
    } finally {
      setCancelling(false);
    }
  };

  if (error) {
    return (
      <AccountLayout title={t('orderDetail.title')}>
        <p className="storefront-account__alert storefront-account__alert--error" role="alert">{error}</p>
        <Link to="/account/orders" className="storefront-account__back">{t('orderDetail.back')}</Link>
      </AccountLayout>
    );
  }

  if (!order) {
    return (
      <AccountLayout title={t('orderDetail.title')}>
        <p className="storefront-account__loading">{t('common.loading')}</p>
      </AccountLayout>
    );
  }

  const statusLabel = orderStatusLabel(t, order.status);
  const paymentLabel = orderStatusLabel(t, order.paymentStatus);

  return (
    <AccountLayout title={t('orderDetail.titleWithNumber', { orderNumber: order.orderNumber })}>
      <Link to="/account/orders" className="storefront-account__back">{t('orderDetail.back')}</Link>

      <div className="storefront-account__order-meta">
        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
        <span className={orderBadgeClass(order.status)}>{statusLabel}</span>
        <span className={orderBadgeClass(order.paymentStatus)}>{paymentLabel}</span>
      </div>

      {order.status === 'PendingPayment' && (
        <div className="storefront-account__actions" data-testid="pending-order-actions">
          {actionError && (
            <p
              className="storefront-account__alert storefront-account__alert--error"
              role="alert"
              data-testid="order-action-error"
            >
              {actionError}
            </p>
          )}

          {!showPayment && !showCancelConfirm && (
            <>
              <button
                type="button"
                className="storefront-btn storefront-btn--primary"
                data-testid="btn-resume-payment"
                onClick={handleResumePayment}
                disabled={resuming}
              >
                {resuming ? t('orderDetail.actions.resuming') : t('orderDetail.actions.completePayment')}
              </button>
              <button
                type="button"
                className="storefront-btn storefront-btn--ghost"
                data-testid="btn-cancel-order"
                onClick={openCancelConfirm}
              >
                {t('orderDetail.actions.cancelOrder')}
              </button>
            </>
          )}

          {showCancelConfirm && (
            <div
              className="storefront-account__confirm"
              role="alertdialog"
              aria-labelledby="cancel-order-confirm-title"
              data-testid="cancel-order-confirm"
            >
              <p id="cancel-order-confirm-title">{t('orderDetail.actions.cancelConfirm')}</p>
              <div className="storefront-account__confirm-actions">
                <button
                  type="button"
                  className="storefront-btn storefront-btn--ghost"
                  data-testid="btn-confirm-cancel"
                  onClick={confirmCancelOrder}
                  disabled={cancelling}
                >
                  {cancelling ? t('orderDetail.actions.cancelling') : t('orderDetail.actions.confirmCancel')}
                </button>
                <button
                  type="button"
                  className="storefront-btn storefront-btn--text"
                  data-testid="btn-dismiss-cancel"
                  onClick={dismissCancelConfirm}
                  disabled={cancelling}
                >
                  {t('orderDetail.actions.keepOrder')}
                </button>
              </div>
            </div>
          )}

          {showPayment && clientSecret && stripePromise && (
            <div className="storefront-account__payment-panel" data-testid="resume-payment-panel">
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  orderNumber={order.orderNumber}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>
              <button
                type="button"
                className="storefront-btn storefront-btn--text"
                onClick={() => {
                  setShowPayment(false);
                  setClientSecret(null);
                }}
              >
                {t('orderDetail.actions.backToOrder')}
              </button>
            </div>
          )}
        </div>
      )}

      {order.items && order.items.length > 0 && (
        <div className="storefront-account__table-wrap">
          <table className="storefront-account__table">
            <thead>
              <tr>
                <th>{t('orderDetail.table.product')}</th>
                <th>{t('orderDetail.table.sku')}</th>
                <th>{t('orderDetail.table.qty')}</th>
                <th style={{ textAlign: 'right' }}>{t('orderDetail.table.unit')}</th>
                <th style={{ textAlign: 'right' }}>{t('orderDetail.table.total')}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.productNameSnapshot}</td>
                  <td className="text-muted">{item.skuSnapshot}</td>
                  <td>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>€{item.unitPrice}</td>
                  <td style={{ textAlign: 'right' }}>€{item.totalPrice}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right' }} className="text-muted">
                  {t('orderDetail.table.subtotal')}
                </td>
                <td style={{ textAlign: 'right' }}>€{order.subtotalAmount}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right' }} className="text-muted">
                  {t('orderDetail.table.shipping')}
                </td>
                <td style={{ textAlign: 'right' }}>€{order.shippingAmount}</td>
              </tr>
              {parseFloat(order.discountAmount) > 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right' }} className="text-muted">
                    {t('orderDetail.table.discount')}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-error)' }}>-€{order.discountAmount}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} style={{ textAlign: 'right' }}>{t('orderDetail.table.total')}</td>
                <td style={{ textAlign: 'right' }}>€{order.totalAmount}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </AccountLayout>
  );
};

export default AccountOrderDetailPage;
