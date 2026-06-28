import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStorefrontCategories } from '../../hooks/useStorefrontCategories';
import { useCookieConsent } from '../../contexts/CookieConsentContext';

const StorefrontFooter: React.FC = () => {
  const { t } = useTranslation('common');
  const { getHref } = useStorefrontCategories();
  const { openPreferences } = useCookieConsent();

  const shopLinks: { labelKey: string; to: string }[] = [
    { labelKey: 'footer.link.women', to: getHref('women') },
    { labelKey: 'footer.link.men', to: getHref('men') },
    { labelKey: 'footer.link.accessories', to: getHref('accessories') },
    { labelKey: 'footer.link.newArrivals', to: '/catalog?sort=createdAt&order=desc' },
  ];

  const helpLinks = [
    { labelKey: 'footer.link.shipping', to: '/pages/shipping' },
    { labelKey: 'footer.link.returns', to: '/pages/returns' },
    { labelKey: 'footer.link.sizeGuide', to: '/pages/size-guide' },
    { labelKey: 'footer.link.contact', to: '/pages/contact' },
  ];

  const companyLinks = [
    { labelKey: 'footer.link.ourStory', to: '/pages/our-story' },
    { labelKey: 'footer.link.materials', to: '/pages/materials' },
    { labelKey: 'footer.link.sustainability', to: '/pages/sustainability' },
    { labelKey: 'footer.link.press', to: '/pages/press' },
  ];

  return (
    <footer className="storefront-footer">
      <div className="storefront-footer__grid">
        <div>
          <Link to="/catalog" className="storefront-footer__brand-link">
            <img src="/mavile-logo.svg" alt="Mavile" className="storefront-footer__brand-logo" />
          </Link>
          <p className="storefront-footer__brand-text">
            {t('footer.brand')}
          </p>
        </div>
        <div>
          <h4 className="storefront-footer__col-title">{t('footer.shop')}</h4>
          <ul className="storefront-footer__links">
            {shopLinks.map((link) => (
              <li key={link.labelKey}>
                <Link to={link.to}>{t(link.labelKey)}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="storefront-footer__col-title">{t('footer.help')}</h4>
          <ul className="storefront-footer__links">
            {helpLinks.map((link) => (
              <li key={link.labelKey}>
                <Link to={link.to}>{t(link.labelKey)}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="storefront-footer__col-title">{t('footer.company')}</h4>
          <ul className="storefront-footer__links">
            {companyLinks.map((link) => (
              <li key={link.labelKey}>
                <Link to={link.to}>{t(link.labelKey)}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="storefront-footer__bottom">
        <div className="storefront-footer__bottom-inner">
          <span>&copy; {new Date().getFullYear()} Mavile</span>
          <span>{t('footer.cities')}</span>
          <Link to="/pages/privacy">{t('footer.link.privacy')}</Link>
          <Link to="/pages/legal">{t('footer.link.legal')}</Link>
          <button
            type="button"
            onClick={openPreferences}
            className="storefront-footer__cookie-settings"
            data-testid="footer-cookie-settings"
          >
            {t('footer.cookieSettings', { ns: 'cookies' })}
          </button>
        </div>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
