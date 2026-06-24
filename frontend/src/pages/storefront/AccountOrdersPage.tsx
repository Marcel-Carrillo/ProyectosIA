import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountLayout from '../../components/storefront/AccountLayout';
import { listMyOrders } from '../../services/customerAuthService';
import { orderStatusLabel } from '../../utils/orderStatusLabel';

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

const AccountOrdersPage: React.FC = () => {
  const { t } = useTranslation('account');
  const [orders, setOrders] = useState<Array<{ id: number; orderNumber: string; totalAmount: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyOrders()
      .then((items) => setOrders(items as typeof orders))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AccountLayout title={t('orders.title')}>
      <div className="storefront-account__panel">
        <h2 className="storefront-account__panel-title">{t('orders.panelTitle')}</h2>
        {loading ? (
          <p className="storefront-account__loading">{t('common.loading')}</p>
        ) : !orders.length ? (
          <div className="storefront-account__empty">
            <p className="storefront-account__empty-title">{t('orders.empty.title')}</p>
            <p className="storefront-account__empty-text">{t('orders.empty.text')}</p>
            <Link to="/catalog" className="storefront-btn storefront-btn--text">
              {t('common.browseCatalog')}
            </Link>
          </div>
        ) : (
          <ul className="storefront-account__list">
            {orders.map((order) => {
              const statusLabel = orderStatusLabel(t, order.status);
              return (
                <li key={order.id}>
                  <Link to={`/account/orders/${order.id}`} className="storefront-account__list-item">
                    <div>
                      <span className="storefront-account__list-primary">{order.orderNumber}</span>
                      <p className="storefront-account__list-secondary">{statusLabel}</p>
                    </div>
                    <div className="storefront-account__list-meta">
                      <span className="storefront-account__list-price">€{order.totalAmount}</span>
                      <span className={orderBadgeClass(order.status)}>{statusLabel}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AccountLayout>
  );
};

export default AccountOrdersPage;
