import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StorefrontHeader from './StorefrontHeader';
import StorefrontFooter from './StorefrontFooter';

const StorefrontLayout: React.FC = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

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
