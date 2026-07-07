# Backend Implementation Plan — `cj-dropshipping-integration`

Scope: `openspec/changes/cj-dropshipping-integration/tasks.md` groups **1–8** (schema → domain →
repositories → infra client → repo impls → application services → new order-push service →
presentation layer), plus the exact test files that must be renamed/rewritten alongside them.
Groups 9–14 (test/db verification, curl testing, docs, commit/PR) are the parent agent's/
follow-on responsibility and are only summarized at the end for continuity.

This plan **replaces** the Spocket placeholder outright (rename, not extend), per
`design.md` Decision 1. Every "Spocket" identifier below is renamed to "Cj"; there is no
intermediate compatibility shim.

---

## 0. Key decisions this plan locks in (read first)

1. **Token cache lives in `cjClient.ts` as module-level state** — `{ accessToken, refreshToken,
   accessTokenExpiryDate }`, not persisted anywhere. Refresh is triggered when
   `Date.now() > accessTokenExpiryDate.getTime() - SAFETY_MARGIN_MS` (24h margin). Never a
   hardcoded lifetime constant.
2. **Success/failure is body-based everywhere in `cjClient.ts`**: every response is parsed as
   JSON first (regardless of HTTP status), then checked via `body.result === true` (CJ's actual
   field is `result`, with `code === 200` — see note in §4.1 on exact field names, verify against
   live-tested shape captured in the session) before falling back to HTTP-status handling for
   truly non-JSON/network failures only.
3. **New repository method needed but not explicit in `tasks.md`**: resolving a
   `SupplierOrderItem` → CJ `vid` requires a lookup by `(supplierIntegrationId, externalRef)`
   where `externalRef` is sourced from `ProductVariant.supplierReference` (the existing field
   already used to snapshot `SupplierOrderItem.supplierReferenceSnapshot` — see
   `supplierOrderRepository.ts:314`). This plan adds
   `ICjCatalogItemRepository.findByExternalRef(supplierIntegrationId, externalRef)` in §3/§5,
   since `cjOrderPushService` cannot resolve freight/order items without it.
4. **`isSandbox` never appears in any request DTO/type** for the push endpoint — not just
   "ignored if present," but structurally absent from the validator and the service method
   signature, per design.md Risk mitigation #5.
5. Renames are mechanical (`Spocket` → `Cj`, `spocket` → `cj`) except where noted (e.g. new
   fields, new methods, new files).

---

## 1. Prisma Schema (`backend/prisma/schema.prisma`)

### 1.1 — Rename `SpocketCatalogItem` → `CjCatalogItem`, add CJ fields

Replace the existing model (currently lines ~479–499):

```prisma
model CjCatalogItem {
  id                    Int                 @id @default(autoincrement())
  supplierIntegrationId Int
  supplierIntegration   SupplierIntegration @relation(fields: [supplierIntegrationId], references: [id])
  externalRef           String              @db.VarChar(150) // CJ's vid — unique key, unchanged role
  pid                   String?             @db.VarChar(150) // CJ product id, kept alongside vid for clarity
  vid                   String?             @db.VarChar(150) // mirrors externalRef; explicit CJ-shaped field
  sku                   String?             @db.VarChar(100)
  categoryId            String?             @db.VarChar(100)
  title                 String              @db.VarChar(150)
  size                  String?             @db.VarChar(50)
  color                 String?             @db.VarChar(50)
  supplierCost          Decimal             @db.Decimal(10, 2)
  sellPrice             Decimal?            @db.Decimal(10, 2)
  stockQuantity         Int
  warehouseInventoryNum Int?
  rawPayload            Json
  syncStatus            String              @default("Synced") @db.VarChar(20)
  syncError             String?             @db.VarChar(500)
  lastSyncedAt          DateTime?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  @@unique([supplierIntegrationId, externalRef])
  @@index([supplierIntegrationId])
  @@index([syncStatus])
}
```

Note: `vid` duplicates `externalRef`'s value in practice (both are CJ's `vid`) — `tasks.md 1.1`
explicitly asks for both, "kept for clarity". Document in code comment above the field that
`externalRef` is the canonical unique key used by application code; `vid`/`pid` are the
CJ-native field names preserved for readability when cross-referencing raw CJ API docs/responses.

### 1.2 — `SupplierIntegration.provider` default

```prisma
provider String @default("CJDropshipping") @db.VarChar(50)
```

### 1.3 — `SupplierOrder` external-order fields

Add to the `SupplierOrder` model (after `internalNotes`, before `createdAt`):

```prisma
  externalProvider         String?   @db.VarChar(50)
  externalOrderId          String?   @unique @db.VarChar(150)
  externalOrderStatus      String?   @db.VarChar(50)
  externalTrackingNumber   String?   @db.VarChar(100)
  externalTrackingProvider String?   @db.VarChar(100)
  sandbox                  Boolean   @default(true)
  pushedAt                 DateTime?
  lastStatusSyncedAt       DateTime?
```

Add `@@index([externalOrderId])` is unnecessary (unique already indexes it).

### 1.4 — Back-relation rename (optional but do it for clarity)

`Supplier.spocketIntegration SupplierIntegration?` → `Supplier.cjIntegration SupplierIntegration?`
(schema.prisma line 41). Prisma-relation-name-only change; update the one reference to
`spocketIntegration` if any application code reads it (grep confirmed none does — the
`SupplierIntegrationRepository` queries `supplierIntegration` model directly by `supplierId`,
not through the `Supplier` relation, so this rename has zero code blast radius beyond the schema
file itself).

### 1.5 / 1.6 — Migration commands (execute inside Docker per the lesson in the context session)

```bash
docker compose exec backend npx prisma migrate dev --name rename_spocket_to_cj_and_add_order_push_fields
docker cp <container_name>:/app/prisma/migrations/<timestamp>_rename_spocket_to_cj_and_add_order_push_fields backend/prisma/migrations/
npx prisma generate   # host-side, after copying, so TS types match
docker compose exec backend npx prisma generate
```

**Verify the migration folder exists on the host filesystem (`backend/prisma/migrations/`)
before running any `docker compose build`/`up -d`** — this exact step was missed once already in
the prior spocket-integration change and the container's `/app/prisma` is not bind-mounted.

Confirm via `SELECT COUNT(*) FROM "SpocketCatalogItem"` / `SupplierIntegration` returns 0 rows
(both confirmed empty placeholder data in dev per `design.md` Migration Plan step 1) before
running the rename — if either is non-zero, stop and ask the user rather than silently
renaming populated tables.

---

## 2. Domain Layer

### 2.1 — `backend/src/domain/models/spocketCatalogItem.ts` → `cjCatalogItem.ts`

Rename class `SpocketCatalogItem` → `CjCatalogItem`, type `SpocketSyncStatus` → `CjSyncStatus`.
Add constructor fields: `pid?: string | null`, `vid?: string | null`, `sku?: string | null`,
`categoryId?: string | null`, `sellPrice?: string | null`, `warehouseInventoryNum?: number | null`
— all optional, all following the existing pattern (`?? null` defaulting in the constructor body,
mirroring how `size`/`color` are handled today).

### 2.2 — `backend/src/domain/models/supplierIntegration.ts`

Line 27: `this.provider = data.provider ?? 'Spocket';` → `this.provider = data.provider ?? 'CJDropshipping';`
No other changes to this file.

### 2.3 — `backend/src/domain/models/supplierOrder.ts`

Extend the `SupplierOrder` class (not `SupplierOrderItem`) with:

```ts
externalProvider?: string | null;
externalOrderId?: string | null;
externalOrderStatus?: string | null;
externalTrackingNumber?: string | null;
externalTrackingProvider?: string | null;
sandbox: boolean;
pushedAt?: Date | null;
lastStatusSyncedAt?: Date | null;
```

Constructor: add matching optional params, default `sandbox` to `true` (`data.sandbox ?? true`),
default the rest to `null`. Follow the exact `?? null` idiom already used for
`trackingNumber`/`trackingUrl`. **Do not** add any method that mutates
`status`/`trackingNumber`/`trackingUrl` from these new fields — they are intentionally
independent per design.md Decision 4.

---

## 3. Domain Repositories

### 3.1 — `backend/src/domain/repositories/spocketCatalogItemRepository.ts` → `cjCatalogItemRepository.ts`

Rename `ISpocketCatalogItemRepository` → `ICjCatalogItemRepository`,
`SpocketCatalogItemUpsertInput` → `CjCatalogItemUpsertInput` (add the new optional fields:
`pid`, `vid`, `sku`, `categoryId`, `sellPrice`, `warehouseInventoryNum`),
`SpocketCatalogItemListFilters` → `CjCatalogItemListFilters`,
`SpocketCatalogItemListResult` → `CjCatalogItemListResult`.

**Add a new method** (needed by `cjOrderPushService`, not present in the old interface):

```ts
export interface ICjCatalogItemRepository {
  upsertMany(supplierIntegrationId: number, items: CjCatalogItemUpsertInput[]): Promise<{ upserted: number }>;
  findBySupplierIntegrationId(supplierIntegrationId: number, filters?: CjCatalogItemListFilters): Promise<CjCatalogItemListResult>;
  findByExternalRef(supplierIntegrationId: number, externalRef: string): Promise<CjCatalogItem | null>;
}
```

### 3.2 — `supplierIntegrationRepository.ts` (domain)

Confirmed (per grep) this file has no "Spocket" string in it today — it is already
provider-neutral (`ISupplierIntegrationRepository`, `SupplierIntegrationUpsertData`). **Leave
as-is**, no rename needed. (Task 3.2 explicitly says "verify and leave as-is if already
provider-neutral" — verified.)

### 3.3 — `backend/src/domain/repositories/supplierOrderRepository.ts`

Add to `ISupplierOrderRepository`:

```ts
findByExternalOrderId(externalOrderId: string): Promise<SupplierOrder | null>;
updateExternalOrder(
  id: number,
  data: { externalProvider: string; externalOrderId: string; sandbox: boolean; pushedAt: Date }
): Promise<SupplierOrder>;
updateExternalOrderStatus(
  id: number,
  data: {
    externalOrderStatus: string;
    externalTrackingNumber?: string | null;
    externalTrackingProvider?: string | null;
    lastStatusSyncedAt: Date;
  }
): Promise<SupplierOrder>;
```

Add a corresponding input type near the existing `SupplierOrderStatusUpdateData` (e.g.
`SupplierOrderExternalUpdateData`, `SupplierOrderExternalStatusUpdateData`) for clarity, mirroring
the naming convention already used for `SupplierOrderStatusUpdateData`.

---

## 4. Infrastructure: Real CJ Dropshipping API Client

### 4.1 — `backend/src/infrastructure/external/spocketTypes.ts` → `cjTypes.ts`

Replace all DTOs. Based on the live-validated shapes recorded in the context session and
`design.md`:

```ts
export interface CjAuthData {
  accessToken: string;
  accessTokenExpiryDate: string; // ISO date string from CJ — parse with `new Date(...)`
  refreshToken: string;
  refreshTokenExpiryDate: string;
}

export interface CjPointsInfo {
  total: number;
  usedToday: number;
  remaining: number;
}

// Generic envelope every CJ response shares — success/failure is read from
// `result`/`code`, NEVER from HTTP status (CJ returns HTTP 200 for logical errors too).
export interface CjEnvelope<T> {
  code: number;
  result: boolean;
  message?: string; // never surfaced verbatim to logs/clients — see CjApiError
  data: T;
  pointsInfo?: CjPointsInfo;
}

export interface CjCategoryDto {
  categoryId: string;
  categoryName: string;
  children?: CjCategoryDto[];
}

export interface CjProductDto {
  pid: string;
  productNameEn: string; // confirm exact field name against live payload captured in session; `nameEn` per design.md draft — reconcile against the actual JSON captured during live testing before finalizing the mapper
  productSku: string;
  productImage?: string;
  sellPrice: number;
  categoryId: string;
  warehouseInventoryNum?: number;
}

export interface CjVariantDto {
  vid: string;
  pid: string;
  variantSku: string;
  variantNameEn?: string; // size/color are typically embedded in variant name/key fields — mapper in cjCatalogSyncService must parse per the real /variant/query response captured live
  variantWeight?: number;
  variantSellPrice: number;
  variantStandardPrice?: number; // CJ's internal cost field candidate for supplierCost — confirm against session's captured payload
}

export interface CjListV2Response {
  pageNum: number;
  pageSize: number;
  total: number;
  content: Array<{ productList: CjProductDto[] }>;
}

export interface CjFreightOption {
  logisticName: string;
  logisticAging: string; // e.g. "4-8 days"
  logisticPrice: number;
  totalPostageFee: number;
}

export interface CjFreightCalculateParams {
  startCountryCode: string;
  endCountryCode: string;
  products: Array<{ vid: string; quantity: number }>;
}

export interface CjOrderCreateParams {
  orderNumber: string; // our SupplierOrder.supplierOrderNumber, used as CJ's client-side reference
  logisticName: string;
  isSandbox: 1; // literal type — cannot be widened to number/boolean by a caller
  products: Array<{ vid: string; quantity: number }>;
  shippingAddress: Record<string, unknown>; // resolved from CustomerOrder's shipping address — see §7 note
}

export interface CjOrderCreateResult {
  orderId: string;
}

export interface CjOrderDetail {
  orderId: string;
  orderStatus: string;
  trackNumber?: string | null;
  logisticName?: string | null;
}

export interface CjVerifyResult {
  healthy: boolean;
  externalAccountRef?: string;
}

// Port consumed by application services — implemented by CjApiClient. Same
// rationale as the old ISpocketClient split (services testable via hand-written
// fakes instead of mocking HTTP).
export interface ICjClient {
  verifyConnection(): Promise<CjVerifyResult>;
  fetchCategories(): Promise<CjCategoryDto[]>;
  fetchCatalog(page: number, pageSize?: number): Promise<CjListV2Response>;
  fetchVariants(pid: string): Promise<CjVariantDto[]>;
  calculateFreight(params: CjFreightCalculateParams): Promise<CjFreightOption[]>;
  createOrder(params: Omit<CjOrderCreateParams, 'isSandbox'>): Promise<CjOrderCreateResult>;
  getOrderDetail(externalOrderId: string): Promise<CjOrderDetail>;
}
```

**Important flagged uncertainty**: several CJ field names above (`productNameEn` vs `nameEn`,
exact variant size/color field, exact cost field for `supplierCost`) are reconstructed from
`design.md`'s prose description, not a captured raw JSON sample. Before implementing
`cjCatalogSyncService`'s mapper (§6.2), **re-run the live `product/listV2` and
`variant/query` calls once more and paste the raw JSON into a scratch file** to lock down exact
field names — do not guess field names into production mapping code, since a wrong field name
fails silently (becomes `undefined`) rather than throwing, which would slip through the "per-item
failure isolation" path silently producing empty titles/costs instead of `Failed` records.

### 4.2 — `backend/src/infrastructure/external/spocketClient.ts` → `cjClient.ts`

```ts
import { ICjClient, CjEnvelope, CjAuthData, CjVerifyResult, CjCategoryDto, CjListV2Response,
  CjVariantDto, CjFreightOption, CjFreightCalculateParams, CjOrderCreateParams,
  CjOrderCreateResult, CjOrderDetail } from './cjTypes';
import { logger } from '../logger';

const CJ_API_BASE_URL = process.env.CJ_API_BASE_URL ?? 'https://developers.cjdropshipping.com/api2.0/v1';
const CJDROPSHIPPING_API_KEY = process.env.CJDROPSHIPPING_API_KEY ?? 'cj_test_placeholder';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const TOKEN_REFRESH_SAFETY_MARGIN_MS = 24 * 60 * 60 * 1000; // 24h before reported expiry
const AUTH_MIN_INTERVAL_MS = 1000; // CJ's documented 1 req/s auth rate limit

export class CjApiError extends Error {
  readonly code = 'CJ_API_ERROR' as const;
  readonly status: number;

  // Fixed vocabulary only — never includes body.message (CJ's raw upstream text),
  // matching the prior SpocketApiError's leak-prevention rationale.
  constructor(statusCode: number, reason: string) {
    super(`CJ Dropshipping API request failed (${statusCode}): ${reason}`);
    this.name = 'CjApiError';
    this.status = statusCode;
    Object.setPrototypeOf(this, CjApiError.prototype);
  }
}

// Module-level token cache — single global CJ account, not per-supplier (design.md Decision 2).
let cachedAuth: CjAuthData | null = null;
let lastAuthCallAt = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isExpiringSoon(expiryDate: string): boolean {
  const expiryMs = new Date(expiryDate).getTime();
  return Number.isNaN(expiryMs) || Date.now() > expiryMs - TOKEN_REFRESH_SAFETY_MARGIN_MS;
}

async function authenticate(): Promise<CjAuthData> {
  const waitMs = AUTH_MIN_INTERVAL_MS - (Date.now() - lastAuthCallAt);
  if (waitMs > 0) await sleep(waitMs);
  lastAuthCallAt = Date.now();

  const res = await fetch(`${CJ_API_BASE_URL}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: CJDROPSHIPPING_API_KEY }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as CjEnvelope<CjAuthData> | null;
  if (!body || body.result !== true || !body.data?.accessToken) {
    throw new CjApiError(res.status, 'authentication rejected');
  }
  logger.info('CJ authentication succeeded', { pointsInfo: body.pointsInfo }); // never log tokens
  cachedAuth = body.data;
  return cachedAuth;
}

async function refreshAuth(refreshToken: string): Promise<CjAuthData> {
  const res = await fetch(`${CJ_API_BASE_URL}/authentication/refreshAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as CjEnvelope<CjAuthData> | null;
  if (!body || body.result !== true || !body.data?.accessToken) {
    // Refresh failed — fall back to full re-authentication rather than throwing,
    // since a stale/invalid refresh token should not permanently break the client.
    return authenticate();
  }
  cachedAuth = body.data;
  return cachedAuth;
}

async function getValidToken(): Promise<string> {
  if (!cachedAuth) return (await authenticate()).accessToken;
  if (isExpiringSoon(cachedAuth.accessTokenExpiryDate)) {
    return (await refreshAuth(cachedAuth.refreshToken)).accessToken;
  }
  return cachedAuth.accessToken;
}

async function requestWithRetry<T>(path: string, init: RequestInit): Promise<T> {
  const token = await getValidToken();
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${CJ_API_BASE_URL}${path}`, {
        ...init,
        headers: { ...init.headers, 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      if (attempt === MAX_RETRIES) throw new CjApiError(502, 'upstream unreachable');
      await sleep(2 ** attempt * 200);
      continue;
    }

    const body = (await response.json().catch(() => null)) as CjEnvelope<T> | null;
    lastStatus = response.status;

    // Body-based success evaluation — HTTP status alone is NOT trusted (CJ
    // returns 200 for logical failures too). This is the core contract fix
    // vs. the old SpocketApiClient's response.ok check.
    if (body && body.result === true) {
      if (body.pointsInfo) logger.info('CJ pointsInfo', { pointsInfo: body.pointsInfo });
      return body.data;
    }

    const retryableCode = body?.code === 429 || response.status >= 500;
    if (!retryableCode || attempt === MAX_RETRIES) {
      if (response.status === 401 || response.status === 403 || body?.code === 1000) {
        throw new CjApiError(response.status, 'authentication rejected');
      }
      throw new CjApiError(response.status, 'request failed');
    }
    await sleep(2 ** attempt * 200);
  }
  throw new CjApiError(lastStatus || 502, 'request failed after retries');
}

export class CjApiClient implements ICjClient {
  async verifyConnection(): Promise<CjVerifyResult> {
    try {
      await authenticate(); // force a fresh auth check rather than relying on a cached token
      await requestWithRetry('/setting/get', { method: 'GET' });
      return { healthy: true };
    } catch (err) {
      if (err instanceof CjApiError) return { healthy: false };
      throw err;
    }
  }

  async fetchCategories(): Promise<CjCategoryDto[]> {
    return requestWithRetry<CjCategoryDto[]>('/product/getCategory', { method: 'GET' });
  }

  async fetchCatalog(page: number, pageSize = 100): Promise<CjListV2Response> {
    return requestWithRetry<CjListV2Response>(
      `/product/listV2?page=${page}&size=${pageSize}`,
      { method: 'GET' }
    );
  }

  async fetchVariants(pid: string): Promise<CjVariantDto[]> {
    return requestWithRetry<CjVariantDto[]>(
      `/product/variant/query?pid=${encodeURIComponent(pid)}`,
      { method: 'GET' }
    );
  }

  async calculateFreight(params: CjFreightCalculateParams): Promise<CjFreightOption[]> {
    return requestWithRetry<CjFreightOption[]>('/logistic/freightCalculate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createOrder(params: Omit<CjOrderCreateParams, 'isSandbox'>): Promise<CjOrderCreateResult> {
    const sandboxForced = process.env.CJ_SANDBOX_ORDERS !== 'false'; // default true
    const body: CjOrderCreateParams = { ...params, isSandbox: 1 };
    if (!sandboxForced) {
      // Even with the flag flipped, this increment never sends a real order —
      // that requires a deliberate future code change, not just an env toggle.
      logger.warn('CJ_SANDBOX_ORDERS=false ignored: real order push not implemented in this increment');
    }
    return requestWithRetry<CjOrderCreateResult>('/shopping/order/createOrderV3', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getOrderDetail(externalOrderId: string): Promise<CjOrderDetail> {
    return requestWithRetry<CjOrderDetail>(
      `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(externalOrderId)}`,
      { method: 'GET' }
    );
  }
}

export const cjClient = new CjApiClient();
```

Notes:
- The exact envelope field name (`result` vs `success`) must be locked down against the actual
  captured live response before writing this file — `design.md`/proposal.md use `success`/`code`
  interchangeably in prose; treat this as the single most important thing to verify empirically
  (grep the session's raw curl output if saved, or re-run one auth call) before finalizing
  `CjEnvelope`.
- `CJ_SANDBOX_ORDERS` is read here (in the client) as a defensive second gate, but the real
  enforcement point is `cjOrderPushService.pushOrder()` in §7, which never accepts an
  `isSandbox` param at all — the client-level check is belt-and-suspenders, not the primary
  control.
- `verifyConnection()` forces a fresh `authenticate()` call rather than reusing a cached token,
  matching the spec's "authenticates against CJ Dropshipping... and then calls GET /setting/get".

### 4.3 — `backend/src/infrastructure/external/__tests__/spocketClient.test.ts` → `cjClient.test.ts`

Rewrite mirroring the existing `jsonResponse` helper idiom, but the mock response body must now
be the CJ envelope shape (`{ code, result, data, pointsInfo }`), not a bare status-code check.
Required cases:
- `verifyConnection` returns `{ healthy: true }` when auth + `/setting/get` both return
  `result: true`.
- `verifyConnection` returns `{ healthy: false }` (no throw) when auth returns HTTP 200 with
  `result: false` — this is the critical regression test proving body-based evaluation replaced
  status-based evaluation.
- Token refresh triggered when `accessTokenExpiryDate` is within the safety margin — assert
  `/authentication/refreshAccessToken` was called, not `/authentication/getAccessToken` again.
- Token NOT refreshed when `accessTokenExpiryDate` is far in the future — assert only one auth
  call across multiple client method calls.
- `fetchCatalog`/`calculateFreight`/`createOrder`/`getOrderDetail` happy paths.
- Retry-then-succeed on a retryable code; throw `CjApiError` after exhausting retries.
- **Regression test**: API key/access/refresh tokens never appear in a thrown `CjApiError`
  message (mirrors the old test's secret-leak assertion, updated for the new error class name).
- **New test specific to this integration**: `createOrder` always sends `isSandbox: 1` in the
  request body regardless of any extra fields passed in `params` (defense in depth, even though
  the type system already excludes `isSandbox` from the params type).

### 4.4 — `backend/.env.example`

Remove:
```
SPOCKET_API_KEY=spocket_test_replace_with_your_spocket_api_key
SPOCKET_API_BASE_URL=https://api.spocket.co
```
Add (same section marker style, e.g. `# ── CJ Dropshipping integration ──`):
```
CJDROPSHIPPING_API_KEY=cj_test_replace_with_your_cj_dropshipping_api_key
CJ_API_BASE_URL=https://developers.cjdropshipping.com/api2.0/v1
CJ_SANDBOX_ORDERS=true
```
Also update the SSM example comment near line 99
(`aws ssm put-parameter --name /ecommerce/prod/SPOCKET_API_BASE_URL ...`) to the CJ equivalent.
**Do not touch `backend/.env`** — it already has the real `CJDROPSHIPPING_API_KEY` per the
context session; only `.env.example` is a tracked file.

---

## 5. Infrastructure: Repository Implementations

### 5.1 — `backend/src/infrastructure/repositories/spocketCatalogItemRepository.ts` → `cjCatalogItemRepository.ts`

Rename class/types (`SpocketCatalogItemRepository` → `CjCatalogItemRepository`, Prisma model
`prisma.spocketCatalogItem` → `prisma.cjCatalogItem`). Update `upsertMany`'s `create`/`update`
data blocks to include the new fields (`pid`, `vid`, `sku`, `categoryId`, `sellPrice`,
`warehouseInventoryNum`) using the same `?? null` pattern as `size`/`color` today.

Add the new method (see §3.1):

```ts
async findByExternalRef(supplierIntegrationId: number, externalRef: string): Promise<CjCatalogItem | null> {
  const row = await prisma.cjCatalogItem.findUnique({
    where: { supplierIntegrationId_externalRef: { supplierIntegrationId, externalRef } },
  });
  return row ? new CjCatalogItem({ ...row, supplierCost: row.supplierCost.toString(),
    sellPrice: row.sellPrice?.toString() ?? null }) : null;
}
```

### 5.2 — `backend/src/infrastructure/repositories/supplierIntegrationRepository.ts`

Line 38: `provider: 'Spocket',` → `provider: 'CJDropshipping',` in the `upsert()` create branch.
Also rename the exported error's fixed vocabulary:
`SupplierIntegrationNotFoundError`'s `code` is currently `'SPOCKET_CONNECTION_NOT_FOUND'` and
message `'Spocket connection not found'` — per the spec (`cj-connection-management` requirement
"Retrieve CJ Dropshipping connection status"), this becomes:

```ts
export class SupplierIntegrationNotFoundError extends Error {
  readonly code = 'CJ_CONNECTION_NOT_FOUND' as const;
  readonly status = 404;
  constructor() {
    super('CJ Dropshipping connection not found');
    this.name = 'SupplierIntegrationNotFoundError';
    Object.setPrototypeOf(this, SupplierIntegrationNotFoundError.prototype);
  }
}
```
(Class name unchanged — only the `code`/message strings change — since `tasks.md 7.2` refers to
"`CjConnectionNotFoundError` equivalent placement (mirrors the existing repository-adjacent
`SupplierIntegrationNotFoundError` pattern, renamed if needed)". Keeping the existing class name
is the lower-risk option since it's imported in 4+ places (`errorHandler.ts`, both connection
service/controller files) and only its `code` string is spec-visible.)

### 5.3 — `backend/src/infrastructure/repositories/supplierOrderRepository.ts`

Add three methods implementing §3.3's interface additions:

```ts
async findByExternalOrderId(externalOrderId: string): Promise<SupplierOrder | null> {
  const row = await prisma.supplierOrder.findUnique({ where: { externalOrderId }, select: orderSelect });
  return row ? mapOrder(row) : null;
}

async updateExternalOrder(
  id: number,
  data: { externalProvider: string; externalOrderId: string; sandbox: boolean; pushedAt: Date }
): Promise<SupplierOrder> {
  const row = await prisma.supplierOrder.update({ where: { id }, data, select: orderSelect });
  return mapOrder(row);
}

async updateExternalOrderStatus(
  id: number,
  data: {
    externalOrderStatus: string;
    externalTrackingNumber?: string | null;
    externalTrackingProvider?: string | null;
    lastStatusSyncedAt: Date;
  }
): Promise<SupplierOrder> {
  const row = await prisma.supplierOrder.update({
    where: { id },
    data: {
      externalOrderStatus: data.externalOrderStatus,
      ...(data.externalTrackingNumber !== undefined && { externalTrackingNumber: data.externalTrackingNumber }),
      ...(data.externalTrackingProvider !== undefined && { externalTrackingProvider: data.externalTrackingProvider }),
      lastStatusSyncedAt: data.lastStatusSyncedAt,
    },
    select: orderSelect,
  });
  return mapOrder(row);
}
```

Add `externalProvider`, `externalOrderId`, `externalOrderStatus`, `externalTrackingNumber`,
`externalTrackingProvider`, `sandbox`, `pushedAt`, `lastStatusSyncedAt` to the module-level
`orderSelect` const (line 97) so `mapOrder` receives them (the `SupplierOrder` constructor
already accepts arbitrary extra fields via `...row` spread once §2.3 is done — verify the
constructor destructures rather than ignores unknown keys, since `mapOrder` does `new
SupplierOrder({ ...row, ... })`).

### 5.4 — Repository unit tests

- Rename `spocketCatalogItemRepository.test.ts` → `cjCatalogItemRepository.test.ts`: update the
  `prisma.spocketCatalogItem` mock key to `prisma.cjCatalogItem`, add assertions for the new
  fields in `upsertMany`'s `create`/`update` payloads, and add a test for the new
  `findByExternalRef` method (both found and not-found cases).
- `supplierIntegrationRepository.test.ts`: update the `create` assertion's expected `provider`
  value from `'Spocket'` to `'CJDropshipping'`.
- New tests in `supplierOrderRepository.test.ts` for `findByExternalOrderId`,
  `updateExternalOrder`, `updateExternalOrderStatus` — mirror the existing `updateStatus` test's
  Prisma-mock idiom (mock `prisma.supplierOrder.update`/`findUnique` directly, no transaction
  needed for these three since they're single-row writes).

---

## 6. Application: Connection and Catalog Sync Services (Renamed + Real Behavior)

### 6.1 — `spocketConnectionService.ts` → `cjConnectionService.ts`

`SpocketConnectionService` → `CjConnectionService`. Constructor now takes `ICjClient` instead of
`ISpocketClient`. `configureConnection`/`getConnection` are unchanged logic-wise (just renamed
imports: `validateSpocketConnectionData` → `validateCjConnectionData` from validator.ts, see
§7.2). `verifyConnection()`'s `logger.warn`/fixed-reason strings update from "Spocket" to "CJ
Dropshipping" wording:

```ts
return { healthy: false, reason: 'CJ Dropshipping rejected the configured credentials or is unreachable' };
```

### 6.2 — `spocketCatalogSyncService.ts` → `cjCatalogSyncService.ts`

`SpocketCatalogSyncService` → `CjCatalogSyncService`. Constructor takes `ICjClient`,
`ICjCatalogItemRepository`. Rewrite `syncCatalog()`'s pagination loop: CJ's `listV2` is
page-number-based (`page`, `size`), not a `nextPageToken` cursor like the old placeholder —
replace the `do...while(pageToken)` loop with a `page`-incrementing loop bounded by
`Math.ceil(total / pageSize)` (from the first response) AND the existing `MAX_SYNC_PAGES` safety
cap (keep both — a page-count cap alone doesn't protect against a `total` that's wildly wrong).

For each product in `page.content[].productList[]`: call `fetchVariants(product.pid)` to get its
variants (an extra per-product upstream call — **note the added CJ quota cost vs. the old
placeholder's flat-response mapping**; log `pointsInfo.remaining` observability per design.md
Risk #3), then map each variant into a `CjCatalogItemUpsertInput`:

```ts
{
  externalRef: variant.vid,
  pid: product.pid,
  vid: variant.vid,
  sku: variant.variantSku,
  categoryId: product.categoryId,
  title: product.productNameEn, // confirm exact field per §4.1 note
  supplierCost: variant.variantStandardPrice?.toFixed(2) ?? variant.variantSellPrice.toFixed(2),
  sellPrice: variant.variantSellPrice.toFixed(2),
  stockQuantity: product.warehouseInventoryNum ?? 0, // or a separate stock-query call if listV2 doesn't include it — verify
  warehouseInventoryNum: product.warehouseInventoryNum ?? null,
  rawPayload: { product, variant },
  syncStatus: 'Synced',
  lastSyncedAt: now,
}
```

Keep the exact per-item try/catch failure-isolation pattern from the old service (invalid
cost/stockQuantity → `syncStatus: 'Failed'` with a sequence-suffixed `externalRef` fallback).
Replace `SpocketApiUnavailableError`/`SpocketConnectionNotReadyError` imports with the renamed
`CjApiUnavailableError`/`CjConnectionNotReadyError` (§7.2). `listStagedCatalog()` is unchanged
logic, just renamed types.

### 6.3 — Test renames

`spocketConnectionService.test.ts` → `cjConnectionService.test.ts`: same structure as the file
read in §research (prisma.supplier mock, `mockRepo`/`mockCjClient` with the new `ICjClient`
method surface — note `fetchCatalog` in the old mock becomes several methods now
(`fetchCategories`, `fetchCatalog`, `fetchVariants`, `calculateFreight`, `createOrder`,
`getOrderDetail`) so the `jest.Mocked<ICjClient>` object literal in `beforeEach` must list all
six). Update the "never leak credential" regex assertion to also exclude `cj_test|CJ-Access-Token`.

`spocketCatalogSyncService.test.ts` → `cjCatalogSyncService.test.ts`: rewrite fixture data to the
CJ `CjListV2Response`/`CjVariantDto` shape; add a test for the page-number pagination loop
(assert `fetchCatalog` called with incrementing `page` args until `total` is exhausted) replacing
the old `nextPageToken` cursor test.

---

## 7. Application: New Supplier-Order Push Service (Sandbox-Only)

### 7.1 — `backend/src/application/services/cjOrderPushService.ts` (NEW)

```ts
export class CjOrderPushService {
  constructor(
    private readonly supplierOrderRepo: ISupplierOrderRepository,
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly cjClient: ICjClient
  ) {}

  async quoteFreight(supplierOrderId: number): Promise<CjFreightOption[]> {
    const order = await this.supplierOrderRepo.findById(supplierOrderId);
    if (!order) throw new SupplierOrderNotFoundError();

    const integration = await this.integrationRepo.findBySupplierId(order.supplierId);
    if (!integration?.id) throw new SupplierIntegrationNotFoundError();

    const products = await this.resolveVids(order, integration.id); // throws CjItemNotMappedError

    return this.cjClient.calculateFreight({
      startCountryCode: 'CN', // CJ's shipping origin default, per design.md
      endCountryCode: 'ES',   // resolve from the order's shipping address in a future increment; hardcode ES for now per session's business context — FLAG for confirmation with user, this is a plan assumption
      products,
    });
  }

  async pushOrder(
    supplierOrderId: number,
    input: { logisticName: string }
  ): Promise<SupplierOrder> {
    const order = await this.supplierOrderRepo.findById(supplierOrderId);
    if (!order) throw new SupplierOrderNotFoundError();
    if (order.externalOrderId) throw new CjOrderAlreadyPushedError();

    const integration = await this.integrationRepo.findBySupplierId(order.supplierId);
    if (!integration?.id) throw new SupplierIntegrationNotFoundError();

    const products = await this.resolveVids(order, integration.id);

    let result;
    try {
      // Note: createOrder's params type has NO isSandbox field — cjClient forces
      // it server-side. There is no code path here that could pass one through.
      result = await this.cjClient.createOrder({
        orderNumber: order.supplierOrderNumber,
        logisticName: input.logisticName,
        products,
        shippingAddress: {}, // TODO plan note: resolve real shipping address — see Open Question below
      });
    } catch (err) {
      logger.error('CJ order push failed', { supplierOrderId, status: err instanceof CjApiError ? err.status : undefined });
      throw new CjApiUnavailableError();
    }

    return this.supplierOrderRepo.updateExternalOrder(supplierOrderId, {
      externalProvider: 'CJDropshipping',
      externalOrderId: result.orderId,
      sandbox: true, // always true in this increment
      pushedAt: new Date(),
    });
  }

  async getOrderStatus(supplierOrderId: number): Promise<SupplierOrder> {
    const order = await this.supplierOrderRepo.findById(supplierOrderId);
    if (!order) throw new SupplierOrderNotFoundError();
    if (!order.externalOrderId) throw new CjOrderNotPushedError();

    let detail;
    try {
      detail = await this.cjClient.getOrderDetail(order.externalOrderId);
    } catch (err) {
      logger.error('CJ order status pull failed', { supplierOrderId });
      throw new CjApiUnavailableError();
    }

    return this.supplierOrderRepo.updateExternalOrderStatus(supplierOrderId, {
      externalOrderStatus: detail.orderStatus,
      externalTrackingNumber: detail.trackNumber ?? null,
      externalTrackingProvider: detail.logisticName ?? null,
      lastStatusSyncedAt: new Date(),
    });
  }

  private async resolveVids(
    order: SupplierOrder,
    supplierIntegrationId: number
  ): Promise<Array<{ vid: string; quantity: number }>> {
    const products = [];
    for (const item of order.items ?? []) {
      const externalRef = item.supplierReferenceSnapshot; // ProductVariant.supplierReference snapshot
      const staged = externalRef
        ? await this.catalogRepo.findByExternalRef(supplierIntegrationId, externalRef)
        : null;
      if (!staged) throw new CjItemNotMappedError();
      products.push({ vid: staged.externalRef, quantity: item.quantity });
    }
    return products;
  }
}
```

**Open question flagged for the user/parent agent before implementation**: `shippingAddress` for
`createOrderV3` is not resolvable from anything in this plan's file list — `SupplierOrder` has no
direct address reference; the customer's shipping address lives on `CustomerOrder`/
`CustomerAddress` (via `order.customerOrderId`). The service must load
`prisma.customerOrder.findUnique({ where: { id: order.customerOrderId }, include: { shippingAddress: true } })`
(confirm the actual relation/field name in schema.prisma — not verified in this research pass)
and map it into CJ's expected address shape. **This mapping needs its own field-name
verification pass against `docs/data-model.md`'s `CustomerAddress` section before writing
`cjOrderPushService.ts`** — flag this explicitly to whoever implements, since it's a real gap
this plan cannot fully close without an extra read.

**Country-code assumption**: `quoteFreight` hardcodes `startCountryCode: 'CN'` /
`endCountryCode: 'ES'`. This matches the session's live-tested China→Spain freight lookup but is
a business-scope assumption (single-country store) baked into code — flag to the user if
multi-country shipping is anticipated soon, since the current plan has no per-order country
resolution.

### 7.2 — `backend/src/application/validator.ts` additions

Replace the "Spocket integration validators + error classes" section (lines ~1030–1069):

```ts
// ─────────────────────────────────────────────────────────────────────────────
// CJ Dropshipping integration validators + error classes
// ─────────────────────────────────────────────────────────────────────────────

export function validateCjConnectionData(data: Record<string, unknown>): void {
  const externalAccountRef = data['externalAccountRef'];
  if (externalAccountRef !== undefined && externalAccountRef !== null && externalAccountRef !== '') {
    if (typeof externalAccountRef !== 'string') {
      throw new ValidationError("Field 'externalAccountRef' must be a string");
    }
    if (externalAccountRef.length > 150) {
      throw new ValidationError("Field 'externalAccountRef' must not exceed 150 characters");
    }
  }
  // No apiKey/secret/credential field accepted — CJDROPSHIPPING_API_KEY always
  // comes from environment/SSM configuration, never a client request.
}

// Validates the push request body accepts ONLY logisticName — this is the
// structural enforcement point for design.md Risk #5: there is no `isSandbox`
// field anywhere in this validator, so nothing downstream can ever read one.
export function validateCjOrderPushData(data: Record<string, unknown>): { logisticName: string } {
  const logisticName = data['logisticName'];
  if (typeof logisticName !== 'string' || logisticName.trim().length === 0) {
    throw new ValidationError("Field 'logisticName' is required and must be a non-empty string");
  }
  if ('isSandbox' in data) {
    throw new ValidationError("Field 'isSandbox' is not accepted — sandbox mode is always forced server-side");
  }
  return { logisticName };
}

export class CjConnectionNotReadyError extends Error {
  readonly code = 'CJ_CONNECTION_NOT_READY' as const;
  readonly status = 422;
  constructor(message = 'CJ Dropshipping connection must be Connected before syncing') {
    super(message);
    this.name = 'CjConnectionNotReadyError';
    Object.setPrototypeOf(this, CjConnectionNotReadyError.prototype);
  }
}

export class CjApiUnavailableError extends Error {
  readonly code = 'CJ_API_UNAVAILABLE' as const;
  readonly status = 502;
  constructor(message = 'CJ Dropshipping API is currently unavailable') {
    super(message);
    this.name = 'CjApiUnavailableError';
    Object.setPrototypeOf(this, CjApiUnavailableError.prototype);
  }
}

export class CjItemNotMappedError extends Error {
  readonly code = 'CJ_ITEM_NOT_MAPPED' as const;
  readonly status = 422;
  constructor(message = 'Supplier order item has no corresponding staged CJ Dropshipping variant') {
    super(message);
    this.name = 'CjItemNotMappedError';
    Object.setPrototypeOf(this, CjItemNotMappedError.prototype);
  }
}

export class CjOrderAlreadyPushedError extends Error {
  readonly code = 'CJ_ORDER_ALREADY_PUSHED' as const;
  readonly status = 409;
  constructor(message = 'Supplier order has already been pushed to CJ Dropshipping') {
    super(message);
    this.name = 'CjOrderAlreadyPushedError';
    Object.setPrototypeOf(this, CjOrderAlreadyPushedError.prototype);
  }
}

export class CjOrderNotPushedError extends Error {
  readonly code = 'CJ_ORDER_NOT_PUSHED' as const;
  readonly status = 422;
  constructor(message = 'Supplier order has not been pushed to CJ Dropshipping yet') {
    super(message);
    this.name = 'CjOrderNotPushedError';
    Object.setPrototypeOf(this, CjOrderNotPushedError.prototype);
  }
}
```

Rename every call site of `validateSpocketConnectionData` (in `cjConnectionService.ts`),
`SpocketConnectionNotReadyError`/`SpocketApiUnavailableError` (in `cjCatalogSyncService.ts` and
`errorHandler.ts`, §8.5).

### 7.3 — `backend/src/application/services/__tests__/cjOrderPushService.test.ts` (NEW)

Mirror the `jest.Mocked<Interface>` pattern from `spocketConnectionService.test.ts`. Mock four
collaborators: `ISupplierOrderRepository`, `ISupplierIntegrationRepository`,
`ICjCatalogItemRepository`, `ICjClient`. Required cases:
- `quoteFreight`: happy path returns the client's raw options list; throws
  `CjItemNotMappedError` when any item's `supplierReferenceSnapshot` has no matching
  `CjCatalogItem`; throws `SupplierOrderNotFoundError`/`SupplierIntegrationNotFoundError` for
  missing order/connection.
- `pushOrder`: happy path asserts `cjClient.createOrder` was called with a params object that has
  **no `isSandbox` key at all** (`expect(callArgs).not.toHaveProperty('isSandbox')`), and that
  the repo's `updateExternalOrder` was called with `sandbox: true`; rejects with
  `CjOrderAlreadyPushedError` when `externalOrderId` is already set (assert `cjClient.createOrder`
  was never called); rejects with `CjApiUnavailableError` on client throw, and asserts
  `updateExternalOrder` was never called (external fields stay unchanged).
- `getOrderStatus`: happy path persists and returns the four external fields; rejects with
  `CjOrderNotPushedError` when `externalOrderId` is null (assert `cjClient.getOrderDetail` never
  called).
- **Explicit anti-injection test**: construct a call to `pushOrder` passing an object literal with
  an extra `isSandbox: 0` property spliced into the second argument at the TypeScript-bypass
  level (`as any`) to prove the service ignores it even if a caller upstream fails to strip it —
  belt-and-suspenders alongside the validator-level rejection in §7.2.

---

## 8. Presentation: Rename Connection/Catalog Endpoints, Add Order-Push Endpoints

### 8.1 — Controllers rename

`spocketConnectionController.ts` → `cjConnectionController.ts`: rename service import/instance to
`CjConnectionService`/`cjConnectionService`, `SupplierIntegrationRepository` + `cjClient` (from
`../../infrastructure/external/cjClient`). Log lines: `'CJ Dropshipping connection configured'`
etc. Response `message` strings: `'CJ Dropshipping connection created successfully'` etc.

`spocketCatalogSyncController.ts` → `cjCatalogSyncController.ts`: rename service/repo imports to
`CjCatalogSyncService`, `CjCatalogItemRepository`, `cjClient`; serializer import renamed (§8.1
continued below). `syncStatus` query validation unchanged logic.

### 8.1 (serializer) — `spocketCatalogItemSerializer.ts` → `cjCatalogItemSerializer.ts`

Rename `SpocketCatalogItemResponseDTO` → `CjCatalogItemResponseDTO`,
`serializeSpocketCatalogItem` → `serializeCjCatalogItem`. Extend the allow-list with the new
CJ-specific fields that the `cj-catalog-sync` spec's "Admin can list staged CJ Dropshipping
catalog items" requirement documents (`externalRef`, `title`, `sku`, `supplierCost`,
`stockQuantity`, `syncStatus`, `lastSyncedAt` — spec explicitly lists these seven; do **not** add
`pid`/`vid`/`categoryId`/`sellPrice`/`warehouseInventoryNum`/`rawPayload` to the response DTO
unless the spec is revisited, since the spec's enumerated field list is narrower than the full
domain model). Keep excluding `supplierIntegrationId` and `rawPayload`.

### 8.2 — `backend/src/presentation/controllers/cjOrderPushController.ts` (NEW)

```ts
import { validateCjOrderPushData } from '../../application/validator';

function parseSupplierOrderIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'supplierOrderId' must be a valid integer");
  return id;
}

const cjOrderPushService = new CjOrderPushService(
  new SupplierOrderRepository(),
  new SupplierIntegrationRepository(),
  new CjCatalogItemRepository(),
  cjClient
);

export async function freightQuote(req, res, next) {
  try {
    const supplierOrderId = parseSupplierOrderIdParam(req.params['supplierOrderId']);
    const options = await cjOrderPushService.quoteFreight(supplierOrderId);
    res.json({ success: true, data: options, message: 'CJ Dropshipping freight quote retrieved successfully' });
  } catch (err) { next(err); }
}

export async function push(req, res, next) {
  try {
    const supplierOrderId = parseSupplierOrderIdParam(req.params['supplierOrderId']);
    const { logisticName } = validateCjOrderPushData(req.body);
    const order = await cjOrderPushService.pushOrder(supplierOrderId, { logisticName });
    logger.info('Supplier order pushed to CJ Dropshipping', { supplierOrderId, externalOrderId: order.externalOrderId });
    res.status(201).json({ success: true, data: order, message: 'Supplier order pushed to CJ Dropshipping successfully' });
  } catch (err) { next(err); }
}

export async function getOrderStatus(req, res, next) {
  try {
    const supplierOrderId = parseSupplierOrderIdParam(req.params['supplierOrderId']);
    const order = await cjOrderPushService.getOrderStatus(supplierOrderId);
    res.json({ success: true, data: order, message: 'CJ Dropshipping order status retrieved successfully' });
  } catch (err) { next(err); }
}
```

### 8.3 — `backend/src/routes/admin/spocketRoutes.ts` → `cjRoutes.ts`

Rename `spocketVerifyLimiter` → `cjVerifyLimiter`, `spocketRouter` → `cjRouter`, controller
imports updated. Same rate-limit config (15 min window, max 30) — the CodeQL-driven rationale
(prevent brute-force/enumeration against upstream credentials) applies identically to CJ.

`supplierRoutes.ts` update:
```ts
import cjRouter from './cjRoutes';
// ...
supplierRouter.use('/:supplierId/cj', cjRouter);
```

### 8.4 — `backend/src/routes/admin/supplierOrderCjRoutes.ts` (NEW)

```ts
import { Router } from 'express';
import { freightQuote, push, getOrderStatus } from '../../presentation/controllers/cjOrderPushController';

const supplierOrderCjRouter = Router({ mergeParams: true });

supplierOrderCjRouter.post('/freight-quote', freightQuote);
supplierOrderCjRouter.post('/push', push);
supplierOrderCjRouter.get('/order', getOrderStatus);

export default supplierOrderCjRouter;
```

Mount in `backend/src/routes/admin/supplierOrderRoutes.ts`:
```ts
import supplierOrderCjRouter from './supplierOrderCjRoutes';
// ...
supplierOrderRouter.use('/:id/cj', supplierOrderCjRouter);
```
**Path note**: the spec says `/api/admin/supplier-orders/:supplierOrderId/cj/*`, but the existing
`supplierOrderRoutes.ts` uses `:id` as its param name for the parent router (see
`supplierOrderRouter.get('/:id', getSupplierOrderById)`). Since `supplierOrderCjRouter` is
mounted at `/:id/cj` on the parent router, the child router's own `req.params['id']` (not
`supplierOrderId`) will hold the value — **use `req.params['id']` in
`cjOrderPushController.ts`, not `req.params['supplierOrderId']`**, unless the child router is
mounted with an explicit param rename. Flagging this because copying the spec's literal
`:supplierOrderId` param name into the controller without checking the actual mount point is an
easy way to silently break every one of these three endpoints (Express would populate
`req.params.id`, and `req.params.supplierOrderId` would be `undefined`, producing a "Parameter
'supplierOrderId' must be a valid integer" 400 on every request). Adjust `parseSupplierOrderIdParam`
in §8.2 to read `req.params['id']` to match the actual route mount, or rename the parent route's
existing `:id` segments to `:supplierOrderId` for clarity (larger diff, touches `supplierOrderController.ts`
too — recommend the smaller, lower-risk option: read `req.params['id']` in the new controller).

### 8.5 — `backend/src/middleware/errorHandler.ts`

Replace the import block (lines 23–26):
```ts
import {
  CjConnectionNotReadyError,
  CjApiUnavailableError,
  CjItemNotMappedError,
  CjOrderAlreadyPushedError,
  CjOrderNotPushedError,
} from '../application/validator';
```
Replace the two `else if` branches (lines 140–143):
```ts
} else if (err instanceof CjConnectionNotReadyError) {
  statusCode = 422; code = err.code; message = err.message;
} else if (err instanceof CjApiUnavailableError) {
  statusCode = 502; code = err.code; message = err.message;
} else if (err instanceof CjItemNotMappedError) {
  statusCode = 422; code = err.code; message = err.message;
} else if (err instanceof CjOrderAlreadyPushedError) {
  statusCode = 409; code = err.code; message = err.message;
} else if (err instanceof CjOrderNotPushedError) {
  statusCode = 422; code = err.code; message = err.message;
```
`SupplierIntegrationNotFoundError` branch (line 138) is untouched (class name unchanged, per
§5.2 — only its `code` string changed, and `errorHandler.ts` already reads `err.code`
dynamically, so no code change needed there beyond leaving the import as-is).

### 8.6 — Controller test renames + new test

`spocketConnectionController.test.ts` → `cjConnectionController.test.ts`,
`spocketCatalogSyncController.test.ts` → `cjCatalogSyncController.test.ts`: same
`jest.mock(...service path...)`/`jest.mock(...repo path...)`/`jest.mock(...client path...)`
triple-mock idiom as the file read during research, renamed. Update the "never leak credential"
regex to CJ vocabulary (`cj_test|CJ-Access-Token`).

`cjOrderPushController.test.ts` (NEW): mock `CjOrderPushService` the same way (jest.mock the
service module, mock its three methods). Cases: `freightQuote`/`push`/`getOrderStatus` happy
paths + each error code mapping via `next(err)` assertions (mirrors
`spocketConnectionController.test.ts`'s `'should_call_next_on_service_error'` pattern for all
five new error codes: `CJ_ITEM_NOT_MAPPED`, `CJ_ORDER_ALREADY_PUSHED`, `CJ_ORDER_NOT_PUSHED`,
`CJ_API_UNAVAILABLE`, `SUPPLIER_ORDER_NOT_FOUND`). Add the regression assertion: serialize every
successful response's JSON body and assert it does not match
`/apiKey|accessToken|refreshToken|CJ-Access-Token/i`.

### 8.7 — `spocketIsolation.test.ts` → `cjIsolation.test.ts`

Update `candidatePaths` to the `/cj/` equivalents plus the new supplier-order push paths:
```ts
const candidatePaths = [
  '/api/public/suppliers/1/cj/connection',
  '/api/public/suppliers/1/cj/connection/verify',
  '/api/public/suppliers/1/cj/sync',
  '/api/public/suppliers/1/cj/catalog',
  '/api/public/products/1/cj/connection',
  '/api/public/cj/catalog',
  '/api/public/supplier-orders/1/cj/freight-quote',
  '/api/public/supplier-orders/1/cj/push',
  '/api/public/supplier-orders/1/cj/order',
];
```
Keep the "mount a real public router" sanity-check pattern unchanged.

---

## 9. Cross-cutting notes / risks to carry into implementation

1. **Route param mismatch (§8.4)** is the single highest-risk item in this plan — it's the kind
   of bug that passes every unit test (which construct `req.params` by hand) but breaks 100% of
   real curl testing in task group 11. Get this right before running any curl test.
2. **CJ envelope field names** (`result` vs `success`, exact product/variant field names) are
   reconstructed from prose in `design.md`/the context session, not a pasted raw JSON sample.
   Recommend capturing one fresh raw response per endpoint (auth, listV2, variant/query,
   freightCalculate) into a scratch file before finalizing `cjTypes.ts`/`cjClient.ts` — do not
   trust this plan's exact field names as ground truth for those.
3. **Shipping address resolution for `createOrderV3`** is a genuine gap this plan flags but does
   not fully close (§7.1) — needs one more read of `CustomerOrder`/`CustomerAddress` in
   `schema.prisma` and `docs/data-model.md` before `cjOrderPushService.ts` can be completed.
   Recommend resolving this as the very first thing when implementation starts, since every
   `pushOrder` test/curl call depends on it.
4. **`sellPrice`/`warehouseInventoryNum` types**: schema uses `Decimal?`/`Int?`; domain model
   should stringify `Decimal` the same way `supplierCost` already is (`String(data.supplierCost)`
   pattern) to stay consistent with existing repo mapping conventions.
5. Every renamed error class/message string is a place where a stray literal `"Spocket"` could be
   missed — after implementing, run `grep -rn "Spocket\|SPOCKET\|spocket" backend/src` and confirm
   zero results (excluding the migration folder, which is historical and should not be edited).

---

## 10. Test verification command (per CI `backend-quality` / ESLint standards)

```bash
cd backend && npm run lint && npm test -- --watchAll=false --testPathPattern=cj
```
Then the full suite per `tasks.md` §10: `npm test -- --watchAll=false` and `npm run lint` with no
`--testPathPattern` filter, to catch any missed `Spocket` reference in an unrelated test file
(e.g. a shared fixture). New test code must prefix unused params with `_`, avoid `any` (the one
deliberate exception is the `pushOrder` anti-injection test in §7.3, which needs `as any` to
bypass TypeScript and should have a comment explaining why), and mirror the exact `jest.mock()`
patterns shown throughout this plan (they were copied from the actual current spocket* test
files, not invented).

---

## 11. Out of scope for this plan (groups 9, 10, 11, 13 — parent agent's responsibility)

- Group 9: reviewing `supplierOrderService.test.ts`/`supplierOrderController.test.ts` for
  fixture breakage from the new `SupplierOrder` fields (likely a no-op per tasks.md's own note,
  but must be verified by running the suite, not assumed).
- Group 10: running tests + DB baseline capture/report.
- Group 11: live curl testing against the real CJ account (already has a validated real API key
  in `backend/.env` per the context session) — pay special attention to the §8.4 route-param
  risk and the §7.1 shipping-address gap, since both will surface immediately here if unresolved.
- Group 13: `docs/data-model.md`, `docs/api-spec.yml`, `docs/development_guide.md`,
  `docs/backend-standards.md` updates — every doc reference to "Spocket" found in this research
  (see the grep results this plan was built from) needs its CJ Dropshipping equivalent; the new
  `SupplierOrder` external-order fields and the three new order-push endpoints need net-new
  documentation, not just renames.
