import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCookieConsent } from '../../contexts/CookieConsentContext';

const CookieConsentBanner: React.FC = () => {
  const { t } = useTranslation('cookies');
  const { hasDecision, saveConsent, openPreferences } = useCookieConsent();

  if (hasDecision) return null;

  const handleAcceptAll = () => saveConsent({ analytics: true, marketing: true });
  const handleRejectAll = () => saveConsent({ analytics: false, marketing: false });

  return (
    <div
      role="region"
      aria-label={t('banner.ariaLabel')}
      aria-live="polite"
      className="storefront-cookie__banner"
      data-testid="cookie-consent-banner"
    >
      <div className="storefront-cookie__banner-inner">
        <p className="storefront-cookie__banner-message">{t('banner.message')}</p>
        <div className="storefront-cookie__banner-actions">
          <button
            type="button"
            onClick={handleRejectAll}
            className="storefront-btn storefront-btn--ghost"
            data-testid="cookie-banner-reject"
          >
            {t('banner.rejectAll')}
          </button>
          <button
            type="button"
            onClick={openPreferences}
            className="storefront-btn storefront-btn--ghost"
            data-testid="cookie-banner-customize"
          >
            {t('banner.customize')}
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="storefront-btn storefront-btn--primary"
            data-testid="cookie-banner-accept"
          >
            {t('banner.acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
