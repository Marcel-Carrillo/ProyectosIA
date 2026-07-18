import React from 'react';
import { useTranslation } from 'react-i18next';
import { getUiLocale } from '../../utils/uiLocale';

/** Compact Spain flag (3:2). */
const FlagEs: React.FC = () => (
  <svg
    className="storefront-lang-switcher__flag"
    viewBox="0 0 21 14"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="21" height="14" fill="#c60b1e" />
    <rect y="3.5" width="21" height="7" fill="#ffc400" />
  </svg>
);

/** Compact UK flag for English locale (3:2). */
const FlagEn: React.FC = () => (
  <svg
    className="storefront-lang-switcher__flag"
    viewBox="0 0 60 40"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="60" height="40" fill="#012169" />
    <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
    <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="5" />
    <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="13" />
    <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="7" />
  </svg>
);

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
        title="Español"
      >
        <FlagEs />
      </button>
      <button
        type="button"
        className={`storefront-lang-switcher__btn${isEn ? ' storefront-lang-switcher__btn--active' : ''}`}
        onClick={() => handleChange('en')}
        aria-label="English"
        aria-pressed={isEn}
        title="English"
      >
        <FlagEn />
      </button>
    </div>
  );
};

export default LanguageSwitcher;
