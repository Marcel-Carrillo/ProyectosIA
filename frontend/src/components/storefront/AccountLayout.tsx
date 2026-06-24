import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';

interface AccountLayoutProps {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: '/account', labelKey: 'layout.nav.overview', end: true },
  { to: '/account/profile', labelKey: 'layout.nav.profile' },
  { to: '/account/orders', labelKey: 'layout.nav.orders' },
  { to: '/account/wishlist', labelKey: 'layout.nav.wishlist' },
  { to: '/account/security/2fa', labelKey: 'layout.nav.security' },
] as const;

const AccountLayout: React.FC<AccountLayoutProps> = ({
  title,
  eyebrow,
  children,
}) => {
  const { t } = useTranslation('account');
  const { customer, logout } = useCustomerAuth();
  const location = useLocation();
  const isOverview = location.pathname === '/account';
  const resolvedEyebrow = eyebrow ?? t('layout.eyebrow');

  return (
    <div className="storefront-account storefront-animate-fade-in">
      <header className="storefront-account__header">
        <p className="storefront-account__eyebrow">{resolvedEyebrow}</p>
        <h1 className="storefront-account__title">{title}</h1>
        {customer && isOverview && (
          <p className="storefront-account__greeting">
            {customer.firstName} {customer.lastName}
            <span className="storefront-account__email">{customer.email}</span>
          </p>
        )}
      </header>

      <div className="storefront-account__layout">
        <aside className="storefront-account__sidebar" aria-label={t('layout.navLabel')}>
          {customer && !isOverview && (
            <div className="storefront-account__user">
              <span className="storefront-account__user-name">
                {customer.firstName} {customer.lastName}
              </span>
              <span className="storefront-account__user-email">{customer.email}</span>
            </div>
          )}
          <nav className="storefront-account__nav">
            {NAV_ITEMS.map(({ to, labelKey, ...rest }) => (
              <NavLink
                key={to}
                to={to}
                end={'end' in rest ? rest.end : false}
                className={({ isActive }) =>
                  `storefront-account__nav-link${isActive ? ' storefront-account__nav-link--active' : ''}`
                }
              >
                {t(labelKey)}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            className="storefront-account__logout"
            onClick={() => logout()}
          >
            {t('layout.logout')}
          </button>
        </aside>

        <main className="storefront-account__main">{children}</main>
      </div>
    </div>
  );
};

export default AccountLayout;
