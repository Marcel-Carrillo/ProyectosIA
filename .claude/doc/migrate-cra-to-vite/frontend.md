# Implementation Plan: migrate-cra-to-vite (frontend)

Worktree: `C:\Users\mcarh\Desktop\AI_AGENTS\ProyectoPrueba\.worktrees\feature-migrate-cra-to-vite`
Branch: `feature/migrate-cra-to-vite`

This plan is PLAN-ONLY. No file outside `.claude/doc/` was modified to produce it. All paths below are relative to `frontend/` unless stated otherwise (repo-root paths are written as `frontend/...` or `.github/...` explicitly).

---

## 0. Recounted inventory (ground truth as of this branch, superseding the proposal's "21 call sites" / "271 tests" / "51 files" numbers)

### 0.1 `process.env.*` usage in `frontend/src` — 22 occurrences in 22 files (not 21)

All 22 are in **runtime source**, none in test files. 21 are `REACT_APP_*` (in scope for the env-var task); 1 is `BACKEND_URL` inside `setupProxy.js`, which is being **deleted** (its logic moves into `vite.config.ts`, not renamed).

| # | File | Line | Current | Target |
|---|---|---|---|---|
| 1 | `src/setupProxy.js` | 3 | `process.env.BACKEND_URL \|\| 'http://localhost:3000'` | **File deleted.** Logic ported to `vite.config.ts` `server.proxy['/api'].target` using `process.env.BACKEND_URL` (this one stays `process.env.*` — it's a Node-context read inside `vite.config.ts`, not client code, so it is NOT renamed to `VITE_*`). |
| 2 | `src/components/storefront/OAuthButtons.tsx` | 4 | `process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000'` | `import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'` |
| 3 | `src/components/storefront/Seo.tsx` | 17 | `process.env.REACT_APP_SITE_URL ?? 'http://localhost:3001'` | `import.meta.env.VITE_SITE_URL ?? 'http://localhost:3001'` |
| 4 | `src/services/categoryService.ts` | 4 | `process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000'` | `import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'` |
| 5 | `src/services/adminAuthService.ts` | 4 | same | same pattern |
| 6 | `src/services/adminProductService.ts` | 23 | same | same pattern |
| 7 | `src/services/cjConnectionService.ts` | 10 | same | same pattern |
| 8 | `src/services/checkoutService.ts` | 5 | same | same pattern |
| 9 | `src/services/cjCatalogService.ts` | 11 | same | same pattern |
| 10 | `src/services/customerService.ts` | 15 | same | same pattern |
| 11 | `src/services/customerOrderService.ts` | 12 | same | same pattern |
| 12 | `src/services/productService.ts` | 9 | same | same pattern |
| 13 | `src/services/refundService.ts` | 10 | same | same pattern |
| 14 | `src/services/returnRequestService.ts` | 10 | same | same pattern |
| 15 | `src/services/paymentService.ts` | 4 | same | same pattern |
| 16 | `src/services/customerAuthService.ts` | 4 | same | same pattern |
| 17 | `src/services/supplierOrderService.ts` | 12 | same | same pattern |
| 18 | `src/services/shipmentService.ts` | 11 | same | same pattern |
| 19 | `src/services/wishlistService.ts` | 4 | same | same pattern |
| 20 | `src/services/reviewService.ts` | 14 | same | same pattern |
| 21 | `src/services/supplierService.ts` | 11 | same | same pattern |
| 22 | `src/pages/storefront/TwoFactorSetupPage.tsx` | 9 | same | same pattern |
| — | `src/pages/storefront/ContentPage.tsx` | 27 | same | same pattern |

(That's 17 service files + `OAuthButtons.tsx` + `Seo.tsx` + `ContentPage.tsx` + `TwoFactorSetupPage.tsx` = 21 `REACT_APP_*` sites, matching design.md's count exactly — confirmed, no drift from PR #85/#100.)

Codemod for all 21: replace `process.env.REACT_APP_` → `import.meta.env.VITE_`, keep every `?? 'http://localhost:...'` fallback verbatim (do not touch the fallback literal). Example diff (identical shape in all 17 service files):

```diff
- const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
+ const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
```

**Verification regex** (task 2.4): `grep -rn "REACT_APP_\|%PUBLIC_URL%\|react-scripts\|setupProxy" frontend/src frontend/package.json frontend/index.html` must return empty after the migration. Note this grep target list omits `frontend/public/index.html` because that file will no longer exist (moved to `frontend/index.html`) — do not leave a stale `public/index.html` behind (delete it, see §2.4).

Also delete `frontend/src/react-app-env.d.ts` (contains only `/// <reference types="react-scripts" />` — a dangling reference to a removed package that would break `tsc`). It is superseded by the new `frontend/env.d.ts` (§2.3).

### 0.2 Test file inventory — 53 files (not 51)

`Glob frontend/src/**/*.test.*` returns **53 files** on this branch (proposal said 51; PR #85's CJ connection UI added `CjConnectionModal.test.tsx`, `CjConnectionPanel.test.tsx`, and CJ additions to `CjCatalogPage.test.tsx`/`cjConnectionService.test.ts` account for the +2 file delta versus the design doc's baseline; the design doc's own body text says "51 test files, 271 tests" but tasks.md already flags this as stale and mandates a fresh count at step 0.4).

Full list (53):
```
src/App.test.tsx
src/components/__tests__/Layout.test.tsx
src/components/admin/__tests__/CjConnectionModal.test.tsx
src/components/admin/__tests__/CjConnectionPanel.test.tsx
src/components/admin/__tests__/CustomerAddressFormModal.test.tsx
src/components/admin/__tests__/CustomerFormModal.test.tsx
src/components/admin/__tests__/ImageManager.test.tsx
src/components/admin/__tests__/OrderStatusControl.test.tsx
src/components/admin/__tests__/ProductFilters.test.tsx
src/components/admin/__tests__/ProductFormModal.test.tsx
src/components/admin/__tests__/RequireAdminAuth.test.tsx
src/components/admin/__tests__/StatusBadge.test.tsx
src/components/admin/__tests__/SupplierFormModal.test.tsx
src/components/admin/__tests__/SupplierOrderStatusControl.test.tsx
src/components/admin/__tests__/VariantTable.test.tsx
src/components/storefront/LanguageSwitcher.test.tsx
src/components/storefront/Pagination.test.tsx
src/components/storefront/PriceTag.test.tsx
src/components/storefront/ProductCard.test.tsx
src/components/storefront/ProductGallery.test.tsx
src/components/storefront/ProductReviews.test.tsx
src/components/storefront/ReviewForm.test.tsx
src/components/storefront/Seo.test.tsx
src/components/storefront/VariantSelector.test.tsx
src/components/storefront/__tests__/CookieConsentBanner.test.tsx
src/components/storefront/__tests__/CookiePreferencesModal.test.tsx
src/components/storefront/__tests__/PaymentForm.test.tsx
src/components/storefront/__tests__/StorefrontFooter.test.tsx
src/contexts/__tests__/CookieConsentContext.test.tsx
src/pages/__tests__/CjCatalogPage.test.tsx
src/pages/__tests__/CustomerOrderDetailPage.test.tsx
src/pages/__tests__/CustomerOrdersPage.test.tsx
src/pages/__tests__/CustomersPage.test.tsx
src/pages/__tests__/ProductDetailPage.test.tsx
src/pages/__tests__/ProductsPage.test.tsx
src/pages/__tests__/ShipmentDetailPage.test.tsx
src/pages/__tests__/ShipmentsPage.test.tsx
src/pages/__tests__/SuppliersPage.test.tsx
src/pages/storefront/__tests__/AccountOrderDetailPage.test.tsx
src/pages/storefront/__tests__/AccountOrdersPage.test.tsx
src/pages/storefront/__tests__/AccountPage.test.tsx
src/pages/storefront/__tests__/CartPage.test.tsx
src/pages/storefront/__tests__/CatalogPage.test.tsx
src/pages/storefront/__tests__/ContentPage.test.tsx
src/pages/storefront/__tests__/LoginPage.test.tsx
src/pages/storefront/__tests__/OrderConfirmationPage.test.tsx
src/pages/storefront/__tests__/ProductPage.test.tsx
src/services/__tests__/adminProductService.test.ts
src/services/__tests__/cjCatalogService.test.ts
src/services/__tests__/cjConnectionService.test.ts
src/services/__tests__/customerOrderService.test.ts
src/services/__tests__/productService.test.ts
src/services/__tests__/supplierOrderService.test.ts
```

### 0.3 Current total test count (statically derivable, with a caveat)

Static count of literal `it(`/`test(` call sites across the 53 files: **282**, across 52 of the 53 files (`StatusBadge.test.tsx` contributes 0 to this count — see below).

This is **not** the true runtime test count: 5 files use `it.each([...])(...)`, which the static grep for `it(`/`test(` does **not** match (the call site is literally `it.each(` not `it(`), but which Jest/Vitest expand into one test per array row at runtime:

| File | `it.each` blocks | Rows (→ tests emitted) |
|---|---|---|
| `src/components/admin/__tests__/StatusBadge.test.tsx` | 1 | 5 |
| `src/services/__tests__/cjConnectionService.test.ts` | 2 | 3 + 4 = 7 |
| `src/services/__tests__/cjCatalogService.test.ts` | 2 | 9 |
| `src/services/__tests__/adminProductService.test.ts` | 1 | 8 |

Sum of `it.each` row expansions: **29** additional runtime tests not present in the 282 static count.

**Estimated true baseline: 282 + 29 = 311 tests.** No `.skip`/`.todo`/`.only` found anywhere (`grep -rn "\.skip\(|\.todo\(" frontend/src --include="*.test.*"` → empty), so none are excluded from a normal run.

This 311 is an estimate from static analysis, not a substitute for tasks.md step 0.4. The agent executing step 0.4 MUST run `npx react-scripts test --watchAll=false` (or equivalent CRA invocation) once before touching any tooling and record the exact number CI would report — that run is the authoritative parity gate for step 5.4/8.2, not this estimate. Flag to the implementing agent: if the observed count differs materially from 311, that's expected only if it deviates by roughly the `it.each` math above; a large unexplained gap means something in this recount was missed and should be re-verified.

### 0.4 `jest.*` API usage classification (53 test files + `setupTests.ts`)

| API | Files using it | Notes |
|---|---|---|
| `jest.fn()` | ~50 of 53 files (near-universal) | Mechanical: `jest.fn` → `vi.fn`. |
| `jest.mock(...)` | 35 files (listed in §3.2) | Mechanical: `jest.mock` → `vi.mock`. Hoisting behavior differs from `globalThis.jest = vi` shims — **must** be a real rename, not an alias (see §3.1). |
| `jest.spyOn` | **0 files** | Not used anywhere in this codebase — nothing to convert for this API. |
| `jest.useFakeTimers` / `jest.useRealTimers` / `jest.advanceTimersByTime` | `src/pages/__tests__/SuppliersPage.test.tsx` (L92,97,104), `src/pages/__tests__/CustomersPage.test.tsx` (L107,112,119), `src/pages/__tests__/CustomerOrdersPage.test.tsx` (L73,81,89) | All 3 are debounced-search tests (400–500ms). Mechanical: `jest.useFakeTimers` → `vi.useFakeTimers`, etc. Vitest's fake timer semantics (sinon-based, via `@sinonjs/fake-timers`) are close enough to Jest's for `advanceTimersByTime`; no behavioral rewrite expected, but these 3 files are the highest-risk group for timing flakiness post-migration and should be run individually (`npx vitest run SuppliersPage`) rather than trusted from a full-suite pass alone. |
| `jest.clearAllMocks()` | 30 files (listed in §3.2, subset of the `jest.mock` list plus `CustomerOrderDetailPage.test.tsx`/`ImageManager.test.tsx`/etc.) | Mechanical: `jest.clearAllMocks` → `vi.clearAllMocks`. |
| `jest.resetModules()` | `src/services/__tests__/productService.test.ts` (L25) | Mechanical: `jest.resetModules` → `vi.resetModules`. This file also does `jest.mock('../../i18n', ...)` — verify after the codemod since it mixes `resetModules` with a hard mock of a singleton module; run it individually. |
| `jest.requireActual(...)` | 13 files: `SuppliersPage.test.tsx`, `ShipmentsPage.test.tsx`, `ShipmentDetailPage.test.tsx`, `ProductDetailPage.test.tsx`, `CustomersPage.test.tsx`, `CjCatalogPage.test.tsx`, `ReviewForm.test.tsx`, `SupplierFormModal.test.tsx`, `ProductFormModal.test.tsx`, `CustomerFormModal.test.tsx`, `CustomerAddressFormModal.test.tsx`, `CjConnectionPanel.test.tsx`, `CjConnectionModal.test.tsx` | **Manual, not mechanical** — `jest.requireActual` is synchronous, `vi.importActual` is async (`Promise<T>`). Every call site and its enclosing factory must become `async () => { const actual = await vi.importActual(...); return {...actual, ...}; }`. See §3.3 for the exact per-pattern rewrite (two distinct shapes appear: top-level factory functions, and inline `...jest.requireActual(...)` spreads). |
| `jest.Mock` / `jest.Mocked<T>` (type-only usage) | 21 files: `supplierOrderService.test.ts`, `productService.test.ts`, `customerOrderService.test.ts`, `cjConnectionService.test.ts`, `cjCatalogService.test.ts`, `adminProductService.test.ts`, `CatalogPage.test.tsx`, `SuppliersPage.test.tsx`, `ProductsPage.test.tsx`, `ProductDetailPage.test.tsx`, `CustomersPage.test.tsx`, `CustomerOrdersPage.test.tsx`, `CustomerOrderDetailPage.test.tsx`, `ReviewForm.test.tsx`, `VariantTable.test.tsx`, `SupplierFormModal.test.tsx`, `ProductFormModal.test.tsx`, `ImageManager.test.tsx`, `CustomerFormModal.test.tsx`, `CustomerAddressFormModal.test.tsx`, `Layout.test.tsx` | Mechanical but needs an added import: `jest.Mock` → `Mock` and `jest.Mocked<T>` → `Mocked<T>`, both imported from `'vitest'` (`import { vi, type Mock, type Mocked } from 'vitest';` or split into a type-only import per file's existing import style). |
| `setupTests.ts` | 1 file (not a `.test.*` file, excluded from the 53 count above) | `window.matchMedia` mock uses `jest.fn()` 5 times (addListener/removeListener/addEventListener/removeEventListener/dispatchEvent) — mechanical rename, plus add `import { vi } from 'vitest';` at the top. Keep the `@testing-library/jest-dom` import and the `TextEncoder`/`TextDecoder` polyfill untouched. |

None of the 53 files use `jest.spyOn`, so the design.md risk item about spy conversion doesn't apply here — no file needs that particular manual check.

---

## 1. `frontend/vite.config.ts` (new file) — full proposed content

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'build',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
  },
});
```

Notes:
- `path.resolve(__dirname, './src')` (not a bare `'/src'` string) — `vite.config.ts` runs under Node with CommonJS-style `__dirname` available even though `"type"` isn't `module` in `frontend/package.json` (Vite's config loader handles this transparently); using `path.resolve` avoids any ambiguity between POSIX `/src` interpretation and Windows absolute-path resolution, which matters since this repo is developed on Windows.
- `server.proxy['/api'].target` reads `process.env.BACKEND_URL` — this executes in `vite.config.ts`'s Node context at dev-server-start time, so it correctly stays `process.env.*` (Vite's `import.meta.env` client-exposure rule applies only to code bundled for the browser, not to the config file itself). This exactly reproduces `setupProxy.js`'s current behavior.
- No `envPrefix` override needed — Vite's default `VITE_` prefix is exactly what design.md decided on.
- `test.alias` is intentionally omitted: Vitest inherits `resolve.alias` from the top-level Vite config automatically (both `vite.config.ts`'s `resolve` and `test` sections are merged into one resolved config), so a duplicate `test: { alias: {...} } }` block would be redundant. Confirm this holds during step 4/5 (§4 verification) — if `@/...` imports fail to resolve inside Vitest specifically, add `test.alias` mirroring `resolve.alias` as a fallback, but do not add it preemptively.
- `test.css: true` processes CSS during tests (several storefront components import `.css` files at module scope, e.g. `styles/storefront.css` imported transitively) — needed for parity with CRA's Jest config, which used `identity-obj-proxy`-free real CSS processing via `react-scripts`' Jest transform.

---

## 2. `frontend/tsconfig.node.json` (new file) — full proposed content

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

Referenced from `frontend/tsconfig.json` via a top-level `"references"` array (see §5). This mirrors the standard Vite scaffold split (`tsconfig.json` for `src/`, `tsconfig.node.json` for the Node-context config file) so `vite.config.ts`'s use of `process.env`/`path`/`__dirname` type-checks against Node types without polluting `src/`'s browser-context `tsconfig.json` (which intentionally does not include `"node"` broadly — it only needs `@types/node` for a couple of ambient globals already declared via the existing `"types": ["cypress", "node"]`, but `vite.config.ts` itself is not inside `include: ["src"]` so it needs its own project).

---

## 3. `frontend/env.d.ts` (new file, at `frontend/` root, NOT inside `src/`) — full proposed content

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Delete `frontend/src/react-app-env.d.ts` in the same step (§0.1) — its sole content, `/// <reference types="react-scripts" />`, references a package that no longer exists once `react-scripts` is removed and would fail `tsc --noEmit` with "Cannot find type definition file for 'react-scripts'".

---

## 4. `frontend/index.html` (moved from `frontend/public/index.html`) — full proposed content

Current `frontend/public/index.html` (46 lines) has 3 `%PUBLIC_URL%` placeholders (favicon href, apple-touch-icon href, manifest href), no existing `<script>` tag (CRA injects the bundle automatically), and no static `<meta name="description">` (already removed per `docs/frontend-standards.md`'s SEO section — confirmed, do not re-add it).

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0D1B2A" />
    <link rel="apple-touch-icon" href="/favicon.svg" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"
      rel="stylesheet"
    />
    <title>Mavile</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

Steps:
1. `git mv frontend/public/index.html frontend/index.html` (preserves history) — then edit in place per the diff above (strip the 3 CRA comment blocks explaining `%PUBLIC_URL%`/eject, since they're no longer accurate; strip `%PUBLIC_URL%` prefixes; add the module script tag before `</body>`).
2. The rest of `frontend/public/` (favicon.ico, favicon.svg, logo192.png, logo512.png, manifest.json, mavile-icon.*, mavile-logo.*, mavile-monogram.svg, robots.txt) stays in `frontend/public/` unchanged — Vite serves the `public/` directory at the site root by convention (no config needed), so `/favicon.svg`, `/manifest.json`, etc. resolve identically to how CRA served them.
3. `lang="es"`, `theme-color`, Google Fonts preconnect/stylesheet links, and `<div id="root">` are preserved verbatim as required by design.md decision 9.

---

## 5. `frontend/package.json` — exact diff

```diff
   "dependencies": {
     "@stripe/react-stripe-js": "^6.6.0",
     "@stripe/stripe-js": "^9.8.0",
     "@testing-library/dom": "^10.4.1",
     "@testing-library/jest-dom": "^6.9.1",
     "@testing-library/react": "^16.3.2",
     "@testing-library/user-event": "^13.5.0",
-    "@types/jest": "^27.5.2",
     "@types/node": "^22.15.29",
     "@types/react": "^19.2.17",
     "@types/react-dom": "^19.2.3",
     "axios": "^1.18.0",
     "bootstrap": "^5.3.8",
     "i18next": "^23.16.8",
     "i18next-browser-languagedetector": "^7.2.2",
     "qrcode.react": "^4.2.0",
     "react": "^19.2.7",
     "react-beautiful-dnd": "^13.1.1",
     "react-bootstrap": "^2.10.10",
     "react-bootstrap-icons": "^1.11.6",
     "react-datepicker": "^6.9.0",
     "react-dom": "^19.2.7",
     "react-helmet-async": "^3.0.0",
     "react-i18next": "^14.1.3",
     "react-router-dom": "^7.18.0",
-    "react-scripts": "5.0.1",
     "typescript": "^5.8.3",
     "web-vitals": "^2.1.4"
   },
   "scripts": {
-    "start": "react-scripts start",
-    "build": "react-scripts build",
-    "test": "react-scripts test",
-    "eject": "react-scripts eject",
+    "start": "vite",
+    "dev": "vite",
+    "build": "vite build",
+    "test": "vitest run",
+    "test:watch": "vitest",
     "cypress:open": "cypress open",
     "cypress:run": "cypress run"
   },
   "eslintConfig": {
     "extends": [
       "react-app",
       "react-app/jest"
     ],
     "overrides": [
       {
         "files": [
           "**/*.test.ts",
           "**/*.test.tsx"
         ],
         "rules": {
           "testing-library/no-container": "off",
           "testing-library/no-node-access": "off"
         }
       }
     ]
   },
   "browserslist": {
     "production": [
       ">0.2%",
       "not dead",
       "not op_mini all"
     ],
     "development": [
       "last 1 chrome version",
       "last 1 firefox version",
       "last 1 safari version"
     ]
   },
   "devDependencies": {
     "@types/react-beautiful-dnd": "^13.1.8",
-    "cypress": "^15.17.0"
+    "cypress": "^15.17.0",
+    "@vitejs/plugin-react": "^4.3.4",
+    "eslint-config-react-app": "^7.0.1",
+    "jsdom": "^25.0.1",
+    "vite": "^6.3.5",
+    "vitest": "^3.1.4"
   },
-  "jest": {
-    "moduleNameMapper": {
-      "^react-router-dom$": "<rootDir>/node_modules/react-router-dom/dist/index.js",
-      "^react-router/dom$": "<rootDir>/node_modules/react-router/dist/development/dom-export.js",
-      "^react-router$": "<rootDir>/node_modules/react-router/dist/development/index.js"
-    }
-  },
   "proxy": "http://localhost:3000"
 }
```

Wait — the trailing `"proxy"` field must also be deleted; shown separately below because it's the last key and easy to miss when diffing the `"jest"` block above it:

```diff
-  },
-  "proxy": "http://localhost:3000"
+  }
 }
```

Notes:
- `eslintConfig` block is **kept byte-for-byte** — design.md decision 7 and the CI gotcha in the session file both require `eslint-config-react-app` to resolve identically; making it a direct `devDependency` (rather than transitive via `react-scripts`) is the only change needed for `npx eslint src --ext .ts,.tsx` to keep working. Do not touch `extends`/`overrides`.
- `browserslist` block is **kept** — it's still consumed by `@vitejs/plugin-react`'s underlying esbuild/PostCSS/autoprefixer target resolution when present (design.md's open question #2). No evidence found in this repo that removing it is required; leaving it in place is zero-risk and avoids an unnecessary decision at implementation time.
- Version numbers above (`vite@^6.3.5`, `vitest@^3.1.4`, `@vitejs/plugin-react@^4.3.4`, `jsdom@^25.0.1`, `eslint-config-react-app@^7.0.1`) are reasonable current majors compatible with React 19 / TS 5.8 as of this plan's writing — the implementing agent should let `npm install` resolve to whatever is actually latest-compatible at install time rather than hand-pinning; treat these as starting points, not requirements. Vitest major **must** track the Vite major installed (Vitest 3.x ↔ Vite 5/6) to avoid a peer-resolution mismatch.
- `npm ci`/`npm install` in this repo already requires `--legacy-peer-deps` (see Dockerfile, CI workflows) due to React 19 — this continues to apply; do not drop the flag anywhere it's currently used.

---

## 6. jest → vi codemod

### 6.1 Codemod script

A single Node script (not sed/PowerShell — more reliable for multi-pattern, cross-platform, and it can report which files it touched) run once against all 53 test files plus `setupTests.ts`:

```js
// scripts/codemod-jest-to-vi.mjs — run with: node scripts/codemod-jest-to-vi.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs'; // Node 22+ has fs.globSync; if unavailable, use fast-glob or a manual walk

const files = [
  ...globSync('src/**/*.test.{ts,tsx}'),
  'src/setupTests.ts',
];

// Order matters: longer/more-specific patterns before shorter ones sharing a prefix.
const mechanicalReplacements = [
  [/\bjest\.clearAllMocks\b/g, 'vi.clearAllMocks'],
  [/\bjest\.resetModules\b/g, 'vi.resetModules'],
  [/\bjest\.useFakeTimers\b/g, 'vi.useFakeTimers'],
  [/\bjest\.useRealTimers\b/g, 'vi.useRealTimers'],
  [/\bjest\.advanceTimersByTime\b/g, 'vi.advanceTimersByTime'],
  [/\bjest\.mock\b/g, 'vi.mock'],
  [/\bjest\.fn\b/g, 'vi.fn'],
  [/\bjest\.Mocked\b/g, 'Mocked'],
  [/\bjest\.Mock\b/g, 'Mock'],
  // jest.requireActual is intentionally NOT included here — handled manually, see §6.3
];

let changedCount = 0;
for (const file of files) {
  const original = readFileSync(file, 'utf8');
  if (!/\bjest\./.test(original)) continue;

  let updated = original;
  for (const [pattern, replacement] of mechanicalReplacements) {
    updated = updated.replace(pattern, replacement);
  }

  const usesVi = /\bvi\./.test(updated);
  const alreadyImportsVi = /from ['"]vitest['"]/.test(updated) && /\bvi\b/.test(updated.match(/import[^;]*from ['"]vitest['"];?/)?.[0] ?? '');
  const needsMockType = /\bMocked?\b/.test(updated) && !/type Mock/.test(updated);

  if (usesVi && !alreadyImportsVi) {
    const importLine = needsMockType
      ? "import { vi, type Mock, type Mocked } from 'vitest';\n"
      : "import { vi } from 'vitest';\n";
    // Insert after the last top-of-file import statement (or at the very top if none).
    const lastImportMatch = [...updated.matchAll(/^import .+;\s*$/gm)].pop();
    updated = lastImportMatch
      ? updated.slice(0, lastImportMatch.index + lastImportMatch[0].length) + '\n' + importLine + updated.slice(lastImportMatch.index + lastImportMatch[0].length)
      : importLine + updated;
  }

  if (updated !== original) {
    writeFileSync(file, updated, 'utf8');
    changedCount++;
    console.log(`updated: ${file}`);
  }
}
console.log(`\n${changedCount} files updated.`);
console.log('Remaining manual work: jest.requireActual (13 files, see plan §6.3), review import placement/dedup.');
```

Run: `cd frontend && node scripts/codemod-jest-to-vi.mjs`, then delete the script (or leave it under `scripts/` — it's a one-time migration tool, not part of the ongoing build; recommend deleting after a successful run so it isn't mistaken for live tooling).

**Caveats the implementing agent must handle by hand after running the script:**
1. **Import de-duplication.** If a test file already has some other `from 'vitest'` import (unlikely today since none exist yet, but double-check), the naive "insert after last import" step could create two `from 'vitest'` import lines — merge them manually.
2. **`jest.Mocked<typeof x>` vs `jest.Mock`** — both become bare `Mocked<typeof x>` / `Mock` after the regex pass, which is correct, but only if the file's added import actually includes `type Mocked`/`type Mock`. The script's `needsMockType` check handles this, but verify by running `tsc --noEmit` (§8) — a missed import shows up immediately as "Cannot find name 'Mocked'".
3. **`jest.requireActual`** is excluded from the automated pass — see §6.3, it's async-only and requires restructuring, not a straight rename.

### 6.2 Files needing manual attention beyond the codemod

| File | Why manual |
|---|---|
| `src/setupTests.ts` | Not matched by the `src/**/*.test.{ts,tsx}` glob (it's `setupTests.ts`, no `.test.` in the name) — the script above explicitly appends it to the file list; confirm the diff by hand since it's the one file every other test depends on transitively via `setupFiles`. |
| `src/pages/__tests__/CjCatalogPage.test.tsx` | Contains **both** `jest.mock(...)` factories that return an object mixing mocked functions with `jest.requireActual(...)` results (lines ~24-38, spread across 2 separate `jest.mock` calls for `cjCatalogService` and `cjConnectionService`) — highest concentration of `requireActual` call sites in the suite (4 in one file). Do this one first as the reference pattern for the rest. |
| `src/pages/__tests__/SuppliersPage.test.tsx`, `src/pages/__tests__/CustomersPage.test.tsx`, `src/pages/__tests__/CustomerOrdersPage.test.tsx` | Combine `jest.requireActual` (in the mock factory) **and** fake timers (debounce tests) — verify both concerns independently after conversion; run these 3 files in isolation (`npx vitest run <file>`) before trusting a full-suite green. |
| `src/services/__tests__/productService.test.ts` | Combines `jest.resetModules()` with `jest.mock('../../i18n', ...)` — `vi.resetModules()` combined with a mocked singleton module has different re-import semantics under Vitest's module runner than under Jest's; run in isolation and diff behavior if it fails. |
| The other 9 `requireActual` files (`ShipmentsPage.test.tsx`, `ShipmentDetailPage.test.tsx`, `ProductDetailPage.test.tsx`, `ReviewForm.test.tsx`, `SupplierFormModal.test.tsx`, `ProductFormModal.test.tsx`, `CustomerFormModal.test.tsx`, `CustomerAddressFormModal.test.tsx`, `CjConnectionPanel.test.tsx`, `CjConnectionModal.test.tsx` — that's 10, listed fully in §0.4's table) | Each has exactly 1 `jest.requireActual` call site inside a single mock factory — apply the pattern from §6.3 mechanically per file, but each still needs individual review since the factory shape (inline object literal vs. top-level `const actual = ...`) differs slightly per file. |

### 6.3 `jest.requireActual` → `vi.importActual` — exact rewrite patterns

Two shapes appear in this codebase. Both require the enclosing `jest.mock(...)` factory to become `async () => {...}` because `vi.importActual` returns a `Promise`.

**Pattern A — top-level `const actual = jest.requireActual(...)` inside the factory** (e.g. `SuppliersPage.test.tsx`, `CustomersPage.test.tsx`, `SupplierFormModal.test.tsx`, `CustomerFormModal.test.tsx`, `CustomerAddressFormModal.test.tsx`, `ProductDetailPage.test.tsx`, `ProductFormModal.test.tsx`):

```diff
-jest.mock('../../services/supplierService', () => {
-  const actual = jest.requireActual('../../services/supplierService');
+vi.mock('../../services/supplierService', async () => {
+  const actual = await vi.importActual('../../services/supplierService');
   return {
     ...actual,
     supplierService: {
-      list: jest.fn(),
+      list: vi.fn(),
       ...
     },
   };
 });
```

**Pattern B — inline spread/property using `jest.requireActual(...)` directly** (e.g. `CjCatalogPage.test.tsx`, `CjConnectionPanel.test.tsx`, `CjConnectionModal.test.tsx`, `ReviewForm.test.tsx`):

```diff
-jest.mock('../../services/cjCatalogService', () => ({
+vi.mock('../../services/cjCatalogService', async () => ({
   cjCatalogService: { listCatalog: mockListCatalog, promote: mockPromote, ... },
-  extractCjCatalogErrorMessage: jest.requireActual('../../services/cjCatalogService').extractCjCatalogErrorMessage,
-  mapCjCatalogError: jest.requireActual('../../services/cjCatalogService').mapCjCatalogError,
+  extractCjCatalogErrorMessage: (await vi.importActual('../../services/cjCatalogService')).extractCjCatalogErrorMessage,
+  mapCjCatalogError: (await vi.importActual('../../services/cjCatalogService')).mapCjCatalogError,
 }));
```

Note the factory arrow function itself becomes `async () => ({...})` (not just adding `await` inline) — an object literal returned from a non-async arrow function cannot contain a bare `await` expression; the `async` keyword must move to the factory's own signature. If a file calls `jest.requireActual` more than once with the same module path inside one factory (true for `CjCatalogPage.test.tsx` and `CjConnectionPanel.test.tsx`/`CjConnectionModal.test.tsx`), prefer hoisting a single `const actual = await vi.importActual(...)` at the top of the async factory and referencing `actual.x` for each property, rather than repeating the `await vi.importActual(...)` call — cheaper and reads better (equivalent to converting inline Pattern B into Pattern A's shape once there's more than one property to pull from the real module).

**Special case — `CustomersPage.test.tsx` line 65:** `const axios = jest.requireActual('axios');` appears **outside** any `jest.mock` factory, inside a test body (used to build a fresh unmocked axios instance for one specific assertion, separate from the globally mocked axios). This one becomes:

```diff
-  const axios = jest.requireActual('axios');
+  const axios = await vi.importActual('axios');
```

— and the enclosing `it(...)`/`test(...)` callback must be `async` (check it already is, since the test almost certainly already awaits other calls; if not, add `async`).

**Special case — `ShipmentsPage.test.tsx` and `ShipmentDetailPage.test.tsx`:** both have `jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }))`. Same Pattern A/B hybrid — becomes:

```diff
-jest.mock('react-router-dom', () => ({
-  ...jest.requireActual('react-router-dom'),
+vi.mock('react-router-dom', async () => ({
+  ...(await vi.importActual('react-router-dom')),
   useNavigate: () => mockNavigate,
 }));
```

---

## 7. `package.json`'s `jest.moduleNameMapper` react-router aliases — needed under Vitest? **No, do not port them.**

Inspection performed: `node_modules/react-router-dom/package.json`'s `exports` field:
```json
"exports": {
  ".": {
    "node": { "types": "...", "module-sync": "./dist/index.mjs", "default": "./dist/index.js" },
    "import": {...}, "default": {...}
  }
}
```
This is a proper conditional-exports map with `import`/`module-sync`/`default` conditions and a real ESM build (`dist/index.mjs`). The three `moduleNameMapper` entries in the current `package.json`'s `jest` block force `react-router-dom`, `react-router/dom`, and `react-router` to resolve to specific `dist/` files:

```json
"^react-router-dom$": "<rootDir>/node_modules/react-router-dom/dist/index.js",
"^react-router/dom$": "<rootDir>/node_modules/react-router/dist/development/dom-export.js",
"^react-router$": "<rootDir>/node_modules/react-router/dist/development/index.js"
```

**Why these exist today:** `setupTests.ts` has a comment "react-router v7 requires TextEncoder/TextDecoder (not available in jsdom/jest 27)" — this is the same underlying issue: Jest 27 (bundled inside `react-scripts@5.0.1`, itself pinned to an old `jest-resolve`) predates good support for package.json `exports` maps and/or dual ESM/CJS packages, and historically has had trouble correctly picking the right conditional-export branch for ESM-first packages like React Router v7, causing either a resolution failure or resolving to a build that assumes browser globals Jest's CJS test environment doesn't provide. The aliases were a workaround pinning Jest to a specific, known-working file.

**Why Vitest doesn't need this:** Vitest doesn't use `jest-resolve` at all — it resolves imports through **Vite's own resolver** (esbuild/Rollup-based, native ESM), which correctly and natively understands package.json `exports` maps, including dual-condition packages, without any special-casing. This is precisely the class of problem Vite's resolver was built to solve well (unlike Jest's, which is a much older, CJS-oriented resolution algorithm retrofitted for ESM). There is no equivalent "old resolver" reason for the alias to exist under Vitest.

**Recommendation:** Delete the whole `package.json` `"jest"` block (§5 diff already does this) and do **not** port the three `moduleNameMapper` entries into `vite.config.ts`'s `resolve.alias`. Verify this holds during §8's test run — if `npx vitest run` throws a resolution error naming `react-router-dom`/`react-router`, add back only the specific alias that fails, scoped in `vite.config.ts`'s top-level `resolve.alias` (which Vitest inherits, per §1's note) — do not add all three speculatively.

---

## 8. `frontend/tsconfig.json` — exact edits

Current file is 32 lines (already read in full — see below). Required changes: add `"vite/client"` to `types`, add a `"references"` array pointing at the new `tsconfig.node.json`. Everything else (`target`, `lib`, `strict`, `paths`, `isolatedModules`, `noEmit`, `jsx`) stays as-is per design.md decision — this migration does not touch language-level TS settings.

```diff
 {
   "compilerOptions": {
     "target": "es5",
     "lib": [
       "dom",
       "dom.iterable",
       "esnext"
     ],
     "allowJs": true,
     "skipLibCheck": true,
     "esModuleInterop": true,
     "allowSyntheticDefaultImports": true,
     "strict": true,
     "forceConsistentCasingInFileNames": true,
     "noFallthroughCasesInSwitch": true,
     "module": "esnext",
     "moduleResolution": "node",
     "resolveJsonModule": true,
     "isolatedModules": true,
     "noEmit": true,
     "jsx": "react-jsx",
     "baseUrl": ".",
     "paths": {
       "@/*": ["src/*"]
     },
-    "types": ["cypress", "node"]
+    "types": ["cypress", "node", "vite/client"]
   },
   "include": [
     "src"
-  ]
+  ],
+  "references": [
+    { "path": "./tsconfig.node.json" }
+  ]
 }
```

Do not change `target: "es5"` or `moduleResolution: "node"` — out of scope per design.md non-goals ("no TS upgrades"); Vite doesn't care what `target`/`moduleResolution` `tsconfig.json` declares since it uses esbuild for transpilation independent of `tsc`'s settings (`tsc --noEmit` is only used for type-checking in this project, per CI's `frontend-quality` job, never for emitting JS).

---

## 9. `frontend/Dockerfile` — exact edits

Current (11 lines, read in full above): copies only `package*.json`, `tsconfig.json`, `src`, `public`; exposes `3001`; runs `npm start`.

```diff
 FROM node:20-alpine
 WORKDIR /app
 COPY package*.json ./
 COPY tsconfig.json ./
+COPY tsconfig.node.json ./
+COPY vite.config.ts ./
+COPY env.d.ts ./
+COPY index.html ./
 RUN npm ci --legacy-peer-deps
 COPY src ./src
 COPY public ./public
 RUN chown -R node:node /app
 EXPOSE 3001
 USER node
 CMD ["npm", "start"]
```

`EXPOSE 3001` already matches `vite.config.ts`'s `server.port: 3001` — no change needed there. `CMD ["npm", "start"]` already resolves to whatever `"start"` maps to in `package.json`'s `scripts` — since §5 changes `"start"` from `react-scripts start` to `vite`, this line needs no edit, it automatically picks up the new script. One caveat: Vite's dev server by default binds to `localhost` only; inside a Docker container this means it won't be reachable from the host unless bound to `0.0.0.0`. Check whether the current `docker-compose.yml` (repo root) publishes the frontend container's port and whether CRA's dev server (which binds `0.0.0.0` by default) was relied upon for that — if so, add `host: true` (equivalent to `--host 0.0.0.0`) to `vite.config.ts`'s `server` block:

```diff
   server: {
     port: 3001,
+    host: true,
     proxy: { ... },
   },
```

This is flagged as **verify-before-deciding** rather than included unconditionally in §1's `vite.config.ts` content, because adding `host: true` unconditionally when it's not needed is harmless but the plan should not silently diverge from CRA's actual bind behavior without the implementing agent confirming via `docker-compose.yml` whether the frontend service is even proxied through Docker networking (inspect `docker-compose.yml`'s frontend service `ports`/`network_mode` before deciding — not inspected as part of this plan since it's outside `frontend/`, but must be checked during step 4/6 dev-server verification).

---

## 10. CI workflow edits

### 10.1 `.github/workflows/pr-extra-quality.yml` — `frontend-quality` job (lines 79-103)

```diff
       - name: Install dependencies
         run: npm ci --legacy-peer-deps
       - name: Run ESLint
         run: npx eslint src --ext .ts,.tsx
       - name: Run unit tests
-        run: npm test -- --watchAll=false
+        run: npm test
       - name: Run TypeScript check
         run: npx tsc --noEmit
```

`npm test` now runs `vitest run` (per §5's script change) — `vitest run` is already non-watch/CI mode by default (unlike `vitest` bare, which watches), so no extra flag is needed; `-- --watchAll=false` was CRA/Jest-specific and has no Vitest equivalent flag needed since the base behavior differs. Do not add `-- run` (`npm test -- run` would be redundant/wrong since `"test"` already resolves to `vitest run`, and Vitest CLI would then treat `run` as a spec-name filter, incorrectly narrowing the suite).

The ESLint and `tsc --noEmit` steps need **no changes** — confirmed since `frontend/package.json`'s `"eslintConfig"` block is preserved as-is (§5) and `eslint-config-react-app` becomes a direct dependency, so `npx eslint src --ext .ts,.tsx` continues to resolve identically; `npx tsc --noEmit` continues to type-check against the same `tsconfig.json` `include: ["src"]` (the new `vite.config.ts` type-checks separately via `tsconfig.node.json`'s reference, not part of this `tsc --noEmit` invocation — that's fine, this CI step's job is checking `src/`, and `vite.config.ts` correctness is exercised implicitly by `npm run build`/`npm run dev` actually working).

### 10.2 `.github/workflows/deploy.yml` — frontend build step (lines 66-70)

```diff
-      - name: Build frontend (CRA production build)
+      - name: Build frontend (Vite production build)
         working-directory: frontend
         env:
-          REACT_APP_API_BASE_URL: ${{ secrets.REACT_APP_API_BASE_URL }}
+          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
         run: npm run build
```

The S3 sync step (line 78: `aws s3 sync frontend/build/ s3://...`) needs **no change** — `build.outDir: 'build'` in §1's `vite.config.ts` keeps the artifact path identical.

**Pre-merge blocker (task 7.3, not a file edit but must be flagged loudly):** this diff assumes a GitHub Actions secret named `VITE_API_BASE_URL` exists with the same value as the current `REACT_APP_API_BASE_URL` secret. It does not today. Before this PR is merged to `develop` and especially before any merge to `master` triggers `deploy.yml`, someone with repo admin access must run (or the implementing agent must run, if it has `gh` access with sufficient scope):
```bash
gh secret set VITE_API_BASE_URL --body "<same value as existing REACT_APP_API_BASE_URL>"
```
Keep the old `REACT_APP_API_BASE_URL` secret in place until the first green production deploy under the new name, per design.md's rollback plan (if `master` needs an emergency revert before the secret exists, the revert restores the old workflow file referencing the old secret, so keeping both is what makes that revert path actually work).

---

## 11. Ordered verification commands

Run from `frontend/` unless noted. This order is chosen so cheap/fast checks fail first and each step's success is a precondition understood by the next (e.g. don't chase test failures caused by a config typo `tsc` would have caught in 10 seconds).

1. **Install** (not run by this planning agent, but the first command the implementing agent runs): `npm install --legacy-peer-deps` (confirm clean install, no unresolved peer errors beyond what `--legacy-peer-deps` already tolerates).
2. **Type-check**: `npx tsc --noEmit` — catches `env.d.ts`/`tsconfig.json`/import-path mistakes before touching tests. Also effectively validates `tsconfig.node.json`'s reference is wired correctly (a broken reference surfaces here).
3. **Codemod + Vitest, iteratively**: run the codemod (§6.1), then `npx vitest run` repeatedly, fixing one failing file at a time — prioritize the 3 fake-timer files and the 13 `requireActual` files (§6.2/§6.3) first since they're the only ones needing hand-editing beyond the mechanical pass; everything else should pass on the first `vitest run` after the codemod. Track progress against the §0.3 baseline (311 estimated, confirm the true number from the mandatory pre-migration CRA/Jest run per tasks.md step 0.4) — 0 skipped, 0 deleted is the gate, not "close enough."
4. **Lint**: `npx eslint src --ext .ts,.tsx` — run only after tests are green, since a failing lint on a test file you haven't finished editing yet is noise.
5. **Production build**: `npm run build` — confirm it emits to `frontend/build/` (not `dist/`), then serve statically and manually click through: `npx serve build` (or equivalent), open the served URL, confirm the catalog page loads, a lazy-loaded storefront route (`CatalogPage`/`ProductPage`, per `App.tsx`'s `lazy(...)` calls found at `src/App.tsx:45-46`) navigates without a blank screen or console error, and Bootstrap CSS renders (no unstyled-flash/ordering regression — design.md's risk item on CSS order).
6. **Dev server + proxy parity** (tasks.md §4, AGENT MUST EXECUTE — not part of this planning agent's scope, but the next agent in the chain must run this): start backend (`docker compose` DB + API on `:3000`), `npm run dev` in `frontend/`, confirm Vite serves `:3001` with no compile errors, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/public/products` returns `200`, matching a direct `curl http://localhost:3000/api/public/products` call.
7. **Docker build** (tasks.md §6.3): `docker build` the `frontend/Dockerfile` (after §9's edits) and start the container, confirming it serves on `:3001` inside the container network — this is the first real check that `index.html`/`vite.config.ts`/`tsconfig.node.json`/`env.d.ts` are all actually copied in (a missed `COPY` line manifests as "vite: command not found" or a build failure referencing a missing config file).

---

## Summary of every file touched (for the implementing agent's task-tracking)

**Created:**
- `frontend/vite.config.ts` (§1)
- `frontend/tsconfig.node.json` (§2)
- `frontend/env.d.ts` (§3)
- `frontend/index.html` (§4, moved+edited from `frontend/public/index.html`)

**Deleted:**
- `frontend/public/index.html` (moved, see above)
- `frontend/src/setupProxy.js` (logic ported into `vite.config.ts`)
- `frontend/src/react-app-env.d.ts` (superseded by `frontend/env.d.ts`)

**Edited:**
- `frontend/package.json` (§5)
- `frontend/tsconfig.json` (§8)
- `frontend/Dockerfile` (§9)
- `frontend/src/setupTests.ts` (jest→vi, §0.4/§6.2)
- 21 runtime source files: 17 services + `OAuthButtons.tsx` + `Seo.tsx` + `ContentPage.tsx` + `TwoFactorSetupPage.tsx` (§0.1)
- 53 test files (jest→vi codemod + 13 manual `requireActual` fixes, §0.4/§6)
- `.github/workflows/pr-extra-quality.yml` (§10.1)
- `.github/workflows/deploy.yml` (§10.2)
- `frontend/.env.example` (rename `REACT_APP_*` → `VITE_*` in the documented/commented variable names; note there is **no** local `.env.development` file in this worktree to edit — it's gitignored and not present — so this migration cannot "rename" a file that doesn't exist locally; document in `.env.example`'s comments that a developer's own `.env.development` must use `VITE_*` names and drop the `PORT` line, since port now lives in `vite.config.ts`)
- Docs (task group 12, not detailed line-by-line in this plan since it's non-code): `docs/frontend-standards.md` (Technology Stack table, Environment Configuration section's `REACT_APP_*` list at lines 662-667, the "CRA vs. Vite" decision record at lines 1055-1064 — flip the decision to "migrated" and reference this change), `docs/development_guide.md` (5 hits found: lines 140-141 `.env` example, line 584 S3 bucket description, line 605 table row, line 625 manual-build example — all `REACT_APP_API_BASE_URL` → `VITE_API_BASE_URL`), `frontend/README.md` (currently pure CRA boilerplate, replace with Vite/Vitest instructions), `openspec/config.yaml` (line 19: "Create React App" → "Vite"; line 20: "Jest" → "Vitest" for the frontend half of that line, keep backend Jest mention).

**Not touched (confirmed no impact):** `docs/data-model.md`, `docs/api-spec.yml` (per design.md/tasks.md 12.5 — no entity/API surface changes), `frontend/cypress.config.ts` and all of `frontend/cypress/` (baseUrl already `:3001`, unaffected by the dev-server swap), `frontend/.dockerignore` (already excludes `node_modules`/`build`/`.env*`, still correct).
