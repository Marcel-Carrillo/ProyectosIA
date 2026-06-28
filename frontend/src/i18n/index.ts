import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esCatalog from './locales/es/catalog.json';
import esCart from './locales/es/cart.json';
import esProduct from './locales/es/product.json';
import esCheckout from './locales/es/checkout.json';
import esAccount from './locales/es/account.json';
import esPages from './locales/es/pages.json';
import esAdmin from './locales/es/admin.json';
import esCookies from './locales/es/cookies.json';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enCatalog from './locales/en/catalog.json';
import enCart from './locales/en/cart.json';
import enProduct from './locales/en/product.json';
import enCheckout from './locales/en/checkout.json';
import enAccount from './locales/en/account.json';
import enPages from './locales/en/pages.json';
import enAdmin from './locales/en/admin.json';
import enCookies from './locales/en/cookies.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        common: esCommon,
        auth: esAuth,
        catalog: esCatalog,
        cart: esCart,
        product: esProduct,
        checkout: esCheckout,
        account: esAccount,
        pages: esPages,
        admin: esAdmin,
        cookies: esCookies,
      },
      en: {
        common: enCommon,
        auth: enAuth,
        catalog: enCatalog,
        cart: enCart,
        product: enProduct,
        checkout: enCheckout,
        account: enAccount,
        pages: enPages,
        admin: enAdmin,
        cookies: enCookies,
      },
    },
    fallbackLng: 'es',
    defaultNS: 'common',
    supportedLngs: ['es', 'en'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'mavile.lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    keySeparator: '.',
  });

export default i18n;
