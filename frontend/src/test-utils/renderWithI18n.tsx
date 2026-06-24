import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';

import esCommon from '../i18n/locales/es/common.json';
import esAuth from '../i18n/locales/es/auth.json';
import esCatalog from '../i18n/locales/es/catalog.json';
import esCart from '../i18n/locales/es/cart.json';
import esAccount from '../i18n/locales/es/account.json';
import enCommon from '../i18n/locales/en/common.json';
import enAuth from '../i18n/locales/en/auth.json';
import enCatalog from '../i18n/locales/en/catalog.json';
import enCart from '../i18n/locales/en/cart.json';
import enAccount from '../i18n/locales/en/account.json';

const createTestI18n = (lng: 'es' | 'en' = 'en') => {
  const testI18n = i18n.createInstance();
  testI18n.use(initReactI18next).init({
    lng,
    fallbackLng: 'es',
    defaultNS: 'common',
    resources: {
      es: { common: esCommon, auth: esAuth, catalog: esCatalog, cart: esCart, account: esAccount },
      en: { common: enCommon, auth: enAuth, catalog: enCatalog, cart: enCart, account: enAccount },
    },
    interpolation: { escapeValue: false },
  });
  return testI18n;
};

interface RenderWithI18nOptions extends Omit<RenderOptions, 'wrapper'> {
  lng?: 'es' | 'en';
}

export function renderWithI18n(ui: React.ReactElement, options: RenderWithI18nOptions = {}) {
  const { lng = 'en', ...rest } = options;
  const testI18n = createTestI18n(lng);

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
  );

  return render(ui, { wrapper: Wrapper, ...rest });
}
