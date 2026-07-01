# Frontend Implementation Plan — storefront-seo-foundation

Scope: tasks.md sections 1–5 only (frontend). Backend sitemap endpoint (section 6) is out of scope for this plan.

This plan was written after reading the actual current contents of `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx` (admin), `frontend/src/components/storefront/StorefrontLayout.tsx`, `frontend/src/components/storefront/AccountLayout.tsx`, `frontend/src/components/storefront/StorefrontAuthPanel.tsx`, `frontend/src/components/storefront/ProductGallery.tsx`, `frontend/src/components/storefront/ProductCard.tsx`, `frontend/src/components/storefront/ProductGrid.tsx`, all storefront pages in scope, `frontend/src/i18n/index.ts`, `frontend/public/index.html`, `frontend/public/robots.txt`, `frontend/package.json`, `frontend/.env.*`, and `backend/.env.example` (for the real production domain). Key findings that changed the plan from a naive per-file reading of tasks.md are called out explicitly below (see "Deviations from the literal task list — read this first").

---

## Deviations from the literal task list — read this first

1. **Admin `noindex` (task 3.2):** `frontend/src/components/Layout.tsx` is a genuine router-level wrapper (`<Outlet/>` inside `RequireAdminAuth`) around **all 15** admin back-office pages. tasks.md itself flags this as the preferred option ("check whether noindex can be added once there instead of on every individual page"). **Plan: add `<Seo noindex />` once in `Layout.tsx`. Do not touch the 15 individual admin page files.** `AdminLoginPage.tsx` is *not* wrapped by `Layout` (it's a standalone route `/admin/login` in `App.tsx`), so it needs its own `<Seo noindex />`.

2. **Customer account pages:** `frontend/src/components/storefront/AccountLayout.tsx` is composed (not a route wrapper, but every one of the 6 account pages renders `<AccountLayout>...</AccountLayout>` as its root) by **all** of: `AccountPage`, `AccountProfilePage`, `AccountOrdersPage`, `AccountOrderDetailPage`, `AccountWishlistPage`, `TwoFactorSetupPage` (verified via grep — no other consumers). Adding `<Seo noindex />` once inside `AccountLayout.tsx` covers all 6, including all 3 return branches of `AccountOrderDetailPage` (error / loading / success), with one edit instead of 6+.

3. **Customer auth pages:** `frontend/src/components/storefront/StorefrontAuthPanel.tsx` is composed by **all** of: `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage` (verified via grep — no other consumers). Adding `<Seo noindex />` once inside `StorefrontAuthPanel.tsx` covers all 4.

4. **Remaining individual pages needing their own `<Seo noindex />`:** `CartPage.tsx` (2 return branches), `CheckoutPage.tsx` (3 return branches), `OrderConfirmationPage.tsx` (1 return branch). These are not wrapped by any shared component.

   Net effect: instead of touching ~20 page files individually for task group 3, we touch 7 files (`Layout.tsx`, `AdminLoginPage.tsx`, `AccountLayout.tsx`, `StorefrontAuthPanel.tsx`, `CartPage.tsx`, `CheckoutPage.tsx`, `OrderConfirmationPage.tsx`) and every route in spec.md's noindex list is still covered. This is a stronger, more DRY implementation of the same requirement (fewer places a future page can "forget" `noindex`), consistent with design.md's own stated philosophy for the admin case. Unit test 3.3 must render through the real wrapper (see test plan) rather than the bare page component, since that's where the tag now lives.

5. **Product JSON-LD breadcrumb category name:** `Product`/`ProductResponse` types have no `category` relation — only `categoryId: number | null` (confirmed in `backend/src/presentation/serializers/publicProduct.ts` — the DTO allow-list has no category name field, and this is backend/out of scope to change). The frontend already has a hook, `useStorefrontCategories()` (`frontend/src/hooks/useStorefrontCategories.ts`), that fetches `categoryService.getAll()` and maps every DB category (all 4: Women/Men/Accessories/Shoes, per `STOREFRONT_CATEGORY_ORDER` in `constants/storefrontCategories.ts` — this is the exhaustive set, no subcategories in use) to a translated label + `id`. **Plan: `ProductPage.tsx` reuses this hook** (same pattern as `CatalogHero.tsx`) to resolve `product.categoryId` → translated category label for the breadcrumb, instead of adding a new fetch or touching the backend.

6. **Production site URL:** no `SITE_URL`/domain constant exists in the frontend today. `backend/.env.example` shows the real production value via the SSM parameter comment: `FRONTEND_URL=https://mavile.es` (prod) / `http://localhost:3001` (dev, matches `PORT=3001` in `frontend/.env.development`). Use these as the `REACT_APP_SITE_URL` values.

7. **React 19 peer-dependency risk:** `frontend/package.json` has `react@^19.2.7`. The project's own convention (see `docs/frontend-standards.md` § Stripe.js) is to install with `--legacy-peer-deps` when a package's peer-deps don't yet declare React 19 support. `react-helmet-async`'s published peerDependencies typically cap at React 18. **Plan: install with `--legacy-peer-deps`** and note it in `docs/frontend-standards.md` alongside the existing Stripe note (documentation update is task 11, not in this plan's scope, but flag it now so the implementer doesn't get a silent install failure).

8. **`renderWithI18n` test helper must be updated.** `frontend/src/test-utils/renderWithI18n.tsx` is used by most storefront page tests (`CartPage.test.tsx`, `ProductPage.test.tsx`, `CatalogPage.test.tsx`, etc.). Once these pages render `<Seo>` (which renders `<Helmet>` from `react-helmet-async`), every test using `renderWithI18n` needs an ancestor `<HelmetProvider>` or `react-helmet-async` will throw/warn about missing context. **Plan: wrap `renderWithI18n`'s internal `Wrapper` with `HelmetProvider`** so all existing callers keep working without individually editing every test file.

---

## 1. Dependency, env var, and provider setup

### 1.1 `frontend/package.json`
Add dependency:
```
npm install react-helmet-async --legacy-peer-deps
```
This adds `"react-helmet-async": "^2.x"` to `dependencies`. Note the `--legacy-peer-deps` flag in the PR description / commit, matching the existing Stripe precedent.

### 1.2 Environment files (follow `REACT_APP_API_BASE_URL` convention exactly)

- **`frontend/.env.development`** — add:
  ```
  REACT_APP_SITE_URL=http://localhost:3001
  ```
  (matches the existing `PORT=3001` in the same file — the dev server's own origin.)

- **`frontend/.env.production`** — add, with the same comment style already used for `REACT_APP_API_BASE_URL`:
  ```
  REACT_APP_SITE_URL=https://mavile.es
  ```
  Note: unlike `REACT_APP_API_BASE_URL`, this value does **not** need to be injected as a CI/CD secret (it's not sensitive) — safe to commit directly. Mention this explicitly in the file comment so nobody adds it to GitHub Secrets by mistake.

- **`frontend/.env.example`** — add a mirroring section:
  ```
  # REACT_APP_SITE_URL=http://localhost:3001   (dev)
  # REACT_APP_SITE_URL=https://mavile.es        (prod — public value, safe to commit)
  ```

- **`docs/frontend-standards.md`** (section "Recommended frontend environment variables") — add `REACT_APP_SITE_URL` to the list. (This falls under task 11.2/11.3 territory but is a one-line addition worth doing alongside 1.2 since it's the same convention documented there.)

### 1.3 `frontend/src/App.tsx` — wrap with `HelmetProvider`

Add import:
```tsx
import { HelmetProvider } from 'react-helmet-async';
```
Wrap the outermost returned JSX. Current root is `<BrowserRouter>`; wrap that (not just the storefront subtree, since admin routes also need `Seo`):

```tsx
const App: React.FC = () => {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ScrollManager />
        <AdminAuthProvider>
          ...
        </AdminAuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
};
```
This is additive/non-breaking per design.md's migration plan step 1.

---

## 2. `Seo.tsx` component (task 1.4) + unit tests (task 1.5)

### 2.1 Create `frontend/src/components/storefront/Seo.tsx`

```tsx
import React from 'react';
import { Helmet } from 'react-helmet-async';

export interface SeoProps {
  title: string;
  description?: string;
  /** Site-relative path, e.g. '/catalog', '/catalog/42', '/pages/shipping'. */
  canonicalPath?: string;
  /** Absolute image URL for Open Graph / Twitter. Falls back to the site default. */
  image?: string;
  noindex?: boolean;
  /** One JSON-LD object, or several (e.g. Product + BreadcrumbList on the PDP). */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = (process.env.REACT_APP_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const DEFAULT_OG_IMAGE = `${SITE_URL}/mavile-logo.png`;

const Seo: React.FC<SeoProps> = ({
  title,
  description,
  canonicalPath,
  image,
  noindex = false,
  jsonLd,
}) => {
  const canonicalUrl = canonicalPath ? `${SITE_URL}${canonicalPath}` : undefined;
  const resolvedImage = image ?? DEFAULT_OG_IMAGE;
  const jsonLdBlocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content="website" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={resolvedImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={resolvedImage} />

      {jsonLdBlocks.map((block, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
};

export default Seo;
```

Notes:
- `noindex` defaults to `false`; the `robots` meta tag is only rendered `when noindex` (per task 1.4's own wording) — no `"index, follow"` tag is emitted for public pages, which is the standard convention (absence = indexable).
- `og:type` is a constant `'website'` — no prop for it, keeping the prop surface exactly as specified (`title, description, canonicalPath, image, noindex, jsonLd`). This still satisfies the OG requirement scenario in spec.md (it doesn't assert a specific `og:type` value).
- `react-helmet-async`'s dedup/merge behavior: when both a parent (`StorefrontLayout`/`AccountLayout`/etc.) and a child page render `<Helmet>`, the deeper-mounted one wins per attribute-keyed tag (e.g. `meta[name="robots"]`, `title`, `link[rel="canonical"]`). This is what makes the wrapper-level consolidation in section 3 below safe.

### 2.2 Create `frontend/src/components/storefront/Seo.test.tsx` (co-located, matching `ProductCard.test.tsx` / `PriceTag.test.tsx` convention)

```tsx
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import Seo from './Seo';

const renderSeo = (ui: React.ReactElement) =>
  render(<HelmetProvider>{ui}</HelmetProvider>);

describe('Seo', () => {
  it('renders title, description and canonical by default (no robots meta)', async () => {
    renderSeo(<Seo title="Shop All | Mavile" description="Browse the collection" canonicalPath="/catalog" />);
    await waitFor(() => expect(document.title).toBe('Shop All | Mavile'));
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', 'Browse the collection');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', expect.stringContaining('/catalog'));
    expect(document.querySelector('meta[name="robots"]')).not.toBeInTheDocument();
  });

  it('renders noindex robots meta when noindex is true', async () => {
    renderSeo(<Seo title="Checkout" noindex />);
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    );
  });

  it('renders a JSON-LD script tag when jsonLd is provided', async () => {
    renderSeo(<Seo title="Product" jsonLd={{ '@type': 'Product', name: 'Dress' }} />);
    await waitFor(() => {
      const script = document.querySelector('script[type="application/ld+json"]');
      expect(script).toBeInTheDocument();
      expect(JSON.parse(script!.textContent ?? '{}')).toEqual({ '@type': 'Product', name: 'Dress' });
    });
  });

  it('renders multiple JSON-LD blocks when an array is provided', async () => {
    renderSeo(<Seo title="PDP" jsonLd={[{ '@type': 'Product' }, { '@type': 'BreadcrumbList' }]} />);
    await waitFor(() => {
      expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(2);
    });
  });
});
```
Use `waitFor` (not `getBy*`) for these DOM/head assertions — they are not Testing Library queries, so `testing-library/prefer-find-by` does not apply (per `docs/frontend-standards.md` § ESLint, "reserve `waitFor` for non-query assertions"). Run `npx eslint src --ext .ts,.tsx` after adding.

### 2.3 Update `frontend/src/test-utils/renderWithI18n.tsx`

Add `HelmetProvider` so every existing caller keeps working once pages render `<Seo>`:
```tsx
import { HelmetProvider } from 'react-helmet-async';
...
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <HelmetProvider>
    <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
  </HelmetProvider>
);
```

---

## 3. Public page metadata (task group 2)

### 3.1 `frontend/src/pages/storefront/CatalogPage.tsx`

Add new i18n keys (both locales) since "Shop All | Mavile" / category-specific titles are user-facing text and must follow the project's i18n convention (never hardcode English-only strings):

**`frontend/src/i18n/locales/es/catalog.json`** — add a `meta` block:
```json
"meta": {
  "titleAll": "Todo | Mavile",
  "titleCategory": "{{category}} | Mavile",
  "description": "Descubre la colección Mavile: moda atemporal con una estética moderna y minimalista."
}
```
**`frontend/src/i18n/locales/en/catalog.json`** — mirror:
```json
"meta": {
  "titleAll": "Shop All | Mavile",
  "titleCategory": "{{category}} | Mavile",
  "description": "Discover the Mavile collection — timeless fashion with a modern, minimalist aesthetic."
}
```

In `CatalogPage.tsx`:
- Import `Seo` and `useStorefrontCategories`.
- Reuse the same category-resolution pattern already in `CatalogHero.tsx` (`resolveCategoryKey`) — or, simpler, just look up the label directly from `useStorefrontCategories().links` by matching `id === categoryId`.
- Add near the top of the component body (after existing hooks, before the `return`):
```tsx
const { links: categoryLinks } = useStorefrontCategories();
const activeCategory = categoryLinks.find((l) => l.id === categoryId);
const seoTitle = activeCategory
  ? t('meta.titleCategory', { category: activeCategory.label })
  : t('meta.titleAll');
```
- Add `<Seo title={seoTitle} description={t('meta.description')} canonicalPath="/catalog" />` as the first child of the returned `<div>`.

### 3.2 `frontend/src/pages/storefront/ProductPage.tsx`

- Import `Seo` and `useStorefrontCategories`.
- Only the **final** success return (line ~97 in current file, `if (!product) return null;` guards everything above it) needs `<Seo>` — the loading/notFound/error early returns intentionally do not need product-specific metadata (they're transient; StorefrontLayout's fallback Seo, see §3.4, covers them if a crawler somehow catches that exact moment).
- Title: `` `${product.name} | Mavile` `` (product name isn't translatable UI copy in this codebase — it's DB content already localized server-side via `Accept-Language`, so no new i18n key needed here).
- Description: truncate `product.description` to ~155 chars (per spec scenario), e.g.:
  ```tsx
  const seoDescription = product.description
    ? product.description.length > 155
      ? `${product.description.slice(0, 152)}...`
      : product.description
    : undefined;
  ```
- Image: `product.mainImageUrl || product.images?.[0]?.url` (absolute URL already, matches what `ProductCard`/`ProductGallery` use).
- Category breadcrumb resolution (see Deviation #5 above):
  ```tsx
  const { links: categoryLinks } = useStorefrontCategories();
  const categoryLink = categoryLinks.find((l) => l.id === product.categoryId);
  ```
- Build the two JSON-LD blocks:
  ```tsx
  const priceForSchema = priceVariant?.publicPrice;
  const stockVariant = product.variants?.some((v) => v.status === 'Active');

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.mainImageUrl || product.images?.[0]?.url,
    description: product.description ?? undefined,
    sku: priceVariant?.sku,
    offers: priceVariant ? {
      '@type': 'Offer',
      price: priceVariant.publicPrice,
      priceCurrency: 'EUR',
      availability: stockVariant
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    } : undefined,
  };

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/catalog` },
    ...(categoryLink
      ? [{ '@type': 'ListItem', position: 2, name: categoryLink.label, item: `${SITE_URL}${categoryLink.href}` }]
      : []),
    {
      '@type': 'ListItem',
      position: categoryLink ? 3 : 2,
      name: product.name,
      item: `${SITE_URL}/catalog/${product.id}`,
    },
  ];
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };
  ```
  Note: `Seo.tsx` doesn't export `SITE_URL` — either export it as a named export from `Seo.tsx` (`export const SITE_URL = ...`) for reuse here and in `CatalogPage`/`ContentPage` breadcrumb-style needs, or inline the same `process.env.REACT_APP_SITE_URL ?? '...'` expression locally in `ProductPage.tsx`. **Recommend exporting `SITE_URL` from `Seo.tsx`** to avoid duplicating the fallback-URL logic in three files.
- Add `<Seo title={...} description={seoDescription} canonicalPath={`/catalog/${product.id}`} image={...} jsonLd={[productJsonLd, breadcrumbJsonLd]} />` as the first child of the returned JSX (the `<div className="storefront-section">` root at the bottom of the file).

### 3.3 `frontend/src/pages/storefront/ContentPage.tsx`

- The existing `pages` namespace already has `title` and `intro` per slug (confirmed shape in `docs/frontend-standards.md` and `pages.json`) — **no new i18n keys needed**, per the task instruction to reuse the existing namespace.
- Add `<Seo title={t(`${slug}.title`)} description={t(`${slug}.intro`)} canonicalPath={`/pages/${slug}`} />` as the first child inside `<article className="storefront-content-page ...">`, right after the `VALID_SLUGS` guard (so it's never rendered for the `Navigate` redirect branch).

### 3.4 `frontend/src/components/storefront/StorefrontLayout.tsx` — defensive fallback (task 2.4)

This is a **generic baseline**, not a noindex safety net (StorefrontLayout wraps both public and private routes, so defaulting it to noindex would require every public page to override — CatalogPage/ProductPage/ContentPage already do via their own `<Seo>`, so either default works, but a plain non-noindex generic fallback is simpler and matches "for any storefront page that does not set its own" literally — i.e. baseline title/description, not a security control):

```tsx
import Seo from './Seo';
...
return (
  <div className="storefront-root">
    <Seo title="Mavile" description="Mavile — timeless fashion with a modern, minimalist aesthetic." />
    <StorefrontHeader />
    ...
```
Because deeper components win on duplicate tags, every page that renders its own `<Seo>` (Catalog/Product/Content, plus the noindex pages in §4) overrides this fallback for the tags it sets.

---

## 4. Non-public route noindex coverage (task group 3)

### 4.1 `frontend/src/components/Layout.tsx` (admin wrapper) — covers all 15 admin pages

Add import and one `<Seo noindex />` call, before `<Outlet/>`:
```tsx
import Seo from './storefront/Seo';
...
<main className="admin-main">
  <Seo title="Admin | Mavile" noindex />
  <Outlet />
</main>
```
(Reusing the storefront `Seo` component from the admin `Layout` is intentional — it's a generic head-metadata component, not storefront-specific business logic; there is no `components/admin/Seo.tsx` and no admin i18n need since admin titles are hardcoded English/Spanish already per project convention.)

This single edit covers: `ProductsPage`, `ProductDetailPage`, `CategoriesPage`, `SuppliersPage`, `CustomersPage`, `CustomerOrdersPage`, `CustomerOrderDetailPage`, `SupplierOrdersPage`, `SupplierOrderDetailPage`, `ShipmentsPage`, `ShipmentDetailPage`, `ReturnRequestsPage`, `ReturnRequestDetailPage`, `RefundsPage`, `RefundDetailPage` — **none of these 15 files need to be touched.**

### 4.2 `frontend/src/pages/admin/AdminLoginPage.tsx` — standalone, needs its own

Add inside the returned `<Container>`, as its first child:
```tsx
import Seo from '../../components/storefront/Seo';
...
<Container className="py-5" style={{ maxWidth: 420 }}>
  <Seo title="Admin sign in | Mavile" noindex />
  <Card>
  ...
```

### 4.3 `frontend/src/components/storefront/AccountLayout.tsx` — covers 6 account pages

```tsx
import Seo from './Seo';
...
return (
  <div className="storefront-account storefront-animate-fade-in">
    <Seo title={`${title} | Mavile`} noindex />
    <header className="storefront-account__header">
    ...
```
Covers: `AccountPage`, `AccountProfilePage`, `AccountOrdersPage`, `AccountOrderDetailPage` (all 3 of its return branches, since all 3 route through `AccountLayout`), `AccountWishlistPage`, `TwoFactorSetupPage`. **None of these 6 files need to be touched individually.**

### 4.4 `frontend/src/components/storefront/StorefrontAuthPanel.tsx` — covers 4 auth pages

```tsx
import Seo from './Seo';
...
return (
  <div className="storefront-auth">
    <Seo title={`${title} | Mavile`} noindex />
    <div className="storefront-auth__panel storefront-animate-fade-up">
    ...
```
Covers: `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`. **None of these 4 files need to be touched individually.**

### 4.5 `frontend/src/pages/storefront/CartPage.tsx` — 2 return branches, both need it

Add `<Seo title="Cart | Mavile" noindex />` as the first child in **both** returns:
- The empty-cart early return (`<div className="storefront-cart-empty ...">`)
- The main return (`<div className="storefront-cart ...">`)

(A `t('cart.title')`-based title could be used instead of a literal string for language-consistency, but since this page is never indexed, exact wording doesn't matter for SEO — using the existing `t('title')` from the `cart` namespace is still preferable for consistency with the rest of the app; recommend `title={t('title')}` reusing the namespace already imported in this file via `useTranslation('cart')`, doing `` `${t('title')} | Mavile` `` in both branches.)

### 4.6 `frontend/src/pages/storefront/CheckoutPage.tsx` — 3 return branches, all need it

This file has no i18n (`useTranslation` is not imported here — verified in the file content; all copy is hardcoded English). Add `<Seo title="Checkout | Mavile" noindex />` as the first child in all three:
1. `if (!items.length && step === 'details') return <Navigate to="/cart" replace />;` — this one is a redirect with no rendered page content, **no Seo needed** (nothing is displayed).
2. The `step === 'payment'` return (`<div className="storefront-checkout ...">` with "Payment" title).
3. The final default return (`<div className="storefront-checkout ...">` with "Checkout" title).

### 4.7 `frontend/src/pages/storefront/OrderConfirmationPage.tsx` — 1 return branch

Add `<Seo title="Order confirmation | Mavile" noindex />` as the first child of the single returned `<div className="storefront-confirmation ...">`.

---

## 5. `robots.txt` and `index.html` (task group 4)

### 5.1 Rewrite `frontend/public/robots.txt`

Replace the current permissive file entirely:

```
# https://www.robotstxt.org/robotstxt.html
User-agent: *

# Auth / account / checkout — customer non-public routes
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /cart
Disallow: /checkout
Disallow: /order-confirmation/
Disallow: /account
Disallow: /account/

# Admin back-office — not under /admin/*, listed explicitly (see design.md decision #5)
Disallow: /admin/login
Disallow: /products
Disallow: /categories
Disallow: /suppliers
Disallow: /customers
Disallow: /customer-orders
Disallow: /supplier-orders
Disallow: /shipments
Disallow: /return-requests
Disallow: /refunds

Sitemap: https://mavile.es/api/public/sitemap.xml
```

Notes for the implementer:
- `Disallow: /account` and `Disallow: /account/` together block both the exact `/account` path and all `/account/*` sub-paths (`/account/profile`, `/account/orders`, `/account/orders/:id`, `/account/wishlist`, `/account/security/2fa`) — standard robots.txt prefix-matching behavior, no need to enumerate each account sub-route.
- `Disallow: /products`, `/customers`, etc. block both the list route and the `:id` detail route since robots.txt matches by path prefix (`/products/123` starts with `/products`).
- The `Sitemap:` line points at the **backend** endpoint (cross-origin from the frontend's own origin — this is valid per the robots.txt spec, sitemaps may live on a different host). Confirm the exact production API host with whoever implements task group 6 (backend) — `https://mavile.es` is the storefront's own domain per `FRONTEND_URL`; if the API Gateway domain differs (e.g., the `execute-api...amazonaws.com` URL seen in `frontend/.env.production`), use that instead so the sitemap URL actually resolves. **This value must be double-checked against the real deployed API origin before merging** — do not blindly ship the placeholder above.

### 5.2 Fix `lang` attribute in `frontend/public/index.html`

Change line 2:
```diff
-<html lang="en">
+<html lang="es">
```
This matches `fallbackLng: 'es'` in `frontend/src/i18n/index.ts`. Note: `StorefrontLayout.tsx` already syncs `document.documentElement.lang` reactively via `useEffect` on `i18n.language` at runtime — this fix only affects the pre-hydration/no-JS static value and crawlers that don't execute the language-detection JS.

---

## 6. Image `alt` text audit (task group 5)

### 6.1 `frontend/src/components/storefront/ProductGallery.tsx` — already correct, no change needed

Current code (lines 16–17, 31, 36):
```tsx
const mainAlt = activeImage?.altText || productName;
...
aria-label={img.altText || `Image ${idx + 1}`}
...
<img src={img.url} alt={img.altText || `${productName} thumbnail ${idx + 1}`} />
```
This already implements `altText || productName` (main image) and a reasonable thumbnail-specific fallback. **No fix required here** — but still add the unit test below (task 5.2 requires it regardless, and no `ProductGallery.test.tsx` currently exists).

### 6.2 `frontend/src/components/storefront/ProductCard.tsx` — has a real gap, needs a fix

Current code (line 24):
```tsx
const imageAlt = product.mainImageUrl ? product.name : firstImage?.altText || product.name;
```
**Bug:** when `product.mainImageUrl` is set (the common case — most products have a main image), the alt text is **always** `product.name`, completely ignoring `firstImage?.altText` even when it's present and more descriptive. The `altText || product.name` fallback only kicks in for products *without* a `mainImageUrl`. This violates the spec scenario "Product card image has alt text ... rendered `<img>` SHALL have its alt attribute set to that altText value" whenever a product has both a `mainImageUrl` and a populated `images[0].altText`.

**Fix:**
```tsx
const imageAlt = firstImage?.altText || product.name;
```
(Drop the `product.mainImageUrl ? ... :` branch entirely — `firstImage` is `product.images?.[0] ?? null` regardless of whether `mainImageUrl` is separately set, so this single expression is correct for both cases and matches the exact `alt={image.altText || product.name}` pattern the task specifies.)

The secondary/hover image (`alt=""` with `aria-hidden`, line 40) is correctly decorative and should **not** change — it's a duplicate of the primary image shown only on hover, not new content.

### 6.3 New/updated tests

**`frontend/src/components/storefront/ProductCard.test.tsx`** — add a case for the bug fix (the existing "renders the product image with alt text" test at line 49 uses a product with `images: []`, so it never exercised the `firstImage?.altText` branch — extend it):
```tsx
it('prefers image altText over product name when both mainImageUrl and altText are present', () => {
  const withAlt: Product = {
    ...baseProduct,
    mainImageUrl: 'https://cdn.example.com/dress.jpg',
    images: [{ id: 1, productId: 1, url: 'https://cdn.example.com/dress.jpg', altText: 'Black midi dress on model', sortOrder: 0, createdAt: '' }],
  };
  render(<MemoryRouter><ProductCard product={withAlt} /></MemoryRouter>);
  expect(screen.getByRole('img', { name: 'Black midi dress on model' })).toBeInTheDocument();
});

it('falls back to product name when altText is empty, even with mainImageUrl set', () => {
  const noAlt: Product = {
    ...baseProduct,
    mainImageUrl: 'https://cdn.example.com/dress.jpg',
    images: [{ id: 1, productId: 1, url: 'https://cdn.example.com/dress.jpg', altText: null, sortOrder: 0, createdAt: '' }],
  };
  render(<MemoryRouter><ProductCard product={noAlt} /></MemoryRouter>);
  expect(screen.getByRole('img', { name: 'Black Midi Dress' })).toBeInTheDocument();
});
```

**Create `frontend/src/components/storefront/ProductGallery.test.tsx`** (new file):
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import ProductGallery from './ProductGallery';
import { ProductImage } from '../../types/product';

const images: ProductImage[] = [
  { id: 1, productId: 1, url: 'https://cdn.example.com/a.jpg', altText: 'Red dress front view', sortOrder: 0, createdAt: '' },
  { id: 2, productId: 1, url: 'https://cdn.example.com/b.jpg', altText: null, sortOrder: 1, createdAt: '' },
];

describe('ProductGallery', () => {
  it('uses the active image altText for the main image', () => {
    render(<ProductGallery images={images} productName="Red Dress" />);
    const main = screen.getAllByRole('img')[0];
    expect(main).toHaveAttribute('alt', 'Red dress front view');
  });

  it('falls back to productName for the main image when altText is empty', () => {
    render(<ProductGallery images={[images[1]]} productName="Red Dress" />);
    const main = screen.getByRole('img');
    expect(main).toHaveAttribute('alt', 'Red Dress');
  });
});
```

---

## 7. Consolidated file list

**New files:**
- `frontend/src/components/storefront/Seo.tsx`
- `frontend/src/components/storefront/Seo.test.tsx`
- `frontend/src/components/storefront/ProductGallery.test.tsx`

**Modified files:**
- `frontend/package.json` (add `react-helmet-async`)
- `frontend/.env.development`, `frontend/.env.production`, `frontend/.env.example` (add `REACT_APP_SITE_URL`)
- `frontend/src/App.tsx` (`HelmetProvider` wrap)
- `frontend/src/test-utils/renderWithI18n.tsx` (`HelmetProvider` wrap)
- `frontend/src/pages/storefront/CatalogPage.tsx` (+ `es/catalog.json`, `en/catalog.json` new `meta` keys)
- `frontend/src/pages/storefront/ProductPage.tsx`
- `frontend/src/pages/storefront/ContentPage.tsx`
- `frontend/src/components/storefront/StorefrontLayout.tsx`
- `frontend/src/components/Layout.tsx` (admin)
- `frontend/src/pages/admin/AdminLoginPage.tsx`
- `frontend/src/components/storefront/AccountLayout.tsx`
- `frontend/src/components/storefront/StorefrontAuthPanel.tsx`
- `frontend/src/pages/storefront/CartPage.tsx`
- `frontend/src/pages/storefront/CheckoutPage.tsx`
- `frontend/src/pages/storefront/OrderConfirmationPage.tsx`
- `frontend/public/robots.txt`
- `frontend/public/index.html` (`lang="es"`)
- `frontend/src/components/storefront/ProductCard.tsx` (alt-text fix)
- `frontend/src/components/storefront/ProductCard.test.tsx` (new cases)
- `docs/frontend-standards.md` (env var list + Seo convention — technically task 11.2, but low-risk to bundle here)

**Explicitly NOT modified** (covered defensively via a shared wrapper — see Deviations section):
`ProductsPage.tsx`, `ProductDetailPage.tsx`, `CategoriesPage.tsx`, `SuppliersPage.tsx`, `CustomersPage.tsx`, `CustomerOrdersPage.tsx`, `CustomerOrderDetailPage.tsx`, `SupplierOrdersPage.tsx`, `SupplierOrderDetailPage.tsx`, `ShipmentsPage.tsx`, `ShipmentDetailPage.tsx`, `ReturnRequestsPage.tsx`, `ReturnRequestDetailPage.tsx`, `RefundsPage.tsx`, `RefundDetailPage.tsx`, `AccountPage.tsx`, `AccountProfilePage.tsx`, `AccountOrdersPage.tsx`, `AccountOrderDetailPage.tsx`, `AccountWishlistPage.tsx`, `TwoFactorSetupPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`.

---

## 8. Unit test for task 3.3 ("representative admin page" + "representative account page")

Because the `noindex` tag for admin pages now lives in `Layout.tsx` (not in the page files), the test must render through the real composition, not the bare page component:

**New file `frontend/src/components/__tests__/Layout.test.tsx`** (or add to an existing admin test — either is fine; a dedicated file is cleaner):
```tsx
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Layout from '../Layout';
import ProductsPage from '../../pages/ProductsPage';
import { adminProductService } from '../../services/adminProductService';
import { categoryService } from '../../services/categoryService';

jest.mock('../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({ admin: { email: 'admin@mavile.es' }, logout: jest.fn() }),
}));
jest.mock('../../services/adminProductService');
jest.mock('../../services/categoryService');

beforeEach(() => {
  (adminProductService as jest.Mocked<typeof adminProductService>).list.mockResolvedValue({
    success: true, data: { items: [], total: 0, page: 1, pageSize: 20 }, message: '',
  });
  (categoryService as jest.Mocked<typeof categoryService>).getAll.mockResolvedValue([]);
});

describe('Admin Layout — noindex coverage', () => {
  it('renders noindex, nofollow on a representative admin page (ProductsPage)', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/products']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="products" element={<ProductsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    );
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    );
  });
});
```

**Representative customer-account page** — add to `frontend/src/pages/storefront/__tests__/` (new file, e.g. `AccountPage.test.tsx`, or extend an existing one if present — none currently exists for `AccountPage`):
```tsx
import React from 'react';
import { waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import AccountPage from '../AccountPage';

jest.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ customer: { firstName: 'Ana', lastName: 'García', email: 'ana@example.com' }, logout: jest.fn() }),
}));

describe('AccountPage — noindex coverage', () => {
  it('renders noindex, nofollow via AccountLayout', async () => {
    renderWithI18n(<MemoryRouter><AccountPage /></MemoryRouter>);
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    );
  });
});
```
(Since `renderWithI18n` was updated in §2.3 to include `HelmetProvider`, no extra provider wrapping is needed here.)

Both tests use `waitFor` (non-query assertion on `document.head`), consistent with the ESLint rule noted in `docs/frontend-standards.md`.

---

## 9. Order of implementation (suggested, to keep the app buildable at each step)

1. §1 (deps, env, `HelmetProvider` in `App.tsx`) + §2 (`Seo.tsx` + its test + `renderWithI18n` update) — verify `Seo.test.tsx` passes in isolation first.
2. §3 (Catalog/Product/Content pages + `StorefrontLayout` fallback) — manually sanity-check in the browser per design.md's migration plan step 2 before touching private routes.
3. §4 (all noindex wiring) in the order: admin `Layout.tsx` → `AdminLoginPage` → `AccountLayout` → `StorefrontAuthPanel` → `CartPage` → `CheckoutPage` → `OrderConfirmationPage`.
4. §5 (`robots.txt`, `index.html`).
5. §6 (`ProductCard` alt fix + both test files).
6. §8 (the two noindex-coverage unit tests).
7. Run `cd frontend && npx eslint src --ext .ts,.tsx` and the full Jest suite; confirm no regressions in the existing `CartPage.test.tsx`, `LoginPage.test.tsx`, `CatalogPage.test.tsx`, `ProductPage.test.tsx`, `ContentPage.test.tsx`, `OrderConfirmationPage.test.tsx`, `ProductsPage.test.tsx` (task 7.1's review — these all render components that now emit `<Helmet>` output, so watch for any test that was asserting `document.title` or head content against the *old* static behavior — none currently do based on the files read for this plan, but re-verify after implementation).
