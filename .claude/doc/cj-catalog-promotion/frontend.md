# Frontend Implementation Plan — cj-catalog-promotion

Scope: OpenSpec task group 7 (`tasks.md` §7) plus the frontend portion of §9 (test run, not executed by this plan) and what §11 (E2E) implies the UI must support. This plan does not implement anything; it is a per-file blueprint for the parent session to build from.

Backend contract assumed (from `specs/cj-catalog-promotion/spec.md` and `specs/cj-catalog-sync/spec.md`, task groups 1–6 — **not yet implemented in code as of this read**, current `cjCatalogSyncController.ts`/`cjCatalogItemSerializer.ts`/`cjCatalogItemRepository.ts` still lack `promotionState`/`productId`/`productVariantId`/the three promotion routes):

- `GET /api/admin/suppliers/:supplierId/cj/catalog?page&pageSize&syncStatus&promotionState` → `{ success, data: { items, total, page, pageSize }, message }`, each item: `{ id, externalRef, title, sku, size, color, supplierCost, stockQuantity, syncStatus, syncError, lastSyncedAt, promotionState, productId, productVariantId }` (the last three are the new fields; `id` is what routes call `cjCatalogItemId`).
- `POST /api/admin/suppliers/:supplierId/cj/catalog/promote` body `{ items: [{ cjCatalogItemId, publicPrice?, compareAtPrice? }], categoryId, activate? }` → `201` (or `200` if fully idempotent-resolved) with created/linked product/variant identifiers; `422` with a per-item error list on validation failure (exact per-item error shape is **not specified** in spec.md — see Risks).
- `POST /api/admin/suppliers/:supplierId/cj/catalog/:cjCatalogItemId/activate` → sets linked variant + parent product `Active`.
- `POST /api/admin/suppliers/:supplierId/cj/catalog/:cjCatalogItemId/deactivate` → sets linked variant `Inactive`, preserves `cjCatalogItemId`.
- Error codes to map: `CJ_PROMOTION_CATEGORY_REQUIRED`, `CJ_PROMOTION_PRICE_REQUIRED`, `CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE`, `CJ_CATALOG_ITEM_NOT_PROMOTED`, plus pre-existing `CJ_CONNECTION_NOT_READY`/`CJ_CONNECTION_NOT_FOUND`.

---

## 1. `frontend/src/types/cjCatalog.ts` (NEW)

DTO/error-type pattern mirrors `frontend/src/types/supplier.ts` / `frontend/src/types/customer.ts`.

```ts
export type CjSyncStatus = 'Synced' | 'Failed';
export type CjPromotionState = 'NotPromoted' | 'Active' | 'Inactive';

export interface CjCatalogItem {
  id: number;                    // = cjCatalogItemId used in route params
  externalRef: string;
  title: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  supplierCost: string;          // decimal-as-string (matches backend serializer convention)
  stockQuantity: number;
  syncStatus: CjSyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  promotionState: CjPromotionState;
  productId: number | null;
  productVariantId: number | null;
}

export interface CjCatalogQueryParams {
  page?: number;
  pageSize?: number;
  syncStatus?: CjSyncStatus;
  promotionState?: CjPromotionState;
}

export interface CjCatalogListResult {
  items: CjCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CjCatalogListResponse {
  success: boolean;
  data: CjCatalogListResult;
  message: string;
}

export interface CjPromoteItemInput {
  cjCatalogItemId: number;
  publicPrice?: number;
  compareAtPrice?: number;
}

export interface CjPromoteRequest {
  items: CjPromoteItemInput[];
  categoryId: number;
  activate?: boolean;
}

// Response shape beyond `success/data/message` is not pinned down by spec.md
// (only "returns 201 with the created product/variant identifiers" for the
// single-item case). Treat as opaque — CjCatalogPage always re-fetches the
// list after a successful promote instead of parsing this payload for UI state.
export interface CjPromoteResponseData {
  [key: string]: unknown;
}

export interface CjPromoteResponse {
  success: boolean;
  data: CjPromoteResponseData;
  message: string;
}

export interface CjActionResponse {
  success: boolean;
  data: Record<string, unknown>;
  message: string;
}

export interface CjAdminApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ cjCatalogItemId?: number; code?: string; message?: string }>;
  };
}
```

---

## 2. `frontend/src/services/cjCatalogService.ts` (NEW)

Mirrors `frontend/src/services/supplierService.ts` exactly: plain `axios` (not `axios.create`), `API_BASE_URL` constant, try/catch + `console.error` + rethrow per call, named error-mapping exports.

```ts
import axios, { AxiosError } from 'axios';
import {
  CjCatalogQueryParams,
  CjCatalogListResponse,
  CjPromoteRequest,
  CjPromoteResponse,
  CjActionResponse,
  CjAdminApiError,
} from '../types/cjCatalog';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const cjBase = (supplierId: number) => `${API_BASE_URL}/api/admin/suppliers/${supplierId}/cj`;

export function mapCjCatalogError(code: string): string { /* switch, see below */ }
export function extractCjCatalogErrorMessage(error: unknown): string { /* like extractSupplierErrorMessage */ }
export function extractCjCatalogErrorCode(error: unknown): string { /* like extractCustomerErrorCode */ }

export const cjCatalogService = {
  listCatalog: (supplierId: number, params?: CjCatalogQueryParams): Promise<CjCatalogListResponse> => { /* GET `${cjBase(supplierId)}/catalog` with { params } */ },
  promote: (supplierId: number, payload: CjPromoteRequest): Promise<CjPromoteResponse> => { /* POST `${cjBase(supplierId)}/catalog/promote` */ },
  activate: (supplierId: number, cjCatalogItemId: number): Promise<CjActionResponse> => { /* POST `${cjBase(supplierId)}/catalog/${cjCatalogItemId}/activate` */ },
  deactivate: (supplierId: number, cjCatalogItemId: number): Promise<CjActionResponse> => { /* POST `${cjBase(supplierId)}/catalog/${cjCatalogItemId}/deactivate` */ },
};
```

`mapCjCatalogError` switch cases:
- `CJ_PROMOTION_CATEGORY_REQUIRED` → "Select a category before promoting."
- `CJ_PROMOTION_PRICE_REQUIRED` → "Enter a public price — no default markup is configured."
- `CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE` → "One or more selected items failed to sync and cannot be promoted."
- `CJ_CATALOG_ITEM_NOT_PROMOTED` → "This item has not been promoted yet."
- `CJ_CONNECTION_NOT_READY` → "The CJ Dropshipping connection is not ready. Verify the connection first."
- `CJ_CONNECTION_NOT_FOUND` → "No CJ Dropshipping connection is configured for this supplier."
- `VALIDATION_ERROR` → "Please check the form fields and try again."
- default → "An unexpected error occurred. Please try again." (same fallback text used by every other admin service, for test-string consistency)

---

## 3. `frontend/src/components/admin/StatusBadge.tsx` (MODIFIED)

`StatusValue` already accepts arbitrary `string`, so no type change needed. `Active`/`Inactive` are already mapped (`success`/`warning`) and will be reused as-is for `promotionState`. Add one entry to the `VARIANT` record:

```ts
const VARIANT: Record<string, string> = {
  // Product statuses
  Draft: 'secondary',
  Active: 'success',
  Inactive: 'warning',
  Archived: 'dark',
  // Supplier-only status
  Blocked: 'danger',
  // CJ catalog promotionState-only value (Active/Inactive above are reused)
  NotPromoted: 'secondary',
};
```

Also reuse `StatusBadge` for the `syncStatus` badge (`Synced`/`Failed`) — add:
```ts
  Synced: 'success',
  Failed: 'danger',
```
(`Failed` doesn't collide with any existing key.)

No new component needed for badges — `<StatusBadge status={item.promotionState} data-testid={...}/>` and `<StatusBadge status={item.syncStatus} data-testid={...}/>` both work directly.

---

## 4. `frontend/src/components/admin/CjPromoteModal.tsx` (NEW)

Mirrors `ProductFormModal.tsx` structure (controlled form in a `Modal`, `fullscreen="sm-down"`, save/cancel footer, error `Alert`), but takes an array of pre-selected items instead of building one entity.

```tsx
type CjPromoteModalProps = {
  show: boolean;
  onHide: () => void;
  supplierId: number;
  items: CjCatalogItem[];       // the selected staged items (full objects, not just ids)
  onSuccess: () => void;        // caller (CjCatalogPage) re-fetches + clears selection
};

type PriceOverride = { publicPrice: string; compareAtPrice: string };
```

State: `categories: Category[]`, `categoryId: string`, `activateOnPromote: boolean`, `overrides: Record<number, PriceOverride>` (keyed by `CjCatalogItem.id`), `submitting: boolean`, `error: string`.

Behavior:
- On `show` becoming `true`: load categories via `categoryService.getAll()` (same call `ProductFormModal` uses — public, no admin-only category endpoint exists), reset `categoryId`/`activateOnPromote`/`overrides`/`error`.
- Per-item optional `publicPrice`/`compareAtPrice` number inputs in a small `<Table size="sm">` inside the modal body, one row per selected item (title + size/color + supplierCost for reference, then the two price inputs). Placeholder text on the price input: "Default markup" — **do not** attempt to compute/display the actual default price client-side; `CJ_DEFAULT_MARKUP_MULTIPLIER` is a backend-only env var never exposed via any API (confirmed in `design.md` — no endpoint returns it), so there is nothing to compute against.
- `handleSubmit`: client-side guard requires `categoryId` (mirrors `ProductFormModal`'s `name.trim()` guard) before calling `cjCatalogService.promote(supplierId, payload)`. Build `items` payload converting blank price strings to `undefined` (not `0`) and non-blank ones to `Number(...)`.
- On success: call `onSuccess()` then `onHide()`. On failure: `setError(extractCjCatalogErrorMessage(err))`.
- `data-testid`s: `modal-promote-cj`, `select-promote-category`, `checkbox-activate-on-promote`, `promote-items-table`, `input-price-{id}`, `input-compare-price-{id}`, `btn-modal-cancel`, `btn-modal-promote`.

---

## 5. `frontend/src/pages/admin/CjCatalogPage.tsx` (NEW)

New directory `frontend/src/pages/admin/` gets its second file (first is `AdminLoginPage.tsx`) — **note**: unlike `SuppliersPage.tsx`/`ProductsPage.tsx` which live directly under `frontend/src/pages/`, `tasks.md` §7.3 and the proposal both explicitly place this at `frontend/src/pages/admin/CjCatalogPage.tsx`. Follow the task file, not the (inconsistent) precedent of the other admin list pages — this matches where `AdminLoginPage.tsx` already lives.

Route param: `:supplierId` (page is always reached via a specific supplier).

State shape (mirrors `SuppliersPage.tsx`'s `useState`/`useSearchParams` pattern, extended with selection state that has no existing precedent in this codebase — see Risks):

```ts
const { supplierId: supplierIdParam } = useParams<{ supplierId: string }>();
const supplierId = Number(supplierIdParam);

const [searchParams, setSearchParams] = useSearchParams();
const [syncStatusFilter, setSyncStatusFilter] = useState(searchParams.get('syncStatus') ?? '');
const [promotionStateFilter, setPromotionStateFilter] = useState(searchParams.get('promotionState') ?? '');
const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);

const [items, setItems] = useState<CjCatalogItem[]>([]);
const [total, setTotal] = useState(0);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
const [showPromoteModal, setShowPromoteModal] = useState(false);

const [actioningId, setActioningId] = useState<number | null>(null); // in-flight activate/deactivate row
const [actionError, setActionError] = useState('');
```

`PAGE_SIZE = 20` (matches `SuppliersPage`/`ProductsPage`).

Functions:
- `fetchCatalog` (`useCallback`, deps `[supplierId, syncStatusFilter, promotionStateFilter, page]`): calls `cjCatalogService.listCatalog(supplierId, { syncStatus: syncStatusFilter || undefined, promotionState: promotionStateFilter || undefined, page, pageSize: PAGE_SIZE })`; sets `items`/`total`; on error sets a generic `"Unable to load the CJ catalog. Please try again later."`; **clears `selectedIds`** on every successful fetch (selection does not persist across pages/filter changes/refetches — simplest correct behavior, avoids stale-selection bugs referencing items no longer on screen).
- `useEffect(() => { fetchCatalog(); }, [fetchCatalog])`.
- URL sync `useEffect` (mirrors `SuppliersPage`): writes `syncStatus`, `promotionState`, `page` into `searchParams`.
- `handleFilterChange(key, value)` / `handleReset()`: mirrors `SuppliersPage`'s handlers, resets `page` to 1.
- `toggleSelect(id: number)`: flips membership in `selectedIds` (new `Set`, don't mutate in place).
- `toggleSelectAllOnPage()`: if every *selectable* row on the current page (i.e. `syncStatus === 'Synced'`) is already selected, clears them; otherwise adds them all.
- `selectableItems = items.filter((i) => i.syncStatus === 'Synced')` — `Failed` items are never selectable (per §7.3: "disabling selection for Failed items").
- `selectedItems = items.filter((i) => selectedIds.has(i.id))` — passed to `CjPromoteModal`.
- `handlePromoteSuccess()`: closes modal, clears `selectedIds`, calls `fetchCatalog()`.
- `handleActivate(id: number)` / `handleDeactivate(id: number)`: `setActioningId(id)`, `setActionError('')`, call `cjCatalogService.activate/deactivate(supplierId, id)`, on success `fetchCatalog()`, on error `setActionError(extractCjCatalogErrorMessage(err))`, `finally setActioningId(null)`.

Render structure (mirrors `SuppliersPage.tsx` dual card/table + `Pagination`, with filters inlined like `SuppliersPage` rather than extracted into a separate `*Filters.tsx` component — only two selects here, doesn't warrant `ProductFilters`-style extraction):

- Header: `<h1>CJ Catalog</h1>` + (no "new" button — items only come from sync, not manual creation here).
- Filter row (`Row`/`Col`, `xs=12 md=...`): `syncStatus` `Form.Select` (`data-testid="filter-sync-status"`, options: All / Synced / Failed), `promotionState` `Form.Select` (`data-testid="filter-promotion-state"`, options: All / NotPromoted / Active / Inactive), Reset button (`data-testid="btn-filter-reset"`).
- Bulk-action bar, rendered only when `selectedIds.size > 0`: `<Alert variant="light" data-testid="bulk-action-bar">{selectedIds.size} selected <Button onClick={() => setShowPromoteModal(true)} data-testid="btn-promote-selected">Promote selected</Button> <Button variant="link" onClick={() => setSelectedIds(new Set())} data-testid="btn-clear-selection">Clear</Button></Alert>`.
- Loading (`data-testid="loading-state"` + `LoadingSpinner`) / error (`ErrorAlert`) / empty (`data-testid="empty-state"`, `Alert variant="info"`, "No CJ catalog items found.") states — identical pattern to `SuppliersPage`.
- Mobile card list `d-lg-none admin-card-list` (`data-testid="cj-catalog-card-list"`): each card (`data-testid="cj-catalog-card-row-{id}"`) shows a `Form.Check` (disabled when `syncStatus==='Failed'`, `data-testid="checkbox-select-{id}"`), title, size/color, supplierCost, `StatusBadge` for `syncStatus` (`data-testid="sync-badge-{id}"`) and `promotionState` (`data-testid="promotion-badge-{id}"`), and per-row action: `Activate`/`Deactivate` button when `promotionState !== 'NotPromoted'` (button label/handler flips based on current state; disabled while `actioningId === item.id`), nothing actionable when `NotPromoted` (promotion only happens via bulk/selection flow).
- Desktop table `d-none d-lg-block admin-table-wrap` (`data-testid="cj-catalog-table"`): header row has a "select all on page" `Form.Check` (`data-testid="checkbox-select-all"`, indeterminate state when some-but-not-all selectable rows are selected) plus columns Title / SKU / Cost / Stock / Sync / Promotion / Product / Actions. `Product` column: when `promotionState !== 'NotPromoted'`, `<Link to={`/products/${item.productId}`}>{item.productId}</Link>` (existing `ProductDetailPage` route already handles `/products/:id`); else `—`.
- `{actionError && <Alert variant="danger" data-testid="action-error">{actionError}</Alert>}` placed above the table so a failed activate/deactivate is visible without losing table context (distinct from the page-level `error` used for the initial list-fetch failure).
- `<Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />`.
- `<CjPromoteModal show={showPromoteModal} onHide={() => setShowPromoteModal(false)} supplierId={supplierId} items={selectedItems} onSuccess={handlePromoteSuccess} />`.

---

## 6. `frontend/src/pages/SuppliersPage.tsx` (MODIFIED)

Add an entry point per supplier row to `CjCatalogPage`. `SuppliersPage.tsx` currently has no `Link` import and no per-row "view detail" concept (only Edit/Deactivate). Add:

- Import `Link` from `react-router-dom` (alongside existing `useSearchParams` import).
- Desktop table: new button/link in the Actions `<td>`, before or after Edit: `<Link to={`/suppliers/${s.id}/cj-catalog`} className="btn btn-sm btn-outline-secondary me-2" data-testid={`btn-cj-catalog-${s.id}`}>CJ Catalog</Link>`.
- Mobile card: same link styled with `admin-touch-btn` in `.admin-card-row__actions`, `data-testid={`btn-cj-catalog-${s.id}`}`.

No visibility gating on whether the supplier actually has a configured/verified CJ connection — the `Supplier` type/list response has no such flag today (confirmed: no `hasCjConnection`/connection-status field on `frontend/src/types/supplier.ts`, and there is no frontend CJ-connection-config UI anywhere in the repo yet). The link is always shown; landing on `CjCatalogPage` for a supplier with no/unready connection will surface the existing `CJ_CONNECTION_NOT_READY`/`CJ_CONNECTION_NOT_FOUND` errors from `GET .../cj/catalog` through the normal error-state Alert. Flagged in Risks below.

---

## 7. `frontend/src/App.tsx` (MODIFIED)

- Add import: `import CjCatalogPage from './pages/admin/CjCatalogPage';` (grouped with the other top-of-file page imports, near `SuppliersPage`).
- Add route inside the existing `RequireAdminAuth`+`Layout` route group, near `suppliers`:
  ```tsx
  <Route path="suppliers" element={<SuppliersPage />} />
  <Route path="suppliers/:supplierId/cj-catalog" element={<CjCatalogPage />} />
  ```
  (No `RequireAdminAuth` wrapping needed at the individual `<Route>` level — the whole parent `<Route path="/" element={<RequireAdminAuth><Layout /></RequireAdminAuth>}>` block already gates every nested admin route, exactly like `products/:id`.)

---

## 8. Tests

### 8.1 `frontend/src/services/__tests__/cjCatalogService.test.ts` (NEW)

Pattern: `jest.mock('axios')` + `mockedAxios = axios as jest.Mocked<typeof axios>` (same as `adminProductService.test.ts` — **not** the `axios.create` mock pattern from `productService.test.ts`, since `cjCatalogService` uses plain `axios` like `supplierService`/`customerService`).

Cases:
- `mapCjCatalogError` — `it.each` over all 7 mapped codes (`CJ_PROMOTION_CATEGORY_REQUIRED`, `CJ_PROMOTION_PRICE_REQUIRED`, `CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE`, `CJ_CATALOG_ITEM_NOT_PROMOTED`, `CJ_CONNECTION_NOT_READY`, `CJ_CONNECTION_NOT_FOUND`, `VALIDATION_ERROR`) asserting a distinguishing text fragment per code, plus one test for unknown/empty code → generic fallback text.
- `listCatalog(3, { syncStatus: 'Synced', page: 2 })` → asserts `mockedAxios.get` called with `'http://localhost:3000/api/admin/suppliers/3/cj/catalog'` and `{ params: { syncStatus: 'Synced', page: 2 } }`.
- `promote(3, payload)` → asserts `mockedAxios.post` called with `'.../suppliers/3/cj/catalog/promote'` and the exact payload object.
- `activate(3, 42)` → asserts POST to `'.../suppliers/3/cj/catalog/42/activate'`.
- `deactivate(3, 42)` → asserts POST to `'.../suppliers/3/cj/catalog/42/deactivate'`.
- `extractCjCatalogErrorMessage`/`extractCjCatalogErrorCode` on a fake `{ response: { data: { error: { code: 'CJ_PROMOTION_PRICE_REQUIRED' } } } }`-shaped object, and on an error with no `response` (should not throw, should fall back to `''`/generic message).
- Each `listCatalog`/`promote`/`activate`/`deactivate` should also have one rejected-promise case asserting the call rethrows (mirrors `supplierService`'s catch-and-rethrow contract) — not strictly required by other service tests in this repo, but worth 1–2 cases since this service has more endpoints/error surface than most; keep minimal if time-constrained.
- Run `npx eslint src --ext .ts,.tsx` before considering this file done — use `findBy*`/direct assertions only, no `waitFor` + `getBy*` (N/A for a service test with no DOM, but keep as a checklist reminder since the lint step is repo-wide).

### 8.2 `frontend/src/pages/__tests__/CjCatalogPage.test.tsx` (NEW)

Pattern: mirrors `ShipmentDetailPage.test.tsx`'s `MemoryRouter` + `Routes`/`Route` wrapper for `useParams` (`CjCatalogPage` needs `:supplierId`), combined with `ProductsPage.test.tsx`'s `jest.mock('../../services/xService')` + `findBy*` conventions.

```tsx
jest.mock('../../services/cjCatalogService');
jest.mock('../../services/categoryService'); // CjPromoteModal loads categories when opened
const mockedCj = cjCatalogService as jest.Mocked<typeof cjCatalogService>;
const mockedCategory = categoryService as jest.Mocked<typeof categoryService>;

const renderPage = () => render(
  <MemoryRouter initialEntries={['/suppliers/3/cj-catalog']}>
    <Routes><Route path="/suppliers/:supplierId/cj-catalog" element={<CjCatalogPage />} /></Routes>
  </MemoryRouter>
);
```

Key test cases (per `tasks.md` §7.6: "rendering states, selection, promote/activate/deactivate calls, and error display"):

1. **Loading state**: `listCatalog` returns a never-resolving promise → `loading-state` spinner visible.
2. **Rendering / NotPromoted state**: `listCatalog` resolves with items where `promotionState: 'NotPromoted'`, `productId: null` → row/card renders with a `NotPromoted` badge, no product link, checkbox enabled.
3. **Rendering / Active + Inactive states**: items with `promotionState: 'Active'`/`'Inactive'` render the matching badge and a product link (`href` containing `/products/{productId}`), plus a `Deactivate`/`Activate` button respectively (not both).
4. **Failed sync item cannot be selected**: item with `syncStatus: 'Failed'` renders its checkbox `disabled`.
5. **Empty state**: `listCatalog` resolves `{ items: [], total: 0, ... }` → `empty-state` alert.
6. **List error state**: `listCatalog` rejects → generic "Unable to load the CJ catalog…" message via `findByText`.
7. **Filter triggers re-query**: `fireEvent.change` on `filter-sync-status` → assert `mockedCj.listCatalog` last called with `expect.objectContaining({ syncStatus: 'Failed', page: 1 })` (mirrors `ProductsPage.test.tsx`'s filter-refetch test, using `waitFor` around the mock-call assertion since there's no new DOM element to `findBy*` on — consistent with the existing precedent in `ProductsPage.test.tsx` line ~74).
8. **Selection updates the bulk-action bar**: click one row checkbox → `bulk-action-bar` appears with `findByTestId`, shows "1 selected"; click "select all on page" → count matches number of `Synced` items on the page (excluding any `Failed` ones); click again → clears.
9. **Selection resets after a successful fetch**: select a row, trigger a filter change (which refetches) → bulk-action-bar is gone (`queryByTestId` returns null) after the refetch resolves.
10. **Promote flow — opens modal with selected items**: select 2 items, click `btn-promote-selected` → `findByTestId('modal-promote-cj')` appears; assert the modal's item rows correspond to the 2 selected `CjCatalogItem`s (by title/testid), not all items.
11. **Promote flow — success**: `mockedCj.promote` resolves → after submitting the modal (category selected via `mockedCategory.getAll` resolved list), assert `mockedCj.promote` called with the right `supplierId`/`categoryId`/`items` shape, modal closes (`queryByTestId('modal-promote-cj')` null), and `mockedCj.listCatalog` was called again (refetch) — assert via call count increasing, not by asserting new badge values (keeps the test decoupled from the unspecified promote-response shape, matching the "always refetch" design decision in §5).
12. **Promote flow — error**: `mockedCj.promote` rejects with `{ response: { data: { error: { code: 'CJ_PROMOTION_CATEGORY_REQUIRED' } } } }` → modal shows the mapped message via `findByText`, modal stays open, `mockedCj.listCatalog` is **not** called again.
13. **Activate call**: item with `promotionState: 'Inactive'` → click its `btn-activate-{id}` → assert `mockedCj.activate` called with `(3, id)`, then `mockedCj.listCatalog` called again (refetch).
14. **Deactivate call**: item with `promotionState: 'Active'` → click its `btn-deactivate-{id}` → assert `mockedCj.deactivate` called with `(3, id)`.
15. **Activate/deactivate error display**: `mockedCj.deactivate` rejects → `findByTestId('action-error')` shows the mapped message, row's badge unchanged (no refetch happened).
16. Run `npx eslint src --ext .ts,.tsx` — all async assertions must use `findBy*`, never `waitFor` + `getBy*` (per `testing-library/prefer-find-by`; the one `waitFor`-around-a-mock-call-assertion case in #7/#9 is fine since it's not a `getBy*` query).

### 8.3 `frontend/src/components/admin/__tests__/CjPromoteModal.test.tsx` (OPTIONAL, not explicitly required by §7.6 but recommended)

Not listed by name in `tasks.md` §7.6 (which only names `cjCatalogService.ts` and `CjCatalogPage.tsx`), and case #10–12 above already exercise the modal through `CjCatalogPage`. Skip a standalone modal test file unless the implementer wants isolated coverage of price-override parsing (blank → `undefined`, not `0`) and the category-required client-side guard — if added, mirror `ProductFormModal`'s own test file structure (not read in this session; locate via `frontend/src/components/admin/__tests__/ProductFormModal.test.tsx` if it exists before writing).

---

## Risks / Ambiguities for the implementer to resolve against the real backend once tasks 1–6 land

1. **Per-item `422` promote error-list shape is unspecified.** `spec.md`'s "A partially invalid bulk request persists nothing" scenario only says the response has "a per-item error list identifying the invalid item" — no field names given, and `tasks.md` §6.3 doesn't pin it down either. This plan's `CjAdminApiError.error.details` shape is a **guess**. Before wiring any per-item error UI (e.g., highlighting which row in the promote modal failed), read the actual `cjCatalogPromotionController.ts`/`validateCjPromotionData` once implemented and adjust `CjAdminApiError`/`CjPromoteModal` accordingly. Until then, `CjPromoteModal` only surfaces the top-level mapped message (`extractCjCatalogErrorMessage`), which is safe regardless of the exact shape.
2. **Promote response body shape is unspecified** beyond "identifiers are returned." Mitigated by design: `CjCatalogPage` never parses `promote()`'s response for UI state — it always calls `fetchCatalog()` again on success. `CjPromoteResponseData` is typed as an open/opaque object for this reason.
3. **No existing multi-select/bulk-checkbox pattern anywhere in this codebase.** Grepped `frontend/src/**` for `checkbox`/`Form.Check`/`indeterminate`/`selectedIds` — the only hit is an unrelated cookie-preferences toggle. `CjCatalogPage`'s row/select-all checkboxes and bulk-action bar are a **new UI pattern** for this admin panel, not a mirror of an existing one. Selection-state design choices in this plan (Set of ids, cleared on every refetch, `Failed`-sync rows non-selectable) are this plan's own decisions, not extracted from precedent — flag for review since `design.md`/`tasks.md` don't specify selection persistence behavior across pagination.
4. **No existing paginated admin list page has a page-level "select all" + bulk action bar.** `ProductsPage.tsx`/`SuppliersPage.tsx`/`CustomersPage.tsx` are all single-row-action only. Confirm the bulk UX (floating bar shown conditionally vs. a permanently-visible toolbar) is acceptable before building — this plan chose "shown only when `selectedIds.size > 0`" as the least intrusive default.
5. **No admin-only category list endpoint exists.** `CjPromoteModal` reuses `categoryService.getAll()`, which hits `GET /api/public/categories` (same call `ProductFormModal` already makes for admin category selection) — not a new risk, just confirming this is the existing precedent and not an oversight.
6. **`docs/frontend-standards.md` says admin components must never call `useTranslation` ("The admin panel remains hardcoded in Spanish... Admin components must never call `useTranslation`")**, but `ProductFormModal.tsx` (the modal this plan mirrors) *does* call `useTranslation('admin')` for its Spanish-translation section fields. This is a **pre-existing violation** of the documented standard, not something to replicate. `CjCatalogPage.tsx`/`CjPromoteModal.tsx` as planned use plain hardcoded strings (matching `SuppliersPage.tsx`/`ProductsPage.tsx`, which correctly follow the documented standard) — do not add `useTranslation` to the new files.
7. **No frontend UI exists anywhere for configuring/verifying the CJ connection itself** (`POST .../cj/connection`, `.../verify`) — confirmed via repo-wide grep, zero matches for `cj`/`Cj`/`CJ` under `frontend/src`. This change's scope (`tasks.md` §7) does not add one either; the entry-point link added to `SuppliersPage.tsx` is unconditional and will surface `CJ_CONNECTION_NOT_READY`/`CJ_CONNECTION_NOT_FOUND` as an ordinary list-fetch error on `CjCatalogPage` if no connection is configured. If the actual E2E run (`tasks.md` §11) needs a connection to exist first, that setup happens via curl/backend directly (§10.1 says "reusing the existing connected integration"), not through any UI this plan builds.
8. **Page location precedent conflict**: `SuppliersPage.tsx`/`ProductsPage.tsx`/etc. live directly under `frontend/src/pages/`, but `tasks.md`/`proposal.md` explicitly say `frontend/src/pages/admin/CjCatalogPage.tsx`. This plan follows the task file's explicit path (joining `AdminLoginPage.tsx` as the second file in `pages/admin/`) rather than the majority precedent — confirm this is intentional before implementing, since it's a minor structural inconsistency either way.
9. **`compareAtPrice` in the promote payload**: included in `CjPromoteItemInput`/`CjPromoteModal` per the spec's request shape, but no scenario in `spec.md` exercises it and `design.md` doesn't discuss its validation rules (e.g., must be > `publicPrice`?). Treated as a fully optional, unvalidated-client-side passthrough field.

## Files touched summary

| File | Status |
|---|---|
| `frontend/src/types/cjCatalog.ts` | NEW |
| `frontend/src/services/cjCatalogService.ts` | NEW |
| `frontend/src/components/admin/CjPromoteModal.tsx` | NEW |
| `frontend/src/pages/admin/CjCatalogPage.tsx` | NEW |
| `frontend/src/components/admin/StatusBadge.tsx` | MODIFIED (add `NotPromoted`, `Synced`, `Failed` to `VARIANT`) |
| `frontend/src/pages/SuppliersPage.tsx` | MODIFIED (add `Link` import + per-row "CJ Catalog" entry point) |
| `frontend/src/App.tsx` | MODIFIED (import + route `suppliers/:supplierId/cj-catalog`) |
| `frontend/src/services/__tests__/cjCatalogService.test.ts` | NEW |
| `frontend/src/pages/__tests__/CjCatalogPage.test.tsx` | NEW |
| `frontend/src/components/admin/__tests__/CjPromoteModal.test.tsx` | OPTIONAL |
