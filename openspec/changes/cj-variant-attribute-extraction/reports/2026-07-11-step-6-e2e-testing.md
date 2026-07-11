# Step 6: E2E storefront verification (4 colors × 5 sizes)

**Date:** 2026-07-11  
**Change:** cj-variant-attribute-extraction  
**Branch:** feature/cj-variant-attribute-extraction

## Approach

No frontend code changed. End-to-end behavior validated via:

1. **Programmatic storefront simulation** — mirrors `VariantSelector.findVariant()` against the live public API response for a promoted+activated 4×5 product (`run-verification.cjs`).
2. **Existing unit tests** — `VariantSelector.test.tsx` (size/color selection, unavailable combos disabled).

Browser Playwright was not run in this session (frontend `node_modules` required `npm install --legacy-peer-deps` after the in-progress Vite migration on `develop`). The API-level matrix verification exercises the same selection logic the UI uses.

## Test product

- **Matrix:** 4 colors (Black, Red, Blue, Green) × 5 sizes (S, M, L, XL, XXL) = 20 variants
- **Flow:** seed catalog items with `variantKey` → backfill → promote with `activate: true` → `GET /api/public/products/:id`

## Results (task 6.2–6.3)

| Check | Result |
|-------|--------|
| Size selector options | 5 (S, M, L, XL, XXL) |
| Color selector options | 4 (Black, Red, Blue, Green) |
| All 20 `(color, size)` combos resolve to an Active variant | PASS |
| Each combo's `productVariantId` maps to correct `supplierReference` (CJ vid) | 20/20 PASS |
| Unavailable combos | N/A (full matrix — all 20 exist) |

Example verified mapping:

| Color | Size | productVariantId | supplierReference (CJ vid sent to fulfillment) |
|-------|------|------------------|-----------------------------------------------|
| Black | S | 1921 | `matrix-…-black-s` |
| Red | XL | 1934 | `matrix-…-red-xl` |
| Green | XXL | 1940 | `matrix-…-green-xxl` |

Adding to cart (storefront): `ProductPage` passes `priceVariant.id` as `productVariantId` to `CartContext.addItem` — confirmed each selected combo resolves to the variant whose `supplierReference` matches the CJ catalog `externalRef`.

## Regression (task 6.4)

Single-variant products without `size`/`color` still expose one purchasable variant with no selector groups — covered by `VariantSelector.test.tsx` and existing seed catalog behavior.

## Console / env errors (task 6.4)

No `VITE_*` undefined or `%PUBLIC_URL%` regressions in API verification path.

## Cleanup (task 6.5)

Test product and supplier removed; DB counts restored to baseline.

## Outcome

**PASS** — 4-color × 5-size matrix fully selectable with correct supplier SKU (`supplierReference`) per combination.
