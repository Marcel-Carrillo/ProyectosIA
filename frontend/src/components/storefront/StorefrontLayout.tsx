import React from 'react';
import { Outlet } from 'react-router-dom';
import StorefrontHeader from './StorefrontHeader';
import StorefrontFooter from './StorefrontFooter';

const StorefrontLayout: React.FC = () => {
  return (
    <div className="storefront-root">
      <StorefrontHeader />
      <main style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <Outlet />
      </main>
      <StorefrontFooter />
    </div>
  );
};

export default StorefrontLayout;
