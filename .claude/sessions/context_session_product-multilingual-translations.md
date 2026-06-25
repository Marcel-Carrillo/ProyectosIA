# Change Context: product-multilingual-translations

## Summary
Add multilingual translation support for product name and description (ES/EN). The storefront UI is already bilingual via i18next, but product data (name, description) is stored in English only.

## Artifacts
- Proposal: openspec/changes/product-multilingual-translations/proposal.md
- Design: openspec/changes/product-multilingual-translations/design.md
- Specs:
  - openspec/changes/product-multilingual-translations/specs/product-translations/spec.md
  - openspec/changes/product-multilingual-translations/specs/product-catalog/spec.md
  - openspec/changes/product-multilingual-translations/specs/public-catalog-api/spec.md
  - openspec/changes/product-multilingual-translations/specs/product-management/spec.md
  - openspec/changes/product-multilingual-translations/specs/admin-product-panel/spec.md
  - openspec/changes/product-multilingual-translations/specs/storefront-i18n/spec.md
- Tasks: openspec/changes/product-multilingual-translations/tasks.md

## Key Design Decisions
- Overlay approach: keep Product.name/description as EN fallback, add ProductTranslation table
- ProductTranslation: (productId, locale) unique, locale ∈ {en, es}, source ∈ {manual, import, machine}
- Locale resolution helper: resolveProductLocale(product, locale) — centralized, deterministic fallback
- Eager include translations in all product queries (no N+1)
- Vary: Accept-Language on all public product endpoints
- Frontend: Axios interceptor injects Accept-Language from i18n.language on public product service
- Re-fetch on language change: i18n.language as useEffect dependency

## Branch
feature/product-multilingual-translations (from develop)

## Tech Stack
Backend: Node.js, TypeScript, Express 4, Prisma 6, PostgreSQL
Frontend: React CRA, TypeScript, i18next (key: mavile.lang), Axios, React Bootstrap
Architecture: DDD, layered (Presentation→Application→Domain→Infrastructure), repository pattern
