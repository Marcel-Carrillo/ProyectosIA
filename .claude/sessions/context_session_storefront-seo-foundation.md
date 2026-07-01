# Context Session: storefront-seo-foundation

## Change location
`openspec/changes/storefront-seo-foundation/` — read `proposal.md`, `design.md`, `specs/storefront-seo/spec.md`, `tasks.md` in full before planning.

## Summary
Add foundational technical SEO to the storefront (CRA client-side-rendered React app): per-route `<title>`/meta description/canonical/Open Graph/Twitter via a shared `Seo` component (`react-helmet-async`), `Product` + `BreadcrumbList` JSON-LD on the product detail page, `noindex, nofollow` on all non-public routes (auth, cart, checkout, account, and all admin back-office pages — note: admin routes are NOT under a `/admin/*` prefix except `/admin/login`; the rest live at root paths like `/products`, `/categories`, `/customer-orders`, etc., guarded by `RequireAdminAuth` — verified directly in `frontend/src/App.tsx`), a rewritten `robots.txt`, a new dynamically-generated backend sitemap endpoint (`GET /api/public/sitemap.xml`), an `alt`-text audit on product images, and a fix to the static `lang` attribute in `index.html`.

Explicitly out of scope: SSR/SSG/prerendering migration, locale-segmented URLs/hreflang, slug-based PDP routing.

## Branch
`feature/storefront-seo-foundation` (created from `develop`).

## What each planning agent should produce
A per-file implementation plan saved to `.claude/doc/storefront-seo-foundation/<layer>.md`, listing concrete files to create/edit and the specific changes in each, following `docs/backend-standards.md` / `docs/frontend-standards.md` conventions. Agents plan only — the parent session implements, runs tests, and writes verification reports.
