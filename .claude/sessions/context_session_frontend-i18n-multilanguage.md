# Change Context: frontend-i18n-multilanguage

## Summary
Add ES/EN language switcher to the Mavile fashion ecommerce storefront. Flag selector (🇪🇸/🇬🇧) in StorefrontHeader. All static UI text in the storefront migrated to react-i18next. Admin panel stays hardcoded in Spanish.

## Key Artifacts
- Proposal: openspec/changes/frontend-i18n-multilanguage/proposal.md
- Design: openspec/changes/frontend-i18n-multilanguage/design.md
- Spec: openspec/changes/frontend-i18n-multilanguage/specs/storefront-i18n/spec.md
- Tasks: openspec/changes/frontend-i18n-multilanguage/tasks.md

## Key Design Decisions
- Library: react-i18next + i18next + i18next-browser-languagedetector (--legacy-peer-deps)
- Init: frontend/src/i18n/index.ts, imported in index.tsx before ReactDOM.createRoot
- Namespaces: common, auth, catalog, product, cart, checkout, account
- Locales: frontend/src/i18n/locales/es/*.json and en/*.json
- LanguageSwitcher: new component in components/storefront/LanguageSwitcher.tsx
- PriceTag: locale-aware Intl.NumberFormat (es-ES / en-GB)
- Admin: NO i18n, NO switcher, stays hardcoded Spanish
- Persistence: localStorage via i18next-browser-languagedetector (key: mavile.lang)
- html lang: synced in StorefrontLayout.tsx via useEffect

## Storefront Files to Migrate
Components:
- components/storefront/StorefrontHeader.tsx
- components/storefront/StorefrontFooter.tsx
- components/storefront/CategoryNav.tsx
- components/storefront/PriceTag.tsx
- components/storefront/ProductCard.tsx
- components/storefront/ProductGrid.tsx
- components/storefront/ProductGallery.tsx
- components/storefront/VariantSelector.tsx
- components/storefront/Pagination.tsx
- components/storefront/OAuthButtons.tsx
- components/storefront/StorefrontAuthPanel.tsx
- components/storefront/PaymentForm.tsx
- components/storefront/StorefrontLayout.tsx (I18nSync effect)

Pages (storefront):
- pages/storefront/LoginPage.tsx
- pages/storefront/RegisterPage.tsx
- pages/storefront/ForgotPasswordPage.tsx
- pages/storefront/ResetPasswordPage.tsx
- pages/storefront/TwoFactorSetupPage.tsx
- pages/storefront/CatalogPage.tsx
- pages/storefront/ProductPage.tsx
- pages/storefront/CartPage.tsx
- pages/storefront/CheckoutPage.tsx
- pages/storefront/OrderConfirmationPage.tsx
- pages/storefront/AccountPage.tsx
- pages/storefront/AccountProfilePage.tsx
- pages/storefront/AccountOrdersPage.tsx
- pages/storefront/AccountOrderDetailPage.tsx
- pages/storefront/AccountWishlistPage.tsx

## Test Files to Update
- components/storefront/Pagination.test.tsx
- components/storefront/PriceTag.test.tsx
- components/storefront/ProductCard.test.tsx
- components/storefront/VariantSelector.test.tsx

## New Files to Create
- frontend/src/i18n/index.ts
- frontend/src/i18n/testUtils.tsx
- frontend/src/i18n/locales/es/{common,auth,catalog,product,cart,checkout,account}.json
- frontend/src/i18n/locales/en/{common,auth,catalog,product,cart,checkout,account}.json
- frontend/src/components/storefront/LanguageSwitcher.tsx
- frontend/src/components/storefront/LanguageSwitcher.test.tsx
