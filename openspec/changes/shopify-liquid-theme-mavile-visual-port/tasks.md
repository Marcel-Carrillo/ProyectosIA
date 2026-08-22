## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md`: check current branch, `git status`, and `git worktree list`. If the workspace is clean, use a normal feature branch in the current checkout; otherwise ask before creating a worktree.
- [x] 0.2 Ensure current branch is `develop` and up to date (`git fetch origin && git checkout develop && git pull`).
- [x] 0.3 Create and switch to `feature/shopify-liquid-theme-mavile-visual-port` from `develop`.
- [x] 0.4 Verify with `git branch --show-current` and report a clean starting state.

## 1. Planning artifacts (workspace rule — before source edits)

- [x] 1.1 Create `.claude/sessions/context_session_shopify-liquid-theme-mavile-visual-port.md` with links to proposal, design, specs, tasks, and a scope summary (Liquid theme only; backend N/A).
- [x] 1.2 Skip backend plan: write `.claude/doc/shopify-liquid-theme-mavile-visual-port/backend.md` stating backend is out of scope and no Express/Prisma/Stripe files will be edited.
- [x] 1.3 Write `.claude/doc/shopify-liquid-theme-mavile-visual-port/frontend.md` from `ai-specs/agents/frontend-developer.md` covering `shopify/theme` surfaces, parity, consent, and E2E (or write it manually and state that the subagent was skipped).

## 2. Withdraw hybrid catalog change

- [x] 2.1 Delete `openspec/changes/shopify-headless-catalog-phase1/` if it still exists. Do **not** run `openspec archive` (that flow syncs abandoned delta specs).
- [x] 2.2 Confirm `openspec/specs/` was not modified by that withdrawal.

## 3. Shopify shop prerequisites

- [x] 3.1 Record shop checklist in `openspec/changes/shopify-liquid-theme-mavile-visual-port/reports/YYYY-MM-DD-shopify-shop-prerequisites.md`: Mavile name, EUR, Europe/Madrid, Spain market, ES+EN (`/en`), password or `noindex`, classic customer accounts, Shopify cookie banner off, menus and collection handles `women` / `men` / `accessories` / `shoes`, 8–12 sample products with variants and 2+ images.
- [x] 3.2 Missing live shop does not block scaffolding theme files; `shopify theme dev` and E2E wait on this report being filled.

## 4. Theme scaffold and tooling

- [x] 4.1 Add `shopify/README.md`, `shopify/.theme-check.yml`, `shopify/shopify.theme.toml`, and `.gitignore` for `shopify/theme/.shopify/`.
- [x] 4.2 Scaffold Dawn into `shopify/theme` and remove unused sections/assets that Mavile will not use.
- [x] 4.3 Add GitHub workflow `.github/workflows/shopify-theme-check.yml` and Prettier Liquid plugin config.
- [x] 4.4 Add ESLint scope for `shopify/theme/assets/*.js`.

## 5. Tokens and base CSS

- [x] 5.1 Port `frontend/src/styles/tokens.css` 1:1 to `shopify/theme/assets/mavile-tokens.css`.
- [x] 5.2 Add self-hosted Inter woff2 subset, preload, `font-display: swap`.
- [x] 5.3 Add `mavile-base.css` (reset, type, buttons, fields, animations) using existing token names.
- [x] 5.4 Copy brand SVGs into theme assets.

## 6. Layout shell

- [x] 6.1 Implement `layout/theme.liquid` (token `:root`, meta, consent mount, JSON-LD hooks).
- [x] 6.2 Implement header (sticky blur, centered logo, `mavile-nav`, flag language switcher, cart count) and footer from Shopify menus.
- [x] 6.3 Implement `password.liquid` in Mavile style.
- [x] 6.4 Add `mavile-header.js` mobile menu.

## 7. Hero

- [x] 7.1 Add `sections/mavile-hero.liquid` + `mavile-hero.css` + `mavile-hero.js` (rotation, motion presets, scrim, grain, dots, reduced-motion guard).
- [x] 7.2 Wire home `templates/index.json` to the hero section.

## 8. Collection surfaces

- [x] 8.1 Implement collection grid, `card-product`, `price`, pagination, sort/facets.
- [x] 8.2 Match 1/2/3 columns, 3:4 card, hover image swap, name clamp, uppercase vendor, tabular price.

## 9. Product detail

- [x] 9.1 Implement `main-product` with breadcrumb, gallery, pill variant picker, add to cart via Ajax Cart.
- [x] 9.2 Implement D11 colour→hero-only behaviour in `mavile-gallery.js`.
- [x] 9.3 Disable unavailable combinations; do not promise delivery from `available`.

## 10. Cart and checkout hand-off

- [x] 10.1 Implement cart **page** (not drawer): items, quantity, remove, summary, empty state.
- [ ] 10.2 Confirm `/checkout` reaches hosted Shopify Checkout (test order in the development store).
- [ ] 10.3 Apply Checkout branding settings (logo, colours, radius) on the shop.

## 11. Content, search, 404

- [x] 11.1 Page template + contact `{% form 'contact' %}`.
- [x] 11.2 Search and 404 in Mavile visual language.
- [x] 11.3 Confirm policy URLs render (content authored in Admin, not hardcoded).

## 12. Classic account templates

- [x] 12.1 Style `templates/customers/*.liquid` (login, register, account, order, addresses, reset, activate).
- [x] 12.2 Confirm no Mavile 2FA/OAuth/API calls.

## 13. Localization

- [x] 13.1 Fill `locales/es.default.json` and `locales/en.json` for all ported chrome strings.
- [x] 13.2 Verify flag switcher preserves path and `hreflang` is present.

## 14. Consent

- [x] 14.1 Implement Mavile cookie banner + preferences modal calling Customer Privacy API (D7 mapping).
- [ ] 14.2 Verify reject blocks analytics/marketing scripts in both locales.

## 15. Review and Update Existing Unit Tests (MANDATORY)

- [x] 15.1 Review backend Jest and frontend Vitest suites: this change MUST NOT require fixture updates (no `frontend/src` or `backend/src` edits). Document that finding.
- [x] 15.2 Add or update theme JS tests only if non-trivial logic is extracted; otherwise Theme Check + Playwright are the theme tests.

## 16. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 16.1 Capture pre-test DB baseline (Product/ProductVariant counts) to prove **no mutation** — this change writes no Prisma data.
- [x] 16.2 Run backend `npm test` and `npm run lint` (regression only).
- [x] 16.3 Run frontend `npx eslint src --ext .ts,.tsx` and `npm test` (regression only).
- [x] 16.4 Run `shopify theme check` in `shopify/theme` and ESLint on theme JS. Restore DB only if a suite leaked writes (expected: none).
- [x] 16.5 Write `openspec/changes/shopify-liquid-theme-mavile-visual-port/reports/YYYY-MM-DD-step-16-unit-test-and-db-verification.md`.

## 17. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 17.1 No Mavile API endpoints are added or changed. Execute a documented N/A curl pass: hit Shopify cart.js / a collection URL on the preview instead of `/api/public/*`, and assert the theme does not call Mavile `/api/`.
- [x] 17.2 No CREATE/UPDATE/DELETE against Prisma; no DB restore required for this step.
- [x] 17.3 Write `openspec/changes/shopify-liquid-theme-mavile-visual-port/reports/YYYY-MM-DD-step-17-curl-endpoint-testing.md`.

## 18. E2E Testing with Playwright (MANDATORY - AGENT MUST EXECUTE)

- [ ] 18.1 Against `shopify theme dev` preview: collection → PDP → variant → add to cart → cart → hosted checkout; ES↔EN; consent reject/accept; colour hero-only; disabled unavailable options; cart qty/remove; pagination/sort; content/404; classic login.
- [x] 18.2 Write `openspec/changes/shopify-liquid-theme-mavile-visual-port/reports/YYYY-MM-DD-step-18-e2e-testing.md`.
- [x] 18.3 Write Lighthouse/a11y and visual-parity reports under the same `reports/` folder.

## 19. Update Technical Documentation (MANDATORY)

- [x] 19.1 Add `docs/shopify-theme-standards.md` and `docs/shopify-migration-launch-gap.md`.
- [x] 19.2 Update `docs/base-standards.md` (platform direction + Theme Check gate), `docs/frontend-standards.md` (legacy React vs Shopify theme), `docs/development_guide.md`, `docs/documentation-standards.md`, root `README.md`.
- [x] 19.3 Confirm `docs/data-model.md` and `docs/api-spec.yml` need **no** contract change; record that check in the launch-gap or development guide.

## 20. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 20.1 Follow `ai-specs/skills/commit/SKILL.md`: commit on `feature/shopify-liquid-theme-mavile-visual-port`.
- [ ] 20.2 Push and `gh pr create` targeting **`develop`**.
- [ ] 20.3 Report the PR URL in chat.
