# Context Session: legal-pages-frontend

## Change Summary
Add Privacy Policy (`/pages/privacy`) and Legal Notice (`/pages/legal`) static pages to the storefront.
Frontend-only change. No backend, API, or database changes.

## Artifacts
- Proposal: `openspec/changes/legal-pages-frontend/proposal.md`
- Design: `openspec/changes/legal-pages-frontend/design.md`
- Specs: `openspec/changes/legal-pages-frontend/specs/`
- Tasks: `openspec/changes/legal-pages-frontend/tasks.md`

## Key Files to Modify
- `frontend/src/pages/storefront/ContentPage.tsx` — add `'privacy'` and `'legal'` to `VALID_SLUGS`
- `frontend/src/i18n/locales/es/pages.json` — add `privacy` and `legal` keys (ES)
- `frontend/src/i18n/locales/en/pages.json` — add `privacy` and `legal` keys (EN)
- `frontend/src/i18n/locales/es/common.json` — add `footer.link.privacy` and `footer.link.legal`
- `frontend/src/i18n/locales/en/common.json` — same for EN
- `frontend/src/components/storefront/StorefrontFooter.tsx` — add legal links in bottom bar
- `docs/frontend-standards.md` — document new slugs

## Branch
`feature/legal-pages-frontend`
