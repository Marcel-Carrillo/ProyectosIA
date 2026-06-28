## Context

The storefront is a CRA React + TypeScript SPA. It already has:
- `StorefrontLayout` (header / `<Outlet>` / footer) wrapping all customer-facing routes in `App.tsx`
- A `storefront.css` BEM-like design system with existing `storefront-hero__*`, `storefront-catalog__*`, etc. patterns and CSS custom properties for spacing, color, typography, and motion
- `react-i18next` with per-namespace JSON files (`common`, `catalog`, `pages`) registered in `src/i18n/index.ts`
- A stubbed `reportWebVitals` call in `index.tsx` that should be gated behind analytics consent
- A privacy policy page at `/pages/privacy` that already references RGPD and promises a cookie management control

No backend endpoint, Prisma schema change, or API contract change is needed.

## Goals / Non-Goals

**Goals:**
- Deliver a compliant, accessible, brand-consistent cookie consent banner and preferences modal with three cookie categories (Necessary, Analytics, Marketing).
- Provide a reusable `CookieConsentProvider` / `useCookieConsent` hook as the single source of truth for consent state.
- Gate `reportWebVitals` behind analytics consent.
- Expose a footer "Cookie settings" entry to reopen the modal at any time.
- Add a `cookies` i18n namespace (es/en).

**Non-Goals:**
- Server-side consent logging or a `ConsentLog` entity.
- IAB TCF / CMP integration.
- A separate cookie policy page (existing `/pages/privacy` covers legal text for MVP).
- Real analytics/marketing vendor integration.
- Cross-device consent sync.

## Decisions

### 1. `localStorage` for persistence (not cookies)
Consent itself is stored in `localStorage` under `mavile.cookieConsent` rather than in a cookie, because the consent mechanism must not set non-necessary cookies before consent is given. The key contains `version` (to invalidate on policy change), `timestamp` (for expiry), and `categories`.

*Alternative considered:* Store in a `SameSite=Strict` HTTP-only cookie on the backend → rejected for MVP because it introduces a backend round-trip and a new endpoint, adding complexity disproportionate to the current scale.

### 2. React context for consent state (`CookieConsentContext`)
A `CookieConsentProvider` wraps the storefront subtree (inside `StorefrontLayout` or at the `App.tsx` storefront scope) and initialises from `localStorage` on mount. Components and future scripts read from `useCookieConsent()`. On any user action the context updates in memory and writes to `localStorage` atomically.

*Alternative considered:* Global `window` variable or event-based system → rejected because context integrates cleanly with React's re-render cycle and avoids manual subscription management.

### 3. Provider placement — `App.tsx` around the storefront route subtree
`CookieConsentProvider` is placed in `App.tsx` wrapping the `<Route element={<StorefrontLayout />}>` block (not globally around admin routes). This ensures consent state is available to the footer "Cookie settings" trigger and to `StorefrontLayout`-mounted banner, without leaking into admin screens.

*Alternative considered:* Inside `StorefrontLayout.tsx` → rejected because it would require passing the `openModal` callback from the layout into the footer via prop drilling or a separate context. Placing the provider at `App.tsx` allows the footer to call `useCookieConsent()` directly.

### 4. Banner is non-blocking; modal uses a portal
The banner is a fixed-position bar at the bottom of the viewport (`position: fixed; bottom: 0`). It does NOT use a full-screen overlay or `pointer-events: none` on the page — scrolling and interaction remain possible. The preferences modal uses `ReactDOM.createPortal` to render at `document.body` level, ensuring it sits above everything including the sticky header (`z-index: 200` vs header `z-index: 100`).

### 5. Focus trap — native implementation, no new dependency
Focus trap is implemented with a `useEffect` that listens for `keydown` Tab/Shift+Tab and wraps focus within the modal's focusable elements. No new npm package is introduced (matches the project's minimal-dependency policy).

### 6. `CONSENT_VERSION` constant
A `CONSENT_VERSION = '1'` string constant lives in `frontend/src/constants/cookieConsent.ts`. Incrementing this value invalidates all stored decisions and re-prompts users. This is the only mechanism for re-prompting, which keeps the consent logic simple.

### 7. Styling — extend existing `storefront.css` BEM system
New classes follow the existing pattern: `storefront-cookie__banner`, `storefront-cookie__modal`, `storefront-cookie__toggle`, etc. Design tokens already in scope (`--color-near-black`, `--font-family-body`, `--spacing-*`, `--radius-*`) are used. No new CSS framework or library. Motion uses the same `@media (prefers-reduced-motion: reduce)` guard already used by `storefront-hero__*` animations.

### 8. `cookies` i18n namespace — separate file
A dedicated `cookies.json` namespace is registered in `i18n/index.ts` and loaded lazily via `react-i18next`'s dynamic namespace loading (already used for `catalog`). This avoids polluting `common.json` with banner/modal copy.

## Risks / Trade-offs

- **`localStorage` is not proof-of-consent** — If the store later requires an auditable consent log (for a DPA or legal challenge), the current MVP is insufficient. Mitigation: flagged in proposal Non-goals; backend `POST /api/consent` is the documented future step.
- **No real scripts to gate today** — `reportWebVitals` is the only non-essential "script" wired up. The risk is that future developers add analytics/marketing SDKs without checking `useCookieConsent`. Mitigation: `frontend-standards.md` is updated with an explicit convention requiring the consent check.
- **`localStorage` blocked in private/incognito on some browsers** — `localStorage.getItem` / `setItem` can throw in certain contexts. Mitigation: wrap reads/writes in try/catch; treat failure as "no decision" (show banner each visit — safe default).
- **CLS from banner mount** — A late-mounted fixed-position banner can cause a layout shift. Mitigation: banner uses `position: fixed` (outside flow); `will-change: transform` on the animated element; deferred mount via `useEffect` on client hydration already done in CRA.

## Migration Plan

1. Feature branch off `develop` (worktree per `ai-specs/skills/using-git-worktrees/SKILL.md`).
2. All changes are additive — no existing component is removed or renamed.
3. Deploy to production: the banner appears for all users on first load after deployment (no stored decision exists yet). Users who accept/reject are not prompted again until `CONSENT_VERSION` changes.
4. Rollback: revert the PR — banner disappears; `localStorage` entries left over are harmless (banner would just not show on rollback).

## Open Questions

*(none — all decisions resolved above)*
