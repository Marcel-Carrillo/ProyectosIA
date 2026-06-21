import React from 'react';
import { useTranslation } from 'react-i18next';

const StorefrontFooter: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <footer className="storefront-footer">
      <div className="storefront-footer__grid">
        <div>
          <p className="storefront-footer__brand-title">Mavile</p>
          <p className="storefront-footer__brand-text">
            {t('footer.brand')}
          </p>
        </div>
        <div>
          <h4 className="storefront-footer__col-title">{t('footer.shop')}</h4>
          <ul className="storefront-footer__links">
            <li><button type="button">{t('footer.link.women')}</button></li>
            <li><button type="button">{t('footer.link.men')}</button></li>
            <li><button type="button">{t('footer.link.accessories')}</button></li>
            <li><button type="button">{t('footer.link.newArrivals')}</button></li>
          </ul>
        </div>
        <div>
          <h4 className="storefront-footer__col-title">{t('footer.help')}</h4>
          <ul className="storefront-footer__links">
            <li><button type="button">{t('footer.link.shipping')}</button></li>
            <li><button type="button">{t('footer.link.returns')}</button></li>
            <li><button type="button">{t('footer.link.sizeGuide')}</button></li>
            <li><button type="button">{t('footer.link.contact')}</button></li>
          </ul>
        </div>
        <div>
          <h4 className="storefront-footer__col-title">{t('footer.company')}</h4>
          <ul className="storefront-footer__links">
            <li><button type="button">{t('footer.link.ourStory')}</button></li>
            <li><button type="button">{t('footer.link.materials')}</button></li>
            <li><button type="button">{t('footer.link.sustainability')}</button></li>
            <li><button type="button">{t('footer.link.press')}</button></li>
          </ul>
        </div>
      </div>
      <div className="storefront-footer__bottom">
        <div className="storefront-footer__bottom-inner">
          <span>&copy; {new Date().getFullYear()} Mavile</span>
          <span>{t('footer.cities')}</span>
        </div>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
