import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useCookieConsent } from '../../contexts/CookieConsentContext';
import { ConsentCategories } from '../../constants/cookieConsent';

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const CookiePreferencesModal: React.FC = () => {
  const { t } = useTranslation('cookies');
  const { consent, isPreferencesOpen, saveConsent, closePreferences } = useCookieConsent();

  const [localConsent, setLocalConsent] = useState<Pick<ConsentCategories, 'analytics' | 'marketing'>>({
    analytics: false,
    marketing: false,
  });

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPreferencesOpen) {
      setLocalConsent({ analytics: consent.analytics, marketing: consent.marketing });
    }
  }, [isPreferencesOpen, consent.analytics, consent.marketing]);

  useEffect(() => {
    if (!isPreferencesOpen || !modalRef.current) return;

    const focusables = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    );
    focusables[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePreferences();
        return;
      }
      if (e.key === 'Tab') {
        const current = Array.from(
          modalRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        );
        const first = current[0];
        const last = current[current.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPreferencesOpen, closePreferences]);

  if (!isPreferencesOpen) return null;

  const modalContent = (
    <div className="storefront-cookie__overlay" data-testid="cookie-modal-overlay">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-modal-title"
        className="storefront-cookie__modal"
        data-testid="cookie-preferences-modal"
      >
        <div className="storefront-cookie__modal-header">
          <h2 id="cookie-modal-title" className="storefront-cookie__modal-title">
            {t('modal.title')}
          </h2>
          <button
            type="button"
            onClick={closePreferences}
            className="storefront-btn storefront-btn--text"
            aria-label={t('modal.close')}
            data-testid="modal-close-btn"
          >
            {t('modal.close')}
          </button>
        </div>

        <div className="storefront-cookie__categories">
          <div className="storefront-cookie__category">
            <div className="storefront-cookie__category-info">
              <p className="storefront-cookie__category-name">{t('modal.categories.necessary.name')}</p>
              <p className="storefront-cookie__category-desc">{t('modal.categories.necessary.description')}</p>
            </div>
            <label className="storefront-cookie__toggle">
              <input
                type="checkbox"
                checked={true}
                disabled={true}
                readOnly
                aria-label={t('modal.categories.necessary.name')}
                data-testid="toggle-necessary"
              />
              <span className="storefront-cookie__toggle-track" />
            </label>
          </div>

          <div className="storefront-cookie__category">
            <div className="storefront-cookie__category-info">
              <p className="storefront-cookie__category-name">{t('modal.categories.analytics.name')}</p>
              <p className="storefront-cookie__category-desc">{t('modal.categories.analytics.description')}</p>
            </div>
            <label className="storefront-cookie__toggle">
              <input
                type="checkbox"
                checked={localConsent.analytics}
                onChange={(e) => setLocalConsent(prev => ({ ...prev, analytics: e.target.checked }))}
                aria-label={t('modal.categories.analytics.name')}
                data-testid="toggle-analytics"
              />
              <span className="storefront-cookie__toggle-track" />
            </label>
          </div>

          <div className="storefront-cookie__category">
            <div className="storefront-cookie__category-info">
              <p className="storefront-cookie__category-name">{t('modal.categories.marketing.name')}</p>
              <p className="storefront-cookie__category-desc">{t('modal.categories.marketing.description')}</p>
            </div>
            <label className="storefront-cookie__toggle">
              <input
                type="checkbox"
                checked={localConsent.marketing}
                onChange={(e) => setLocalConsent(prev => ({ ...prev, marketing: e.target.checked }))}
                aria-label={t('modal.categories.marketing.name')}
                data-testid="toggle-marketing"
              />
              <span className="storefront-cookie__toggle-track" />
            </label>
          </div>
        </div>

        <div className="storefront-cookie__modal-actions">
          <button
            type="button"
            onClick={() => saveConsent({ analytics: false, marketing: false })}
            className="storefront-btn storefront-btn--ghost"
            data-testid="modal-reject-all"
          >
            {t('modal.rejectAll')}
          </button>
          <button
            type="button"
            onClick={() => saveConsent(localConsent)}
            className="storefront-btn storefront-btn--secondary"
            data-testid="modal-save-preferences"
          >
            {t('modal.savePreferences')}
          </button>
          <button
            type="button"
            onClick={() => saveConsent({ analytics: true, marketing: true })}
            className="storefront-btn storefront-btn--primary"
            data-testid="modal-accept-all"
          >
            {t('modal.acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CookiePreferencesModal;
