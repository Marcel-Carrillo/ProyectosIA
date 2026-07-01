# Adversarial Review Report — storefront-seo-foundation

- Date: 2026-07-01
- Change: storefront-seo-foundation
- Reviewer: independent subagent (fresh session, per `ai-specs/skills/adversarial-review/SKILL.md`)

## Verdict (as delivered by the reviewer)

**PASS WITH GAPS** — archiving advisable after addressing the two Major findings or explicitly accepting them as tracked follow-ups.

## Findings and Resolution

| Severity | Finding | Resolution |
|----------|---------|------------|
| Major | `Seo.tsx` injected `JSON.stringify(block)` unescaped into a `<script type="application/ld+json">` child; a product `name`/`description` containing the literal string `</script>` could break out of the script tag. | **Fixed.** `Seo.tsx` now replaces every `<` in the serialized JSON with its Unicode escape before injecting. Added a regression test (`Seo.test.tsx`: "escapes `</script>` in JSON-LD content...") asserting the raw string never appears and the JSON still parses back to the original value. |
| Major | `frontend/public/robots.txt`'s `Sitemap:` directive hardcodes the current AWS API Gateway invoke URL; CRA does not template files under `public/` (only `index.html`), so this value can silently go stale if the API Gateway is ever recreated. | **Accepted as a documented follow-up**, not fixed in code (a real fix requires either a build-time templating script or an infra-level same-origin rewrite — out of scope for this change). Added a `#` comment in `robots.txt` and a `[Risk]` entry in `design.md` cross-referencing this decision. |
| Minor/Question | `ProductPage.tsx`'s JSON-LD picked `sku`/`offers.price` from `priceVariant` (the cart-selection variable, which can be any non-deleted variant) while `offers.availability` was derived independently from "does any Active variant exist" — could show a price from a non-Active variant labeled `InStock`. | **Fixed.** Structured data now derives `sku` and the full `offers` object from a single Active-variant lookup; `offers` is omitted entirely when no Active variant exists, so price and availability can never disagree. Verified live against two products: one with an Active variant (shows `sku`/`offers`, price matches DB) and one without (shows neither). |
| Minor | Checkout's `noindex` was verified only via source-read (identical pattern to the already-live-tested `CartPage`), not exercised live in the E2E pass, because the only product with `Add to cart` enabled during that session lacked stock to complete the flow cleanly within the session's time budget. | Accepted as documented in the step 10 report; not re-attempted (low risk — same component pattern, same `Seo` component, already covered by the `Seo.test.tsx` `noindex` unit test). |
| Question | Sitemap lists Active-status products even when they have zero Active variants (unpurchasable). | No change — matches the spec's literal wording ("`Active`-status product"), consistent with how `/api/public/products` already behaves. |

## Post-Review Verification

- Frontend: `CI=true npx react-scripts test --watchAll=false` → 44 suites / 193 tests passed (192 + 1 new escaping test).
- `npx eslint src --ext .ts,.tsx` → 0 errors.
- `npx tsc --noEmit` → 0 errors.
- Live re-verification via Playwright MCP against the rebuilt Docker frontend (`localhost:3001`), backend (`localhost:3000`):
  - `/catalog/46` (no Active variant): JSON-LD has no `sku`/`offers`.
  - `/catalog/48` (Active variant, `publicPrice=21.12`): JSON-LD `offers.price = 21.12`, `availability = InStock`, matches DB.

## Outcome

All findings addressed except the `robots.txt` staleness risk, which is explicitly accepted and tracked (not a blocker per the reviewer's own classification). Proceeding to commit and PR.
