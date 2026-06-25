import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleChange = (lang: 'es' | 'en') => {
    i18n.changeLanguage(lang);
  };

  const isEs = i18n.language === 'es';
  const isEn = i18n.language === 'en';

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
