import React from 'react';
import { Link } from 'react-router-dom';
import CategoryNav from './CategoryNav';

const StorefrontHeader: React.FC = () => {
  return (
    <header className="storefront-header">
      <div className="storefront-header__inner">
        <Link to="/catalog" className="storefront-header__wordmark" aria-label="Fashion Store home">
          Fashion Store
        </Link>
        <div className="storefront-header__actions">
          <button
            type="button"
            aria-label="Search"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Cart"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </button>
        </div>
      </div>
      <CategoryNav />
    </header>
  );
};

export default StorefrontHeader;
