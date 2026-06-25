## 0. Setup: Create Feature Branch (MANDATORY — FIRST STEP)

> Before executing Step 0, read `ai-specs/skills/using-git-worktrees/SKILL.md` to decide whether to work in the current checkout or a dedicated Git worktree.

- [x] 0.1 Create feature branch `feature/frontend-i18n-multilanguage` from `develop` (or `master` if `develop` does not exist)
- [x] 0.2 Verify branch creation with `git branch --show-current`

---

## 1. Frontend: Install i18n Packages

- [x] 1.1 Install `i18next`, `react-i18next`, and `i18next-browser-languagedetector` with `--legacy-peer-deps` (required for React 19 + CRA peer deps):
  ```bash
  cd frontend && npm install i18next react-i18next i18next-browser-languagedetector --legacy-peer-deps
  ```
- [x] 1.2 Verify packages appear in `frontend/package.json` dependencies
- [x] 1.3 Confirm TypeScript types are resolved (both `i18next` and `react-i18next` ship their own types — no separate `@types/*` needed)

---

## 2. Frontend: i18n Initialization

- [ ] 2.1 Create `frontend/src/i18n/index.ts` with i18next initialization:
  - Languages: `['es', 'en']`
  - `fallbackLng: 'es'`
  - `defaultNS: 'common'`
  - `keySeparator: '.'`
  - `interpolation: { escapeValue: false }` (React handles XSS)
  - Detection order: `['localStorage', 'navigator']` via `i18next-browser-languagedetector`
  - localStorage key: `mavile.lang`
  - Resources loaded from `./locales/es/*.json` and `./locales/en/*.json` (inline import at init time — no lazy loading for MVP)
- [ ] 2.2 Import `frontend/src/i18n/index.ts` at the top of `frontend/src/index.tsx` before `ReactDOM.createRoot` to guarantee synchronous initialization before first render

---

## 3. Frontend: Locale Files — `common` Namespace

- [ ] 3.1 Create `frontend/src/i18n/locales/es/common.json` covering:
  - Navigation labels (home, catalog, cart, account, logout, login, register)
  - Header: cart icon tooltip, search placeholder, language switcher aria-labels
  - Footer: all static text
  - Shared buttons: Save, Cancel, Confirm, Delete, Close, Back, Submit, Continue, Loading…
  - Shared loading and error states: "Loading…", "Something went wrong", "Please try again"
  - Pagination: "Previous", "Next", "Page X of Y"
- [ ] 3.2 Create `frontend/src/i18n/locales/en/common.json` with the same keys as `es/common.json`, translated to English
- [ ] 3.3 Verify key parity between `es/common.json` and `en/common.json` (same set of keys in both files)

---

## 4. Frontend: Locale Files — `auth` Namespace

- [ ] 4.1 Create `frontend/src/i18n/locales/es/auth.json` covering:
  - LoginPage: title, email/password labels, placeholders, submit button, forgot password link, register link, error messages
  - RegisterPage: title, first/last name, email, password labels/placeholders, submit, login link, validation errors
  - ForgotPasswordPage: title, instructions, email label, submit, back to login link, success message
  - ResetPasswordPage: title, new password/confirm labels, submit, validation errors, success message
  - TwoFactorSetupPage: title, instructions, code label, submit, cancel
  - StorefrontAuthPanel: all tab labels and shared auth UI text
  - OAuthButtons: "Continue with Google", "Continue with Apple", "Continue with Facebook"
- [ ] 4.2 Create `frontend/src/i18n/locales/en/auth.json` with the same keys translated to English
- [ ] 4.3 Verify key parity between `es/auth.json` and `en/auth.json`

---

## 5. Frontend: Locale Files — `catalog` and `product` Namespaces

- [ ] 5.1 Create `frontend/src/i18n/locales/es/catalog.json` covering:
  - CatalogPage: page title, search placeholder, sort options, filter labels, results count, empty state, "Load more" / pagination
  - CategoryNav: "All categories" label, "Shop by category" heading (if any)
  - ProductCard: "View product", "Add to wishlist" (aria-labels), "Out of stock" badge
  - ProductGrid: grid/list toggle labels, results heading
- [ ] 5.2 Create `frontend/src/i18n/locales/en/catalog.json` with the same keys translated
- [ ] 5.3 Create `frontend/src/i18n/locales/es/product.json` covering:
  - ProductPage / ProductGallery: "Image X of Y", "Zoom" aria-label
  - VariantSelector: "Select size", "Select color", "Unavailable" labels
  - ProductCard: price display labels
  - "Add to cart" button, "Add to wishlist" button, "In stock" / "Out of stock" labels
  - Product description section heading, specifications heading (if any)
- [ ] 5.4 Create `frontend/src/i18n/locales/en/product.json` with the same keys translated
- [ ] 5.5 Verify key parity for both namespace pairs

---

## 6. Frontend: Locale Files — `cart`, `checkout`, `account` Namespaces

- [ ] 6.1 Create `frontend/src/i18n/locales/es/cart.json` covering:
  - CartPage: title, item count, quantity labels, remove button, empty cart message, "Continue shopping" link, subtotal, proceed to checkout button
- [ ] 6.2 Create `frontend/src/i18n/locales/en/cart.json` with the same keys translated
- [ ] 6.3 Create `frontend/src/i18n/locales/es/checkout.json` covering:
  - CheckoutPage: section headings (Shipping address, Contact info, Coupon), form labels and placeholders, step navigation, coupon apply/remove, order summary headings (subtotal, shipping, total)
  - PaymentForm: payment section heading, card field labels, pay button, processing state
  - OrderConfirmationPage: success heading, order number label, "View my orders" link, "Continue shopping" link, thank-you message, polling status messages
- [ ] 6.4 Create `frontend/src/i18n/locales/en/checkout.json` with the same keys translated
- [ ] 6.5 Create `frontend/src/i18n/locales/es/account.json` covering:
  - AccountPage: navigation tabs (Profile, Orders, Wishlist)
  - AccountProfilePage: section headings, form labels/placeholders, save button, success/error messages
  - AccountOrdersPage: page title, table/card column headers, empty state, status labels
  - AccountOrderDetailPage: back link, order info headings, item table headers, totals labels, status labels
  - AccountWishlistPage: page title, empty state, "Add to cart" / "Remove" buttons
- [ ] 6.6 Create `frontend/src/i18n/locales/en/account.json` with the same keys translated
- [ ] 6.7 Verify key parity for all three namespace pairs (`cart`, `checkout`, `account`)

---

## 7. Frontend: `LanguageSwitcher` Component

- [ ] 7.1 Create `frontend/src/components/storefront/LanguageSwitcher.tsx`:
  - Two flag buttons: 🇪🇸 (Spanish) and 🇬🇧 (English)
  - Each button has `aria-label` in the corresponding language ("Español", "English")
  - Active language shows a visual active state (CSS class or Bootstrap variant)
  - On click, calls `i18n.changeLanguage('es' | 'en')` from `react-i18next`
  - Uses `useTranslation` to read current language
  - Keyboard accessible (focusable `<button>` elements, not `<span>`)
  - Styled to match the `.storefront-header__icon-btn` pattern (min 44×44px hit area)
- [ ] 7.2 Write unit test for `LanguageSwitcher`:
  - Renders both flag buttons
  - Active language button has the active CSS class
  - Clicking the inactive button calls `i18n.changeLanguage` with the correct language code
  - Both buttons have correct `aria-label` attributes

---

## 8. Frontend: Wire `LanguageSwitcher` and `I18nSync` into Layout

- [ ] 8.1 Mount `<LanguageSwitcher />` inside `frontend/src/components/storefront/StorefrontHeader.tsx` within the `storefront-header__actions` section (alongside cart icon and account icon)
- [ ] 8.2 Add a `useEffect` in `frontend/src/components/storefront/StorefrontLayout.tsx` that syncs `document.documentElement.lang` with `i18n.language` on every language change and on mount

---

## 9. Frontend: Migrate Header, Footer, Nav, and `PriceTag`

- [ ] 9.1 Replace all hardcoded UI strings in `StorefrontHeader.tsx` with `t('common.<key>')` calls (search placeholder, cart/account aria-labels, nav links)
- [ ] 9.2 Replace all hardcoded UI strings in `StorefrontFooter.tsx` with `t('common.<key>')` calls
- [ ] 9.3 Replace all hardcoded UI strings in `CategoryNav.tsx` with `t('catalog.<key>')` calls
- [ ] 9.4 Update `PriceTag.tsx` to derive the `Intl.NumberFormat` locale from `i18n.language` (`es` → `es-ES`, `en` → `en-GB`) using `useTranslation` hook to re-render on language change
- [ ] 9.5 Update `Pagination.tsx` to use `t('common.previous')`, `t('common.next')`, `t('common.pageXofY', { current, total })` (interpolation)

---

## 10. Frontend: Migrate Auth Components and Pages

- [ ] 10.1 Replace all hardcoded strings in `StorefrontAuthPanel.tsx` with `t('auth.<key>')` calls
- [ ] 10.2 Replace all hardcoded strings in `OAuthButtons.tsx` with `t('auth.<key>')` calls
- [ ] 10.3 Replace all hardcoded strings in `LoginPage.tsx` with `t('auth.<key>')` calls
- [ ] 10.4 Replace all hardcoded strings in `RegisterPage.tsx` with `t('auth.<key>')` calls
- [ ] 10.5 Replace all hardcoded strings in `ForgotPasswordPage.tsx` with `t('auth.<key>')` calls
- [ ] 10.6 Replace all hardcoded strings in `ResetPasswordPage.tsx` with `t('auth.<key>')` calls
- [ ] 10.7 Replace all hardcoded strings in `TwoFactorSetupPage.tsx` with `t('auth.<key>')` calls

---

## 11. Frontend: Migrate Catalog and Product Components

- [ ] 11.1 Replace all hardcoded strings in `CatalogPage.tsx` with `t('catalog.<key>')` calls
- [ ] 11.2 Replace all hardcoded strings in `ProductCard.tsx` with `t('catalog.<key>')` and `t('product.<key>')` calls
- [ ] 11.3 Replace all hardcoded strings in `ProductGrid.tsx` with `t('catalog.<key>')` calls
- [ ] 11.4 Replace all hardcoded strings in `ProductPage.tsx` with `t('product.<key>')` calls
- [ ] 11.5 Replace all hardcoded strings in `ProductGallery.tsx` with `t('product.<key>')` calls
- [ ] 11.6 Replace all hardcoded strings in `VariantSelector.tsx` with `t('product.<key>')` calls

---

## 12. Frontend: Migrate Cart, Checkout, and Account Pages

- [ ] 12.1 Replace all hardcoded strings in `CartPage.tsx` with `t('cart.<key>')` calls
- [ ] 12.2 Replace all hardcoded strings in `CheckoutPage.tsx` with `t('checkout.<key>')` calls
- [ ] 12.3 Replace all hardcoded strings in `PaymentForm.tsx` with `t('checkout.<key>')` calls
- [ ] 12.4 Replace all hardcoded strings in `OrderConfirmationPage.tsx` with `t('checkout.<key>')` calls
- [ ] 12.5 Replace all hardcoded strings in `AccountPage.tsx` with `t('account.<key>')` calls
- [ ] 12.6 Replace all hardcoded strings in `AccountProfilePage.tsx` with `t('account.<key>')` calls
- [ ] 12.7 Replace all hardcoded strings in `AccountOrdersPage.tsx` with `t('account.<key>')` calls
- [ ] 12.8 Replace all hardcoded strings in `AccountOrderDetailPage.tsx` with `t('account.<key>')` calls
- [ ] 12.9 Replace all hardcoded strings in `AccountWishlistPage.tsx` with `t('account.<key>')` calls

---

## 13. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [ ] 13.1 Create a `renderWithI18n` test utility in `frontend/src/i18n/testUtils.tsx` that wraps with `I18nextProvider` initialized with the real `es` locale resources
- [ ] 13.2 Update existing component tests that render storefront components to use `renderWithI18n`:
  - `components/storefront/Pagination.test.tsx`
  - `components/storefront/PriceTag.test.tsx`
  - `components/storefront/ProductCard.test.tsx`
  - `components/storefront/VariantSelector.test.tsx`
- [ ] 13.3 Verify updated tests pass individually before running the full suite
- [ ] 13.4 Confirm no admin tests were inadvertently modified

---

## 14. Frontend: Run Unit Tests (MANDATORY)

- [ ] 14.1 Run targeted tests for new and modified components:
  ```bash
  cd frontend && npm test -- --testPathPattern="LanguageSwitcher|PriceTag|Pagination|ProductCard|VariantSelector" --watchAll=false
  ```
- [ ] 14.2 Run the full frontend unit test suite:
  ```bash
  cd frontend && npm test -- --watchAll=false
  ```
- [ ] 14.3 Confirm all tests pass (0 failures)
- [ ] 14.4 Create report `openspec/changes/frontend-i18n-multilanguage/reports/YYYY-MM-DD-step-14-unit-test-verification.md` with executed commands, pass/fail counts, and any notes

---

## 15. Manual Endpoint Testing with curl — NOT APPLICABLE

> This change introduces no new or modified backend endpoints. All changes are confined to the frontend. This step is skipped per `openspec-tasks-mandatory-steps.md` (curl testing applies only to backend endpoint changes).

- [ ] 15.1 Confirm no backend files were modified (verify with `git diff --name-only` scoped to `backend/`)

---

## 16. Frontend: E2E Testing with Playwright MCP (MANDATORY — AGENT MUST EXECUTE)

- [ ] 16.1 Ensure both frontend (`http://localhost:3001`) and backend (`http://localhost:3000`) servers are running
- [ ] 16.2 Navigate to storefront using Playwright MCP `browser_navigate` → `http://localhost:3001`
- [ ] 16.3 Take snapshot — verify Spanish flag is active by default and all visible text is in Spanish
- [ ] 16.4 Click the English flag in the header using `browser_click` — take snapshot and verify:
  - English flag shows active state
  - Navigation labels switch to English
  - Page text switches to English
- [ ] 16.5 Navigate to `/catalog` — verify catalog page text (search placeholder, sort labels, empty state) is in English
- [ ] 16.6 Click on a product — verify product detail page text (add to cart button, variant selector labels) is in English
- [ ] 16.7 Navigate to `/cart` (or add an item) — verify cart page text is in English
- [ ] 16.8 Navigate back to `/catalog` — click the Spanish flag — verify text reverts to Spanish
- [ ] 16.9 Close and reopen the browser (or use `localStorage` check) — verify English preference persists after page reload (reload via `browser_navigate` to same URL)
- [ ] 16.10 Navigate to an admin route (e.g., `/products`) — verify NO language switcher is present and text remains in Spanish
- [ ] 16.11 Verify `document.documentElement.lang` equals the active language using `browser_evaluate`
- [ ] 16.12 Create report `openspec/changes/frontend-i18n-multilanguage/reports/YYYY-MM-DD-step-16-e2e-testing.md` with all tested workflows, browser interactions, assertions, and outcomes

---

## 17. Update Technical Documentation (MANDATORY)

- [ ] 17.1 Update `docs/frontend-standards.md`:
  - Add a new section "Internationalization (i18n)" documenting:
    - Library: `react-i18next` + `i18next`
    - Scope: storefront only; admin is hardcoded Spanish
    - File structure: `src/i18n/locales/es/*.json` and `en/*.json`
    - Namespaces and their purpose
    - Convention: use `useTranslation` hook in storefront components; `useTranslation` is banned in `components/admin/**` and `pages/admin/**`
    - How to add a new key: add to both `es` and `en` files; verify key parity
    - Test helper: `renderWithI18n` utility in `src/i18n/testUtils.tsx`
- [ ] 17.2 Verify `docs/api-spec.yml` requires no update (no backend changes)
- [ ] 17.3 Verify `docs/data-model.md` requires no update (no schema changes)

---

## 18. Commit and Create Pull Request (MANDATORY — LAST STEP)

- [ ] 18.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 18.2 Verify all tasks above are marked `[x]` and reports exist under `openspec/changes/frontend-i18n-multilanguage/reports/`
- [ ] 18.3 Stage all relevant files (exclude `.env`, `node_modules/`, `dist/`, `coverage/`):
  - `frontend/src/i18n/`
  - `frontend/src/components/storefront/LanguageSwitcher.tsx`
  - Modified storefront components and pages
  - Updated test files
  - `docs/frontend-standards.md`
  - `openspec/changes/frontend-i18n-multilanguage/`
- [ ] 18.4 Create commit with Conventional Commit message:
  ```
  feat(storefront): add ES/EN language switcher with full i18n support

  - Install react-i18next + i18next-browser-languagedetector
  - Add LanguageSwitcher (🇪🇸/🇬🇧) to StorefrontHeader
  - Create locale JSON files for 7 namespaces (es + en)
  - Migrate all static UI strings in storefront to t() calls
  - Align PriceTag locale with active language (es-ES / en-GB)
  - Sync document.lang on language change
  - Admin panel remains Spanish-only, no switcher
  - OpenSpec change: frontend-i18n-multilanguage
  - Tests: unit ✅, curl N/A, E2E ✅
  ```
- [ ] 18.5 Push branch: `git push -u origin feature/frontend-i18n-multilanguage`
- [ ] 18.6 Create Pull Request with `gh pr create` and report the PR URL in chat
