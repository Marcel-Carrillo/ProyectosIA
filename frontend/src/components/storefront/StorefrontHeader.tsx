import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CategoryNav from './CategoryNav';
import LanguageSwitcher from './LanguageSwitcher';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';

const StorefrontHeader: React.FC = () => {
  const { itemCount } = useCart();
  const { isAuthenticated } = useCustomerAuth();
  const { t } = useTranslation('common');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, location.search]);

  const toggleMenu = () => setIsMenuOpen(open => !open);

  return (
    <header className="storefront-header">
      <div className="storefront-header__bar">
        <CategoryNav variant="header" />

        <Link to="/catalog" className="storefront-header__logo-link" aria-label={t('header.home')}>
          <img src="/mavile-logo.png" alt="Mavile" className="storefront-header__logo" />
        </Link>

        <div className="storefront-header__actions">
          <LanguageSwitcher />

          <button
            type="button"
            className="storefront-header__icon-btn storefront-header__hamburger"
            aria-label={isMenuOpen ? t('header.closeMenu') : t('header.openMenu')}
            aria-expanded={isMenuOpen}
            aria-controls="storefront-mobile-menu"
            onClick={toggleMenu}
          >
            {isMenuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>

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

          <Link
            to="/cart"
            className="storefront-header__icon-btn"
            aria-label={t('header.cart', { count: itemCount })}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            <span className="storefront-header__cart-count">({itemCount})</span>
          </Link>
        </div>
      </div>

      {/* Mobile collapsible menu */}
      <div
        id="storefront-mobile-menu"
        className={`storefront-header__mobile-menu${isMenuOpen ? ' storefront-header__mobile-menu--open' : ''}`}
        aria-hidden={!isMenuOpen}
      >
        <CategoryNav variant="mobile" onNavClick={() => setIsMenuOpen(false)} />
      </div>
    </header>
  );
};

export default StorefrontHeader;
