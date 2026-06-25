import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountLayout from '../../components/storefront/AccountLayout';

const DASHBOARD_LINKS = [
  { to: '/account/profile', cardKey: 'profile' },
  { to: '/account/orders', cardKey: 'orders' },
  { to: '/account/wishlist', cardKey: 'wishlist' },
  { to: '/account/security/2fa', cardKey: 'security' },
] as const;

const AccountPage: React.FC = () => {
  const { t } = useTranslation('account');

  return (
    <AccountLayout title={t('overview.title')}>
      <div className="storefront-account__dashboard-grid">
        {DASHBOARD_LINKS.map((item) => (
          <Link key={item.to} to={item.to} className="storefront-account__dashboard-card">
            <span className="storefront-account__dashboard-card-label">
              {t(`overview.cards.${item.cardKey}.label`)}
            </span>
            <h2 className="storefront-account__dashboard-card-title">
              {t(`overview.cards.${item.cardKey}.title`)}
            </h2>
            <p className="storefront-account__dashboard-card-desc">
              {t(`overview.cards.${item.cardKey}.description`)}
            </p>
          </Link>
        ))}
      </div>
    </AccountLayout>
  );
};

export default AccountPage;
