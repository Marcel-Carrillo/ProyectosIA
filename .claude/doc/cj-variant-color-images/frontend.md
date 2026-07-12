# Frontend Implementation Plan: cj-variant-color-images

Scope of this plan: **tasks 7, 8, and 12 only** from `openspec/changes/cj-variant-color-images/tasks.md`.
Backend tasks (1–6, 9–11) are out of scope and assumed to land separately/first — see "Cross-layer dependency" below.
Docs (task 13) and commit/PR (task 14) are out of scope for this plan.

Do not implement. This document is the complete, concrete, file-by-file spec for the parent session (or another
implementing agent) to execute directly.

---

## Cross-layer dependency (read first)

The frontend changes below only become *meaningfully testable end-to-end* once the backend public API
(`GET /api/public/products/:id`) actually returns `color` on each image (backend tasks 1–4) and — for task 12's
E2E fixture — once admin image endpoints accept `color` (backend task 5). The frontend code itself (types,
`ProductGallery`, `ProductPage` wiring, RTL tests) has **no runtime dependency on the backend being done first**:
`ProductImage.color` is simply added to the frontend TypeScript type and consumed defensively. RTL unit tests
(7.2, 8.2) fabricate their own fixtures and do not need a live backend.

Only task 12 (Playwright E2E) needs the backend finished and deployed to a running dev environment, because it
drives real servers end-to-end. If backend tasks are not yet done when task 12 is reached, flag this explicitly
rather than faking it.

---

## File 1 — `frontend/src/types/product.ts`

**Task 7.1.**

Add `color` to the `ProductImage` interface only. Do **not** touch `CreateImageInput` / `UpdateImageInput` (admin
write payloads) — those belong to backend task 5's frontend counterpart, which does **not** appear anywhere in
tasks.md's frontend section (7, 8, 12). The admin `ImageManager.tsx` component (`frontend/src/components/admin/ImageManager.tsx`)
is intentionally left untouched by this change; it will keep working unmodified since `color` is additive and
optional. If the parent session wants admin UI support for setting image color, that is new scope beyond this
plan — flag it rather than silently adding it.

Change:

```ts
export interface ProductImage {
  id: number;
  productId: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  color: string | null; // NEW — matches ProductVariant.color vocabulary; null = shared/product-level image
  createdAt: string;
}
```

Insert the new field between `sortOrder` and `createdAt` to match the field order already used in
`ProductVariant.color`'s placement relative to other fields, and so existing object literals in tests that use
positional/spread patterns don't need reordering (TS structural typing doesn't care about order, but this keeps
the type readable next to the backend Prisma model field order from design.md D1).

**Do not** add `color` to `CreateImageInput`/`UpdateImageInput` in this task — out of scope, see above.

---

## File 2 — `frontend/src/components/storefront/ProductGallery.tsx`

**Task 7.3.** This is the core logic change. Current file (`frontend/src/components/storefront/ProductGallery.tsx`)
in full for reference:

```tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductImage } from '../../types/product';

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

const PLACEHOLDER_IMG = '...';

const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName }) => {
  const { t } = useTranslation('product');
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const [activeIdx, setActiveIdx] = useState(0);

  const activeImage = sorted[activeIdx] ?? null;
  const mainSrc = activeImage?.url ?? PLACEHOLDER_IMG;
  const mainAlt = activeImage?.altText || productName;

  return ( /* renders sorted.map(...) thumbs */ );
};
```

### Required changes

1. Add `selectedColor?: string | null` to `ProductGalleryProps`. Optional and defaults to `undefined` — products
   rendered without passing it behave exactly as today (per D7 and the "Products without a color selector" spec
   scenario).

2. Import `useEffect` alongside the existing `useState` import:
   `import React, { useState, useEffect } from 'react';`

3. Compute the color-filtered list **after** sorting, then apply the mandatory fallback:

   ```tsx
   const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

   // selectedColor is treated the same whether it's `undefined` (prop omitted — no
   // variant selector on this product) or `null` (a variant is selected but has no
   // color dimension) — both mean "no color filtering", matching the spec's
   // "Products with no color selection (no variant selector, or no color selected)".
   const colorFiltered =
     selectedColor != null
       ? sorted.filter((img) => img.color === selectedColor || img.color === null)
       : sorted;

   // D7 mandatory fallback: never render an empty gallery because of filtering.
   const displayed = colorFiltered.length > 0 ? colorFiltered : sorted;
   ```

   Use `!= null` / `=== null` (not `!==`/`===` strict-only) consistent with existing codebase convention for
   null-or-undefined checks (see `frontend/src/components/admin/VariantTable.tsx` lines 65, 228, 234 for
   precedent) — this is intentional, not a lint violation risk (the project's `eqeqeq` config already tolerates
   `== null`/`!= null` elsewhere).

4. Replace every remaining use of `sorted` in the render body (the `.map()` over thumbnails, `sorted[activeIdx]`,
   `sorted.length > 1`) with `displayed`. `sorted` itself is still needed as the fallback source and as the base
   for filtering, so keep both variables — don't rename `sorted` to `displayed` outright.

5. Reset the active thumbnail to index 0 whenever the *effective* image set changes — i.e. whenever `selectedColor`
   changes, or whenever the underlying `images` prop changes (new product loaded). Do this with a `useEffect`,
   not by deriving `activeIdx` inline, because `activeIdx` must remain independently settable by thumbnail clicks:

   ```tsx
   useEffect(() => {
     setActiveIdx(0);
   }, [selectedColor, images]);
   ```

   Do **not** key this effect on `displayed` or `colorFiltered` directly — those are new array instances on every
   render (from `.sort()`/`.filter()`), which would fire the effect every render. `images` is the prop reference
   (stable across re-renders of the same product; only changes identity when `ProductPage` sets a new `product`
   state), and `selectedColor` is a primitive (`string | null | undefined`) — both are stable, cheap dependency
   checks that changes exactly when the visible set can meaningfully change.

6. Full resulting component (for direct reference — implement exactly this shape unless a concrete reason to
   diverge is found during implementation):

   ```tsx
   import React, { useState, useEffect } from 'react';
   import { useTranslation } from 'react-i18next';
   import { ProductImage } from '../../types/product';

   interface ProductGalleryProps {
     images: ProductImage[];
     productName: string;
     selectedColor?: string | null;
   }

   const PLACEHOLDER_IMG = 'data:image/svg+xml,...'; // unchanged

   const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName, selectedColor }) => {
     const { t } = useTranslation('product');
     const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

     const colorFiltered =
       selectedColor != null
         ? sorted.filter((img) => img.color === selectedColor || img.color === null)
         : sorted;
     const displayed = colorFiltered.length > 0 ? colorFiltered : sorted;

     const [activeIdx, setActiveIdx] = useState(0);

     useEffect(() => {
       setActiveIdx(0);
     }, [selectedColor, images]);

     const activeImage = displayed[activeIdx] ?? null;
     const mainSrc = activeImage?.url ?? PLACEHOLDER_IMG;
     const mainAlt = activeImage?.altText || productName;

     return (
       <div className="storefront-gallery">
         <div className="storefront-gallery__main">
           <img src={mainSrc} alt={mainAlt} />
         </div>
         {displayed.length > 1 && (
           <div className="storefront-gallery__thumbs" role="list" aria-label={t('gallery.imagesLabel')}>
             {displayed.map((img, idx) => (
               <button
                 key={img.id}
                 type="button"
                 role="listitem"
                 aria-label={img.altText || t('gallery.imageN', { n: idx + 1 })}
                 aria-current={idx === activeIdx ? 'true' : undefined}
                 onClick={() => setActiveIdx(idx)}
                 className={`storefront-gallery__thumb${idx === activeIdx ? ' storefront-gallery__thumb--active' : ''}`}
               >
                 <img src={img.url} alt={img.altText || t('gallery.thumbAlt', { name: productName, n: idx + 1 })} />
               </button>
             ))}
           </div>
         )}
       </div>
     );
   };

   export default ProductGallery;
   ```

   Note the `key={img.id}` on thumbnail buttons stays as-is — React uses it correctly across filtered-set changes
   since `id` is stable per image regardless of which subset is currently displayed.

7. No new CSS classes needed — `storefront-gallery`, `storefront-gallery__main`, `storefront-gallery__thumbs`,
   `storefront-gallery__thumb`, `storefront-gallery__thumb--active` already exist and are unaffected by this
   change (verify in `frontend/src/index.css` or wherever storefront gallery styles live, but no edits expected
   there).

---

## File 3 — `frontend/src/components/storefront/ProductGallery.test.tsx`

**Task 7.2.** Important convention note: tasks.md suggests a path of
`frontend/src/components/storefront/__tests__/ProductGallery.test.tsx or equivalent`. The **actual existing test
file** is co-located directly next to the component at
`frontend/src/components/storefront/ProductGallery.test.tsx` (no `__tests__` subfolder — this project does not use
one for this component). **Extend the existing file in place; do not create a new file in a `__tests__`
subfolder** — that would create a duplicate/conflicting test suite for the same component.

Existing file content (for reference, keep these two tests unmodified):

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import ProductGallery from './ProductGallery';
import { ProductImage } from '../../types/product';

const images: ProductImage[] = [
  { id: 1, productId: 1, url: 'https://cdn.example.com/a.jpg', altText: 'Red dress front view', sortOrder: 0, createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, productId: 1, url: 'https://cdn.example.com/b.jpg', altText: null, sortOrder: 1, createdAt: '2026-01-01T00:00:00Z' },
];

describe('ProductGallery', () => {
  it('uses the active image altText for the main image', () => { ... });
  it('falls back to productName for the main image when altText is empty', () => { ... });
});
```

### Required changes

1. Add `color: null` to both existing fixture objects in the `images` array — `ProductImage` now requires `color`
   as a non-optional field (`color: string | null`, not `color?:`), so these object literals will fail to
   typecheck (`tsc`) and fail Vitest compilation once File 1 lands. This is a **mandatory** fixture fix, not
   optional — matches task 9's "review existing fixtures" instruction, mirrored here for the frontend fixture
   that would otherwise break the build.

   ```tsx
   const images: ProductImage[] = [
     { id: 1, productId: 1, url: 'https://cdn.example.com/a.jpg', altText: 'Red dress front view', sortOrder: 0, color: null, createdAt: '2026-01-01T00:00:00Z' },
     { id: 2, productId: 1, url: 'https://cdn.example.com/b.jpg', altText: null, sortOrder: 1, color: null, createdAt: '2026-01-01T00:00:00Z' },
   ];
   ```

2. Add a new `describe('ProductGallery color filtering', ...)` block below the existing `describe`, with a
   dedicated fixture set covering multiple colors plus a shared image. Suggested fixture (use these exact
   `id`/`color`/`sortOrder` values so assertions below are unambiguous):

   ```tsx
   const colorImages: ProductImage[] = [
     { id: 10, productId: 1, url: 'https://cdn.example.com/shared.jpg', altText: 'Shared front', sortOrder: 0, color: null, createdAt: '2026-01-01T00:00:00Z' },
     { id: 11, productId: 1, url: 'https://cdn.example.com/red-1.jpg', altText: 'Red detail 1', sortOrder: 1, color: 'Red', createdAt: '2026-01-01T00:00:00Z' },
     { id: 12, productId: 1, url: 'https://cdn.example.com/red-2.jpg', altText: 'Red detail 2', sortOrder: 2, color: 'Red', createdAt: '2026-01-01T00:00:00Z' },
     { id: 13, productId: 1, url: 'https://cdn.example.com/blue-1.jpg', altText: 'Blue detail 1', sortOrder: 3, color: 'Blue', createdAt: '2026-01-01T00:00:00Z' },
   ];
   ```

3. Test cases to add inside the new `describe` block (all synchronous — no `findBy*`/`waitFor` needed since
   `ProductGallery` has no async data fetching; use `getBy*`/`queryBy*` per the project's `testing-library/prefer-find-by`
   rule, which only applies to *async* assertions):

   - **"filters to images matching the selected color plus shared (color=null) images"**
     Render with `selectedColor="Red"`. Assert the thumbnail strip (`screen.getAllByRole('listitem')`) has length
     3 (shared `id:10` + `id:11` + `id:12`), and that `id:13` (Blue) is absent — e.g. assert
     `screen.queryByAltText('Blue detail 1')` is `null`.

   - **"falls back to the full image list when the filtered set would be empty"**
     Render with `selectedColor="Green"` (a color with zero matching images and no shared images beyond `id:10`
     which *is* shared and would already keep the set non-empty — to properly test the **fully-empty** fallback
     path, use a fixture with **no** `color: null` entries at all, e.g. a second fixture array
     `noSharedImages = colorImages.filter((img) => img.color !== null)` filtered to only `Red`/`Blue` items, then
     select `selectedColor="Green"`). Assert all 3 non-shared images (`id:11`, `id:12`, `id:13`) are present —
     i.e. the full unfiltered list rendered, not an empty gallery. This directly covers the "Selected color has no
     color-specific images" spec scenario, distinct from the "some shared images always present" case above.

   - **"renders the full list unchanged when selectedColor is not provided"**
     Render `colorImages` with no `selectedColor` prop at all. Assert all 4 images are present
     (`screen.getAllByRole('listitem')` length 4).

   - **"renders the full list unchanged when selectedColor is explicitly null"**
     Render `colorImages` with `selectedColor={null}`. Assert same as above (length 4) — covers "no color
     selected" (a selected variant exists but has no `color`), distinct from the prop being omitted.

   - **"resets the active thumbnail to the first image when selectedColor changes"**
     Use RTL's `rerender`. Render `colorImages` with `selectedColor="Blue"` first. Click the second thumbnail in
     the filtered set (shared `id:10` is index 0, Blue `id:13` is index 1 — after filtering to Blue there are only
     2 images: `id:10`, `id:13`; click index 1 i.e. `id:13`) so `activeIdx` becomes 1. Assert the main image now
     shows `id:13`'s `url`/`altText`. Then `rerender(<ProductGallery images={colorImages} productName="..." selectedColor="Red" />)`.
     Assert the main image reset to the first image of the **new** filtered set (shared `id:10`, since it's
     `sortOrder: 0` and included via the `color === null` clause) — i.e. `screen.getByRole('img', { name: 'Shared front' })`
     is the main (first) image, not one of the Red-only images that would show if `activeIdx` had stayed at 1.

     Implementation note for whoever writes this test: `screen.getAllByRole('img')[0]` is always the main image
     (see the existing tests' pattern of `screen.getAllByRole('img')[0]`); thumbnails are the same `role="img"`
     elements nested inside `role="listitem"` buttons, so prefer scoping via `within(screen.getByRole('list'))`
     when asserting on thumbnails specifically, to avoid ambiguity with the main image.

4. Run `npx eslint src --ext .ts,.tsx` after writing these tests (per the frontend-developer agent's mandatory
   RTL/ESLint standard) — confirm no `testing-library/prefer-find-by` violations (there should be none, since
   nothing here is async) and no other lint errors.

---

## File 4 — `frontend/src/pages/storefront/ProductPage.tsx`

**Task 8.1.** One-line change at the existing `<ProductGallery />` call site (currently around line 264):

```tsx
// Before
<ProductGallery images={product.images ?? []} productName={product.name} />

// After
<ProductGallery
  images={product.images ?? []}
  productName={product.name}
  selectedColor={selectedVariant?.color ?? null}
/>
```

No other changes needed in this file. `selectedVariant` is already local state (`useState<ProductVariant | null>`,
set via `VariantSelector`'s `onVariantChange` prop) — it already exists and is unrelated to this task; just wire
its `.color` through. `selectedVariant?.color ?? null` correctly produces `undefined → null` when no variant is
selected yet (initial render before `VariantSelector`'s effect fires) and when a variant is selected but has no
color dimension — both cases are handled by `ProductGallery`'s `selectedColor != null` check (File 2) to mean "no
filtering," which is the desired behavior per the product-detail spec's "no color selection" scenario.

---

## File 5 — `frontend/src/pages/storefront/__tests__/ProductPage.test.tsx`

**Task 8.2.** This file already exists (`frontend/src/pages/storefront/__tests__/ProductPage.test.tsx`) with
`describe` blocks for language refetch and structured-data (gtin, reviews). It mocks `productService`,
`categoryService`, `reviewService`, `react-router-dom`, `CartContext`, `CustomerAuthContext`, and renders via
`renderWithI18n` from `frontend/src/test-utils/renderWithI18n`.

**Do not mock `ProductGallery` or `VariantSelector`** — render them for real so the color-wiring is actually
exercised end-to-end within the RTL test (this project's existing pattern favors real child components with only
service/network-boundary mocks, as seen in this same file already rendering the real gallery/variant selector
implicitly today).

Add a new `describe('ProductPage gallery color wiring', ...)` block:

1. **beforeEach**: same `vi.clearAllMocks()` + `mockCategoryGetAll.mockResolvedValue([])` +
   `mockListApprovedForProduct.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 5, summary: { averageRating: null, reviewCount: 0 }, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })`
   pattern already used by the other `describe` blocks in this file.

2. **Test: "selecting a color-bearing variant filters the gallery to that color's images"**
   `mockGetById.mockResolvedValue` with a product that has:
   - `variants`: at least two variants with distinct `color` values sharing the same `size` (or no size), both
     `status: 'Active'`, `deletedAt: null` — e.g. `{ id: 1, ..., color: 'Red', size: null, ... }` and
     `{ id: 2, ..., color: 'Blue', size: null, ... }`, following the full `ProductVariant` shape (see
     `frontend/src/types/product.ts` for required fields: `sku`, `publicPrice`, `compareAtPrice`, `stockPolicy`,
     `status`, `deletedAt`, `createdAt`, `updatedAt`).
   - `images`: one shared (`color: null`), one `color: 'Red'`, one `color: 'Blue'`.

   Render with `renderWithI18n(<ProductPage />, { lng: 'en' })`. Await the product to load — use
   `await screen.findByText('<product name>')` or similar `findBy*` (per the mandatory `prefer-find-by` rule,
   since the product loads asynchronously via `productService.getById`). `VariantSelector` auto-selects the first
   color it finds (`colors[0]`, see `frontend/src/components/storefront/VariantSelector.tsx` — `useState<string | null>(colors[0] ?? null)`
   plus an effect calling `onVariantChange`) — so after the initial render settles, the gallery should already be
   filtered to whichever color is first in the variants array (test against that, or explicitly click the color
   button for the second color via `screen.getByRole('button', { name: /blue/i })` — check the actual
   accessible name pattern in `VariantSelector.tsx`: `aria-label={t('variant.colorOption', { value: color })}`,
   so the button's accessible name is the i18n-interpolated string, e.g. English translation of "colorOption" —
   check `frontend/src/i18n/locales/en/product.json` for the exact key text before writing the `name:` regex).
   After clicking, assert (via `within` scoped to the gallery, or `queryByAltText`) that the Blue-only image is
   shown/present and the Red-only image is absent, while the shared image remains present.

3. **Test: "a product without variants/colors renders the gallery unchanged"**
   `mockGetById.mockResolvedValue` with a product that has `variants: []` (or omitted) and `images` all with
   `color: null` (or a mix, doesn't matter since no variant selector renders). Assert `VariantSelector` doesn't
   render color buttons (or renders nothing — `VariantSelector` returns `null` when `!sizes.length && !colors.length`)
   and all images are present in the gallery (`screen.getAllByRole('listitem')` matches full image count, or
   `screen.getAllByRole('img')` count matches `images.length + 1` main-image duplicate — verify exact counting
   logic against the real component rather than assuming, since the main image is also `role="img"` separately
   from thumbnails).

4. Run `npx eslint src --ext .ts,.tsx` after writing — confirm `findBy*` used for every async assertion (initial
   product load, and if asserting after a click that triggers a state update via `VariantSelector`'s `useEffect`,
   consider whether that update is synchronous enough for `getBy*`, or whether to be safe and use `findBy*` there
   too — `VariantSelector`'s `onVariantChange` fires from a `useEffect` after the click's state update, so it is
   not strictly synchronous with the click event; prefer `findBy*`/`waitFor` for post-click gallery assertions to
   avoid flakiness and lint violations).

---

## Task 12 — Frontend E2E Testing with Playwright MCP (execution plan, not files)

This task is **agent-executed** (per tasks.md: "MANDATORY - AGENT MUST EXECUTE"), using the `Playwright` MCP
tools (`mcp__Playwright__browser_navigate`, `browser_click`, `browser_snapshot`, `browser_console_messages`,
etc.) against locally running `backend` (`:3000`) and `frontend` dev servers. This is not a file to write, but the
concrete scenario plan the parent session should follow when it reaches this step. Route: `/catalog/:id` (see
`frontend/src/App.tsx` line ~140, `path="/catalog/:id"` → lazy `StorefrontProductPage`).

### Prerequisite: test data (12.1)

Needs an **Active** product with color-tagged images across ≥2 colors, in the dev DB the frontend/backend dev
servers point at. Two ways to get this, in order of preference:

1. **Preferred — if backend tasks 1–6 are already implemented and deployed to the dev DB**: use a real CJ-promoted
   product that has multiple colors (check via `psql` against the dev DB: a `Product` whose `ProductImage` rows
   have non-null, distinct `color` values, e.g.
   `SELECT "productId", color, count(*) FROM "ProductImage" WHERE color IS NOT NULL GROUP BY "productId", color;`).
   No new data setup needed if one already exists post-backfill (task 6/11.5).

2. **Fallback — if no such product exists yet in the dev DB**: use the admin API to construct one directly
   (requires backend task 5 — admin image endpoints accepting `color` — to be done first):
   - `POST /api/admin/products` to create a product (`status: 'Active'` after creation, or a follow-up
     `PATCH /api/admin/products/:id` to set `status: 'Active'`).
   - `POST /api/admin/products/:id/variants` twice, e.g. `{ sku: 'E2E-RED', color: 'Red', size: 'M', publicPrice: 29.99, stockPolicy: 'SupplierManaged' }`
     and `{ sku: 'E2E-BLUE', color: 'Blue', size: 'M', publicPrice: 29.99, stockPolicy: 'SupplierManaged' }`.
   - `POST /api/admin/products/:id/images` three times: one with no `color` (shared), one `{ color: 'Red', url: ... }`,
     one `{ color: 'Blue', url: ... }`. Use small public placeholder image URLs (e.g. `https://picsum.photos/seed/red/400/600`)
     so the gallery has something real to render.
   - Document this as test fixture creation in the step-12 report (12.7) and **restore/delete it afterward** per
     12.6 (`DELETE` the product via admin API, or note it was left as a permanent fixture if the team prefers a
     stable E2E fixture product — confirm with the parent session which is wanted before deleting).

   If backend task 5 is not yet done, this fallback is unavailable — flag that task 12 is blocked and escalate
   rather than fabricating a shortcut (e.g. writing `color` directly via `psql UPDATE` bypasses the API surface
   under test and would be a weaker verification, but is an acceptable last-resort documented fallback if the
   parent session explicitly wants to unblock frontend-only verification ahead of backend completion).

### Scenario steps (12.2–12.5)

1. **12.2 — Initial load shows the default/selected variant's images.**
   `browser_navigate` to `http://localhost:5173/catalog/<id>` (confirm actual dev port via `frontend/vite.config.ts`
   or the running dev server's own startup output — don't assume 5173 without checking). `browser_snapshot` to
   get the accessibility tree; confirm the gallery's main image and thumbnail count matches the first
   color-selected variant's expected image set (shared images + that color's images), per `VariantSelector`'s
   "first color wins by default" behavior.

2. **12.3 — Selecting a different color updates the gallery and resets the active thumbnail.**
   `browser_click` the second color's swatch button (find via `browser_snapshot`'s accessible name, matching
   `VariantSelector`'s `aria-label` pattern from `t('variant.colorOption', { value: color })`). Re-snapshot;
   confirm: (a) the main image changed to that color's first image (or the first shared image if the color has no
   dedicated first-sort-order image — check actual `sortOrder` values in the fixture), (b) the thumbnail strip now
   shows only that color's + shared images, (c) `aria-current="true"` is on the first thumbnail of the new set
   (proving the reset, not just that the set changed).

3. **12.4 — A color with no dedicated images falls back to the full list.**
   Requires a fixture variant/color with zero matching `ProductImage.color` rows (e.g. a third variant color, say
   `Green`, with no images of `color: 'Green'`). Click that color's swatch; confirm the gallery still shows all
   images (the full unfiltered set) rather than an empty or broken gallery — this is the D7/spec fallback
   scenario. If the fixture used in 12.1 only has 2 colors and both have dedicated images, either extend the
   fixture with a third color that has none, or use a single-color/no-color product for this check instead (per
   tasks.md's phrasing "or a single-color product" — that's an acceptable substitute scenario for 12.4).

4. **12.5 — No console errors; a product without color-tagged images is unaffected (regression check).**
   `mcp__Playwright__browser_console_messages` after each navigation/click above — assert no `error`-level
   entries. Separately navigate to an existing, unrelated Active product that predates this change (all images
   `color: null`, or no variants/no color dimension) and confirm the gallery renders exactly as before — full
   image list, thumbnail clicks work, no console errors. This is the most important regression guard since it's
   the majority case in production today (pre-backfill).

### Cleanup and reporting (12.6–12.7)

- Close the Playwright browser (`mcp__Playwright__browser_close`).
- Revert any fixture data created in the "fallback" branch of 12.1 per the earlier note.
- Create `openspec/changes/cj-variant-color-images/reports/YYYY-MM-DD-step-12-e2e-testing.md` documenting: which
  product/fixture was used (real CJ-promoted vs. constructed), each scenario's pass/fail with a one-line
  observation, any console errors seen, and confirmation that the regression check (12.5, unrelated pre-existing
  product) passed.

---

## Summary of files touched by this plan

| # | File | Task | Change type |
|---|------|------|-------------|
| 1 | `frontend/src/types/product.ts` | 7.1 | Add `color: string \| null` to `ProductImage` |
| 2 | `frontend/src/components/storefront/ProductGallery.tsx` | 7.3 | Add `selectedColor` prop, filter+fallback, active-thumbnail reset `useEffect` |
| 3 | `frontend/src/components/storefront/ProductGallery.test.tsx` | 7.2 | Fix existing fixtures (`color: null`); add color-filter/fallback/reset test cases |
| 4 | `frontend/src/pages/storefront/ProductPage.tsx` | 8.1 | Pass `selectedColor={selectedVariant?.color ?? null}` to `<ProductGallery />` |
| 5 | `frontend/src/pages/storefront/__tests__/ProductPage.test.tsx` | 8.2 | Add gallery-color-wiring `describe` block (real `VariantSelector`+`ProductGallery`, mocked services only) |
| 6 | `frontend/src/components/admin/__tests__/ImageManager.test.tsx` | (fixture fix, not numbered) | Add `color: null` to the `image` fixture so the file still compiles |
| — | Playwright MCP session against running dev servers | 12 | E2E scenarios 12.2–12.5, fixture setup 12.1, report 12.7 |

**Explicitly out of scope for this plan** (do not touch): `frontend/src/components/admin/ImageManager.tsx`,
`CreateImageInput`/`UpdateImageInput` in `frontend/src/types/product.ts`, `frontend/src/services/adminProductService.ts`
— none of these appear in tasks.md's frontend task numbers (7, 8, 12), and `color` being additive/optional on the
backend means they continue to work unmodified.

**Verification commands to run after implementing** (not part of this plan's authorship, but required before
marking 7/8 tasks `[x]`): `npx eslint src --ext .ts,.tsx` and `npm test` from `frontend/`.

**Additional mandatory fixture fix found while researching this plan (not in tasks.md's frontend numbers, but
required for the build to compile once File 1 lands):**
`frontend/src/components/admin/__tests__/ImageManager.test.tsx` (lines 11–18) has a `ProductImage` object literal
with no `color` field:

```ts
const image: ProductImage = {
  id: 3,
  productId: 1,
  url: 'https://img/main.jpg',
  altText: 'main',
  sortOrder: 0,
  createdAt: '',
};
```

Add `color: null,` (after `sortOrder: 0,`) — a one-line, no-behavior-change fixture fix, same as the fix in File 3
above. This is the only other `ProductImage` object literal in `frontend/src` besides the two files already
covered in this plan (confirmed via `grep -rln "ProductImage\b" frontend/src`, which returned exactly six files:
`types/product.ts` and `ProductGallery.tsx` — definition/consumption, no literals; `ProductDetailPage.tsx` — only
imports the type, no literals; `ProductGallery.test.tsx` and `ImageManager.test.tsx` — literals needing the fix;
`ImageManager.tsx` — no literals, only consumes the prop). No other frontend file needs a fixture change for this
plan's scope.
