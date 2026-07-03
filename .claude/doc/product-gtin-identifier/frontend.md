# Frontend implementation plan — product-gtin-identifier

Scope: tasks.md sections 8, 9, 10 (frontend types, admin form, storefront structured data) plus the
frontend portion of section 11 (review existing tests for hardcoded `Product` shapes). Backend is out
of scope for this file (see `.claude/doc/product-gtin-identifier/backend.md`).

Reference pattern: `brand` (already implemented end-to-end). Every edit below mirrors the equivalent
`brand` line/block as closely as possible.

---

## 1. `frontend/src/types/product.ts`

Current relevant lines (read from source):

```
42  export interface Product {
43    id: number;
44    name: string;
45    slug: string;
46    description: string | null;
47    brand: string | null;
...
93  export interface CreateProductInput {
94    name: string;
95    description?: string | null;
96    brand?: string | null;
...
103 export interface UpdateProductInput {
104   name?: string;
105   description?: string | null;
106   brand?: string | null;
```

### Edit 1.1 — `Product` interface (task 8.1)
Insert immediately after line 47 (`brand: string | null;`):

```ts
  gtin: string | null;
```

Result (lines 42-49):
```ts
export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  gtin: string | null;
  status: ProductStatus;
```

Note: this is a **non-optional, nullable** field (matches `brand`'s style: always present on the
`Product` shape returned by the API, value is `string | null`). Because it's non-optional, every
test fixture/mock object typed as `Product` (or passed to a mocked service typed against `Product`)
must include a `gtin` key or TypeScript will fail to compile. This is why the test-file edits in
sections 3 and 5 below are mandatory, not optional — grep confirms exactly two such fixtures exist:
`ProductFormModal.test.tsx`'s `created` object and `ProductPage.test.tsx`'s `mockGetById` resolved
value.

### Edit 1.2 — `CreateProductInput` (task 8.2)
Insert immediately after line 96 (`brand?: string | null;`):

```ts
  gtin?: string | null;
```

Result (lines 93-100):
```ts
export interface CreateProductInput {
  name: string;
  description?: string | null;
  brand?: string | null;
  gtin?: string | null;
  mainImageUrl?: string | null;
  categoryId?: number | null;
  translations?: { locale: SupportedLocale; name: string; description?: string | null }[];
}
```

### Edit 1.3 — `UpdateProductInput` (task 8.2)
Insert immediately after line 106 (`brand?: string | null;`):

```ts
  gtin?: string | null;
```

Result (lines 103-111):
```ts
export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  brand?: string | null;
  gtin?: string | null;
  status?: ProductStatus;
  mainImageUrl?: string | null;
  categoryId?: number | null;
  translations?: { locale: SupportedLocale; name: string; description?: string | null }[];
}
```

No other types in this file need `gtin` (variants/images/translations are unrelated entities).

---

## 2. `frontend/src/components/admin/ProductFormModal.tsx`

This component only supports **create** (`adminProductService.create`, `Modal.Title` = "New product",
button label "Create"); it does not edit existing products. That's the existing behavior for `brand`
too, so no new capability gap is introduced by adding `gtin` here — see the "Scope note" at the end of
this file regarding `ProductDetailPage.tsx`, which is a separate, already-existing edit page not listed
in tasks.md section 9.

### Edit 2.1 — `FormData` type (task 9.1)
Current (lines 16-24):
```ts
type FormData = {
  name: string;
  description: string;
  brand: string;
  categoryId: string;
  mainImageUrl: string;
  nameEs: string;
  descriptionEs: string;
};
```
Insert `gtin: string;` immediately after `brand: string;` (after line 19):
```ts
type FormData = {
  name: string;
  description: string;
  brand: string;
  gtin: string;
  categoryId: string;
  mainImageUrl: string;
  nameEs: string;
  descriptionEs: string;
};
```

### Edit 2.2 — `EMPTY` constant (task 9.1)
Current (line 26):
```ts
const EMPTY: FormData = { name: '', description: '', brand: '', categoryId: '', mainImageUrl: '', nameEs: '', descriptionEs: '' };
```
New:
```ts
const EMPTY: FormData = { name: '', description: '', brand: '', gtin: '', categoryId: '', mainImageUrl: '', nameEs: '', descriptionEs: '' };
```

### Edit 2.3 — submit payload (task 9.2)
Current (lines 61-68):
```ts
      const payload: CreateProductInput = {
        name: formData.name.trim(),
        description: formData.description || null,
        brand: formData.brand || null,
        categoryId: formData.categoryId ? Number(formData.categoryId) : null,
        mainImageUrl: formData.mainImageUrl || null,
        translations: translations.length > 0 ? translations : undefined,
      };
```
Insert `gtin: formData.gtin || null,` immediately after the `brand` line:
```ts
      const payload: CreateProductInput = {
        name: formData.name.trim(),
        description: formData.description || null,
        brand: formData.brand || null,
        gtin: formData.gtin || null,
        categoryId: formData.categoryId ? Number(formData.categoryId) : null,
        mainImageUrl: formData.mainImageUrl || null,
        translations: translations.length > 0 ? translations : undefined,
      };
```
This mirrors `brand`'s normalization exactly: empty string → `null`. No client-side digit/length
validation is added here — per `design.md`, format/length validation lives on the backend validator
(`validateProductData`); the frontend only trims via the `|| null` empty-string check, same as `brand`.
Do not add HTML `pattern`/`maxLength` constraints beyond what's specified below, to keep this change
minimal and consistent with the `brand` field's lack of client-side format constraints.

### Edit 2.4 — new form field (task 9.3)
Current brand `Form.Group` (lines 107-115):
```tsx
          <Form.Group className="mb-3">
            <Form.Label>Brand</Form.Label>
            <Form.Control
              type="text"
              value={formData.brand}
              onChange={(e) => handleChange('brand', e.target.value)}
              data-testid="input-product-brand"
            />
          </Form.Group>
```
Insert a new `Form.Group` immediately after it (after line 115, before the "Category" `Form.Group`
that currently starts at line 116):
```tsx
          <Form.Group className="mb-3">
            <Form.Label>GTIN</Form.Label>
            <Form.Control
              type="text"
              value={formData.gtin}
              onChange={(e) => handleChange('gtin', e.target.value)}
              data-testid="input-product-gtin"
            />
            <Form.Text className="text-muted">
              8, 12, 13, or 14-digit product barcode (EAN/UPC). Leave blank if unknown.
            </Form.Text>
          </Form.Group>
```
Notes:
- `data-testid="input-product-gtin"` is required exactly as specified in tasks.md 9.3 and the parent
  task prompt.
- The `Form.Text` helper line is a small UX addition (not required by tasks.md) explaining the
  expected format to the admin user, since "GTIN" is a less self-explanatory label than "Brand". It
  uses the existing `Form.Text`/`text-muted` idiom already used elsewhere in the codebase for helper
  copy — if the implementer prefers strict minimalism they may drop it; it does not affect any test
  assertion (tests only touch the `data-testid` input, not the helper text).
- `handleChange` already accepts any `keyof FormData`, so no change needed there — passing `'gtin'`
  works out of the box.
- No i18n key needed: `brand`'s label is a plain hardcoded string ("Brand"), not translated via `t()`
  (only the Spanish-section fields use `t()`); `gtin`'s label follows the same untranslated pattern.

---

## 3. `frontend/src/components/admin/__tests__/ProductFormModal.test.tsx`

### Edit 3.1 — fix the `created` fixture (mandatory for compilation, task 11)
Current (lines 19-30):
```ts
const created: Product = {
  id: 9,
  name: 'New',
  slug: 'new',
  description: null,
  brand: null,
  status: 'Draft',
  mainImageUrl: null,
  categoryId: null,
  createdAt: '',
  updatedAt: '',
};
```
Insert `gtin: null,` immediately after `brand: null,`:
```ts
const created: Product = {
  id: 9,
  name: 'New',
  slug: 'new',
  description: null,
  brand: null,
  gtin: null,
  status: 'Draft',
  mainImageUrl: null,
  categoryId: null,
  createdAt: '',
  updatedAt: '',
};
```
Without this, the file fails to typecheck once `gtin` becomes a required (non-optional) key on
`Product` (Edit 1.1), which would break `npx eslint src --ext .ts,.tsx` / `tsc` / CRA's build-time
type check and the test run itself.

### Edit 3.2 — new test cases (task 9.4)
Add these three `it` blocks inside the existing `describe('ProductFormModal', ...)` block, after the
existing "includes ES translation in create payload when provided" test (after line 75, before the
closing `});` of the describe block on line 76):

```tsx
  it('includes gtin in the create payload when provided', async () => {
    mocked.create.mockResolvedValue({ success: true, data: created, message: '' });
    renderModal(<ProductFormModal show onHide={jest.fn()} onSuccess={jest.fn()} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'Dress' } });
    fireEvent.change(screen.getByTestId('input-product-gtin'), { target: { value: '4006381333931' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ gtin: '4006381333931' })),
    );
  });

  it('submits null gtin when the field is left empty', async () => {
    mocked.create.mockResolvedValue({ success: true, data: created, message: '' });
    renderModal(<ProductFormModal show onHide={jest.fn()} onSuccess={jest.fn()} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'Dress' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ gtin: null })),
    );
  });

  it('clears a previously entered gtin value before submitting', async () => {
    mocked.create.mockResolvedValue({ success: true, data: created, message: '' });
    renderModal(<ProductFormModal show onHide={jest.fn()} onSuccess={jest.fn()} categories={[]} />);
    fireEvent.change(screen.getByTestId('input-product-name'), { target: { value: 'Dress' } });
    fireEvent.change(screen.getByTestId('input-product-gtin'), { target: { value: '4006381333931' } });
    fireEvent.change(screen.getByTestId('input-product-gtin'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ gtin: null })),
    );
  });
```

These three cases cover "entering, submitting, and clearing a gtin value" verbatim as required by
task 9.4. They follow the exact `waitFor` + `mocked.create` assertion idiom already used by every
other test in this file (this is asserting on a `jest.fn()` mock call, not a `screen.getBy*` query, so
the `testing-library/prefer-find-by` ESLint rule does not apply here — same as the existing translation
test at lines 61-75).

### Verification (task 9.5)
Run: `npx jest ProductFormModal --watchAll=false` (or the project's standard single-file test command)
from `frontend/`, then `npx eslint src --ext .ts,.tsx` per the CI `frontend-quality` gate.

---

## 4. `frontend/src/pages/storefront/ProductPage.tsx`

Current file was re-read in full for this plan (post-commit `69d56c7`, which already added
`brand`/`hasMerchantReturnPolicy`/`shippingDetails`). The relevant block is `productJsonLd`, currently
lines 116-169:

```tsx
116  const productJsonLd = {
117    '@context': 'https://schema.org',
118    '@type': 'Product',
119    name: product.name,
120    ...(seoImage ? { image: seoImage } : {}),
121    ...(product.description ? { description: product.description } : {}),
122    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
123    ...(structuredDataVariant
124      ? {
...
169  };
```

### Edit 4.1 — conditional GTIN emission (task 10.1)
Insert a new spread block immediately after line 122 (the `brand` block) and before line 123
(the `structuredDataVariant` block):

```tsx
    ...(product.gtin
      ? product.gtin.length === 13
        ? { gtin13: product.gtin }
        : { gtin: product.gtin }
      : {}),
```

Result (lines 116-124 after edit):
```tsx
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(seoImage ? { image: seoImage } : {}),
    ...(product.description ? { description: product.description } : {}),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(product.gtin
      ? product.gtin.length === 13
        ? { gtin13: product.gtin }
        : { gtin: product.gtin }
      : {}),
    ...(structuredDataVariant
      ? {
```

Rationale for the length check being sufficient (no extra 8/12/14 allow-list check needed here):
`product.gtin` is only ever a value that already passed backend validation (digits-only, length ∈
{8,12,13,14}) or is `null` — see `design.md` "Validation" decision and `spec.md` "GTIN format
validation" requirement. So on the frontend, `null` is handled by the outer ternary, and any non-null
value is guaranteed by contract to be exactly one of the four valid lengths. `length === 13` therefore
correctly routes 13-digit values to `gtin13` and all other valid values (8/12/14) fall through to the
generic `gtin` property, exactly matching spec.md's two scenarios ("13-digit → gtin13", "8/12/14-digit
→ gtin"). No new helper function is needed — this stays inline, consistent with how `brand` and
`seoImage`/`description` are handled inline in the same object literal (no extracted helper for those
either; `buildSeoDescription` at the top of the file is a different, string-truncation concern, not a
pattern to imitate here).

**Do not** touch any other part of `productJsonLd` (`offers`, `hasMerchantReturnPolicy`,
`shippingDetails`, etc.) — those were added in commit `69d56c7` and are unrelated to this change.

**Do not** render `gtin` anywhere in the visible page body (unlike `brand`, which is also shown as
`<p className="storefront-pdp-brand">` at lines 210-212) — `gtin` is a barcode identifier with no
proposed UI surface in `proposal.md`/`design.md`; this change is structured-data-only, matching
spec.md's "Storefront structured data emits GTIN" requirement, which only talks about JSON-LD.

---

## 5. `frontend/src/pages/storefront/__tests__/ProductPage.test.tsx`

Current file (60 lines) has one `describe('ProductPage language refetch', ...)` block with one test,
and a `mockGetById.mockResolvedValue(...)` fixture in its `beforeEach` (lines 34-47):

```ts
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Dress',
        slug: 'dress',
        description: 'A dress',
        brand: null,
        status: 'Active',
        mainImageUrl: null,
        categoryId: null,
        createdAt: '',
        updatedAt: '',
      },
    });
```

### Edit 5.1 — add `gtin: null` to the existing fixture (task 11, consistency)
Insert `gtin: null,` immediately after `brand: null,` (this mock is not strictly type-checked against
`Product` today because `productService` is replaced via `jest.mock(...)` with an untyped factory —
see note below — but keep it in sync so the fixture stays representative and doesn't silently diverge
from the real shape):
```ts
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Dress',
        slug: 'dress',
        description: 'A dress',
        brand: null,
        gtin: null,
        status: 'Active',
        mainImageUrl: null,
        categoryId: null,
        createdAt: '',
        updatedAt: '',
      },
    });
```

### Edit 5.2 — new `describe` block for GTIN JSON-LD emission (task 10.2)
Append a new top-level `describe` block after the existing one (after the closing `});` on line 59,
at the end of the file). No new imports are required — `waitFor` and `renderWithI18n` are already
imported at the top of the file; `renderWithI18n` already wraps its tree in `HelmetProvider` (see
`frontend/src/test-utils/renderWithI18n.tsx` lines 47-51), which is required for `react-helmet-async`'s
`<script>` tags to actually land in `document.head` during the test — this is the same pattern already
proven in `frontend/src/components/storefront/Seo.test.tsx` (which asserts on
`document.querySelector('script[type="application/ld+json"]')` after a `HelmetProvider`-wrapped
render).

```tsx
describe('ProductPage structured data - gtin', () => {
  const baseProduct = {
    id: 1,
    name: 'Dress',
    slug: 'dress',
    description: 'A dress',
    brand: null,
    status: 'Active',
    mainImageUrl: null,
    categoryId: null,
    createdAt: '',
    updatedAt: '',
  };

  const getProductJsonLd = async () => {
    const scripts = await waitFor(() => {
      const found = document.querySelectorAll('script[type="application/ld+json"]');
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    return JSON.parse(scripts[0].textContent ?? '{}');
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCategoryGetAll.mockResolvedValue([]);
  });

  it('emits gtin13 for a 13-digit gtin', async () => {
    mockGetById.mockResolvedValue({ data: { ...baseProduct, gtin: '4006381333931' } });
    renderWithI18n(<ProductPage />, { lng: 'en' });
    const jsonLd = await getProductJsonLd();
    expect(jsonLd.gtin13).toBe('4006381333931');
    expect(jsonLd.gtin).toBeUndefined();
  });

  it('emits generic gtin for an 8, 12, or 14-digit gtin', async () => {
    mockGetById.mockResolvedValue({ data: { ...baseProduct, gtin: '12345678' } });
    renderWithI18n(<ProductPage />, { lng: 'en' });
    const jsonLd = await getProductJsonLd();
    expect(jsonLd.gtin).toBe('12345678');
    expect(jsonLd.gtin13).toBeUndefined();
  });

  it('omits gtin and gtin13 from structured data when product.gtin is null', async () => {
    mockGetById.mockResolvedValue({ data: { ...baseProduct, gtin: null } });
    renderWithI18n(<ProductPage />, { lng: 'en' });
    const jsonLd = await getProductJsonLd();
    expect(jsonLd.gtin).toBeUndefined();
    expect(jsonLd.gtin13).toBeUndefined();
  });
});
```

Implementation notes:
- `scripts[0]` is `productJsonLd` specifically (not `breadcrumbJsonLd`), because `Seo` receives
  `jsonLd={[productJsonLd, breadcrumbJsonLd]}` at `ProductPage.tsx` line 197 and `Seo.tsx` renders one
  `<script>` per array element in order (`Seo.tsx` lines 49-55) — so index 0 is always the product
  block.
- `getProductJsonLd`'s `waitFor` callback both asserts and returns the `NodeList`, matching the
  existing async-DOM-query idiom already used in `Seo.test.tsx` (`await waitFor(() =>
  expect(document.querySelector(...)).toBeInTheDocument())`); this does not use `screen.getBy*`, so
  `testing-library/prefer-find-by` does not apply here — consistent with the existing file's use of
  `waitFor(() => expect(mockGetById).toHaveBeenCalledTimes(...))`.
- `baseProduct` intentionally omits `gtin` so each test spreads its own value in — avoids repeating
  the full fixture three times and keeps each test's relevant value visible at the call site.
- `mockCategoryGetAll` must be re-stubbed in this block's own `beforeEach` (it's not shared across
  `describe` blocks automatically beyond module-level `jest.mock`), mirroring the existing
  `describe('ProductPage language refetch', ...)` block's own `beforeEach` at lines 31-33.
- Do not add a `gtin` value to the top-level `describe('ProductPage language refetch', ...)` block's
  own tests beyond Edit 5.1 — that block is about the language-refetch behavior, unrelated to GTIN;
  keep that concern isolated in the new block per task 10.2's "extend... or add a focused test"
  wording (this plan adds a focused, separate block).

### Verification (task 10.3)
Run: `npx jest ProductPage --watchAll=false` (or the project's standard single-file test command) from
`frontend/`, then `npx eslint src --ext .ts,.tsx`.

---

## 6. Task 11 cross-check (mandatory review of existing tests)

Ran a repo-wide search for other `Product`-typed fixtures / hardcoded-shape assertions that could
break once `gtin` becomes a required key on the `Product` interface:

- `frontend/src/components/storefront/ProductCard.tsx` / `ProductCard.test.tsx` — grep hit was on the
  word "brand" in CSS/copy context, not a `Product`-typed object construction; **no `gtin` needed**
  (worth a quick double-check by the implementer since this plan is based on a grep, not a full read,
  but `ProductCard`'s prop type is worth confirming doesn't redeclare a local `Product`-like shape).
- `frontend/src/pages/__tests__/ProductsPage.test.tsx` and
  `frontend/src/pages/__tests__/ProductDetailPage.test.tsx` — these belong to the **admin**
  `ProductsPage`/`ProductDetailPage` pair (see Scope note below), which is a distinct, pre-existing
  admin edit flow not listed in tasks.md section 9. If their fixtures are typed as `Product`, they will
  fail to compile once `gtin` is added to the interface and will need `gtin: null` added the same way
  as sections 3 and 5 above. **This plan did not deep-read those two test files** (out of the
  explicitly assigned scope of files to read), so the implementer must open them first and, if they
  contain a `Product`-typed literal, add `gtin: null,` next to their existing `brand: null,` line
  before running tests — otherwise `npm test` in `frontend/` will fail to compile with a "missing
  property `gtin`" TypeScript error.
- No other `.test.tsx`/`.tsx` file in `frontend/src` matched `brand` besides the ones listed above and
  the ones already covered in this plan.

## Scope note: `frontend/src/pages/ProductDetailPage.tsx` is NOT part of this plan

While researching, this plan's author found that `frontend/src/pages/ProductDetailPage.tsx` (an
**admin edit** page, distinct from `ProductFormModal.tsx` which is create-only) already has its own
`brand` form field wired to `UpdateProductInput` (local `formData.brand` state, submit payload at
line 130, input at lines 316-317). This file is **not** mentioned in `tasks.md` section 9 (which only
names `ProductFormModal.tsx`) and was **not** in the explicit list of files the parent session asked
this plan to read/touch, so it is intentionally left out of this plan.

Practical consequence: after this change ships, admins will be able to **set** `gtin` at product
**creation** time (via `ProductFormModal.tsx`) but will have **no UI to edit `gtin` on an existing
product** afterward (since `ProductDetailPage.tsx` won't know about it), even though the type
(`UpdateProductInput.gtin`) and backend PATCH endpoint will support it. This mirrors whatever the
current situation already is for `brand` if `ProductDetailPage.tsx` was never listed as in-scope for
that feature either — but since `ProductDetailPage.tsx` demonstrably *does* already handle `brand`,
this looks like a real gap for `gtin` specifically. Flagging this for the parent session to decide
whether `ProductDetailPage.tsx` should be added to tasks.md before implementation, rather than silently
expanding this plan's scope beyond what was asked.

---

## Summary of files touched by this plan

1. `frontend/src/types/product.ts` — 3 field additions (`Product`, `CreateProductInput`,
   `UpdateProductInput`).
2. `frontend/src/components/admin/ProductFormModal.tsx` — `FormData` type, `EMPTY`, submit payload,
   new `Form.Group` with `data-testid="input-product-gtin"`.
3. `frontend/src/components/admin/__tests__/ProductFormModal.test.tsx` — fix `created` fixture, add 3
   new tests.
4. `frontend/src/pages/storefront/ProductPage.tsx` — one new conditional spread block in
   `productJsonLd` (after the existing `brand` block, before `structuredDataVariant`).
5. `frontend/src/pages/storefront/__tests__/ProductPage.test.tsx` — fix existing fixture, add new
   `describe` block with 3 tests.

Not touched (flagged for parent-session decision): `frontend/src/pages/ProductDetailPage.tsx` and its
test file, `frontend/src/pages/__tests__/ProductDetailPage.test.tsx` / `ProductsPage.test.tsx` (need a
quick read-and-patch-if-needed pass for compile-safety even if left out of feature scope).

## Verification commands (to run after implementing, not part of this plan's job)

From `frontend/`:
```
npx eslint src --ext .ts,.tsx
npx jest ProductFormModal ProductPage --watchAll=false
npm test -- --watchAll=false
```
