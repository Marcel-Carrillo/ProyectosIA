## Context

The storefront already supports static content pages via the `ContentPage` component (`frontend/src/pages/storefront/ContentPage.tsx`). It renders any slug listed in `VALID_SLUGS` using content from the `pages` i18n namespace. The footer (`StorefrontFooter.tsx`) already links to `/pages/shipping`, `/pages/returns`, etc. using `common` namespace keys.

The two new pages (`/pages/privacy`, `/pages/legal`) fit this pattern exactly — no new components, no backend changes, no routing changes beyond adding two slugs.

## Goals / Non-Goals

**Goals:**
- Add `privacy` and `legal` to `VALID_SLUGS` in `ContentPage.tsx`.
- Add bilingual content for both pages in `es/pages.json` and `en/pages.json`.
- Add footer links in `StorefrontFooter.tsx` inside `storefront-footer__bottom-inner`.
- Add footer label keys to `es/common.json` and `en/common.json`.
- Update `docs/frontend-standards.md` to document the new slugs.

**Non-Goals:**
- New React components or routes.
- Backend, API, or database changes.
- Cookie consent / GDPR banner.
- Admin editing of legal text.
- Versioning or user acceptance tracking.

## Decisions

**Decision: Reuse `ContentPage` instead of dedicated components**
The existing `ContentPage` handles the full rendering lifecycle (slug guard, i18n lookup, sections loop, back link). Creating bespoke components for legal pages would duplicate this logic for no benefit.

**Decision: Place legal links in `storefront-footer__bottom-inner` (copyright bar)**
Legal links conventionally live next to the copyright notice. Adding a fifth column to the main grid for two links would unbalance the layout. Placing them inline with the copyright line follows standard ecommerce footer patterns (see Amazon, Zara, Mango) and requires no CSS changes.

**Decision: Use placeholder strings for business data**
Real company data (NIF, registered address, DPO contact) is unknown to the development team. Using `[COMPANY NAME]`, `[NIF]`, etc. as explicit placeholders makes incomplete data immediately visible in review/QA and prevents accidentally shipping empty fields or invented data.

**Decision: Sections body uses plain text (no HTML)**
`ContentPage` renders `section.body` inside a `<p>` tag. Multi-paragraph or list content could use `\n` separators and be split at render time, but the existing slugs (shipping, returns, etc.) use single-paragraph bodies. Legal text will follow the same pattern per section to avoid changing the component.

## Risks / Trade-offs

- **Legal risk → Mitigation**: Placeholder text is not real legal advice. Content MUST be reviewed by a lawyer and placeholders replaced before going live. A note in `frontend-standards.md` will document this requirement.
- **Symmetric i18n keys → Mitigation**: Both `es/pages.json` and `en/pages.json` must be updated together. Tests verify both locales render without falling back to key paths.
- **Section body length → Mitigation**: Privacy policies can be long. `ContentPage` renders each section as a single `<p>`; if the business requires multi-paragraph bodies in the future a component update will be needed. Out of scope here.

## Open Questions

- **Real business data**: Company name, NIF, registered address, DPO email, and data retention periods must be supplied by the business owner before production release. Development delivers the structure and placeholder content.
