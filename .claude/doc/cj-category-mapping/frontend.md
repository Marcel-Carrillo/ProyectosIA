# Frontend Implementation Plan — cj-category-mapping

Scope: tasks.md section 9 (Promote Modal — Auto vs Fixed Category) plus the frontend-facing portions of
section 13 (E2E testing hooks/testids the Playwright steps will drive — no new frontend *code* is required
for 13 beyond what section 9 already produces).

This plan builds strictly on the **current** state of the three files below (already reworked this week by a
prior session to add the automatic freight-estimate fetch — `Promise.allSettled` over all items on open,
`freightEstimates` state keyed by item id, `loading`/`error` per-item states, no manual "Consultar envío"
button). Nothing here removes or restructures that shipping-estimate UI; the category auto/override toggle is
added alongside it inside the same `Form.Group`/`Modal.Body` layout.

Relevant delta-spec scenarios this plan must satisfy (`cj-catalog-promotion` spec):
- "Promotion without a request categoryId resolves the real CJ category automatically" — default UI mode
  sends **no** `categoryId`.
- "An explicit request categoryId overrides CJ's own category" — override toggle + dropdown sends an explicit
  `categoryId`.
- "Promotion fails when no category can be resolved by any means" (`CJ_PROMOTION_CATEGORY_REQUIRED`) — this is
  now a **server-side** possibility even in auto mode (CJ resolution failed AND no fallback configured), not
  just a client-side "you forgot to pick a category" guard. The client-side guard now only applies when the
  admin has explicitly turned on manual override and left the dropdown empty.

---

## 1. `frontend/src/types/cjCatalog.ts`

**Change:** make `categoryId` optional on `CjPromoteRequest`, mirroring the backend's now-optional
`CjPromotionRequestInput.categoryId` (design.md Decision 6 / tasks.md 6.1).

```ts
export interface CjPromoteRequest {
  items: CjPromoteItemInput[];
  categoryId?: number;
  activate?: boolean;
}
```

That's the only change in this file. `CjCatalogItem`, `CjPromoteResponse`, etc. are untouched — CJ category
resolution/mapping details (`SupplierCategoryMapping`) are a backend/domain concept; nothing about them needs
to be surfaced in the frontend catalog item shape for this increment (the admin sees the *result* — the
product's assigned category — via the existing admin Products page category column, not inside this modal).

## 2. `frontend/src/services/cjCatalogService.ts`

**Change:** none required. `cjCatalogService.promote()` already forwards whatever `CjPromoteRequest` object
it's given straight to `axios.post(..., payload)` (lines 68–76 of the current file). Since `categoryId` becomes
optional in the type (change 1) and the component (change 3) will either omit the key or send a number, no
service-layer code changes are needed. Axios's default JSON serialization (`JSON.stringify`) already drops
object keys whose value is `undefined`, so `{ categoryId: undefined, ... }` and `{ ...(no categoryId key) }`
both serialize identically over the wire — the modal should still prefer omitting the key entirely (see change
3) for cleaner test assertions (`expect.objectContaining` / `not.toHaveProperty`).

`mapCjCatalogError` already has a `CJ_PROMOTION_CATEGORY_REQUIRED` mapping (line 19-20) — reused as-is; no new
error code was introduced by this change.

## 3. `frontend/src/components/admin/CjPromoteModal.tsx`

This is the only component change. Current relevant state (unchanged, keep as-is):
- `categoryId: string` (line 32) — **repurposed**: now only meaningful when override mode is on.
- `activateOnPromote`, `overrides`, `submitting`, `error`, `freightEstimates` — untouched, keep exactly as they
  are (do not restructure the freight-estimate `useEffect` at lines 56-93 or its reset effect at lines 39-47
  beyond the one addition below).

### 3.1 New state

Add one new piece of state, `overrideCategory`, right next to the existing `categoryId` state:

```tsx
const [categoryId, setCategoryId] = useState('');
const [overrideCategory, setOverrideCategory] = useState(false);
```

### 3.2 Reset effect (lines 39-47)

Add `setOverrideCategory(false)` to the existing show-reset effect so re-opening the modal for a new batch
always starts back in auto mode (matches how `categoryId`, `overrides`, `freightEstimates`, `error` are already
reset on open):

```tsx
useEffect(() => {
  if (show) {
    setCategoryId('');
    setOverrideCategory(false);
    setActivateOnPromote(false);
    setOverrides({});
    setFreightEstimates({});
    setError('');
  }
}, [show]);
```

Do not touch the freight-estimate-fetching `useEffect` (lines 56-93) — it is orthogonal to category resolution
and already has its own documented reason for depending only on `[show]`.

### 3.3 `handleSubmit` (lines 102-128)

Replace the unconditional category guard with one that only fires in override mode, and make the payload omit
`categoryId` entirely in auto mode:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (overrideCategory && !categoryId) {
    setError('Seleccione una categoría antes de promocionar.');
    return;
  }
  setSubmitting(true);
  setError('');
  try {
    await cjCatalogService.promote(supplierId, {
      items: items.map((item) => {
        const override = overrides[item.id];
        const publicPrice = override?.publicPrice ? Number(override.publicPrice) : undefined;
        const compareAtPrice = override?.compareAtPrice ? Number(override.compareAtPrice) : undefined;
        return { cjCatalogItemId: item.id, publicPrice, compareAtPrice };
      }),
      ...(overrideCategory && categoryId ? { categoryId: Number(categoryId) } : {}),
      activate: activateOnPromote,
    });
    onSuccess();
    onHide();
  } catch (err) {
    setError(extractCjCatalogErrorMessage(err));
  } finally {
    setSubmitting(false);
  }
};
```

Note: a server-side `CJ_PROMOTION_CATEGORY_REQUIRED` rejection (auto mode, CJ resolution failed, no fallback
configured) is already handled by the existing `catch` block via `extractCjCatalogErrorMessage` — no new
error-handling branch needed, the mapping in `cjCatalogService.ts` already covers this code.

### 3.4 Category `Form.Group` markup (lines 139-153)

Replace the current always-visible mandatory dropdown with a checkbox that defaults off (auto mode) and reveals
the existing dropdown only when checked. Keep the dropdown's `data-testid="select-promote-category"` unchanged
(it's referenced by `frontend/src/pages/__tests__/CjCatalogPage.test.tsx`, see change 5 below) and keep the
`categories.map(...)` options block byte-for-byte identical, just nested under the conditional:

```tsx
<Form.Group className="mb-3">
  <Form.Check
    type="checkbox"
    label="Elegir categoría manualmente (en vez de usar la categoría de CJ automáticamente)"
    checked={overrideCategory}
    onChange={(e) => {
      setOverrideCategory(e.target.checked);
      if (!e.target.checked) setCategoryId('');
    }}
    data-testid="checkbox-override-category"
  />
  {!overrideCategory && (
    <Form.Text className="text-muted d-block mt-1" data-testid="auto-category-hint">
      Se usará automáticamente la categoría de CJ Dropshipping. Si no se puede determinar, se usará la
      categoría predeterminada.
    </Form.Text>
  )}
  {overrideCategory && (
    <Form.Select
      className="mt-2"
      value={categoryId}
      onChange={(e) => setCategoryId(e.target.value)}
      data-testid="select-promote-category"
    >
      <option value="">Seleccione una categoría…</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Form.Select>
  )}
</Form.Group>
```

Clearing `categoryId` when the checkbox is unchecked (in the `onChange` handler above) prevents a stale
previously-picked category from silently being sent if the admin toggles override on, picks a category, then
toggles override back off without the code re-defaulting to auto mode — belt-and-suspenders on top of the
`overrideCategory && categoryId` guard already in the payload construction in 3.3.

Everything else in the file (the freight-estimate table, `activateOnPromote` checkbox, footer buttons) is
unchanged.

---

## 4. `frontend/src/components/admin/__tests__/CjPromoteModal.test.tsx`

Existing file mocks `cjCatalogService.freightEstimate` and `cjCatalogService.promote`, and reuses
`extractCjCatalogErrorMessage` via `vi.importActual` (lines 11-18) — follow the exact same mocking shape for
new tests; no new mocks needed since no new service functions are introduced. Existing `item`/`item2`/
`categories`/`renderModal()` fixtures (lines 20-54) are reused as-is.

Per `ai-specs/agents/frontend-developer.md`'s RTL/ESLint standard for this repo (`testing-library/prefer-find-by`,
enforced by `npx eslint src --ext .ts,.tsx` in CI), use `findBy*` for anything that resolves after an async
effect — do not add new `waitFor` + `getBy*` pairs (the two pre-existing ones in this file at lines 70 and 94
are pre-existing and out of scope to fix here, but do not copy that pattern into new tests).

Add a new `describe` block, e.g. `describe('CjPromoteModal — category auto/override toggle', ...)`, with:

```tsx
describe('CjPromoteModal — category auto/override toggle', () => {
  beforeEach(() => {
    mockFreightEstimate.mockReset();
    mockPromote.mockReset();
    mockFreightEstimate.mockResolvedValue({
      success: true,
      data: { shippingCostEstimate: 1, suggestedPublicPrice: 11 },
      message: 'ok',
    });
  });

  it('defaults to automatic category mode: the override checkbox is unchecked and no category select is shown', async () => {
    renderModal();
    await screen.findByTestId('auto-category-hint');
    expect(screen.getByTestId('checkbox-override-category')).not.toBeChecked();
    expect(screen.queryByTestId('select-promote-category')).not.toBeInTheDocument();
  });

  it('submits without a categoryId when in automatic mode', async () => {
    mockPromote.mockResolvedValue({ data: {} });
    renderModal();
    await screen.findByTestId('auto-category-hint');

    fireEvent.click(screen.getByTestId('btn-modal-promote'));

    await waitFor(() => expect(mockPromote).toHaveBeenCalledTimes(1));
    const payload = mockPromote.mock.calls[0][1];
    expect(payload).not.toHaveProperty('categoryId');
  });

  it('reveals the category select when the override checkbox is checked, and sends the chosen categoryId', async () => {
    mockPromote.mockResolvedValue({ data: {} });
    renderModal();
    await screen.findByTestId('auto-category-hint');

    fireEvent.click(screen.getByTestId('checkbox-override-category'));
    expect(await screen.findByTestId('select-promote-category')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('select-promote-category'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('btn-modal-promote'));

    await waitFor(() =>
      expect(mockPromote).toHaveBeenCalledWith(3, expect.objectContaining({ categoryId: 1 }))
    );
  });

  it('shows a validation error and does not submit when override mode is on but no category is chosen', async () => {
    renderModal();
    await screen.findByTestId('auto-category-hint');

    fireEvent.click(screen.getByTestId('checkbox-override-category'));
    await screen.findByTestId('select-promote-category');
    fireEvent.click(screen.getByTestId('btn-modal-promote'));

    expect(await screen.findByText('Seleccione una categoría antes de promocionar.')).toBeInTheDocument();
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it('resets to automatic mode and clears the chosen category when the modal is reopened', async () => {
    mockPromote.mockResolvedValue({ data: {} });
    const { rerender } = renderModal();
    await screen.findByTestId('auto-category-hint');
    fireEvent.click(screen.getByTestId('checkbox-override-category'));
    await screen.findByTestId('select-promote-category');

    rerender(
      <CjPromoteModal show={false} onHide={vi.fn()} supplierId={3} items={[item]} categories={categories} onSuccess={vi.fn()} />
    );
    rerender(
      <CjPromoteModal show onHide={vi.fn()} supplierId={3} items={[item]} categories={categories} onSuccess={vi.fn()} />
    );

    await screen.findByTestId('auto-category-hint');
    expect(screen.getByTestId('checkbox-override-category')).not.toBeChecked();
    expect(screen.queryByTestId('select-promote-category')).not.toBeInTheDocument();
  });
});
```

Notes:
- These tests need `fireEvent` and `waitFor` imported — the file already imports `render, screen, waitFor` from
  `@testing-library/react` (line 3); add `fireEvent` to that same import.
- `mockPromote.mock.calls[0][1]` avoids importing an extra matcher just to assert key-absence; `not.toHaveProperty`
  is the RTL/Jest-idiomatic equivalent already used implicitly elsewhere in this codebase's admin tests (e.g.
  `CjCatalogPage.test.tsx`'s use of `expect.objectContaining`), and is compatible with the `findBy*`-only ESLint
  rule since it doesn't use `waitFor` + `getBy*` together.
- Run `npx eslint src --ext .ts,.tsx` after adding these tests (per the frontend-developer agent's mandatory
  verification note) before considering this file done.

## 5. `frontend/src/pages/__tests__/CjCatalogPage.test.tsx` (existing tests will break — must be updated)

Not explicitly named in tasks.md section 9, but discovered during research: this integration-level test
exercises `CjPromoteModal` through the real `CjCatalogPage` and currently hard-codes the *old* mandatory-category
behavior in two places. Both will fail once change 3 ships, so they must be updated in the same PR or CI's
`frontend-quality`/test job breaks:

**a) `'promotes successfully, closes the modal, and refetches the list'`** (currently ~line 240-263): it does
`fireEvent.change(within(modal).getByTestId('select-promote-category'), { target: { value: '1' } })` — but that
testid no longer exists in the DOM until the new override checkbox is checked (change 3.4). Update it to check
the checkbox first:

```tsx
fireEvent.click(within(modal).getByTestId('checkbox-override-category'));
fireEvent.change(await within(modal).findByTestId('select-promote-category'), { target: { value: '1' } });
```

Keep the rest of the test (price auto-fill wait, submit click, `expect(mockPromote).toHaveBeenCalledWith(3,
expect.objectContaining({ categoryId: 1, items: [...] }))`) unchanged — it's still valid as an "override mode"
scenario.

Optionally (recommended, matches the delta spec's "Promotion without a request categoryId resolves the real CJ
category automatically" scenario) add a sibling test asserting the **default auto-mode** path through the full
page — select an item, open the modal, submit without touching the category checkbox, and assert `mockPromote`
was called with a payload that does **not** have `categoryId`:

```tsx
it('promotes in automatic category mode by default, sending no categoryId', async () => {
  mockListCatalog.mockResolvedValue({ data: { items: [notPromotedItem], total: 1, page: 1, pageSize: 20 } });
  mockFreightEstimate.mockResolvedValue({
    data: { shippingCostEstimate: 1, suggestedPublicPrice: 13.99 },
  });
  mockPromote.mockResolvedValue({ data: {} });
  renderPage();
  const card = await screen.findByTestId('cj-catalog-card-row-1');

  fireEvent.click(within(card).getByTestId('checkbox-select-1'));
  fireEvent.click(await screen.findByTestId('btn-promote-selected'));
  const modal = await screen.findByTestId('modal-promote-cj');

  await waitFor(() => expect(within(modal).getByTestId('input-price-1')).toHaveValue(13.99));
  fireEvent.click(within(modal).getByTestId('btn-modal-promote'));

  await waitFor(() => expect(mockPromote).toHaveBeenCalledTimes(1));
  expect(mockPromote.mock.calls[0][1]).not.toHaveProperty('categoryId');
});
```

**b) `'shows a mapped error and keeps the modal open when promote fails'`** (currently ~line 265-280): today it
relies on the **client-side** guard (submit with the category dropdown still empty) to produce the
"Seleccione una categoría antes de promocionar." message, without ever calling the mocked `promote`. That
client-side guard now only fires in override mode (change 3.3), so this test must either:
  - (preferred) switch to asserting the **server-side** rejection path instead — the scenario this delta spec
    actually cares about (`CJ_PROMOTION_CATEGORY_REQUIRED` returned by the backend when CJ resolution fails and
    no fallback is configured): mock `mockPromote.mockRejectedValue({ response: { data: { error: { code:
    'CJ_PROMOTION_CATEGORY_REQUIRED' } } } })`, submit in default auto mode, and assert the same mapped message
    appears and the modal stays open; or
  - keep a client-side-guard test but explicitly check the override checkbox first, submit with the select left
    on its blank `""` option, and assert the message + `mockPromote` not called (this exercises change 3.3's
    `overrideCategory && !categoryId` branch directly).

Recommend doing **both**: rename the existing test to something like `'shows a mapped error and keeps the modal
open when the backend rejects promotion for a missing category'` and switch it to the server-rejection form
above (this is the scenario most likely to occur in practice post-change, per the
`cj-catalog-promotion` spec's "Promotion fails when no category can be resolved by any means" scenario), and add
a small dedicated client-guard test either here or in `CjPromoteModal.test.tsx` change 4 above (already covered
there — no need to duplicate at the page level, one is sufficient).

No other tests in this file reference `select-promote-category` or the promote payload's `categoryId`, per the
earlier repo-wide search — sections for activate/deactivate/filtering/pagination are unaffected.

## 6. `frontend/src/services/__tests__/cjCatalogService.test.ts`

No changes required. Its `promote` tests (lines 46-52, 74) always pass an explicit `categoryId: 1` in the
payload they construct — since `categoryId` becomes optional (widened), not required, these calls remain valid
under the updated `CjPromoteRequest` type and the assertions (`toHaveBeenCalledWith(url, payload)`) are
unaffected. Confirmed no test in this file asserts `categoryId` is present on *every* call or otherwise depends
on the old mandatory-ness.

---

## Section 13 (E2E, frontend-relevant portions only)

No new frontend code is required beyond sections 1-5 above. The Playwright steps in tasks.md 13.2/13.3 will
drive:
- `data-testid="btn-promote-selected"` → opens the modal (existing, unchanged).
- `data-testid="modal-promote-cj"` → the modal root (existing, unchanged).
- `data-testid="auto-category-hint"` → new; presence confirms auto mode is active by default (13.2).
- `data-testid="checkbox-override-category"` → new; click to enable override mode (13.3).
- `data-testid="select-promote-category"` → existing testid, now conditionally rendered; select a category
  value once override mode is on (13.3).
- `data-testid="btn-modal-promote"` → existing, submits.
- Verifying the resulting product's category (13.2's "verify via the admin Products page category filter/
  column") uses the **already-existing** `frontend/src/pages/ProductsPage.tsx` category column
  (`categories.find((c) => c.id === product.categoryId)?.name`, lines 176/237) — no frontend change needed
  there; this is purely a manual/E2E verification step against existing UI.

## Order of implementation

1. `frontend/src/types/cjCatalog.ts` (change 1) — trivial, unblocks the rest.
2. `frontend/src/components/admin/CjPromoteModal.tsx` (change 3) — the only real component change.
3. `frontend/src/components/admin/__tests__/CjPromoteModal.test.tsx` (change 4).
4. `frontend/src/pages/__tests__/CjCatalogPage.test.tsx` (change 5) — fix the two now-broken tests, optionally
   add the auto-mode integration test.
5. Run `npx eslint src --ext .ts,.tsx` and the frontend test suite for the four touched/added test files before
   considering section 9 done. (Per this agent's constraints, do not actually run these — the parent session
   executes verification; this plan just flags it as the final step.)

No changes needed to `frontend/src/services/cjCatalogService.ts` (change 2, no-op) or
`frontend/src/services/__tests__/cjCatalogService.test.ts` (change 6, no-op) — both are already compatible with
an optional `categoryId`, confirmed by reading their current contents in full.
