import React from 'react';
import { Link } from 'react-router-dom';
import CategoryNav from './CategoryNav';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';

const StorefrontHeader: React.FC = () => {
  const { itemCount } = useCart();
  const { isAuthenticated } = useCustomerAuth();

  return (
    <header className="storefront-header">
      <div className="storefront-header__inner">
        <Link to="/catalog" className="storefront-header__wordmark" aria-label="Fashion Store home">
          Fashion Store
        </Link>
        <div className="storefront-header__actions">
          <Link to={isAuthenticated ? '/account' : '/login'} className="storefront-header__icon-btn" aria-label="Account">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
          <Link to="/cart" className="storefront-header__icon-btn" aria-label={`Cart, ${itemCount} items`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {itemCount > 0 && (
              <span style={{ marginLeft: 4, fontSize: 12 }}>{itemCount}</span>
            )}
          </Link>
        </div>
      </div>
      <CategoryNav />
    </header>
  );
};

export default StorefrontHeader;
