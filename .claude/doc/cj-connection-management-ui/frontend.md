# cj-connection-management-ui — Frontend Implementation Plan

Scope: frontend-only, wires 4 already-built/stable backend endpoints
(`GET/POST .../cj/connection`, `POST .../cj/connection/verify`, `POST .../cj/sync`)
into `CjCatalogPage`. No backend changes. Covers tasks.md groups 1–7.

No `.claude/sessions/context_session_cj-connection-management-ui.md` exists yet —
none was found in the repo at planning time.

Patterns mirrored throughout: `frontend/src/services/cjCatalogService.ts` (+ its
test file), `frontend/src/types/cjCatalog.ts`, `frontend/src/components/admin/CjPromoteModal.tsx`,
`frontend/src/pages/CjCatalogPage.tsx`, `frontend/src/components/admin/StatusBadge.tsx`.

---

## 1. `frontend/src/types/cjConnection.ts` (new file)

Mirrors `frontend/src/types/cjCatalog.ts` export style exactly (plain `export
type` / `export interface`, no namespacing, envelope types match the backend's
`{ success, data, message }` shape per `docs/api-spec.yml` `SupplierIntegrationResponse`,
`CjVerifyResponse`, `CjSyncResponse` schemas at lines ~4601–4687).

```ts
export type SupplierIntegrationStatus = 'Disconnected' | 'Connected' | 'Error';

export interface CjConnection {
  id: number;
  supplierId: number;
  provider: string;
  status: SupplierIntegrationStatus;
  externalAccountRef: string | null;
  lastVerifiedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CjConfigureConnectionRequest {
  externalAccountRef?: string | null;
}

export interface CjConnectionResponse {
  success: boolean;
  data: CjConnection;
  message: string;
}

export interface CjVerifyResult {
  healthy: boolean;
  reason?: string | null;
}

export interface CjVerifyResponse {
  success: boolean;
  data: CjVerifyResult;
  message: string;
}

export interface CjSyncResult {
  itemsUpserted: number;
  itemsFailed: number;
  syncedAt: string;
}

export interface CjSyncResponse {
  success: boolean;
  data: CjSyncResult;
  message: string;
}

export interface CjConnectionApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
```

Notes:
- `externalAccountRef` is `string | null` everywhere (never `undefined`) to
  match `docs/data-model.md` §17 `SupplierIntegration.externalAccountRef` being
  optional/nullable, and the API spec's `nullable: true`.
- Do **not** add any credential/API-key field to any of these types — that is
  the whole point of the constraint; `CjConfigureConnectionRequest` has exactly
  one field.
- `reason` on `CjVerifyResult` is optional/nullable per the API spec
  (`nullable: true`) — treat `undefined` and `null` the same in the UI (no
  reason shown).

---

## 2. `frontend/src/services/cjConnectionService.ts` (new file)

Mirror `cjCatalogService.ts`'s exact shape: `API_BASE_URL` constant, `cjBase(supplierId)`
helper, one exported error-map function, one message extractor, one code
extractor, and a `cjConnectionService` object of async functions that return
the **full response envelope** (`response.data`), not an unwrapped `.data.data`
— this matches how `cjCatalogService.listCatalog` returns `CjCatalogListResponse`
and callers read `res.data.items`. Consumers of this new service will read
`res.data` (the `CjConnection`/`CjVerifyResult`/`CjSyncResult`).

```ts
import axios, { AxiosError } from 'axios';
import {
  CjConnection,
  CjConnectionResponse,
  CjConfigureConnectionRequest,
  CjVerifyResponse,
  CjSyncResponse,
  CjConnectionApiError,
} from '../types/cjConnection';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const cjBase = (supplierId: number) => `${API_BASE_URL}/api/admin/suppliers/${supplierId}/cj`;

// ─── Error-code → UI-message mapping ─────────────────────────────────────────

export function mapCjConnectionError(code: string, httpStatus?: number): string {
  // express-rate-limit's default 429 response has no app error-code body (it's
  // plain text, not `{ error: { code } }`), so 429 must be detected via HTTP
  // status, checked before the code switch.
  if (httpStatus === 429) {
    return 'Too many verification attempts. Please wait a few minutes and try again.';
  }
  switch (code) {
    case 'CJ_CONNECTION_NOT_FOUND':
      return 'No CJ Dropshipping connection is configured for this supplier yet.';
    case 'CJ_CONNECTION_NOT_READY':
      return 'The CJ Dropshipping connection is not ready. Verify the connection first.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractCjConnectionErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<CjConnectionApiError>;
  const httpStatus = axiosError.response?.status;
  const code = axiosError.response?.data?.error?.code;
  return mapCjConnectionError(code ?? '', httpStatus);
}

export function extractCjConnectionErrorCode(error: unknown): string {
  return (error as AxiosError<CjConnectionApiError>).response?.data?.error?.code ?? '';
}

// ─── Admin CJ connection lifecycle ───────────────────────────────────────────
// Security invariant: `externalAccountRef` is the only writable/readable
// connection field from this file — never send or read a credential/API-key.

export const cjConnectionService = {
  getConnection: async (supplierId: number): Promise<CjConnectionResponse> => {
    try {
      const response = await axios.get<CjConnectionResponse>(`${cjBase(supplierId)}/connection`);
      return response.data;
    } catch (error) {
      console.error('Error fetching CJ connection:', error);
      throw error;
    }
  },

  configureConnection: async (
    supplierId: number,
    payload: CjConfigureConnectionRequest
  ): Promise<CjConnectionResponse> => {
    try {
      const response = await axios.post<CjConnectionResponse>(`${cjBase(supplierId)}/connection`, payload);
      return response.data;
    } catch (error) {
      console.error('Error configuring CJ connection:', error);
      throw error;
    }
  },

  verifyConnection: async (supplierId: number): Promise<CjVerifyResponse> => {
    try {
      const response = await axios.post<CjVerifyResponse>(`${cjBase(supplierId)}/connection/verify`);
      return response.data;
    } catch (error) {
      console.error('Error verifying CJ connection:', error);
      throw error;
    }
  },

  sync: async (supplierId: number): Promise<CjSyncResponse> => {
    try {
      const response = await axios.post<CjSyncResponse>(`${cjBase(supplierId)}/sync`);
      return response.data;
    } catch (error) {
      console.error('Error syncing CJ catalog:', error);
      throw error;
    }
  },
};
```

`CjConnection` (unwrapped type) is imported for re-export convenience by
callers that only need the `data` shape — no separate export needed since
`CjConnectionResponse.data: CjConnection` already gives callers the type via
`res.data`.

### 2.1 `frontend/src/services/__tests__/cjConnectionService.test.ts` (new file)

Mirror `cjCatalogService.test.ts` structure exactly (`jest.mock('axios')`,
`mockedAxios = axios as jest.Mocked<typeof axios>`):

- `mapCjConnectionError` table test (`it.each`) covering: `CJ_CONNECTION_NOT_FOUND`
  → contains `"not configured"`; `CJ_CONNECTION_NOT_READY` → contains `"not ready"`;
  `VALIDATION_ERROR` → contains `"check the form fields"`; unknown/empty code
  → matches `/unexpected error/i`.
- Separate test: `mapCjConnectionError('', 429)` → contains `"Too many"` /
  `"try again"`, verifying the 429 path wins even with an empty code.
- `cjConnectionService.getConnection` calls `GET {API_BASE_URL}/api/admin/suppliers/3/cj/connection`
  with no params.
- `cjConnectionService.configureConnection(3, { externalAccountRef: 'ref' })`
  calls `POST .../cj/connection` with body `{ externalAccountRef: 'ref' }`.
- `cjConnectionService.verifyConnection(3)` calls `POST .../cj/connection/verify`
  with no body.
- `cjConnectionService.sync(3)` calls `POST .../cj/sync` with no body.
- `it.each` rethrow-on-failure test for all four methods (same pattern as
  `cjCatalogService.test.ts` lines 71–79).
- `extractCjConnectionErrorMessage` / `extractCjConnectionErrorCode`: extracts
  mapped message and raw code from `{ response: { data: { error: { code } } } }`;
  extracts the 429 message from `{ response: { status: 429, data: 'Too many requests, please try again later.' } }`
  (a **string** body, not an object — matches express-rate-limit's real
  default response shape) without throwing; falls back gracefully for a plain
  `Error` with no `response`.

---

## 3. `frontend/src/components/admin/CjConnectionPanel.tsx` (new file)

Props:

```ts
type CjConnectionPanelProps = {
  supplierId: number;
  connection: CjConnection | null; // null = "not configured" (404) state
  onConfigureClick: () => void;    // opens CjConnectionModal (create or edit)
  onRefreshConnection: () => void | Promise<void>; // refetch after verify/sync
  onCatalogRefreshNeeded: () => void; // refetch catalog list after sync success
};
```

Local state:

```ts
const [verifying, setVerifying] = useState(false);
const [verifyResult, setVerifyResult] = useState<CjVerifyResult | null>(null);
const [syncing, setSyncing] = useState(false);
const [syncResult, setSyncResult] = useState<CjSyncResult | null>(null);
const [actionError, setActionError] = useState('');
```

Handlers:

```ts
const handleVerify = async () => {
  setVerifying(true);
  setActionError('');
  setVerifyResult(null);
  setSyncResult(null);
  try {
    const res = await cjConnectionService.verifyConnection(supplierId);
    setVerifyResult(res.data);
    await onRefreshConnection();
  } catch (err) {
    setActionError(extractCjConnectionErrorMessage(err));
  } finally {
    setVerifying(false);
  }
};

const handleSync = async () => {
  setSyncing(true);
  setActionError('');
  setSyncResult(null);
  setVerifyResult(null);
  try {
    const res = await cjConnectionService.sync(supplierId);
    setSyncResult(res.data);
    await onRefreshConnection();
    onCatalogRefreshNeeded();
  } catch (err) {
    setActionError(extractCjConnectionErrorMessage(err));
  } finally {
    setSyncing(false);
  }
};

const formatTimestamp = (value: string | null, emptyLabel: string): string =>
  value ? new Date(value).toLocaleString() : emptyLabel;
```

Clearing `verifyResult`/`syncResult` in both handlers keeps only the most
recent banner visible (avoids a stale "Connection healthy" lingering under a
new sync-error banner, or vice versa).

JSX (React Bootstrap `Alert`, `Button`; reuses `admin-card-row`/`admin-touch-btn`
classes already used by `CjCatalogPage.tsx` for visual consistency):

```tsx
<div className="admin-card-row cj-connection-panel mb-3" data-testid="cj-connection-panel">
  {!connection && (
    <>
      <div className="flex-grow-1">
        <div className="fw-semibold">CJ Dropshipping connection</div>
        <div className="admin-card-row__meta">Not configured yet.</div>
      </div>
      <div className="admin-card-row__actions">
        <Button
          variant="primary"
          className="admin-touch-btn"
          onClick={onConfigureClick}
          data-testid="btn-configure-connection"
        >
          Configure connection
        </Button>
      </div>
    </>
  )}

  {connection && (
    <>
      <div className="admin-card-row__header">
        <div className="flex-grow-1">
          <div className="fw-semibold">
            {connection.provider}{' '}
            <StatusBadge status={connection.status} data-testid="cj-connection-status" />
          </div>
          <div className="admin-card-row__meta">
            Account ref: {connection.externalAccountRef ?? '—'}
          </div>
          <div className="admin-card-row__meta">
            Last verified: {formatTimestamp(connection.lastVerifiedAt, 'Never verified')}
            {' · '}
            Last synced: {formatTimestamp(connection.lastSyncedAt, 'Never synced')}
          </div>
        </div>
      </div>

      <div className="admin-card-row__actions">
        <Button
          variant="outline-secondary"
          className="admin-touch-btn"
          onClick={onConfigureClick}
          data-testid="btn-edit-connection"
        >
          Edit
        </Button>
        <Button
          variant="outline-primary"
          className="admin-touch-btn"
          disabled={verifying}
          onClick={handleVerify}
          data-testid="btn-verify-connection"
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </Button>
        <Button
          variant="primary"
          className="admin-touch-btn"
          disabled={connection.status !== 'Connected' || syncing}
          onClick={handleSync}
          title={connection.status !== 'Connected' ? 'Verify the connection before syncing.' : undefined}
          data-testid="btn-sync-catalog"
        >
          {syncing ? 'Syncing…' : 'Sync catalog'}
        </Button>
      </div>

      {connection.status !== 'Connected' && (
        <div className="admin-card-row__meta" data-testid="cj-sync-disabled-hint">
          Verify the connection before syncing.
        </div>
      )}

      {actionError && (
        <Alert variant="danger" data-testid="cj-connection-error">
          {actionError}
        </Alert>
      )}
      {verifyResult && (
        <Alert variant={verifyResult.healthy ? 'success' : 'warning'} data-testid="cj-verify-result">
          {verifyResult.healthy ? 'Connection healthy.' : 'Connection check failed.'}
          {verifyResult.reason ? ` ${verifyResult.reason}` : ''}
        </Alert>
      )}
      {syncResult && (
        <Alert variant="info" data-testid="cj-sync-result">
          Sync complete: {syncResult.itemsUpserted} item{syncResult.itemsUpserted === 1 ? '' : 's'} upserted
          {syncResult.itemsFailed > 0 ? `, ${syncResult.itemsFailed} failed` : ''}.
        </Alert>
      )}
    </>
  )}
</div>
```

`data-testid`s present (per tasks.md 3.4): `cj-connection-panel`,
`cj-connection-status`, `btn-configure-connection`, `btn-edit-connection`,
`btn-verify-connection`, `btn-sync-catalog`, `cj-verify-result`,
`cj-sync-result`, `cj-connection-error`. (`cj-sync-disabled-hint` is an extra,
not required by tasks.md but harmless and useful for the E2E step.)

No `useTranslation` — hardcoded English strings throughout, matching
`CjCatalogPage.tsx`/`SuppliersPage.tsx` precedent.

---

## 4. `frontend/src/components/admin/CjConnectionModal.tsx` (new file)

Mirrors `CjPromoteModal.tsx` structurally: React Bootstrap `Modal` with
`fullscreen="sm-down"`, reset-on-open `useEffect`, inline error `Alert`,
disable-while-submitting footer buttons.

Props:

```ts
type CjConnectionModalProps = {
  show: boolean;
  onHide: () => void;
  supplierId: number;
  connection: CjConnection | null; // null → "create" mode, present → "edit" mode (prefill)
  onSuccess: (connection: CjConnection) => void;
};
```

Component body:

```tsx
const MAX_EXTERNAL_ACCOUNT_REF_LENGTH = 150;

const CjConnectionModal: React.FC<CjConnectionModalProps> = ({
  show,
  onHide,
  supplierId,
  connection,
  onSuccess,
}) => {
  const [externalAccountRef, setExternalAccountRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setExternalAccountRef(connection?.externalAccountRef ?? '');
      setError('');
    }
  }, [show, connection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const trimmed = externalAccountRef.trim();
      const res = await cjConnectionService.configureConnection(supplierId, {
        externalAccountRef: trimmed ? trimmed : null,
      });
      onSuccess(res.data);
      onHide();
    } catch (err) {
      setError(extractCjConnectionErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} fullscreen="sm-down" data-testid="modal-configure-cj-connection">
      <Modal.Header closeButton>
        <Modal.Title>{connection ? 'Edit' : 'Configure'} CJ Dropshipping connection</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>External account reference (optional, not a credential)</Form.Label>
            <Form.Control
              type="text"
              maxLength={MAX_EXTERNAL_ACCOUNT_REF_LENGTH}
              value={externalAccountRef}
              onChange={(e) =>
                setExternalAccountRef(e.target.value.slice(0, MAX_EXTERNAL_ACCOUNT_REF_LENGTH))
              }
              placeholder="e.g. cj-account-123"
              data-testid="input-external-account-ref"
            />
            <Form.Text muted>
              This is a CJ Dropshipping account reference, not an API key or password. The
              CJ Dropshipping API key is configured server-side and is never entered here.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={submitting} data-testid="btn-modal-cancel">
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitting} data-testid="btn-modal-save-connection">
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
```

Critical constraint check: no `type="password"` field, no field labeled
"API key"/"secret"/"credential" anywhere, only the one text input above. Do
not add any additional form fields to this modal even for convenience.

`data-testid`s (per tasks.md 4.4): `modal-configure-cj-connection`,
`input-external-account-ref`, `btn-modal-cancel`, `btn-modal-save-connection`.

---

## 5. Wire into `frontend/src/pages/CjCatalogPage.tsx` (modify)

### 5.1 New imports

```ts
import { cjConnectionService, extractCjConnectionErrorCode } from '../services/cjConnectionService';
import CjConnectionPanel from '../components/admin/CjConnectionPanel';
import CjConnectionModal from '../components/admin/CjConnectionModal';
import { CjConnection } from '../types/cjConnection';
```

### 5.2 New state (add alongside existing state block)

```ts
const [connection, setConnection] = useState<CjConnection | null>(null);
const [connectionLoading, setConnectionLoading] = useState(true);
const [connectionNotFound, setConnectionNotFound] = useState(false);
const [showConnectionModal, setShowConnectionModal] = useState(false);
```

### 5.3 New `fetchConnection` + effect (add near existing `fetchCatalog`)

```ts
const fetchConnection = useCallback(async () => {
  setConnectionLoading(true);
  try {
    const res = await cjConnectionService.getConnection(supplierId);
    setConnection(res.data);
    setConnectionNotFound(false);
  } catch (err) {
    if (extractCjConnectionErrorCode(err) === 'CJ_CONNECTION_NOT_FOUND') {
      setConnection(null);
      setConnectionNotFound(true);
    } else {
      // Non-404 failure (e.g. 500): leave connection null but do NOT set the
      // "not configured" flag — the panel will simply not render a connection
      // yet; a future retry (e.g. after a manual refresh) can recover. This
      // avoids conflating "no connection exists" with "connection fetch
      // failed", which would otherwise wrongly suppress the catalog gate.
      setConnection(null);
      setConnectionNotFound(false);
    }
  } finally {
    setConnectionLoading(false);
  }
}, [supplierId]);

useEffect(() => {
  fetchConnection();
}, [fetchConnection]);
```

### 5.4 Gate the existing catalog fetch effect

Change the existing:

```ts
useEffect(() => {
  fetchCatalog();
}, [fetchCatalog]);
```

to:

```ts
useEffect(() => {
  if (connectionLoading || connectionNotFound) return;
  fetchCatalog();
}, [fetchCatalog, connectionLoading, connectionNotFound]);
```

This means: while the connection fetch is still in flight, do nothing yet
(avoids a flash of the catalog table before we know if a connection exists).
Once resolved: if `CJ_CONNECTION_NOT_FOUND`, never call `fetchCatalog`. If a
connection exists (any status, including `Error`), `fetchCatalog` runs exactly
as it did before — this is task 5.3/design.md decision 4 ("catalog is fetched
regardless of `status`; only Sync is gated").

`fetchCatalog` itself is unchanged.

### 5.5 Render changes

Insert the connection panel and modal right after the page header, before the
existing filter `Row`. Wrap the entire existing catalog UI (filters, bulk-action
bar, action-error alert, loading/error/empty states, card list, table,
pagination, `CjPromoteModal`) in a `{!connectionNotFound && ( ... )}` block so
none of it renders in the "not configured" state:

```tsx
return (
  <div className="admin-page">
    <div className="admin-page-header">
      <h1 className="h3 mb-0">CJ Catalog</h1>
    </div>

    {connectionLoading && (
      <div data-testid="connection-loading-state">
        <LoadingSpinner />
      </div>
    )}

    {!connectionLoading && (
      <CjConnectionPanel
        supplierId={supplierId}
        connection={connection}
        onConfigureClick={() => setShowConnectionModal(true)}
        onRefreshConnection={fetchConnection}
        onCatalogRefreshNeeded={fetchCatalog}
      />
    )}

    <CjConnectionModal
      show={showConnectionModal}
      onHide={() => setShowConnectionModal(false)}
      supplierId={supplierId}
      connection={connection}
      onSuccess={(updated) => {
        setConnection(updated);
        setConnectionNotFound(false);
      }}
    />

    {!connectionLoading && !connectionNotFound && (
      <>
        {/* existing Row filters block — unchanged */}
        {/* existing bulk-action-bar Alert — unchanged */}
        {/* existing actionError Alert — unchanged */}
        {/* existing loading/error/empty states — unchanged */}
        {/* existing card-list / table — unchanged */}
        {/* existing Pagination — unchanged */}
        {/* existing CjPromoteModal — unchanged */}
      </>
    )}
  </div>
);
```

Important: do **not** delete the existing `{!loading && error && <ErrorAlert
message={error} />}` block — it still handles genuine `fetchCatalog` errors
(e.g. a 500) for a supplier that *does* have a connection. What changes is
only that `fetchCatalog` (and therefore that error path) is never reached in
the `CJ_CONNECTION_NOT_FOUND` case, per task 5.2 ("does not render the
previous bare `CJ_CONNECTION_NOT_FOUND` error message").

`onSuccess` on the modal does not need to explicitly close the modal — `CjConnectionModal`
already calls `onHide()` itself after a successful submit (see §4). Page-level
`onSuccess` only needs to update `connection`/`connectionNotFound` state so the
panel (and the now-unblocked catalog section) reflect the new connection
immediately, without waiting on a second round-trip via `fetchConnection`.

---

## 6. `frontend/src/components/admin/StatusBadge.tsx` (modify)

Current `VARIANT` map (lines 15–28) has no entries for `Connected`,
`Disconnected`, or `Error` (confirmed by reading the file — only `Draft`,
`Active`, `Inactive`, `Archived`, `Blocked`, `Synced`, `Failed`, `NotPromoted`
exist). Add three entries:

```ts
const VARIANT: Record<string, string> = {
  // Product statuses
  Draft: 'secondary',
  Active: 'success',
  Inactive: 'warning',
  Archived: 'dark',
  // Supplier-only status
  Blocked: 'danger',
  // CJ catalog item syncStatus
  Synced: 'success',
  Failed: 'danger',
  // CJ catalog item promotionState-only value (Active/Inactive above are reused)
  NotPromoted: 'secondary',
  // CJ connection (SupplierIntegration) status
  Connected: 'success',
  Disconnected: 'secondary',
  Error: 'danger',
};
```

No change needed to the `StatusValue` type union (`ProductStatus | SupplierStatus
| string`) — the trailing `| string` already permits `SupplierIntegrationStatus`
values at the call site (`CjConnectionPanel` passes `connection.status`, typed
`SupplierIntegrationStatus`, which structurally satisfies `string`). This
matches how `CjSyncStatus`/`CjPromotionState` values are already passed today
without being added to the union.

---

## 7. Page-level and component-level tests

### 7.1 `frontend/src/pages/__tests__/CjCatalogPage.test.tsx` (extend existing file)

Add a new `mockGetConnection` / `mockConfigureConnection` / `mockVerifyConnection`
/ `mockSync` set of jest mocks and a `jest.mock('../../services/cjConnectionService', ...)`
block, following the exact structure of the existing `jest.mock('../../services/cjCatalogService', ...)`
(lines 12–21 of the current file): re-export the real `mapCjConnectionError`/
`extractCjConnectionErrorMessage`/`extractCjConnectionErrorCode` via
`jest.requireActual`, mock only the `cjConnectionService` object's methods.

New/changed test cases (use `findBy*` per the repo's `testing-library/prefer-find-by`
ESLint rule — see `ai-specs/agents/frontend-developer.md` RTL section):

- **Not-configured state**: `mockGetConnection` rejects with
  `{ response: { data: { error: { code: 'CJ_CONNECTION_NOT_FOUND' } } } }`.
  Assert `await screen.findByTestId('cj-connection-panel')` and
  `screen.getByTestId('btn-configure-connection')` render, and
  `expect(mockListCatalog).not.toHaveBeenCalled()`. Also assert no
  `cj-catalog-table`/`cj-catalog-card-list`/`empty-state` renders and no old
  bare error alert text appears.
- **Configured state renders catalog**: `mockGetConnection` resolves with
  `{ data: { id: 1, supplierId: 3, provider: 'CJDropshipping', status: 'Disconnected', externalAccountRef: null, lastVerifiedAt: null, lastSyncedAt: null, createdAt: '', updatedAt: '' } }`;
  `mockListCatalog` resolves as in existing tests. Assert both
  `cj-connection-panel` and (via existing assertions) the catalog card/table
  render, and `mockListCatalog` **was** called.
- **Configure success updates panel**: open modal via `btn-configure-connection`,
  fill `input-external-account-ref`, submit via `btn-modal-save-connection`
  (`mockConfigureConnection` resolves with an updated connection), assert the
  panel reflects the new `externalAccountRef` and `cj-connection-status`
  updates, without a second `getConnection` round-trip being required (page
  updates from the modal's `onSuccess` payload directly).
- **Verify success (healthy)**: connection pre-configured with `status: 'Disconnected'`;
  `mockVerifyConnection` resolves `{ data: { healthy: true } }`; assert
  `await screen.findByTestId('cj-verify-result')` contains "healthy" and
  `mockGetConnection` is called again (refresh) reflecting `status: 'Connected'`.
- **Verify failure (unhealthy) surfaces backend `reason`**: `mockVerifyConnection`
  resolves `{ data: { healthy: false, reason: 'CJ Dropshipping rejected the configured credentials or is unreachable' } }`;
  assert `cj-verify-result` contains that exact reason text.
- **Verify 429**: `mockVerifyConnection` rejects with `{ response: { status: 429 } }`
  (no `data.error.code` — matches the real rate-limiter response shape);
  assert `cj-connection-error` contains "Too many"/"try again" wording, not a
  generic failure message.
- **Verify disabled while in flight**: `mockVerifyConnection` returns a
  never-resolving promise; click `btn-verify-connection`; assert the button
  is `disabled`.
- **Sync disabled unless Connected**: connection with `status: 'Disconnected'`
  → `btn-sync-catalog` is disabled; connection with `status: 'Connected'` →
  enabled.
- **Sync success**: `status: 'Connected'`; `mockSync` resolves
  `{ data: { itemsUpserted: 3, itemsFailed: 1, syncedAt: '...' } }`; assert
  `cj-sync-result` shows both counts, and `mockListCatalog` is called again
  (refetch) after the sync resolves.

### 7.2 New component tests

`frontend/src/components/admin/__tests__/CjConnectionPanel.test.tsx`:
- Not-configured render (`connection={null}`) shows only the CTA.
- Configured render shows provider/status/account-ref/timestamps, with `—`/`Never
  verified`/`Never synced` fallbacks when fields are `null`.
- Verify/Sync in-flight disabled states (never-resolving mock promises from a
  directly-imported, jest-mocked `cjConnectionService`).
- Verify/Sync success calls `onRefreshConnection`; sync success additionally
  calls `onCatalogRefreshNeeded`.
- Sync button `disabled` for `Disconnected`/`Error`, enabled for `Connected`.

`frontend/src/components/admin/__tests__/CjConnectionModal.test.tsx`:
- Renders with empty input in create mode (`connection={null}`), prefilled
  input in edit mode (`connection={{ ...,  externalAccountRef: 'existing-ref' }}`).
- Typing beyond 150 characters is truncated (assert the input's value length
  never exceeds 150 after `fireEvent.change` with a 200-char string).
- Submit calls `cjConnectionService.configureConnection(supplierId, { externalAccountRef: <trimmed-or-null> })`
  and, on success, calls `onSuccess` with the returned connection and closes
  (`onHide` called).
- Submit failure shows the mapped error inline and does **not** call `onHide`.
- No element with `type="password"` or text matching `/api.?key|secret|credential/i`
  is ever rendered (a cheap regression guard for the "no credential field"
  constraint).

Both new test files run through `npx eslint src --ext .ts,.tsx` and `npx tsc
--noEmit` per tasks.md 8.2 — no `.js`/CommonJS test helpers, use the same
`@testing-library/react` + `MemoryRouter`/`Routes` harness as `CjCatalogPage.test.tsx`
where routing context is needed (component tests likely don't need a router at
all since neither new component uses `useParams`/`useNavigate`).

---

## Summary of files touched

| File | Action |
|---|---|
| `frontend/src/types/cjConnection.ts` | new |
| `frontend/src/services/cjConnectionService.ts` | new |
| `frontend/src/services/__tests__/cjConnectionService.test.ts` | new |
| `frontend/src/components/admin/CjConnectionPanel.tsx` | new |
| `frontend/src/components/admin/CjConnectionModal.tsx` | new |
| `frontend/src/components/admin/__tests__/CjConnectionPanel.test.tsx` | new |
| `frontend/src/components/admin/__tests__/CjConnectionModal.test.tsx` | new |
| `frontend/src/pages/CjCatalogPage.tsx` | modify (imports, state, `fetchConnection`, gated `fetchCatalog` effect, render) |
| `frontend/src/pages/__tests__/CjCatalogPage.test.tsx` | modify (extend) |
| `frontend/src/components/admin/StatusBadge.tsx` | modify (add 3 `VARIANT` entries) |

No backend files, no routing (`App.js`/`App.tsx`) changes — the panel lives
inside the existing `suppliers/:supplierId/cj-catalog` route, per design.md
decision 3.
