# Implementation Plan — frontend-i18n-multilanguage

> **Planning task only.** Do not edit source files until this plan is reviewed.
> Feature context: `.claude/sessions/context_session_frontend-i18n-multilanguage.md`

---

## Table of Contents

1. [Package Installation](#1-package-installation)
2. [i18n Init — `frontend/src/i18n/index.ts`](#2-i18n-init)
3. [Locale JSON Files](#3-locale-json-files)
   - [es/common.json](#ies-commonjson)
   - [en/common.json](#ien-commonjson)
   - [es/auth.json](#ies-authjson)
   - [en/auth.json](#ien-authjson)
   - [es/catalog.json](#ies-catalogjson)
   - [en/catalog.json](#ien-catalogjson)
   - [es/cart.json](#ies-cartjson)
   - [en/cart.json](#ien-cartjson)
   - [Placeholder JSONs (product / checkout / account)](#placeholder-jsons)
4. [Modify `frontend/src/index.tsx`](#4-modify-indextsx)
5. [New Component — `LanguageSwitcher.tsx`](#5-languageswitcher-component)
6. [Modify `StorefrontLayout.tsx` — I18nSync effect](#6-storefrontlayout--i18nsync-effect)
7. [Modify `StorefrontHeader.tsx`](#7-storefrontheadertsx)
8. [Modify `StorefrontFooter.tsx`](#8-storefrontfootertsx)
9. [Modify `CategoryNav.tsx`](#9-categorynavtsx)
10. [Modify `PriceTag.tsx` — locale-aware formatting](#10-pricetag--locale-aware-formatting)
11. [Modify `frontend/src/components/Pagination.tsx`](#11-paginationtsx)
12. [Modify `OAuthButtons.tsx`](#12-oauthbuttonstsx)
13. [Modify `LoginPage.tsx`](#13-loginpagetsx)
14. [Modify `RegisterPage.tsx`](#14-registerpagetsx)
15. [Modify `CatalogPage.tsx`](#15-catalogpagetsx)
16. [Modify `CartPage.tsx`](#16-cartpagetsx)
17. [Key Conventions and Notes](#17-key-conventions-and-notes)

---

## 1. Package Installation

Run inside `frontend/`:

```bash
npm install i18next react-i18next i18next-browser-languagedetector --legacy-peer-deps
```

The `--legacy-peer-deps` flag is required because of React 19 peer dependency constraints in CRA, the same pattern already used for Stripe packages.

---

## 2. i18n Init

**New file:** `frontend/src/i18n/index.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ES locale bundles
import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esCatalog from './locales/es/catalog.json';
import esCart from './locales/es/cart.json';
import esProduct from './locales/es/product.json';
import esCheckout from './locales/es/checkout.json';
import esAccount from './locales/es/account.json';

// EN locale bundles
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enCatalog from './locales/en/catalog.json';
import enCart from './locales/en/cart.json';
import enProduct from './locales/en/product.json';
import enCheckout from './locales/en/checkout.json';
import enAccount from './locales/en/account.json';

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
      },
      en: {
        common: enCommon,
        auth: enAuth,
        catalog: enCatalog,
        cart: enCart,
        product: enProduct,
        checkout: enCheckout,
        account: enAccount,
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
      escapeValue: false, // React already escapes strings
    },
    keySeparator: '.',
  });

export default i18n;
```

All locale JSON files are bundled (imported at build time), not lazy-loaded. This prevents any flash of untranslated text because i18next initializes synchronously when the module is evaluated.

---

## 3. Locale JSON Files

### i. es/common.json

**Path:** `frontend/src/i18n/locales/es/common.json`

Covers strings from: `StorefrontHeader`, `StorefrontFooter`, `CategoryNav`, `Pagination`, `OAuthButtons`.

```json
{
  "header": {
    "home": "Inicio de Mavile",
    "account": "Mi cuenta",
    "cart": "Carrito, {{count}} artículos"
  },
  "nav": {
    "all": "Todo",
    "categoryNavLabel": "Navegación por categorías"
  },
  "footer": {
    "brand": "Piezas atemporales fabricadas en Europa con materiales nobles.",
    "cities": "Madrid · Lisboa · París",
    "shop": "Tienda",
    "help": "Ayuda",
    "company": "Empresa",
    "link": {
      "women": "Mujer",
      "men": "Hombre",
      "accessories": "Accesorios",
      "newArrivals": "Novedades",
      "shipping": "Envíos",
      "returns": "Devoluciones",
      "sizeGuide": "Guía de tallas",
      "contact": "Contacto",
      "ourStory": "Nuestra historia",
      "materials": "Materiales",
      "sustainability": "Sostenibilidad",
      "press": "Prensa"
    }
  },
  "pagination": {
    "label": "Paginación",
    "page": "Página {{page}}",
    "previous": "Página anterior",
    "next": "Página siguiente"
  },
  "oauth": {
    "google": "Continuar con Google",
    "apple": "Continuar con Apple",
    "facebook": "Continuar con Facebook"
  }
}
```

### ii. en/common.json

**Path:** `frontend/src/i18n/locales/en/common.json`

```json
{
  "header": {
    "home": "Mavile home",
    "account": "Account",
    "cart": "Cart, {{count}} items"
  },
  "nav": {
    "all": "All",
    "categoryNavLabel": "Category navigation"
  },
  "footer": {
    "brand": "Timeless pieces made in Europe with noble materials.",
    "cities": "Madrid · Lisbon · Paris",
    "shop": "Shop",
    "help": "Help",
    "company": "Company",
    "link": {
      "women": "Women",
      "men": "Men",
      "accessories": "Accessories",
      "newArrivals": "New arrivals",
      "shipping": "Shipping",
      "returns": "Returns",
      "sizeGuide": "Size guide",
      "contact": "Contact",
      "ourStory": "Our story",
      "materials": "Materials",
      "sustainability": "Sustainability",
      "press": "Press"
    }
  },
  "pagination": {
    "label": "Pagination",
    "page": "Page {{page}}",
    "previous": "Previous page",
    "next": "Next page"
  },
  "oauth": {
    "google": "Continue with Google",
    "apple": "Continue with Apple",
    "facebook": "Continue with Facebook"
  }
}
```

### iii. es/auth.json

**Path:** `frontend/src/i18n/locales/es/auth.json`

Covers strings from: `LoginPage`, `RegisterPage`.

```json
{
  "fields": {
    "email": "Correo electrónico",
    "password": "Contraseña",
    "firstName": "Nombre",
    "lastName": "Apellido",
    "phone": "Teléfono"
  },
  "login": {
    "title": "Iniciar sesión",
    "titleMfa": "Autenticación de dos factores",
    "subtitle": "Accede a tus pedidos y datos guardados.",
    "subtitleMfa": "Introduce el código de tu aplicación de autenticación.",
    "createAccount": "Crear cuenta",
    "forgotPassword": "¿Olvidaste tu contraseña?",
    "continueAsGuest": "Continuar como invitado",
    "authCode": "Código de autenticación",
    "verifying": "Verificando…",
    "verify": "Verificar",
    "signingIn": "Iniciando sesión…",
    "submit": "Iniciar sesión",
    "invalidCode": "Código de verificación incorrecto."
  },
  "register": {
    "title": "Crear cuenta",
    "subtitle": "Únete a Mavile en un minuto.",
    "alreadyHaveAccount": "¿Ya tienes cuenta? Inicia sesión",
    "creating": "Creando cuenta…",
    "submit": "Registrarse"
  }
}
```

### iv. en/auth.json

**Path:** `frontend/src/i18n/locales/en/auth.json`

```json
{
  "fields": {
    "email": "Email",
    "password": "Password",
    "firstName": "First name",
    "lastName": "Last name",
    "phone": "Phone"
  },
  "login": {
    "title": "Sign in",
    "titleMfa": "Two-factor authentication",
    "subtitle": "Access your orders and saved details.",
    "subtitleMfa": "Enter the code from your authenticator app.",
    "createAccount": "Create account",
    "forgotPassword": "Forgot password?",
    "continueAsGuest": "Continue as guest",
    "authCode": "Authentication code",
    "verifying": "Verifying…",
    "verify": "Verify",
    "signingIn": "Signing in…",
    "submit": "Sign in",
    "invalidCode": "Invalid verification code."
  },
  "register": {
    "title": "Create account",
    "subtitle": "Join Mavile in a minute.",
    "alreadyHaveAccount": "Already have an account? Sign in",
    "creating": "Creating account…",
    "submit": "Register"
  }
}
```

### v. es/catalog.json

**Path:** `frontend/src/i18n/locales/es/catalog.json`

Covers strings from: `CatalogPage`.

Note on pluralization: i18next uses the `_one` / `_other` suffix convention for Spanish and English (both follow simple plural rules). `t('catalog:pieces', { count: total })` picks `pieces_one` when `count === 1`, `pieces_other` otherwise.

```json
{
  "hero": {
    "eyebrow": "Otoño · Invierno · 26",
    "title": "Una selección discreta de piezas hechas para durar.",
    "subtitle": "Materiales nobles, cortes limpios, una paleta neutra. Diseñado con cuidado, confeccionado para el día a día."
  },
  "toolbar": {
    "searchPlaceholder": "Buscar",
    "searchLabel": "Buscar productos por nombre",
    "sortLabel": "Ordenar productos"
  },
  "sort": {
    "newest": "Más reciente",
    "oldest": "Más antiguo",
    "nameAZ": "Nombre A–Z",
    "nameZA": "Nombre Z–A"
  },
  "error": {
    "loadFailed": "No se pudieron cargar los productos. Por favor, inténtalo de nuevo más tarde."
  },
  "pieces_one": "{{count}} pieza",
  "pieces_other": "{{count}} piezas"
}
```

### vi. en/catalog.json

**Path:** `frontend/src/i18n/locales/en/catalog.json`

```json
{
  "hero": {
    "eyebrow": "Fall · Winter · 26",
    "title": "A discreet selection of pieces made to last.",
    "subtitle": "Noble materials, clean cuts, a neutral palette. Designed with care, crafted for everyday wear."
  },
  "toolbar": {
    "searchPlaceholder": "Search",
    "searchLabel": "Search products by name",
    "sortLabel": "Sort products"
  },
  "sort": {
    "newest": "Newest",
    "oldest": "Oldest",
    "nameAZ": "Name A–Z",
    "nameZA": "Name Z–A"
  },
  "error": {
    "loadFailed": "Unable to load products. Please try again later."
  },
  "pieces_one": "{{count}} piece",
  "pieces_other": "{{count}} pieces"
}
```

### vii. es/cart.json

**Path:** `frontend/src/i18n/locales/es/cart.json`

Covers strings from: `CartPage`.

```json
{
  "title": "Carrito",
  "count_one": "{{count}} artículo",
  "count_other": "{{count}} artículos",
  "empty": {
    "eyebrow": "Tu carrito",
    "title": "Un momento antes de elegir.",
    "text": "Tu carrito está vacío. Vuelve al catálogo para explorar nuestra última selección.",
    "browseCatalog": "Ver catálogo"
  },
  "item": {
    "decreaseQty": "Reducir cantidad",
    "increaseQty": "Aumentar cantidad",
    "remove": "Eliminar"
  },
  "summary": {
    "title": "Resumen",
    "subtotal": "Subtotal",
    "shipping": "Envío",
    "free": "Gratis",
    "total": "Total",
    "checkout": "Finalizar compra",
    "continueShopping": "Seguir comprando",
    "note": "Envío gratuito en pedidos superiores a 100 €. Devoluciones gratuitas en 30 días."
  }
}
```

### viii. en/cart.json

**Path:** `frontend/src/i18n/locales/en/cart.json`

```json
{
  "title": "Cart",
  "count_one": "{{count}} item",
  "count_other": "{{count}} items",
  "empty": {
    "eyebrow": "Your cart",
    "title": "A pause before you choose.",
    "text": "Your cart is empty. Return to the catalog to explore our latest selection.",
    "browseCatalog": "Browse catalog"
  },
  "item": {
    "decreaseQty": "Decrease quantity",
    "increaseQty": "Increase quantity",
    "remove": "Remove"
  },
  "summary": {
    "title": "Summary",
    "subtotal": "Subtotal",
    "shipping": "Shipping",
    "free": "Free",
    "total": "Total",
    "checkout": "Checkout",
    "continueShopping": "Continue shopping",
    "note": "Free shipping on orders over €100. Free returns within 30 days."
  }
}
```

### Placeholder JSONs

The `i18n/index.ts` imports `product`, `checkout`, and `account` namespaces because the full migration covers pages outside the scope of this planning file. Create these as empty objects now so the import does not fail at build time. They will be populated during the respective namespace migration tasks.

**Files to create (each containing exactly `{}`):**

- `frontend/src/i18n/locales/es/product.json`
- `frontend/src/i18n/locales/en/product.json`
- `frontend/src/i18n/locales/es/checkout.json`
- `frontend/src/i18n/locales/en/checkout.json`
- `frontend/src/i18n/locales/es/account.json`
- `frontend/src/i18n/locales/en/account.json`

---

## 4. Modify `index.tsx`

**File:** `frontend/src/index.tsx`

Add the i18n import as the very first import — it must execute before `ReactDOM.createRoot` so the singleton is initialized synchronously before React renders anything. Since all locale JSONs are bundled (not lazy-loaded), initialization is synchronous and there is no flash of untranslated text.

**Add this line immediately after `import React from 'react';` and before any other imports:**

```typescript
import './i18n/index'; // i18n must initialize before React tree mounts
```

Full resulting import block (order matters):

```typescript
import React from 'react';
import './i18n/index';           // ← ADD THIS LINE FIRST
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import './styles/tokens.css';
import './styles/storefront.css';
import './styles/admin.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
```

The rest of `index.tsx` is unchanged.

---

## 5. LanguageSwitcher Component

**New file:** `frontend/src/components/storefront/LanguageSwitcher.tsx`

```typescript
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
```

**CSS to add in `frontend/src/styles/storefront.css`:**

```css
/* Language switcher */
.storefront-lang-switcher {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.storefront-lang-switcher__btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.15rem;
  line-height: 1;
  padding: 4px;
  opacity: 0.4;
  transition: opacity 0.15s ease;
}

.storefront-lang-switcher__btn--active,
.storefront-lang-switcher__btn:hover {
  opacity: 1;
}
```

---

## 6. StorefrontLayout — I18nSync effect

**File:** `frontend/src/components/storefront/StorefrontLayout.tsx`

Two changes:
1. Add imports for `useEffect` and `useTranslation`.
2. Add the `I18nSync` effect inside the component to keep `document.documentElement.lang` in sync.

**Add imports:**

```typescript
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
```

**Inside the `StorefrontLayout` component body, before the `return`:**

```typescript
const { i18n } = useTranslation();

useEffect(() => {
  document.documentElement.lang = i18n.language;
}, [i18n.language]);
```

The effect fires on initial render (setting `lang` to the detected/stored language) and again whenever the user switches language.

**Full updated component:**

```typescript
import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StorefrontHeader from './StorefrontHeader';
import StorefrontFooter from './StorefrontFooter';

const StorefrontLayout: React.FC = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <div className="storefront-root">
      <StorefrontHeader />
      <main style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <Outlet />
      </main>
      <StorefrontFooter />
    </div>
  );
};

export default StorefrontLayout;
```

---

## 7. StorefrontHeader.tsx

**File:** `frontend/src/components/storefront/StorefrontHeader.tsx`

**Strings to migrate:**

| Old string | Translation key | Namespace |
|---|---|---|
| `aria-label="Mavile home"` | `header.home` | `common` |
| `aria-label="Account"` | `header.account` | `common` |
| `` `Cart, ${itemCount} items` `` | `header.cart` with `{ count: itemCount }` | `common` |

**Additionally:** Mount `<LanguageSwitcher />` inside `.storefront-header__actions`.

**Add imports:**

```typescript
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
```

**String replacements:**

```
aria-label="Mavile home"
→ aria-label={t('header.home')}

aria-label="Account"
→ aria-label={t('header.account')}

aria-label={`Cart, ${itemCount} items`}
→ aria-label={t('header.cart', { count: itemCount })}
```

**Mount LanguageSwitcher** inside `.storefront-header__actions` div, before the account link:

```tsx
<div className="storefront-header__actions">
  <LanguageSwitcher />
  <Link
    to={isAuthenticated ? '/account' : '/login'}
    className="storefront-header__icon-btn"
    aria-label={t('header.account')}
  >
    ...
  </Link>
  <Link to="/cart" className="storefront-header__icon-btn" aria-label={t('header.cart', { count: itemCount })}>
    ...
  </Link>
</div>
```

**Hook line to add inside component body:**

```typescript
const { t } = useTranslation('common');
```

---

## 8. StorefrontFooter.tsx

**File:** `frontend/src/components/storefront/StorefrontFooter.tsx`

The current `FOOTER_COLUMNS` constant holds hardcoded English strings. With i18n the constant must be replaced by a key-based structure, because the column data must be computed after the `t` function is available (inside the component). The simplest approach is to remove the constant entirely and inline the JSX with `t()` calls.

**Add import:**

```typescript
import { useTranslation } from 'react-i18next';
```

**Hook line inside component:**

```typescript
const { t } = useTranslation('common');
```

**Remove** the `FOOTER_COLUMNS` constant entirely.

**String replacements (all in the JSX):**

```
'Timeless pieces made in Europe with noble materials.'
→ {t('footer.brand')}

'Madrid · Lisbon · Paris'
→ {t('footer.cities')}
```

For the columns, replace the `FOOTER_COLUMNS.map(...)` block with explicit JSX using `t()`:

```tsx
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
```

---

## 9. CategoryNav.tsx

**File:** `frontend/src/components/storefront/CategoryNav.tsx`

**Strings to migrate:**

| Old string | Translation key | Namespace |
|---|---|---|
| `aria-label="Category navigation"` | `nav.categoryNavLabel` | `common` |
| `'All'` (link text) | `nav.all` | `common` |

**Add import:**

```typescript
import { useTranslation } from 'react-i18next';
```

**Hook line inside component:**

```typescript
const { t } = useTranslation('common');
```

**Replacements:**

```
aria-label="Category navigation"
→ aria-label={t('nav.categoryNavLabel')}

All
→ {t('nav.all')}
```

---

## 10. PriceTag — locale-aware formatting

**File:** `frontend/src/components/storefront/PriceTag.tsx`

Currently `formatPrice` uses a hardcoded `'es-ES'` locale:

```typescript
const formatPrice = (price: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price);
```

This must be changed to read the active language from i18next and pick the matching BCP 47 locale string (`es-ES` for Spanish, `en-GB` for English).

**Add import:**

```typescript
import { useTranslation } from 'react-i18next';
```

**Remove** the module-level `formatPrice` function entirely.

**Inside the `PriceTag` component body**, add:

```typescript
const { i18n } = useTranslation();
const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
const formatPrice = (price: number): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(price);
```

The currency (`EUR`) does not change — only the formatting separators and symbol position change between locales:
- Spanish: `29,99 €`
- English (GB): `€29.99`

No other changes needed to the JSX.

---

## 11. Pagination.tsx

The file `frontend/src/components/storefront/Pagination.tsx` is just a barrel re-export:

```typescript
export { default } from '../Pagination';
```

The actual implementation lives at **`frontend/src/components/Pagination.tsx`**. All changes go there.

**File:** `frontend/src/components/Pagination.tsx`

**Strings to migrate:**

| Old string | Translation key | Namespace | Notes |
|---|---|---|---|
| `aria-label="Pagination"` (nav) | `pagination.label` | `common` | Static |
| `` `Page ${p}` `` (button) | `pagination.page` with `{ page: p }` | `common` | Interpolated |
| `aria-label="Previous page"` | `pagination.previous` | `common` | Static |
| `aria-label="Next page"` | `pagination.next` | `common` | Static |

**Add import:**

```typescript
import { useTranslation } from 'react-i18next';
```

**Hook line inside component:**

```typescript
const { t } = useTranslation('common');
```

**Replacements:**

```
aria-label="Pagination"
→ aria-label={t('pagination.label')}

aria-label={`Page ${p}`}
→ aria-label={t('pagination.page', { page: p })}

aria-label="Previous page"
→ aria-label={t('pagination.previous')}

aria-label="Next page"
→ aria-label={t('pagination.next')}
```

---

## 12. OAuthButtons.tsx

**File:** `frontend/src/components/storefront/OAuthButtons.tsx`

**Strings to migrate:**

| Old string | Translation key | Namespace |
|---|---|---|
| `'Continue with Google'` | `oauth.google` | `common` |
| `'Continue with Apple'` | `oauth.apple` | `common` |
| `'Continue with Facebook'` | `oauth.facebook` | `common` |

**Add import:**

```typescript
import { useTranslation } from 'react-i18next';
```

**Hook line inside component:**

```typescript
const { t } = useTranslation('common');
```

**Replacements:**

```
'Continue with Google'
→ {t('oauth.google')}

'Continue with Apple'
→ {t('oauth.apple')}

'Continue with Facebook'
→ {t('oauth.facebook')}
```

---

## 13. LoginPage.tsx

**File:** `frontend/src/pages/storefront/LoginPage.tsx`

**Strings to migrate:**

| Old string | Translation key | Namespace |
|---|---|---|
| `'Two-factor authentication'` (title) | `login.titleMfa` | `auth` |
| `'Sign in'` (title) | `login.title` | `auth` |
| `'Enter the code from your authenticator app.'` | `login.subtitleMfa` | `auth` |
| `'Access your orders and saved details.'` | `login.subtitle` | `auth` |
| `'Create account'` (link text) | `login.createAccount` | `auth` |
| `'Forgot password?'` (link text) | `login.forgotPassword` | `auth` |
| `'Continue as guest'` (link text) | `login.continueAsGuest` | `auth` |
| `'Authentication code'` (field label) | `login.authCode` | `auth` |
| `'Verifying…'` (button, loading state) | `login.verifying` | `auth` |
| `'Verify'` (button) | `login.verify` | `auth` |
| `'Email'` (field label) | `fields.email` | `auth` |
| `'Password'` (field label) | `fields.password` | `auth` |
| `'Signing in…'` (button, loading state) | `login.signingIn` | `auth` |
| `'Sign in'` (button) | `login.submit` | `auth` |
| `'Invalid verification code.'` (error) | `login.invalidCode` | `auth` |

**Add import:**

```typescript
import { useTranslation } from 'react-i18next';
```

**Hook line inside component:**

```typescript
const { t } = useTranslation('auth');
```

**Replacements (in order of appearance in the file):**

The `title` and `subtitle` variables become:

```typescript
const title = mfaToken ? t('login.titleMfa') : t('login.title');
const subtitle = mfaToken ? t('login.subtitleMfa') : t('login.subtitle');
```

Error set inside `handle2fa`:

```typescript
setError(t('login.invalidCode'));
```

In the JSX footer section:

```
<Link to="/register">Create account</Link>
→ <Link to="/register">{t('login.createAccount')}</Link>

<Link to="/forgot-password">Forgot password?</Link>
→ <Link to="/forgot-password">{t('login.forgotPassword')}</Link>

Continue as guest
→ {t('login.continueAsGuest')}
```

In the MFA form:

```
Authentication code
→ {t('login.authCode')}

{submitting ? 'Verifying…' : 'Verify'}
→ {submitting ? t('login.verifying') : t('login.verify')}
```

In the login form:

```
Email
→ {t('fields.email')}

Password
→ {t('fields.password')}

{submitting ? 'Signing in…' : 'Sign in'}
→ {submitting ? t('login.signingIn') : t('login.submit')}
```

---

## 14. RegisterPage.tsx

**File:** `frontend/src/pages/storefront/RegisterPage.tsx`

**Strings to migrate:**

| Old string | Translation key | Namespace |
|---|---|---|
| `'First name'` | `fields.firstName` | `auth` |
| `'Last name'` | `fields.lastName` | `auth` |
| `'Email'` | `fields.email` | `auth` |
| `'Phone'` | `fields.phone` | `auth` |
| `'Password'` | `fields.password` | `auth` |
| `'Create account'` (panel title) | `register.title` | `auth` |
| `'Join Mavile in a minute.'` (subtitle) | `register.subtitle` | `auth` |
| `'Already have an account? Sign in'` (link) | `register.alreadyHaveAccount` | `auth` |
| `'Creating account…'` (button, loading) | `register.creating` | `auth` |
| `'Register'` (button) | `register.submit` | `auth` |

**Add import:**

```typescript
import { useTranslation } from 'react-i18next';
```

**Hook line inside component:**

```typescript
const { t } = useTranslation('auth');
```

**The `FIELD_LABELS` constant** must change from hardcoded strings to `t()` calls. Since the `t` function is only available inside the component, remove the module-level constant and replace it with an inline object inside the component body:

```typescript
const fieldLabels: Record<string, string> = {
  firstName: t('fields.firstName'),
  lastName: t('fields.lastName'),
  email: t('fields.email'),
  phone: t('fields.phone'),
  password: t('fields.password'),
};
```

Replace `FIELD_LABELS[field]` references in the JSX with `fieldLabels[field]`.

**StorefrontAuthPanel props:**

```
title="Create account"
→ title={t('register.title')}

subtitle="Join Mavile in a minute."
→ subtitle={t('register.subtitle')}
```

**Footer link:**

```
Already have an account? Sign in
→ {t('register.alreadyHaveAccount')}
```

**Submit button:**

```
{submitting ? 'Creating account…' : 'Register'}
→ {submitting ? t('register.creating') : t('register.submit')}
```

---

## 15. CatalogPage.tsx

**File:** `frontend/src/pages/storefront/CatalogPage.tsx`

**Strings to migrate:**

| Old string | Translation key | Namespace | Notes |
|---|---|---|---|
| `'Fall · Winter · 26'` | `hero.eyebrow` | `catalog` | |
| `'A discreet selection of pieces made to last.'` | `hero.title` | `catalog` | |
| `'Noble materials, clean cuts…'` | `hero.subtitle` | `catalog` | |
| `placeholder="Search"` | `toolbar.searchPlaceholder` | `catalog` | |
| `aria-label="Search products by name"` | `toolbar.searchLabel` | `catalog` | |
| `aria-label="Sort products"` | `toolbar.sortLabel` | `catalog` | |
| Sort labels: `'Newest'`, `'Oldest'`, `'Name A–Z'`, `'Name Z–A'` | `sort.newest`, `sort.oldest`, `sort.nameAZ`, `sort.nameZA` | `catalog` | |
| `'Unable to load products. Please try again later.'` | `error.loadFailed` | `catalog` | set in state |
| `{total} {total === 1 ? 'piece' : 'pieces'}` | `pieces` with `{ count: total }` | `catalog` | plural form |

**Add import:**

```typescript
import { useTranslation } from 'react-i18next';
```

**Hook line inside component:**

```typescript
const { t } = useTranslation('catalog');
```

**The `SORT_OPTIONS` constant** references hardcoded label strings. Replace the module-level constant with a key-based version and compute labels with `t()` inside the component:

```typescript
// Replace the module-level SORT_OPTIONS constant:
const SORT_KEYS = [
  { labelKey: 'sort.newest', sort: 'createdAt', order: 'desc' },
  { labelKey: 'sort.oldest', sort: 'createdAt', order: 'asc' },
  { labelKey: 'sort.nameAZ', sort: 'name', order: 'asc' },
  { labelKey: 'sort.nameZA', sort: 'name', order: 'desc' },
] as const;
```

Then inside the JSX `select`:

```tsx
{SORT_KEYS.map((opt) => (
  <option key={`${opt.sort}:${opt.order}`} value={`${opt.sort}:${opt.order}`}>
    {t(opt.labelKey)}
  </option>
))}
```

**Error string** set inside `fetchProducts` catch block:

```typescript
setError(t('error.loadFailed'));
```

**Hero section:**

```
'Fall · Winter · 26'
→ {t('hero.eyebrow')}

'A discreet selection of pieces made to last.'
→ {t('hero.title')}

'Noble materials, clean cuts, a neutral palette. Designed with care, crafted for everyday wear.'
→ {t('hero.subtitle')}
```

**Toolbar:**

```
placeholder="Search"
→ placeholder={t('toolbar.searchPlaceholder')}

aria-label="Search products by name"
→ aria-label={t('toolbar.searchLabel')}

aria-label="Sort products"
→ aria-label={t('toolbar.sortLabel')}
```

**Piece count:**

```
{total} {total === 1 ? 'piece' : 'pieces'}
→ {t('pieces', { count: total })}
```

---

## 16. CartPage.tsx

**File:** `frontend/src/pages/storefront/CartPage.tsx`

**Strings to migrate:**

| Old string | Translation key | Namespace | Notes |
|---|---|---|---|
| `'Your cart'` (empty, eyebrow) | `empty.eyebrow` | `cart` | |
| `'A pause before you choose.'` (empty, title) | `empty.title` | `cart` | |
| `'Your cart is empty. Return to the catalog…'` | `empty.text` | `cart` | |
| `'Browse catalog'` (link) | `empty.browseCatalog` | `cart` | |
| `'Cart'` (h1) | `title` | `cart` | |
| `{itemCount} {itemCount === 1 ? 'item' : 'items'}` | `count` with `{ count: itemCount }` | `cart` | plural |
| `aria-label="Decrease quantity"` | `item.decreaseQty` | `cart` | |
| `aria-label="Increase quantity"` | `item.increaseQty` | `cart` | |
| `'Remove'` (button) | `item.remove` | `cart` | |
| `'Summary'` (h2) | `summary.title` | `cart` | |
| `'Subtotal'` (dt) | `summary.subtotal` | `cart` | |
| `'Shipping'` (dt) | `summary.shipping` | `cart` | |
| `'Free'` (dd, shipping) | `summary.free` | `cart` | |
| `'Total'` (dt) | `summary.total` | `cart` | |
| `'Checkout'` (button) | `summary.checkout` | `cart` | |
| `'Continue shopping'` (link) | `summary.continueShopping` | `cart` | |
| `'Free shipping on orders over €100. Free returns within 30 days.'` | `summary.note` | `cart` | |

**Add import:**

```typescript
import { useTranslation } from 'react-i18next';
```

**Hook line inside component:**

```typescript
const { t } = useTranslation('cart');
```

**Empty state replacements:**

```
'Your cart'         → {t('empty.eyebrow')}
'A pause before you choose.'   → {t('empty.title')}
'Your cart is empty. Return to the catalog…'  → {t('empty.text')}
'Browse catalog'    → {t('empty.browseCatalog')}
```

**Main cart view:**

```
'Cart' (h1)         → {t('title')}

{itemCount} {itemCount === 1 ? 'item' : 'items'}
→ {t('count', { count: itemCount })}

aria-label="Decrease quantity"   → aria-label={t('item.decreaseQty')}
aria-label="Increase quantity"   → aria-label={t('item.increaseQty')}
'Remove'             → {t('item.remove')}
```

**Summary aside:**

```
'Summary'            → {t('summary.title')}
'Subtotal'           → {t('summary.subtotal')}
'Shipping'           → {t('summary.shipping')}
'Free'               → {t('summary.free')}
'Total'              → {t('summary.total')}
'Checkout'           → {t('summary.checkout')}
'Continue shopping'  → {t('summary.continueShopping')}
'Free shipping on orders over €100. Free returns within 30 days.'
→ {t('summary.note')}
```

---

## 17. Key Conventions and Notes

### Namespace usage in `useTranslation`

Each component declares its primary namespace in the `useTranslation` hook:

```typescript
const { t } = useTranslation('catalog');    // keys resolve in catalog namespace
const { t } = useTranslation('common');     // keys resolve in common namespace
```

Cross-namespace references (rare) use the `namespace:key` colon prefix:
```typescript
t('auth:fields.email')  // from a component whose primary NS is something else
```

### i18next pluralization

i18next applies pluralization by appending `_one` / `_other` to the base key automatically when you pass `{ count: N }`:

```typescript
t('pieces', { count: total })   // resolves to pieces_one or pieces_other
t('count', { count: itemCount }) // resolves to count_one or count_one
```

No manual ternary is needed in JSX. Both Spanish and English use simple `_one` / `_other` plural rules.

### `{{variable}}` interpolation

Use double-brace syntax in JSON values:
```json
"cart": "Cart, {{count}} items"
```
Passed via: `t('header.cart', { count: itemCount })`.

### Admin panel boundary

No file under `frontend/src/components/admin/` or `frontend/src/pages/admin/` should ever import `useTranslation`. These components stay hardcoded in Spanish. This must be enforced in code review.

### `ProductCard.tsx` — no changes needed

`ProductCard` has no hardcoded UI strings — it only renders data (`product.name`, `product.brand`) that comes from the API. No `useTranslation` import is needed.

### `storefront/Pagination.tsx` — barrel only

`frontend/src/components/storefront/Pagination.tsx` is a one-line re-export. It does not need to be touched. All changes go to the canonical `frontend/src/components/Pagination.tsx`.

### Test wrappers

Existing tests for `Pagination.tsx`, `PriceTag.tsx`, `ProductCard.tsx` will fail after migration because they render components that call `useTranslation()` without a provider. A `renderWithI18n` test utility must be created at `frontend/src/i18n/testUtils.tsx`. That utility wraps the render with `I18nextProvider` using the real `es` locale. Updating the tests is a separate implementation task covered in the full migration plan.

### CSS for LanguageSwitcher

The `storefront-lang-switcher` CSS class and its modifiers must be added to `frontend/src/styles/storefront.css`. The design uses opacity to indicate the active state, matching the minimalist storefront aesthetic. The emoji flag characters render natively on all modern browsers and OS versions without extra font dependencies.

### File creation summary

| Action | Path |
|---|---|
| Create | `frontend/src/i18n/index.ts` |
| Create | `frontend/src/i18n/locales/es/common.json` |
| Create | `frontend/src/i18n/locales/en/common.json` |
| Create | `frontend/src/i18n/locales/es/auth.json` |
| Create | `frontend/src/i18n/locales/en/auth.json` |
| Create | `frontend/src/i18n/locales/es/catalog.json` |
| Create | `frontend/src/i18n/locales/en/catalog.json` |
| Create | `frontend/src/i18n/locales/es/cart.json` |
| Create | `frontend/src/i18n/locales/en/cart.json` |
| Create | `frontend/src/i18n/locales/es/product.json` (empty `{}`) |
| Create | `frontend/src/i18n/locales/en/product.json` (empty `{}`) |
| Create | `frontend/src/i18n/locales/es/checkout.json` (empty `{}`) |
| Create | `frontend/src/i18n/locales/en/checkout.json` (empty `{}`) |
| Create | `frontend/src/i18n/locales/es/account.json` (empty `{}`) |
| Create | `frontend/src/i18n/locales/en/account.json` (empty `{}`) |
| Create | `frontend/src/components/storefront/LanguageSwitcher.tsx` |
| Modify | `frontend/src/index.tsx` |
| Modify | `frontend/src/components/storefront/StorefrontLayout.tsx` |
| Modify | `frontend/src/components/storefront/StorefrontHeader.tsx` |
| Modify | `frontend/src/components/storefront/StorefrontFooter.tsx` |
| Modify | `frontend/src/components/storefront/CategoryNav.tsx` |
| Modify | `frontend/src/components/storefront/PriceTag.tsx` |
| Modify | `frontend/src/components/Pagination.tsx` |
| Modify | `frontend/src/components/storefront/OAuthButtons.tsx` |
| Modify | `frontend/src/pages/storefront/LoginPage.tsx` |
| Modify | `frontend/src/pages/storefront/RegisterPage.tsx` |
| Modify | `frontend/src/pages/storefront/CatalogPage.tsx` |
| Modify | `frontend/src/pages/storefront/CartPage.tsx` |
| CSS add | `frontend/src/styles/storefront.css` (LanguageSwitcher styles) |
