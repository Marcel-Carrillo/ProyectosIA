import React from 'react';
import { useTranslation } from 'react-i18next';
import { getUiLocale } from '../../utils/uiLocale';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleChange = (lang: 'es' | 'en') => {
    void i18n.changeLanguage(lang);
  };

  const active = getUiLocale(i18n.resolvedLanguage || i18n.language);
  const isEs = active === 'es';
  const isEn = active === 'en';

  return (
    <div className="storefront-lang-switcher" role="group" aria-label="Language switcher">
      <button
        type="button"
        className={`storefront-lang-switcher__btn${isEs ? ' storefront-lang-switcher__btn--active' : ''}`}
        onClick={() => handleChange('es')}
        aria-label="Español"
        aria-pressed={isEs}
      >
        ES
      </button>
      <span className="storefront-lang-switcher__divider" aria-hidden="true">|</span>
      <button
        type="button"
        className={`storefront-lang-switcher__btn${isEn ? ' storefront-lang-switcher__btn--active' : ''}`}
        onClick={() => handleChange('en')}
        aria-label="English"
        aria-pressed={isEn}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;
