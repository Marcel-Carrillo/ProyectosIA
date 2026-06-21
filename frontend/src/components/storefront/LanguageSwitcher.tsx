import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleChange = (lang: 'es' | 'en') => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="storefront-lang-switcher" aria-label="Language switcher">
      <button
        type="button"
        className={`storefront-lang-switcher__btn${i18n.language === 'es' ? ' storefront-lang-switcher__btn--active' : ''}`}
        onClick={() => handleChange('es')}
        aria-label="Español"
        aria-pressed={i18n.language === 'es'}
      >
        🇪🇸
      </button>
      <button
        type="button"
        className={`storefront-lang-switcher__btn${i18n.language === 'en' ? ' storefront-lang-switcher__btn--active' : ''}`}
        onClick={() => handleChange('en')}
        aria-label="English"
        aria-pressed={i18n.language === 'en'}
      >
        🇬🇧
      </button>
    </div>
  );
};

export default LanguageSwitcher;
