# Frontend Implementation Plan — product-multilingual-translations

Generated: 2026-06-25
Feature branch: `feature/product-multilingual-translations`
Spec source: `openspec/changes/product-multilingual-translations/specs/storefront-i18n/spec.md` and `specs/admin-product-panel/spec.md`
Tasks covered: 10.1–10.3, 11.1–11.3, 12.1–12.4, 13.1–13.6

---

## CRITICAL PATH NOTES (read before implementing)

### File path corrections

The task instructions reference file paths that do not exist. Actual paths:

| Referenced path | Actual path |
|---|---|
| `frontend/src/pages/storefront/ProductsPage.tsx` | `frontend/src/pages/storefront/CatalogPage.tsx` |
| `frontend/src/pages/storefront/ProductDetailPage.tsx` | `frontend/src/pages/storefront/ProductPage.tsx` |

`frontend/src/pages/ProductsPage.tsx` and `frontend/src/pages/ProductDetailPage.tsx` are the **admin** pages and must not be confused with the storefront equivalents.

### Admin i18n constraint

`frontend/src/i18n/index.ts` and `docs/frontend-standards.md` state: "i18n is enabled only for the public storefront. Admin components must never call `useTranslation`." The `ProductFormModal` currently uses hardcoded English labels — that convention is kept. Task 13.4 (add i18n keys for admin tab labels) is superseded by this rule; labels go as hardcoded strings in JSX.

### Architecture of locale resolution

The backend resolves the translated name/description at the serialization layer and returns them as `product.name` and `product.description` in the API response. The frontend does NOT perform client-side locale selection from a `translations` array for the storefront display — it simply renders what the API returns. The `Accept-Language` interceptor is the mechanism that signals the backend which locale to apply.

### i18n instance import

The i18next singleton is initialized in `frontend/src/i18n/index.ts` and exported as default (`export default i18n`). In non-React modules (service files), import it as:
```typescript
import i18n from '../i18n';
```
The interceptor is registered at module load time but reads `i18n.language` lazily at request time, so initialization order is not a concern.

---

## 1. `frontend/src/types/product.ts`

**Type of change:** Modify (additive only, no breaking changes)

### What to add

**A. New `ProductTranslation` interface** — insert after the `ProductImage` interface (around line 27):

```typescript
export interface ProductTranslation {
  locale: string;          // 'en' | 'es'
  name: string;
  description?: string | null;
  source: string;          // 'manual' | 'import' | 'machine'
}
```

**B. Add `translations` to `Product`** — add as an optional field after `images?` (around line 39):

```typescript
translations?: ProductTranslation[];
```

**C. Add `translations` to `CreateProductInput`** — add as optional field (after `categoryId`):

```typescript
translations?: Array<{ locale: string; name: string; description?: string }>;
```

**D. Add `translations` to `UpdateProductInput`** — same as above:

```typescript
translations?: Array<{ locale: string; name: string; description?: string }>;
```

### Key implementation details

- `ProductTranslation` is the response-side type (includes `source`); the write-side type in `CreateProductInput`/`UpdateProductInput` is a lighter inline type (no `source` — the backend defaults it to `"manual"`).
- `translations` is optional on `Product` because the admin list endpoint may omit it in the future; always check presence before `.find()`.
- No changes to `ProductListResponse`, `ProductResponse`, or any variant/image types.

---

## 2. `frontend/src/services/productService.ts`

**Type of change:** Modify

### What to change

Replace the single bare `axios.get` calls with a **dedicated Axios instance** that carries the `Accept-Language` interceptor.

**Step 1 — Add i18n import** at the top, after existing imports:

```typescript
import i18n from '../i18n';
```

**Step 2 — Create dedicated Axios instance** before the `productService` export (after the `API_BASE_URL` constant):

```typescript
const publicProductAxios = axios.create({
  baseURL: API_BASE_URL,
});

publicProductAxios.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = i18n.language || 'es';
  return config;
});
```

**Step 3 — Swap `axios.get` → `publicProductAxios.get` in `getAll` and `getById`:**

- `getAll`: change `await axios.get<ProductListResponse>('${API_BASE_URL}/api/public/products', { params })` to `await publicProductAxios.get<ProductListResponse>('/api/public/products', { params })`
- `getById`: change `await axios.get<ProductResponse>('${API_BASE_URL}/api/public/products/${id}')` to `await publicProductAxios.get<ProductResponse>('/api/public/products/${id}')`

### Key implementation details

- The interceptor is added to `publicProductAxios`, **not** the global `axios` instance — admin service requests are unaffected.
- Fallback `|| 'es'` matches the i18next `fallbackLng: 'es'` setting.
- `baseURL` is set to `API_BASE_URL` (not to `/api/public/products`) so that paths remain explicit and readable.
- The stub methods `create`, `update`, `delete` at the bottom of the file remain unchanged (they throw `NotImplemented`).
- No changes to function signatures or return types.

---

## 3. `frontend/src/pages/storefront/CatalogPage.tsx`

**Type of change:** Modify (two-line change)

### What to change

**Line 25** — add `i18n` to the destructured return of `useTranslation`:

```typescript
// Before
const { t } = useTranslation('catalog');

// After
const { t, i18n } = useTranslation('catalog');
```

**`fetchProducts` useCallback dependency array** (currently `[page, categoryId, search, sort, order, t]`) — append `i18n.language`:

```typescript
// Before
}, [page, categoryId, search, sort, order, t]);

// After
}, [page, categoryId, search, sort, order, t, i18n.language]);
```

### Key implementation details

- The existing `useEffect(() => { fetchProducts(); }, [fetchProducts])` pattern means adding `i18n.language` to the `useCallback` deps automatically propagates: language change → new `fetchProducts` reference → `useEffect` fires → new API call with updated `Accept-Language` header.
- `i18n` (the i18next instance object) is stable across renders; `i18n.language` (a string) is what changes. Putting `i18n.language` in deps is correct and idiomatic.
- No other component or hook caches product data in a way that would suppress the re-render: `products` state lives in `CatalogPage` only, passed as props to `ProductGrid`.

---

## 4. `frontend/src/pages/storefront/ProductPage.tsx`

**Type of change:** Modify (three additions)

### What to change

**Step 1 — Add import** (after existing imports near the top):

```typescript
import { useTranslation } from 'react-i18next';
```

**Step 2 — Destructure `i18n`** inside the `ProductPage` component body, after the existing hook calls:

```typescript
const { i18n } = useTranslation();
```

**Step 3 — Add `i18n.language` to the `useEffect` dependency array** (currently `[id]`):

```typescript
// Before
}, [id]);

// After
}, [id, i18n.language]);
```

### Key implementation details

- The `useEffect` in `ProductPage` uses the `.then/.catch/.finally` promise chain pattern (not `async/await`). Adding `i18n.language` to `[id]` is sufficient — the effect re-runs, the service call picks up the new `Accept-Language` header from the interceptor.
- The `setIsLoading(true)`, `setNotFound(false)`, `setError(null)` reset block at the start of the effect already handles stale state, so the re-fetch on language change is safe.
- `useTranslation()` is called with no namespace (defaults to `'common'`). This is only to access `i18n.language`; the page still renders hardcoded English strings (out of scope to localize further in this change).
- No changes to the JSX; `product.name` and `product.description` will automatically show the locale-resolved values from the API.

---

## 5. `frontend/src/components/admin/ProductFormModal.tsx`

**Type of change:** Modify (significant — adds translation fields and edit mode)

### What to change

#### 5a. Props type — add optional `product` for edit mode

```typescript
type ProductFormModalProps = {
  show: boolean;
  onHide: () => void;
  onSuccess: (product: Product) => void;
  categories: Category[];
  product?: Product;   // NEW: when provided, modal runs in edit mode
};
```

#### 5b. `FormData` type — extend with four translation string fields

```typescript
type FormData = {
  name: string;
  description: string;
  brand: string;
  categoryId: string;
  mainImageUrl: string;
  // Translation fields (empty string = field not filled)
  translationEnName: string;
  translationEnDescription: string;
  translationEsName: string;
  translationEsDescription: string;
};
```

#### 5c. `EMPTY` constant — extend to match new `FormData`

```typescript
const EMPTY: FormData = {
  name: '', description: '', brand: '', categoryId: '', mainImageUrl: '',
  translationEnName: '', translationEnDescription: '',
  translationEsName: '', translationEsDescription: '',
};
```

#### 5d. Component destructuring — add `product` to props

```typescript
const ProductFormModal: React.FC<ProductFormModalProps> = ({
  show, onHide, onSuccess, categories, product,
}) => {
```

#### 5e. `useEffect` on `show` — pre-populate from `product` when in edit mode

Replace the current `useEffect` (which only resets to `EMPTY`) with:

```typescript
useEffect(() => {
  if (show) {
    if (product) {
      const enT = product.translations?.find((t) => t.locale === 'en');
      const esT = product.translations?.find((t) => t.locale === 'es');
      setFormData({
        name: product.name,
        description: product.description ?? '',
        brand: product.brand ?? '',
        categoryId: product.categoryId ? String(product.categoryId) : '',
        mainImageUrl: product.mainImageUrl ?? '',
        translationEnName: enT?.name ?? '',
        translationEnDescription: enT?.description ?? '',
        translationEsName: esT?.name ?? '',
        translationEsDescription: esT?.description ?? '',
      });
    } else {
      setFormData(EMPTY);
    }
    setError('');
  }
}, [show, product]);
```

#### 5f. `handleSubmit` — build `translations` array and dispatch create vs. update

Replace the current `handleSubmit` body:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!formData.name.trim()) { setError('Name is required.'); return; }
  setSaving(true);
  setError('');
  try {
    // Build translations — only include a locale if its name is non-empty
    const translations: Array<{ locale: string; name: string; description?: string }> = [];
    if (formData.translationEnName.trim()) {
      translations.push({
        locale: 'en',
        name: formData.translationEnName.trim(),
        ...(formData.translationEnDescription
          ? { description: formData.translationEnDescription }
          : {}),
      });
    }
    if (formData.translationEsName.trim()) {
      translations.push({
        locale: 'es',
        name: formData.translationEsName.trim(),
        ...(formData.translationEsDescription
          ? { description: formData.translationEsDescription }
          : {}),
      });
    }

    const basePayload = {
      name: formData.name.trim(),
      description: formData.description || null,
      brand: formData.brand || null,
      categoryId: formData.categoryId ? Number(formData.categoryId) : null,
      mainImageUrl: formData.mainImageUrl || null,
      ...(translations.length > 0 ? { translations } : {}),
    };

    const res = product
      ? await adminProductService.update(product.id, basePayload)
      : await adminProductService.create(basePayload);
    onSuccess(res.data);
    onHide();
  } catch (err) {
    setError(extractErrorMessage(err));
  } finally {
    setSaving(false);
  }
};
```

#### 5g. Imports — add `Tabs` and `Tab` from react-bootstrap

```typescript
import { Modal, Form, Button, Alert, Tabs, Tab } from 'react-bootstrap';
```

#### 5h. JSX — add translation tabs section after `mainImageUrl` Form.Group and update title + save label

After the existing `mainImageUrl` `Form.Group` block (before `</Modal.Body>`), add:

```tsx
<hr />
<p className="fw-semibold mb-2">Translations</p>
<Tabs defaultActiveKey="en" className="mb-3" data-testid="tabs-translations">
  <Tab eventKey="en" title="English">
    <Form.Group className="mb-3">
      <Form.Label>Name (EN)</Form.Label>
      <Form.Control
        type="text"
        value={formData.translationEnName}
        onChange={(e) => handleChange('translationEnName', e.target.value)}
        maxLength={150}
        data-testid="input-translation-en-name"
      />
    </Form.Group>
    <Form.Group className="mb-3">
      <Form.Label>Description (EN)</Form.Label>
      <Form.Control
        as="textarea"
        rows={3}
        value={formData.translationEnDescription}
        onChange={(e) => handleChange('translationEnDescription', e.target.value)}
        maxLength={2000}
        data-testid="textarea-translation-en-description"
      />
    </Form.Group>
  </Tab>
  <Tab eventKey="es" title="Español">
    <Form.Group className="mb-3">
      <Form.Label>Name (ES)</Form.Label>
      <Form.Control
        type="text"
        value={formData.translationEsName}
        onChange={(e) => handleChange('translationEsName', e.target.value)}
        maxLength={150}
        data-testid="input-translation-es-name"
      />
    </Form.Group>
    <Form.Group className="mb-3">
      <Form.Label>Description (ES)</Form.Label>
      <Form.Control
        as="textarea"
        rows={3}
        value={formData.translationEsDescription}
        onChange={(e) => handleChange('translationEsDescription', e.target.value)}
        maxLength={2000}
        data-testid="textarea-translation-es-description"
      />
    </Form.Group>
  </Tab>
</Tabs>
```

Update `Modal.Title` to reflect edit/create mode:
```tsx
<Modal.Title>{product ? 'Edit product' : 'New product'}</Modal.Title>
```

Update the save `Button` label:
```tsx
{saving ? 'Saving…' : (product ? 'Save changes' : 'Create')}
```

### Key implementation details

- `handleChange` helper (existing: `(key: keyof FormData, value: string) => ...`) covers the new keys automatically because they are in `FormData`.
- EN tab is `defaultActiveKey` — it opens first since EN is the "primary" translation.
- `maxLength={150}` on name inputs enforces the 150-character spec rule client-side (backend still validates server-side).
- The modal's `product` prop accepts a `Product` which may have `translations: ProductTranslation[]` (the new field added in step 1).
- The `update` call uses `product.id` (type `number`). `adminProductService.update` already accepts `(id: number, data: UpdateProductInput)`.
- No changes to `data-testid="modal-create-product"` — it stays on the `Modal` element. Both create and edit use the same modal element.
- Admin translation field labels are hardcoded English strings, consistent with the rest of the modal. No `useTranslation` is called (admin i18n constraint).
- `ProductDetailPage.tsx` (admin) has its own inline edit form. Translation editing from that page is **out of scope** for this feature — it would need a separate "Translations" card section there. Document as a known gap.

---

## 6. `frontend/src/services/adminProductService.ts`

**Type of change:** Modify

### What to change

**A. Add `TRANSLATION_LOCALE_INVALID` to `mapProductError`:**

```typescript
case 'TRANSLATION_LOCALE_INVALID':
  return 'Invalid locale. Supported locales are "en" and "es".';
```

**B. No functional changes needed to `create` or `update`** — they already pass the full data object as the request body. With `CreateProductInput` and `UpdateProductInput` now including the optional `translations` field (from task 10), the service methods automatically forward the field without modification.

**C. Add translation sub-route methods** (optional but recommended for future admin UI use):

After the `deleteImage` method, add a new section:

```typescript
// ─── Translations ─────────────────────────────────────────────────────────────

listTranslations: async (productId: number): Promise<{
  success: boolean;
  data: import('../types/product').ProductTranslation[];
  message: string;
}> => {
  try {
    const response = await axios.get(`${ADMIN_BASE}/${productId}/translations`);
    return response.data;
  } catch (error) {
    console.error('Error fetching translations:', error);
    throw error;
  }
},

upsertTranslation: async (
  productId: number,
  locale: string,
  data: { name: string; description?: string },
): Promise<{ success: boolean; data: import('../types/product').ProductTranslation; message: string }> => {
  try {
    const response = await axios.put(`${ADMIN_BASE}/${productId}/translations/${locale}`, data);
    return response.data;
  } catch (error) {
    console.error('Error upserting translation:', error);
    throw error;
  }
},

deleteTranslation: async (productId: number, locale: string): Promise<void> => {
  try {
    await axios.delete(`${ADMIN_BASE}/${productId}/translations/${locale}`);
  } catch (error) {
    console.error('Error deleting translation:', error);
    throw error;
  }
},
```

### Key implementation details

- The `ProductTranslation` import uses an inline `import(...)` type expression to avoid a circular import since the file already imports from `types/product`. Alternatively add `ProductTranslation` to the existing named imports at the top of the file — either is acceptable.
- `listTranslations`, `upsertTranslation`, `deleteTranslation` are added for completeness and future use (e.g., a dedicated translation management UI). They are not called by the current `ProductFormModal` implementation.
- The `translations` forwarding for create/update works through TypeScript's structural typing: the data object passed to `axios.post`/`axios.patch` is the entire payload, already typed as `CreateProductInput`/`UpdateProductInput` which now includes `translations?`.

---

## 7. `frontend/src/i18n/locales/en/product.json`

**Type of change:** No change required for this feature

The `product.json` namespace currently contains `{}`. This feature does not require new i18n keys because:
1. The storefront `ProductPage.tsx` renders `product.name` and `product.description` which the **backend** resolves to the correct locale. No client-side key is needed.
2. Admin components (`ProductFormModal`) use hardcoded English labels and do not call `useTranslation`.
3. Task 13.4 ("Add i18n label keys for translation tab/section labels") is fulfilled by hardcoded English strings in the modal JSX per the admin i18n constraint.

Leave both `en/product.json` and `es/product.json` as `{}`. If the storefront product page UI strings (currently hardcoded in `ProductPage.tsx`, e.g., "Product not found", "Add to cart") are to be i18n-ified, that is a separate task and not part of this feature scope.

---

## 8. Test files

### 8a. NEW: `frontend/src/services/__tests__/productService.test.ts`

**Create** this file. It does not currently exist.

**What to test:**

Mock i18next and test the interceptor behavior:

```typescript
jest.mock('i18next');           // or jest.mock('../../../i18n')
jest.mock('axios');             // mock axios.create

// Capture the registered interceptor
// Assert it sets config.headers['Accept-Language'] to i18n.language
// Assert fallback to 'es' when i18n.language is empty/undefined
```

**Test cases:**

1. `Accept-Language` is set to `'es'` when `i18n.language === 'es'`
2. `Accept-Language` is set to `'en'` when `i18n.language === 'en'`
3. `Accept-Language` falls back to `'es'` when `i18n.language` is an empty string

**Approach for mocking axios interceptors:**

The standard Jest approach is to mock `axios.create` to return an object with a tracked `interceptors.request.use` function, capture the handler, call it directly, and assert on the mutated config object.

```typescript
import axios from 'axios';

jest.mock('axios', () => {
  const interceptorHandler = { fn: null as ((c: unknown) => unknown) | null };
  const instance = {
    get: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn((fn) => { interceptorHandler.fn = fn; }),
      },
    },
  };
  return {
    ...jest.requireActual('axios'),
    create: jest.fn(() => instance),
    __interceptorHandler: interceptorHandler,
  };
});
```

Then in each test: `const { fn } = (axios as any).__interceptorHandler; const config = { headers: {} }; fn(config); expect(config.headers['Accept-Language']).toBe('es');`

**ESLint compliance:** No RTL queries used in this file, so `testing-library/prefer-find-by` does not apply.

### 8b. MODIFY: `frontend/src/services/__tests__/adminProductService.test.ts`

**Add to the existing `mapProductError` test suite:**

```typescript
it('maps TRANSLATION_LOCALE_INVALID to a locale-specific message', () => {
  expect(mapProductError('TRANSLATION_LOCALE_INVALID')).toContain('locale');
});
```

**Optionally add integration-style tests for translations in payload:**

Mock axios and assert that `adminProductService.create({ name: 'X', translations: [{ locale: 'es', name: 'Y' }] })` sends the `translations` array in the POST body. This follows the existing pattern in the file (which already mocks axios via `AxiosError`).

### 8c. NEW: `frontend/src/pages/storefront/__tests__/CatalogPage.test.tsx`

**Create** this file. No existing test for `CatalogPage.tsx`.

**Render helper:** Use `renderWithI18n` from `frontend/src/test-utils/renderWithI18n.tsx` (per `docs/frontend-standards.md` — storefront i18n-aware components must not be rendered with plain `render()`).

**What to test:**

1. Catalog renders product names from `productService.getAll` response.
2. When `i18n.language` changes (use `act(() => i18n.changeLanguage('es'))`), `productService.getAll` is called a second time.
3. Loading state is shown before the first response.
4. Error message is shown when `productService.getAll` rejects.

**Mock:**
```typescript
jest.mock('../../../services/productService');
const mockedProductService = productService as jest.Mocked<typeof productService>;
```

**ESLint rule:** Use `findBy*` for async assertions. Example:
```typescript
expect(await screen.findByText('Some Product Name')).toBeInTheDocument();
```

**Note on MemoryRouter:** `CatalogPage` uses `useSearchParams`, so wrap in `MemoryRouter initialEntries={['/catalog']}`.

### 8d. NEW: `frontend/src/pages/storefront/__tests__/ProductPage.test.tsx`

**Create** this file. No existing test for `ProductPage.tsx`.

**Render helper:** Use `renderWithI18n` + wrap in `MemoryRouter` with `<Route path="/catalog/:id">`.

**What to test:**

1. Product name and description render from `productService.getById` response.
2. Renders "Product not found" when status is not `'Active'`.
3. Renders error state when `productService.getById` rejects.
4. When `i18n.language` changes (via `act(() => i18n.changeLanguage('es'))`), `productService.getById` is called again.

**Mock:**
```typescript
jest.mock('../../../services/productService');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: '42' }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
```

**ESLint rule:** Use `findBy*` for async assertions.

### 8e. MODIFY: `frontend/src/components/admin/__tests__/ProductFormModal.test.tsx`

**Existing tests to update:**

- `'creates a product and calls onSuccess'` — add assertion that `mocked.create` is called with a payload that does NOT include `translations` when translation fields are not filled.
- Add new test: `'includes EN translation in payload when EN name is filled'` — render modal, fill `input-translation-en-name`, submit, assert `mocked.create` called with `translations: [{ locale: 'en', name: '...' }]`.
- Add new test: `'pre-populates translation fields in edit mode'` — render with `product` prop that has `translations: [{ locale: 'es', name: 'Nombre ES', description: 'Desc ES', source: 'manual' }]`, assert `input-translation-es-name` has value `'Nombre ES'`.
- Add new test: `'calls update instead of create in edit mode'` — render with `product` prop, submit, assert `mocked.update` was called (not `mocked.create`).
- Update the existing mock to also include `update` method:
  ```typescript
  adminProductService: { create: jest.fn(), update: jest.fn() }
  ```

**ESLint compliance:** The file currently uses `waitFor` — check if any assertions need to be converted to `findBy*`. The existing test:
```typescript
await waitFor(() => expect(mocked.create).toHaveBeenCalledWith(...))
```
This is a mock call assertion, not a DOM query, so `waitFor` is acceptable here per the `testing-library/prefer-find-by` rule (which only applies to DOM queries). No change needed to existing assertions.

---

## Summary table

| File | Action | Tasks |
|---|---|---|
| `frontend/src/types/product.ts` | Modify — add `ProductTranslation` interface, extend `Product`, `CreateProductInput`, `UpdateProductInput` | 10.1, 10.2, 10.3 |
| `frontend/src/services/productService.ts` | Modify — add `publicProductAxios` instance + `Accept-Language` interceptor | 11.1, 11.2 |
| `frontend/src/pages/storefront/CatalogPage.tsx` | Modify — add `i18n` to `useTranslation`, add `i18n.language` to `fetchProducts` deps | 12.1 |
| `frontend/src/pages/storefront/ProductPage.tsx` | Modify — add `useTranslation`, add `i18n.language` to `useEffect` deps | 12.2 |
| `frontend/src/components/admin/ProductFormModal.tsx` | Modify — add `product?` prop, translation `FormData` fields, `Tabs` UI, create/edit dispatch | 13.1, 13.2, 13.3 |
| `frontend/src/services/adminProductService.ts` | Modify — add `TRANSLATION_LOCALE_INVALID` error code, add translation sub-route methods | 13.5 |
| `frontend/src/i18n/locales/en/product.json` | No change — admin labels hardcoded; storefront backend-resolved | 13.4 N/A |
| `frontend/src/i18n/locales/es/product.json` | No change — same reason | 13.4 N/A |
| `frontend/src/services/__tests__/productService.test.ts` | Create — interceptor unit tests | 11.3 |
| `frontend/src/services/__tests__/adminProductService.test.ts` | Modify — add `TRANSLATION_LOCALE_INVALID` and translations-in-payload tests | 13.6 |
| `frontend/src/pages/storefront/__tests__/CatalogPage.test.tsx` | Create — re-fetch on language change assertion | 12.4 |
| `frontend/src/pages/storefront/__tests__/ProductPage.test.tsx` | Create — re-fetch on language change assertion | 12.4 |
| `frontend/src/components/admin/__tests__/ProductFormModal.test.tsx` | Modify — add translation field and edit mode tests | 13.6 |

**ESLint reminder:** Before marking any implementation step complete, run:
```bash
cd frontend && npx eslint src --ext .ts,.tsx
```
All new test files must use `findBy*` for DOM queries, not `waitFor + getBy*`.
