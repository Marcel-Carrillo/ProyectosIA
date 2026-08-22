# Step 18 Report — E2E testing

- Date: 2026-08-22
- Change: shopify-liquid-theme-mavile-visual-port

## Commands

Playwright spec: `shopify/e2e/theme.spec.ts` (skips unless `SHOPIFY_THEME_PREVIEW_URL` is set).

Not executed against a live preview: no development store in this environment.

## Coverage intended (when preview URL exists)

Collection → PDP → add to cart → cart → `/checkout`; ES↔EN; consent; gallery; cart qty; 404; classic login.

## Outcome

- Step 18.1: BLOCKED pending shop (prerequisites report).
- Spec file is present so the suite can run as soon as a preview URL exists.
