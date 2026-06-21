import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CategoryNav from './CategoryNav';
import LanguageSwitcher from './LanguageSwitcher';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';

const StorefrontHeader: React.FC = () => {
  const { itemCount } = useCart();
  const { isAuthenticated } = useCustomerAuth();
  const { t } = useTranslation('common');

  return (
    <header className="storefront-header">
      <div className="storefront-header__bar">
        <CategoryNav variant="header" />
        <Link to="/catalog" className="storefront-header__wordmark" aria-label={t('header.home')}>
          Mavile
        </Link>
        <div className="storefront-header__actions">
          <LanguageSwitcher />
          <Link
            to={isAuthenticated ? '/account' : '/login'}
            className="storefront-header__icon-btn"
            aria-label={t('header.account')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
          <Link to="/cart" className="storefront-header__icon-btn" aria-label={t('header.cart', { count: itemCount })}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            <span className="storefront-header__cart-count">({itemCount})</span>
          </Link>
        </div>
      </div>
      <CategoryNav variant="mobile" />
    </header>
  );
};

export default StorefrontHeader;
