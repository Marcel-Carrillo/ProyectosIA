import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountLayout from '../../components/storefront/AccountLayout';
import { getMyOrder } from '../../services/customerAuthService';
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
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getMyOrder(Number(id))
      .then((data) => setOrder(data as OrderDetail))
      .catch(() => setError(t('orderDetail.errors.load')));
  }, [id, t]);

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
