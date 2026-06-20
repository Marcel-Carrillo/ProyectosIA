import React from 'react';

interface StorefrontAuthPanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const StorefrontAuthPanel: React.FC<StorefrontAuthPanelProps> = ({
  title,
  subtitle,
  children,
  footer,
}) => {
  return (
    <div className="storefront-auth">
      <div className="storefront-auth__panel storefront-animate-fade-up">
        <p className="storefront-auth__eyebrow">Mavile</p>
        <h1 className="storefront-auth__title">{title}</h1>
        {subtitle && <p className="storefront-auth__subtitle">{subtitle}</p>}
        <div className="storefront-auth__body">{children}</div>
        {footer && <div className="storefront-auth__footer">{footer}</div>}
      </div>
    </div>
  );
};

export default StorefrontAuthPanel;
