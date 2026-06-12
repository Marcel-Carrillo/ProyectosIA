import React from 'react';

const StorefrontFooter: React.FC = () => {
  return (
    <footer className="storefront-footer">
      <div className="storefront-footer__inner">
        <p className="storefront-footer__wordmark">Fashion Store</p>
        <p className="storefront-footer__copy">
          &copy; {new Date().getFullYear()} Fashion Store. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
