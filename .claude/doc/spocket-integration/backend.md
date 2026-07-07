# Backend Implementation Plan — spocket-integration

Scope: `spocket-connection-management` + `spocket-catalog-sync` (OpenSpec change `openspec/changes/spocket-integration/`). Backend-only, admin-only, additive. No existing file's *behavior* changes except two route-registration files and (optionally) `Supplier`'s Prisma model to add a back-relation.

This plan is written for someone with **no prior context** on this codebase's conventions. Every file below states its exact target path relative to `backend/`. Read `openspec/changes/spocket-integration/{proposal.md,design.md,tasks.md,specs/**/*.md}` first — this plan operationalizes those decisions, it does not re-litigate them.

Precedents used throughout: `backend/src/infrastructure/stripe/stripeClient.ts` (singleton client, env-sourced secret with placeholder fallback), `backend/src/application/services/supplierService.ts` / `supplierController.ts` / `supplierRoutes.ts` (CRUD + pagination envelope), `backend/src/routes/admin/productRoutes.ts` (nested `Router({ mergeParams: true })` for `/products/:id/variants`), `backend/src/application/services/paymentService.ts` (service depending on an external client + repos via constructor injection).

---

## 1. Prisma schema — `backend/prisma/schema.prisma`

Add two new models at the end of the file (after the last existing model). Follow the exact field-type conventions already used (`@db.VarChar(n)` on every bounded string, `Decimal @db.Decimal(10,2)` for money, `status` as a plain `String` with `@default(...)`, not a Prisma `enum` — this codebase does not use Prisma enums anywhere; `Supplier.status`, `SupplierOrder.status`, etc. are all `String`).

```prisma
model SupplierIntegration {
  id                 Int       @id @default(autoincrement())
  supplierId         Int       @unique
  supplier           Supplier  @relation(fields: [supplierId], references: [id])
  provider           String    @default("Spocket") @db.VarChar(50)
  status             String    @default("Disconnected") @db.VarChar(20)
  externalAccountRef String?   @db.VarChar(150)
  lastVerifiedAt     DateTime?
  lastSyncedAt       DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  catalogItems       SpocketCatalogItem[]

  @@index([supplierId])
}

model SpocketCatalogItem {
  id                    Int                 @id @default(autoincrement())
  supplierIntegrationId Int
  supplierIntegration   SupplierIntegration @relation(fields: [supplierIntegrationId], references: [id])
  externalRef           String              @db.VarChar(150)
  title                 String              @db.VarChar(150)
  size                  String?             @db.VarChar(50)
  color                 String?             @db.VarChar(50)
  supplierCost          Decimal             @db.Decimal(10, 2)
  stockQuantity         Int
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

Notes:
- `SupplierIntegration.supplierId` is `@unique` — this *is* the "one connection per supplier" constraint (design.md decision 1), not just an index; task 1.1 says "unique FK", the unique attribute enforces it at the DB level, which `findBySupplierId`/`upsert` in the repository rely on.
- `SpocketCatalogItem.supplierCost` and `.stockQuantity`: spec says "Decimal, >= 0" / "Int, >= 0" — the `>= 0` constraint is NOT expressible in Prisma schema; enforce it in `validator.ts` (section 7 below) before every write, exactly like `validateSupplierOrderCreateData` does for `supplierCost`.
- No `@@unique` needed on `(supplierId)` alone beyond the column-level `@unique` above — do not also add `@@unique([supplierId])`, it's redundant.

### 1b. `Supplier` back-relation

Edit the existing `model Supplier { ... }` block (~line 28) to add one relation field. Insert after the existing `supplierOrders SupplierOrder[]` line:

```prisma
  spocketIntegration SupplierIntegration?
```

This is the *only* change to the `Supplier` model. Do not touch `ProductVariant` (context session explicitly forbids it — `supplierId`/`supplierReference`/`supplierCost` on `ProductVariant` are out of scope for this change).

### 1c. Migration

Run (do NOT run this yourself — implementer runs it): `npx prisma migrate dev --name add_spocket_integration` from `backend/`, then `npx prisma generate`. Verify the generated client exposes `prisma.supplierIntegration` and `prisma.spocketCatalogItem`.

---

## 2. Domain layer — models

### 2.1 `backend/src/domain/models/supplierIntegration.ts` (new file)

Mirror `backend/src/domain/models/supplier.ts`'s shape exactly (plain class, constructor takes a data bag, defaults on optional fields), plus two transition helper methods named explicitly in tasks.md 2.1:

```typescript
export type SupplierIntegrationStatus = 'Disconnected' | 'Connected' | 'Error';

export class SupplierIntegration {
  id?: number;
  supplierId: number;
  provider: string;
  status: SupplierIntegrationStatus;
  externalAccountRef?: string | null;
  lastVerifiedAt?: Date | null;
  lastSyncedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    supplierId: number;
    provider?: string;
    status?: string;
    externalAccountRef?: string | null;
    lastVerifiedAt?: Date | null;
    lastSyncedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.supplierId = data.supplierId;
    this.provider = data.provider ?? 'Spocket';
    this.status = (data.status as SupplierIntegrationStatus) ?? 'Disconnected';
    this.externalAccountRef = data.externalAccountRef ?? null;
    this.lastVerifiedAt = data.lastVerifiedAt ?? null;
    this.lastSyncedAt = data.lastSyncedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Mutates in-memory state only — callers persist via the repository afterward
  // (mirrors how SupplierOrderService computes the next status before calling
  // repo.updateStatus, rather than the entity writing to the DB itself).
  markConnected(verifiedAt: Date = new Date()): void {
    this.status = 'Connected';
    this.lastVerifiedAt = verifiedAt;
  }

  markError(verifiedAt: Date = new Date()): void {
    this.status = 'Error';
    this.lastVerifiedAt = verifiedAt;
  }
}
```

Note: `markError` intentionally takes no `reason` parameter — the codebase's domain entities never store a free-text "why" on the entity (see `SupplierOrder`, which stores structured `trackingNumber`/`trackingUrl` fields, never a narrative reason). The verify endpoint's `reason` string is a *response-only* value computed in the service/controller layer from the caught error, not persisted on `SupplierIntegration`. The context session doc names `markError(reason)` — implementer should decide during implementation whether to accept an unused `reason` param for signature-compat with tasks.md 2.1, but nothing in the schema persists it, so the plan above (no persisted reason) is what to build; if strict fidelity to tasks.md's literal signature is preferred, add `reason?: string` as an accepted-but-unpersisted parameter purely for call-site documentation value.

### 2.2 `backend/src/domain/models/spocketCatalogItem.ts` (new file)

```typescript
export type SpocketSyncStatus = 'Synced' | 'Failed';

export class SpocketCatalogItem {
  id?: number;
  supplierIntegrationId: number;
  externalRef: string;
  title: string;
  size?: string | null;
  color?: string | null;
  supplierCost: string; // Decimal serialized as string, mirrors Refund.amount / SupplierOrderItem.supplierCost convention
  stockQuantity: number;
  rawPayload: unknown;
  syncStatus: SpocketSyncStatus;
  syncError?: string | null;
  lastSyncedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    supplierIntegrationId: number;
    externalRef: string;
    title: string;
    size?: string | null;
    color?: string | null;
    supplierCost: string | number;
    stockQuantity: number;
    rawPayload: unknown;
    syncStatus?: string;
    syncError?: string | null;
    lastSyncedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.supplierIntegrationId = data.supplierIntegrationId;
    this.externalRef = data.externalRef;
    this.title = data.title;
    this.size = data.size ?? null;
    this.color = data.color ?? null;
    this.supplierCost = data.supplierCost.toString();
    this.stockQuantity = data.stockQuantity;
    this.rawPayload = data.rawPayload;
    this.syncStatus = (data.syncStatus as SpocketSyncStatus) ?? 'Synced';
    this.syncError = data.syncError ?? null;
    this.lastSyncedAt = data.lastSyncedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
```

`supplierCost` as `string` (Decimal serialized) follows the existing `Refund`/`SupplierOrderItem` convention of using `Decimal.toString()` at the domain-model boundary — check `backend/src/domain/models/refund.ts` for the exact pattern used (`amount: string`) before implementing, to keep the two consistent.

## 3. Domain layer — repository interfaces

### 3.1 `backend/src/domain/repositories/supplierIntegrationRepository.ts` (new file)

```typescript
import { SupplierIntegration } from '../models/supplierIntegration';

export interface SupplierIntegrationUpsertData {
  externalAccountRef?: string | null;
}

export interface ISupplierIntegrationRepository {
  findBySupplierId(supplierId: number): Promise<SupplierIntegration | null>;
  upsert(supplierId: number, data: SupplierIntegrationUpsertData): Promise<{ integration: SupplierIntegration; created: boolean }>;
  updateStatus(
    id: number,
    data: { status: 'Connected' | 'Error'; lastVerifiedAt: Date }
  ): Promise<SupplierIntegration>;
  updateLastSyncedAt(id: number, lastSyncedAt: Date): Promise<SupplierIntegration>;
}
```

`upsert` returns `{ integration, created }` (not just the entity) because the controller/spec requires `201` on first create and `200` on update (spec.md scenarios "Create a new connection" vs "Update an existing connection") — the service needs to know which happened to pick the status code, exactly like `ProductService`/other create-or-update flows in this codebase signal creation via a boolean. `updateLastSyncedAt` is a separate method (not folded into `updateStatus`) because the sync flow updates `lastSyncedAt` independently of `status`/`lastVerifiedAt`.

### 3.2 `backend/src/domain/repositories/spocketCatalogItemRepository.ts` (new file)

```typescript
import { SpocketCatalogItem } from '../models/spocketCatalogItem';

export interface SpocketCatalogItemUpsertInput {
  externalRef: string;
  title: string;
  size?: string | null;
  color?: string | null;
  supplierCost: string;
  stockQuantity: number;
  rawPayload: unknown;
  syncStatus: 'Synced' | 'Failed';
  syncError?: string | null;
  lastSyncedAt: Date;
}

export interface SpocketCatalogItemListFilters {
  page?: number;
  pageSize?: number;
  syncStatus?: string;
}

export interface SpocketCatalogItemListResult {
  items: SpocketCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ISpocketCatalogItemRepository {
  upsertMany(
    supplierIntegrationId: number,
    items: SpocketCatalogItemUpsertInput[]
  ): Promise<{ upserted: number }>;
  findBySupplierIntegrationId(
    supplierIntegrationId: number,
    filters?: SpocketCatalogItemListFilters
  ): Promise<SpocketCatalogItemListResult>;
}
```

`upsertMany` takes the *whole batch already resolved* (per-item success/failure already decided by the application service — see section 5.2) so the repository stays a thin Prisma wrapper with no upstream-API knowledge, consistent with "services delegate to repositories, repositories never call external APIs" from `ai-specs/agents/backend-developer.md`.

---

## 4. Infrastructure — Spocket API client adapter

### 4.1 `backend/src/infrastructure/external/spocketTypes.ts` (new file)

```typescript
export interface SpocketVariantDto {
  externalRef: string;
  size?: string;
  color?: string;
  cost: number;
  stockQuantity: number;
}

export interface SpocketProductDto {
  externalRef: string;
  title: string;
  variants: SpocketVariantDto[];
}

export interface SpocketCatalogPage {
  products: SpocketProductDto[];
  nextPageToken?: string | null;
}

export interface SpocketVerifyResult {
  healthy: boolean;
  externalAccountRef?: string;
}

// Port consumed by application services — implemented by SpocketApiClient below.
// Kept separate from the concrete client so services can be unit-tested with a
// hand-written fake instead of mocking HTTP (mirrors ISupplierRepository /
// SupplierRepository split, applied here to an external HTTP dependency instead
// of Prisma).
export interface ISpocketClient {
  verifyConnection(): Promise<SpocketVerifyResult>;
  fetchCatalog(pageToken?: string): Promise<SpocketCatalogPage>;
}
```

Per design.md's own open questions (#2), the real Spocket response shape is unconfirmed — these DTOs are a reasonable placeholder shape (flat product/variant/cost/stock) that satisfies every scenario in `specs/spocket-catalog-sync/spec.md`. Isolating them here means only this file + `spocketClient.ts`'s mapping logic change if the real contract differs, not `spocketCatalogSyncService.ts` or the Prisma layer — flag this explicitly in the PR description per design.md's mitigation note.

### 4.2 `backend/src/infrastructure/external/spocketClient.ts` (new file)

```typescript
import { ISpocketClient, SpocketCatalogPage, SpocketVerifyResult } from './spocketTypes';

const SPOCKET_API_BASE_URL = process.env.SPOCKET_API_BASE_URL ?? 'https://api.spocket.co/placeholder';
const SPOCKET_API_KEY = process.env.SPOCKET_API_KEY ?? 'spocket_test_placeholder';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class SpocketApiError extends Error {
  readonly code = 'SPOCKET_API_ERROR' as const;
  readonly status: number;

  // message MUST be built only from statusCode + a fixed vocabulary string,
  // NEVER from raw response body text (design.md risk: "credential leakage
  // through logs or error messages" — upstream error bodies could echo request
  // headers back).
  constructor(statusCode: number, reason: string) {
    super(`Spocket API request failed (${statusCode}): ${reason}`);
    this.name = 'SpocketApiError';
    this.status = statusCode;
    Object.setPrototypeOf(this, SpocketApiError.prototype);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(path: string, init: RequestInit): Promise<Response> {
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${SPOCKET_API_BASE_URL}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${SPOCKET_API_KEY}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // Network error / timeout — treat as retryable up to MAX_RETRIES, then surface as 502.
      if (attempt === MAX_RETRIES) throw new SpocketApiError(502, 'upstream unreachable');
      await sleep(2 ** attempt * 200);
      continue;
    }

    if (response.ok) return response;
    lastStatus = response.status;

    if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_RETRIES) {
      if (response.status === 401 || response.status === 403) {
        throw new SpocketApiError(response.status, 'authentication rejected');
      }
      throw new SpocketApiError(response.status, 'request failed');
    }
    await sleep(2 ** attempt * 200);
  }
  throw new SpocketApiError(lastStatus || 502, 'request failed after retries');
}

export class SpocketApiClient implements ISpocketClient {
  async verifyConnection(): Promise<SpocketVerifyResult> {
    try {
      const res = await requestWithRetry('/v1/auth/verify', { method: 'GET' });
      const body = (await res.json()) as { accountRef?: string };
      return { healthy: true, externalAccountRef: body.accountRef };
    } catch (err) {
      if (err instanceof SpocketApiError) return { healthy: false };
      throw err;
    }
  }

  async fetchCatalog(pageToken?: string): Promise<SpocketCatalogPage> {
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    const res = await requestWithRetry(`/v1/catalog${query}`, { method: 'GET' });
    return (await res.json()) as SpocketCatalogPage;
  }
}

// Module-level singleton, mirrors stripeClient.ts: startup validation (index.ts,
// section 6.4 below) guarantees SPOCKET_API_KEY/SPOCKET_API_BASE_URL are set in
// non-test env. The placeholder fallback above allows Jest to import this module
// without real credentials; tests that exercise Spocket functionality must mock
// this module (see section 8.1).
export const spocketClient = new SpocketApiClient();
```

Key implementation notes:
- Uses native `fetch` + `AbortSignal.timeout` — **do not add `axios` as a dependency**; grep confirms no HTTP client library is in `package.json` today, and `escuelaJsProductImporter.ts` / `facebookOAuth.ts` / `mailpitClient.ts` already use native `fetch`. Adding axios would be an unjustified new dependency for this change.
- `verifyConnection()` swallows `SpocketApiError` and returns `{ healthy: false }` rather than throwing, because the connection-management spec's "Failed verification" scenario expects `200 { healthy: false, reason }`, not a thrown error that would 500. `fetchCatalog()` does NOT swallow — the catalog-sync spec's "Upstream API unavailability aborts the sync" scenario expects a thrown error that the service maps to `502 SPOCKET_API_UNAVAILABLE`.
- `Authorization` header format (`Bearer <key>`) is a placeholder consistent with design.md open question #1 (static-key vs OAuth is unconfirmed) — flag in the PR that this must be revisited once Spocket's real auth model is confirmed.

---

## 5. Infrastructure — repository Prisma implementations

### 5.1 `backend/src/infrastructure/repositories/supplierIntegrationRepository.ts` (new file)

Mirrors `backend/src/infrastructure/repositories/supplierRepository.ts` structure: one exported not-found error class + the repository class.

```typescript
import { prisma } from '../prismaClient';
import { SupplierIntegration } from '../../domain/models/supplierIntegration';
import {
  ISupplierIntegrationRepository,
  SupplierIntegrationUpsertData,
} from '../../domain/repositories/supplierIntegrationRepository';

export class SupplierIntegrationNotFoundError extends Error {
  readonly code = 'SPOCKET_CONNECTION_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Spocket connection not found');
    this.name = 'SupplierIntegrationNotFoundError';
    Object.setPrototypeOf(this, SupplierIntegrationNotFoundError.prototype);
  }
}

export class SupplierIntegrationRepository implements ISupplierIntegrationRepository {
  async findBySupplierId(supplierId: number): Promise<SupplierIntegration | null> {
    const row = await prisma.supplierIntegration.findUnique({ where: { supplierId } });
    return row ? new SupplierIntegration(row) : null;
  }

  async upsert(
    supplierId: number,
    data: SupplierIntegrationUpsertData
  ): Promise<{ integration: SupplierIntegration; created: boolean }> {
    const existing = await prisma.supplierIntegration.findUnique({ where: { supplierId } });

    if (existing) {
      const row = await prisma.supplierIntegration.update({
        where: { supplierId },
        data: { externalAccountRef: data.externalAccountRef ?? null },
      });
      return { integration: new SupplierIntegration(row), created: false };
    }

    const row = await prisma.supplierIntegration.create({
      data: {
        supplierId,
        provider: 'Spocket',
        status: 'Disconnected',
        externalAccountRef: data.externalAccountRef ?? null,
      },
    });
    return { integration: new SupplierIntegration(row), created: true };
  }

  async updateStatus(
    id: number,
    data: { status: 'Connected' | 'Error'; lastVerifiedAt: Date }
  ): Promise<SupplierIntegration> {
    const row = await prisma.supplierIntegration.update({
      where: { id },
      data: { status: data.status, lastVerifiedAt: data.lastVerifiedAt },
    });
    return new SupplierIntegration(row);
  }

  async updateLastSyncedAt(id: number, lastSyncedAt: Date): Promise<SupplierIntegration> {
    const row = await prisma.supplierIntegration.update({
      where: { id },
      data: { lastSyncedAt },
    });
    return new SupplierIntegration(row);
  }
}
```

Note: `upsert`/`updateStatus` deliberately do NOT catch `P2025` here the way `SupplierOrderRepository.updateStatus` does, because the *service* layer (section 6) always checks existence via `findBySupplierId`/`findById` first and throws `SupplierIntegrationNotFoundError` itself before calling these — so a `P2025` should never occur in normal operation. If a race is a concern, add a `try { } catch (Prisma P2025) { throw new SupplierIntegrationNotFoundError() }` guard identical to `SupplierOrderRepository.updateStatus`'s pattern.

### 5.2 `backend/src/infrastructure/repositories/spocketCatalogItemRepository.ts` (new file)

```typescript
import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { SpocketCatalogItem } from '../../domain/models/spocketCatalogItem';
import {
  ISpocketCatalogItemRepository,
  SpocketCatalogItemUpsertInput,
  SpocketCatalogItemListFilters,
  SpocketCatalogItemListResult,
} from '../../domain/repositories/spocketCatalogItemRepository';

export class SpocketCatalogItemRepository implements ISpocketCatalogItemRepository {
  async upsertMany(
    supplierIntegrationId: number,
    items: SpocketCatalogItemUpsertInput[]
  ): Promise<{ upserted: number }> {
    // Sequential upserts inside a single transaction: Prisma has no native
    // "upsertMany", and each row's unique key is (supplierIntegrationId, externalRef)
    // per design.md decision 4. Sequential (not Promise.all) avoids opening more
    // concurrent connections than the pool allows during a large catalog sync.
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.spocketCatalogItem.upsert({
          where: {
            supplierIntegrationId_externalRef: {
              supplierIntegrationId,
              externalRef: item.externalRef,
            },
          },
          update: {
            title: item.title,
            size: item.size ?? null,
            color: item.color ?? null,
            supplierCost: item.supplierCost,
            stockQuantity: item.stockQuantity,
            rawPayload: item.rawPayload as Prisma.InputJsonValue,
            syncStatus: item.syncStatus,
            syncError: item.syncError ?? null,
            lastSyncedAt: item.lastSyncedAt,
          },
          create: {
            supplierIntegrationId,
            externalRef: item.externalRef,
            title: item.title,
            size: item.size ?? null,
            color: item.color ?? null,
            supplierCost: item.supplierCost,
            stockQuantity: item.stockQuantity,
            rawPayload: item.rawPayload as Prisma.InputJsonValue,
            syncStatus: item.syncStatus,
            syncError: item.syncError ?? null,
            lastSyncedAt: item.lastSyncedAt,
          },
        });
      }
    });
    return { upserted: items.length };
  }

  async findBySupplierIntegrationId(
    supplierIntegrationId: number,
    filters: SpocketCatalogItemListFilters = {}
  ): Promise<SpocketCatalogItemListResult> {
    const page = filters.page && filters.page >= 1 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize >= 1 ? filters.pageSize : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SpocketCatalogItemWhereInput = { supplierIntegrationId };
    if (filters.syncStatus) where.syncStatus = filters.syncStatus;

    const [rows, total] = await prisma.$transaction([
      prisma.spocketCatalogItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.spocketCatalogItem.count({ where }),
    ]);

    return {
      items: rows.map((r) => new SpocketCatalogItem({ ...r, supplierCost: r.supplierCost.toString() })),
      total,
      page,
      pageSize,
    };
  }
}
```

The Prisma-generated compound-unique field name `supplierIntegrationId_externalRef` follows Prisma's auto-naming convention for `@@unique([supplierIntegrationId, externalRef])` — verify the exact generated name after running `prisma generate` (it is always `field1_field2` in declaration order, but confirm against the generated client types before compiling).

---

## 6. Application layer — services

### 6.1 `backend/src/application/services/spocketConnectionService.ts` (new file)

```typescript
import {
  ISupplierIntegrationRepository,
} from '../../domain/repositories/supplierIntegrationRepository';
import { ISpocketClient } from '../../infrastructure/external/spocketTypes';
import { SupplierIntegration } from '../../domain/models/supplierIntegration';
import { validateSpocketConnectionData } from '../validator';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { SupplierNotFoundError } from '../../infrastructure/repositories/supplierRepository';
import { prisma } from '../../infrastructure/prismaClient';
import { logger } from '../../infrastructure/logger';

export class SpocketConnectionService {
  constructor(
    private readonly repo: ISupplierIntegrationRepository,
    private readonly spocketClient: ISpocketClient
  ) {}

  async configureConnection(
    supplierId: number,
    data: Record<string, unknown>
  ): Promise<{ integration: SupplierIntegration; created: boolean }> {
    validateSpocketConnectionData(data);

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new SupplierNotFoundError();

    return this.repo.upsert(supplierId, {
      externalAccountRef: (data['externalAccountRef'] as string | null | undefined) ?? null,
    });
  }

  async getConnection(supplierId: number): Promise<SupplierIntegration> {
    const integration = await this.repo.findBySupplierId(supplierId);
    if (!integration) throw new SupplierIntegrationNotFoundError();
    return integration;
  }

  async verifyConnection(supplierId: number): Promise<{ healthy: boolean; reason?: string }> {
    const integration = await this.repo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    const result = await this.spocketClient.verifyConnection();
    const now = new Date();

    if (result.healthy) {
      await this.repo.updateStatus(integration.id, { status: 'Connected', lastVerifiedAt: now });
      return { healthy: true };
    }

    await this.repo.updateStatus(integration.id, { status: 'Error', lastVerifiedAt: now });
    // Fixed, non-sensitive vocabulary only — never forward raw client/upstream text.
    logger.warn('Spocket connection verification failed', { supplierId });
    return { healthy: false, reason: 'Spocket rejected the configured credentials or is unreachable' };
  }
}

export const spocketConnectionService = new SpocketConnectionService(
  new (require('../../infrastructure/repositories/supplierIntegrationRepository').SupplierIntegrationRepository)(),
  require('../../infrastructure/external/spocketClient').spocketClient
);
```

Do NOT actually use `require(...)` inline like the placeholder above — that's illustrative only; write normal ES `import` statements at the top of the file for `SupplierIntegrationRepository` and `spocketClient`, then construct the singleton at the bottom exactly like `paymentService.ts` does:

```typescript
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { spocketClient } from '../../infrastructure/external/spocketClient';
// ...
export const spocketConnectionService = new SpocketConnectionService(
  new SupplierIntegrationRepository(),
  spocketClient
);
```

Design.md decision 3 requires the service to depend on `ISpocketClient` (constructor-injected), not import `spocketClient` directly inside methods — this satisfies that: the concrete `spocketClient` singleton is wired only at the module's bottom composition point, exactly like `paymentService` wires `CustomerOrderRepository`/`StripeWebhookEventRepository` while importing the Stripe SDK singleton separately for direct use. (Small nuance: `paymentService.ts` itself imports `stripe` directly rather than via a port — the Spocket case intentionally diverges from that specific precedent per design.md decision 3, in favor of the injectable-port pattern used for `ISupplierRepository`. State this explicitly in the PR description as a deliberate deviation from the closest precedent, justified by testability.)

`reason` message is a single fixed string — do not build it from `err.message` or any Spocket response text (spec.md: "reason... never includes the API key or raw upstream credentials").

### 6.2 `backend/src/application/services/spocketCatalogSyncService.ts` (new file)

```typescript
import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import {
  ISpocketCatalogItemRepository,
  SpocketCatalogItemUpsertInput,
} from '../../domain/repositories/spocketCatalogItemRepository';
import { ISpocketClient } from '../../infrastructure/external/spocketTypes';
import { SpocketApiError } from '../../infrastructure/external/spocketClient';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import {
  SpocketConnectionNotReadyError,
  SpocketApiUnavailableError,
} from '../validator';
import { SpocketCatalogItem } from '../../domain/models/spocketCatalogItem';
import { logger } from '../../infrastructure/logger';

const MAX_PAGE_SIZE = 100;

export interface SyncCatalogResult {
  itemsUpserted: number;
  itemsFailed: number;
  syncedAt: Date;
}

export class SpocketCatalogSyncService {
  constructor(
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly catalogRepo: ISpocketCatalogItemRepository,
    private readonly spocketClient: ISpocketClient
  ) {}

  async syncCatalog(supplierId: number): Promise<SyncCatalogResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();
    if (integration.status !== 'Connected') throw new SpocketConnectionNotReadyError();

    const validItems: SpocketCatalogItemUpsertInput[] = [];
    let itemsFailed = 0;
    const now = new Date();

    let pageToken: string | undefined;
    do {
      let page;
      try {
        page = await this.spocketClient.fetchCatalog(pageToken);
      } catch (err) {
        // Total upstream outage: abort the whole sync, leave existing staged
        // records untouched (spec.md "Upstream API unavailability aborts the sync").
        logger.error('Spocket catalog fetch failed', {
          supplierId,
          status: err instanceof SpocketApiError ? err.status : undefined,
        });
        throw new SpocketApiUnavailableError();
      }

      for (const product of page.products) {
        for (const variant of product.variants) {
          try {
            if (!variant.externalRef || !Number.isFinite(variant.cost) || variant.cost < 0) {
              throw new Error('Malformed Spocket variant payload');
            }
            if (!Number.isInteger(variant.stockQuantity) || variant.stockQuantity < 0) {
              throw new Error('Malformed Spocket stock quantity');
            }
            validItems.push({
              externalRef: variant.externalRef,
              title: product.title,
              size: variant.size ?? null,
              color: variant.color ?? null,
              supplierCost: variant.cost.toFixed(2),
              stockQuantity: variant.stockQuantity,
              rawPayload: { product, variant },
              syncStatus: 'Synced',
              lastSyncedAt: now,
            });
          } catch (mapErr) {
            itemsFailed += 1;
            validItems.push({
              externalRef: variant.externalRef ?? `unknown-${product.externalRef}`,
              title: product.title ?? 'Unknown',
              supplierCost: '0.00',
              stockQuantity: 0,
              rawPayload: { product, variant },
              syncStatus: 'Failed',
              syncError: mapErr instanceof Error ? mapErr.message : 'Mapping failed',
              lastSyncedAt: now,
            });
          }
        }
      }
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);

    const { upserted } = await this.catalogRepo.upsertMany(integration.id, validItems);
    await this.integrationRepo.updateLastSyncedAt(integration.id, now);

    return { itemsUpserted: upserted - itemsFailed, itemsFailed, syncedAt: now };
  }

  async listStagedCatalog(
    supplierId: number,
    params: { page?: number; pageSize?: number; syncStatus?: string }
  ) {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    const pageSize = params.pageSize !== undefined ? Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE) : 20;
    return this.catalogRepo.findBySupplierIntegrationId(integration.id, { ...params, pageSize });
  }
}
```

Important implementation notes:
- **Per-item failure handling** (spec.md "One malformed item does not block the rest of the sync"): malformed items are still upserted, just with `syncStatus = 'Failed'` and a placeholder cost/stock — this matches "the system SHALL record it with syncStatus = Failed... continue processing remaining items". Do not skip writing the row entirely; the admin needs to see *which* item failed in the staged-catalog listing (spec.md "Admin can list staged Spocket catalog items for review").
- **Total outage vs partial failure**: `fetchCatalog()` throwing (network/5xx after retries) aborts the entire sync with `502`; a successfully-fetched page containing one malformed variant does NOT abort — only that item is marked `Failed`. This distinction is the crux of section 6 spec requirements; do not conflate them.
- `itemsUpserted` in the response counts only *successful* upserts (`upserted - itemsFailed`), matching the scenario "persists 9 records with Synced... itemsFailed: 1" — i.e. `itemsUpserted` + `itemsFailed` should equal total items processed.
- `SpocketApiError` is imported as a *type-check* only (`err instanceof SpocketApiError`) for logging purposes — the service never lets a raw `SpocketApiError` escape to the controller; it always re-throws as `SpocketApiUnavailableError` (an application/validator-layer error class, section 7).

### 6.3 Composition root

At the bottom of `spocketCatalogSyncService.ts`:
```typescript
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { SpocketCatalogItemRepository } from '../../infrastructure/repositories/spocketCatalogItemRepository';
import { spocketClient } from '../../infrastructure/external/spocketClient';

export const spocketCatalogSyncService = new SpocketCatalogSyncService(
  new SupplierIntegrationRepository(),
  new SpocketCatalogItemRepository(),
  spocketClient
);
```

---

## 7. Application layer — validator additions (`backend/src/application/validator.ts`)

Append near the bottom, in the same style as the existing "Stripe / Payment error classes" section (~line 957 onward):

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Spocket integration validators + error classes
// ─────────────────────────────────────────────────────────────────────────────

export function validateSpocketConnectionData(data: Record<string, unknown>): void {
  const externalAccountRef = data['externalAccountRef'];
  if (externalAccountRef !== undefined && externalAccountRef !== null && externalAccountRef !== '') {
    if (typeof externalAccountRef !== 'string') {
      throw new ValidationError("Field 'externalAccountRef' must be a string");
    }
    if (externalAccountRef.length > 150) {
      throw new ValidationError("Field 'externalAccountRef' must not exceed 150 characters");
    }
  }
  // NOTE: no field named apiKey/secret/credential is ever accepted here — the
  // request body is only allowed externalAccountRef, per spec.md "the actual
  // Spocket API key... SHALL NOT be accepted as a request field."
}

export class SpocketConnectionNotReadyError extends Error {
  readonly code = 'SPOCKET_CONNECTION_NOT_READY' as const;
  readonly status = 422;

  constructor(message = 'Spocket connection must be Connected before syncing') {
    super(message);
    this.name = 'SpocketConnectionNotReadyError';
    Object.setPrototypeOf(this, SpocketConnectionNotReadyError.prototype);
  }
}

export class SpocketApiUnavailableError extends Error {
  readonly code = 'SPOCKET_API_UNAVAILABLE' as const;
  readonly status = 502;

  constructor(message = 'Spocket API is currently unavailable') {
    super(message);
    this.name = 'SpocketApiUnavailableError';
    Object.setPrototypeOf(this, SpocketApiUnavailableError.prototype);
  }
}
```

Add a `syncStatus`/pagination query-param validator too, following `SupplierListFilters`'s pattern — this can live in the controller (see 8.2) rather than validator.ts if it's purely query-string parsing, matching how `listSuppliers` parses `page`/`pageSize` inline in the controller rather than through `validator.ts`. Keep `syncStatus` allow-list (`'Synced' | 'Failed'`) validation as a small inline check in `spocketCatalogSyncController.listCatalog`, mirroring `listSuppliers`'s inline `parseInt` calls rather than adding a new validator function for a single query param.

`SupplierIntegrationNotFoundError` (404) is defined in `infrastructure/repositories/supplierIntegrationRepository.ts` (section 5.1), not in `validator.ts` — this matches the existing split where "not found" errors live next to their repository (`SupplierNotFoundError`, `SupplierOrderNotFoundError`, `RefundNotFoundError` are all in `infrastructure/repositories/*`) while business-rule/state errors live in `validator.ts` (`OrderNotPayableError`, `SupplierBlockedError` is actually in the repo file too — check placement case-by-case, but `SPOCKET_CONNECTION_NOT_READY`/`SPOCKET_API_UNAVAILABLE` are sync-service business-rule errors so `validator.ts` is the right home, consistent with `RefundStripeError`/`PaymentGatewayUnavailableError` living there).

---

## 8. Presentation layer — controllers and routes

### 8.1 `backend/src/presentation/controllers/spocketConnectionController.ts` (new file)

```typescript
import { Request, Response, NextFunction } from 'express';
import { spocketConnectionService } from '../../application/services/spocketConnectionService';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

function parseSupplierIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'supplierId' must be a valid integer");
  return id;
}

export async function configure(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const { integration, created } = await spocketConnectionService.configureConnection(supplierId, req.body);
    logger.info('Spocket connection configured', { supplierId, created });
    res.status(created ? 201 : 200).json({
      success: true,
      data: integration,
      message: created ? 'Spocket connection created successfully' : 'Spocket connection updated successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const integration = await spocketConnectionService.getConnection(supplierId);
    res.json({ success: true, data: integration, message: 'Spocket connection retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function verify(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const result = await spocketConnectionService.verifyConnection(supplierId);
    res.json({ success: true, data: result, message: 'Spocket connection verification completed' });
  } catch (err) {
    next(err);
  }
}
```

`integration` returned by the service is a `SupplierIntegration` domain instance — it has no field that could ever hold a credential (no `apiKey` property exists on the class at all, see 2.1), so no explicit strip/allow-list step is needed here, unlike `variantSelect` for `ProductVariant`. This is safer than an allow-list: the field simply does not exist on the entity.

### 8.2 `backend/src/presentation/controllers/spocketCatalogSyncController.ts` (new file)

```typescript
import { Request, Response, NextFunction } from 'express';
import { spocketCatalogSyncService } from '../../application/services/spocketCatalogSyncService';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

function parseSupplierIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'supplierId' must be a valid integer");
  return id;
}

export async function sync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const result = await spocketCatalogSyncService.syncCatalog(supplierId);
    logger.info('Spocket catalog sync completed', { supplierId, ...result });
    res.json({ success: true, data: result, message: 'Spocket catalog sync completed' });
  } catch (err) {
    next(err);
  }
}

export async function listCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const { page, pageSize, syncStatus } = req.query;

    if (syncStatus !== undefined && syncStatus !== 'Synced' && syncStatus !== 'Failed') {
      throw new ValidationError("Query param 'syncStatus' must be one of: Synced, Failed");
    }

    const result = await spocketCatalogSyncService.listStagedCatalog(supplierId, {
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
      syncStatus: syncStatus as string | undefined,
    });
    res.json({ success: true, data: result, message: 'Staged Spocket catalog retrieved successfully' });
  } catch (err) {
    next(err);
  }
}
```

### 8.3 `backend/src/routes/admin/spocketRoutes.ts` (new file)

```typescript
import { Router } from 'express';
import { configure, get, verify } from '../../presentation/controllers/spocketConnectionController';
import { sync, listCatalog } from '../../presentation/controllers/spocketCatalogSyncController';

const spocketRouter = Router({ mergeParams: true });

spocketRouter.post('/connection', configure);
spocketRouter.get('/connection', get);
spocketRouter.post('/connection/verify', verify);
spocketRouter.post('/sync', sync);
spocketRouter.get('/catalog', listCatalog);

export default spocketRouter;
```

`Router({ mergeParams: true })` is required so `req.params.supplierId` from the parent mount path is visible inside this router's handlers — this is the exact pattern `productRoutes.ts` uses for `/:id/variants`, `/:id/images`, `/:id/translations`.

### 8.4 Wiring into `supplierRoutes.ts` and `index.ts`

Two options; **prefer Option A** since it keeps the whole `/suppliers/:supplierId/spocket/*` tree self-contained in one place close to the existing supplier admin router, matching `productRoutes.ts`'s pattern of nesting sub-routers directly onto the parent router rather than back in `index.ts`.

**Option A** — edit `backend/src/routes/admin/supplierRoutes.ts`:
```typescript
import spocketRouter from './spocketRoutes';
// ...after the existing supplierRouter.delete('/:id', deleteSupplier); line:
supplierRouter.use('/:id/spocket', spocketRouter);
```
This yields `/api/admin/suppliers/:id/spocket/...` — note the path param name becomes `:id` here (matching `supplierRouter`'s existing param name), so inside `spocketConnectionController`/`spocketCatalogSyncController`, read `req.params['id']` NOT `req.params['supplierId']`, OR rename the mount to preserve `supplierId` semantics: `supplierRouter.use('/:supplierId/spocket', spocketRouter)` — Express allows a differently-named param on a sub-path even though the parent router's own routes use `:id`, since Express param names are scoped to the specific route pattern that declared them. **Use `:supplierId` explicitly in the mount line** (not `:id`) so the controller code above (which reads `req.params['supplierId']`) works without modification and the code reads unambiguously wherever `supplierId` is referenced. Double-check by testing `GET /api/admin/suppliers/1/spocket/connection` resolves `req.params.supplierId === '1'`.

Do NOT use Option B (registering `spocketRouter` directly in `index.ts` at a hand-built path like `adminRouter.use('/suppliers/:supplierId/spocket', spocketAdminRoutes)`) unless Option A's shared-router-param-naming turns out to conflict in practice — Option A is simpler and requires no `index.ts` changes at all beyond what's already needed.

No `index.ts` change is required if Option A is used, since `supplierAdminRoutes` (already imported and mounted at `/suppliers` in `index.ts` line 107) now internally serves the nested Spocket routes too.

### 8.5 Error handler wiring — `backend/src/middleware/errorHandler.ts`

Add imports and branches for the four new error classes, following the exact existing pattern (grouped near the Supplier-related imports/branches):

```typescript
import { SupplierIntegrationNotFoundError } from '../infrastructure/repositories/supplierIntegrationRepository';
import {
  SpocketConnectionNotReadyError,
  SpocketApiUnavailableError,
} from '../application/validator';
```

And in `globalErrorHandler`, add branches (near the `SupplierNotFoundError` branch):
```typescript
  } else if (err instanceof SupplierIntegrationNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof SpocketConnectionNotReadyError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof SpocketApiUnavailableError) {
    statusCode = 502; code = err.code; message = err.message;
```

Note `ValidationError` (400) is already handled generically at the top of the chain — no new branch needed for the `externalAccountRef`/`syncStatus`/`supplierId` validation errors raised via `ValidationError`.

---

## 9. Environment configuration

### 9.1 `backend/.env.example`

Add a new section, mirroring the "Stripe payments" block:
```
# ── Spocket integration ────────────────────────────────────────────────────────
SPOCKET_API_KEY=spocket_test_replace_with_your_spocket_api_key
SPOCKET_API_BASE_URL=https://api.spocket.co
```
And add the SSM provisioning comment near the bottom "Production SSM parameters" block:
```
# aws ssm put-parameter --name /ecommerce/prod/SPOCKET_API_KEY --value "..." --type SecureString --overwrite
# aws ssm put-parameter --name /ecommerce/prod/SPOCKET_API_BASE_URL --value "https://api.spocket.co" --type String --overwrite
```

### 9.2 `backend/src/index.ts`

Per design.md's migration plan point 3 ("absence of these vars must not crash the app... mirrors the sk_test_placeholder fallback pattern"), do **NOT** add `SPOCKET_API_KEY`/`SPOCKET_API_BASE_URL` to the `stripeRequiredVars`-style hard-fail block at the top of `index.ts`. The `spocketClient.ts` placeholder fallback (section 4.2) already handles missing-env-var safety at import time, consistent with Stripe's own `sk_test_placeholder` — but note Stripe's vars ARE hard-required outside test env (lines 57-65 of `index.ts`) while Spocket's explicitly are not, per the design doc. Leave `index.ts`'s env-var-requirement blocks untouched.

---

## 10. Test file plan

All new test files use Jest + `jest.mock(...)`, following the exact conventions seen in `supplierService.test.ts` / `supplierController.test.ts` / `supplierIsolation.test.ts`. Coverage target: 90% for every new file (CI `backend-quality` gate).

### 10.1 `backend/src/infrastructure/external/__tests__/spocketClient.test.ts`
- Mock global `fetch` (`jest.spyOn(global, 'fetch')` or reassign `global.fetch = jest.fn()`).
- `verifyConnection()`: successful 200 response → `{ healthy: true }`; 401 response → `{ healthy: false }` (no throw); confirm the constructed request includes an `Authorization` header (assert on the call args, not on the actual key value, to avoid hardcoding a secret-shaped string in the test).
- `fetchCatalog()`: successful response → parsed `SpocketCatalogPage`; a persistent 500 across all retries → throws `SpocketApiError` with `status` in the 5xx/502 range; a 429 that recovers on retry N → succeeds without exhausting all retries (assert `fetch` called more than once, less than `MAX_RETRIES + 1` times).
- Timeout: mock a rejected promise on `fetch` (simulating `AbortSignal.timeout` firing) → confirms retry-then-throw behavior, never hangs the test (use `jest.useFakeTimers()` if `sleep()`'s `setTimeout` would otherwise slow the suite — advance timers manually).
- Error normalization: assert `SpocketApiError.message` never contains the literal string `SPOCKET_API_KEY`'s value or the word "Bearer" — construct the mocked response body with a fake sensitive string and assert it does NOT appear in the thrown error's `.message`.

### 10.2 `backend/src/infrastructure/repositories/__tests__/supplierIntegrationRepository.test.ts` and `__tests__/spocketCatalogItemRepository.test.ts`
- Mock `../prismaClient`'s `prisma` object (`jest.mock('../../prismaClient', () => ({ prisma: { supplierIntegration: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }, spocketCatalogItem: { upsert: jest.fn(), findMany: jest.fn(), count: jest.fn() }, $transaction: jest.fn(...) } }))`) — mirror however `supplierRepository.test.ts` (if it exists) or `supplierOrderRepository`'s Prisma-mocking pattern is done; if no direct precedent test file exists for `SupplierRepository`, follow the `$transaction` mock pattern visible in `supplierOrderRepository.ts`'s usage (mock `$transaction` to just invoke the callback/array immediately).
- `upsert`: create-branch when `findUnique` resolves `null` → confirms `created: true`; update-branch when a row exists → `created: false`, `externalAccountRef` passed through.
- `upsertMany`: confirms one `tx.spocketCatalogItem.upsert` call per item with the correct compound `where` key; returns `{ upserted: items.length }`.
- `findBySupplierIntegrationId`: pagination defaults (page=1, pageSize=20), `syncStatus` filter applied to `where`.

### 10.3 `backend/src/application/services/__tests__/spocketConnectionService.test.ts`
Mock `ISupplierIntegrationRepository` and `ISpocketClient` as hand-written `jest.Mocked<...>` objects (exactly like `mockRepo: jest.Mocked<ISupplierRepository>` in `supplierService.test.ts`), inject both into `new SpocketConnectionService(mockRepo, mockSpocketClient)`.
- `configureConnection`: creates when no existing connection (assert `created: true`, `repo.upsert` called); updates when one exists; throws `SupplierNotFoundError` when the referenced supplier doesn't exist — mock `prisma.supplier.findUnique` (this method reaches into `prisma` directly for the supplier-existence check, same pattern as `supplierOrderService.create` reaching into `prisma.customerOrder.findUnique` directly — so this test needs `jest.mock('../../../infrastructure/prismaClient', ...)` too, mirroring `supplierOrderService.test.ts`'s setup).
- `getConnection`: returns entity when found; throws `SupplierIntegrationNotFoundError` when not found.
- `verifyConnection`: successful client response → `repo.updateStatus` called with `{ status: 'Connected', ... }`, returns `{ healthy: true }`; failed client response → `repo.updateStatus` called with `{ status: 'Error', ... }`, returns `{ healthy: false, reason: <fixed string> }` — assert the `reason` string does NOT equal or contain any raw client error message (regression test for the "no secret material" requirement); missing connection → throws `SupplierIntegrationNotFoundError` and `spocketClient.verifyConnection` is NOT called (assert `mockSpocketClient.verifyConnection` not called, mirroring `expect(mockRepo.create).not.toHaveBeenCalled()` idioms elsewhere).

### 10.4 `backend/src/application/services/__tests__/spocketCatalogSyncService.test.ts`
Mock `ISupplierIntegrationRepository`, `ISpocketCatalogItemRepository`, `ISpocketClient`.
- Successful sync: `integrationRepo.findBySupplierId` resolves a `Connected` integration; `spocketClient.fetchCatalog` resolves one page with N well-formed variants → `catalogRepo.upsertMany` called with N items all `syncStatus: 'Synced'`; response `{ itemsUpserted: N, itemsFailed: 0, syncedAt }`; `integrationRepo.updateLastSyncedAt` called.
- Idempotent re-sync: call `syncCatalog` twice with the same mocked fetch response — assert `catalogRepo.upsertMany` is called both times with equivalent input (the *repository*, not the service, is what guarantees no duplicate rows via the DB unique constraint — this service-level test only needs to confirm the service doesn't change behavior on a second call; the true idempotency assertion belongs in the repository test's `upsert`-not-`create` behavior, section 10.2).
- Partial item failure: one variant in the fetched page missing `externalRef` or with a negative `cost` → that item lands in `upsertMany`'s input with `syncStatus: 'Failed'`, `itemsFailed: 1` in the response, and the well-formed items still counted in `itemsUpserted`.
- Connection not ready: integration status `Disconnected`/`Error` → throws `SpocketConnectionNotReadyError`; assert `spocketClient.fetchCatalog` NOT called (no upstream calls per spec.md).
- Total upstream outage: `spocketClient.fetchCatalog` rejects → throws `SpocketApiUnavailableError`; assert `catalogRepo.upsertMany` NOT called (existing staged records must be left unchanged).
- Missing connection: `integrationRepo.findBySupplierId` resolves `null` → throws `SupplierIntegrationNotFoundError`.
- `listStagedCatalog`: pagination pass-through and clamp to 100; `syncStatus` filter forwarded to `catalogRepo.findBySupplierIntegrationId`.

### 10.5 `backend/src/presentation/controllers/__tests__/spocketConnectionController.test.ts` and `__tests__/spocketCatalogSyncController.test.ts`
Mirror `supplierController.test.ts` exactly: `jest.mock('../../../application/services/spocketConnectionService', () => ({ spocketConnectionService: { configureConnection: mockFn, getConnection: mockFn, verifyConnection: mockFn } }))` (note: mock the *exported singleton instance* `spocketConnectionService`, not a class constructor, since this plan's controllers import the singleton directly rather than instantiating `new SpocketConnectionService(...)` themselves — confirm this matches whichever composition style is chosen in section 6.3/8.1; if instead the controller constructs its own instance the way `supplierController.ts` does with `new SupplierService(new SupplierRepository())`, mock the class constructor the way `supplierController.test.ts` does).
- `configure`: 201 on create, 200 on update, response body has no field resembling `apiKey`/`credential`/`secret` (regex assertion mirroring `SUPPLIER_KEYS` regex in `supplierIsolation.test.ts`); non-numeric `supplierId` → `next(ValidationError)`.
- `get`: 200 with connection fields; service throwing `SupplierIntegrationNotFoundError`-shaped error → `next(err)` (404 mapping is `errorHandler`'s job, tested indirectly via the shape of the passed error, same idiom as `supplierController.test.ts`'s `Object.assign(new Error(...), { code, status })`).
- `verify`: 200 with `{ healthy: true }` or `{ healthy: false, reason }`; assert response body JSON stringified does not match a credential-shaped regex.
- `sync`: 200 with `{ itemsUpserted, itemsFailed, syncedAt }`; service throwing `SpocketConnectionNotReadyError`/`SpocketApiUnavailableError`-shaped errors → `next(err)`.
- `listCatalog`: 200 with paginated envelope; invalid `syncStatus` query value → `next(ValidationError)` without calling the service.

### 10.6 `backend/src/routes/public/__tests__/spocketIsolation.test.ts`
Mirror `supplierIsolation.test.ts` structure exactly (build a minimal Express app with only the public routers + error handlers mounted, no admin router):
- `GET /api/public/suppliers/1/spocket/connection` (and `/sync`, `/catalog`) → `404` (route does not exist under `/api/public/*`).
- Generic assertion: iterate a small list of candidate public paths containing `spocket` and assert none resolve to anything but the `notFoundHandler`'s `404 NOT_FOUND`.
- No need to duplicate the `serializePublicProduct` supplier-key regression test here — that test already exists and is unrelated to Spocket; this file is purely about route non-existence, per tasks.md 7.6.

### 10.7 Existing test review (tasks.md section 8)
- Read `supplierService.test.ts` and `supplierController.test.ts` fully (already done for this plan) — confirm neither constructs a full `prisma.supplier` row literal that would fail if Prisma's generated `Supplier` type gains a `spocketIntegration` relation field; since these tests use hand-built `Supplier` domain-model instances (not raw Prisma rows) via `makeSupplier(...)`, and the domain `Supplier` class isn't required to declare a `spocketIntegration` field, **no changes to these test files should be necessary**. Explicitly verify this by running the existing Supplier test suites after the schema migration (section 12.2) rather than assuming.

---

## 11. Documentation updates (tasks.md section 12 — do at implementation time, not part of this plan's code)

- `docs/data-model.md`: add `SupplierIntegration` and `SpocketCatalogItem` sections in the same format as the existing `Supplier`/`SupplierOrder` entries (field table + relationships), with an explicit "internal-only, never exposed via `/api/public/*`" callout matching the existing supplier-cost callouts.
- `docs/api-spec.yml`: add the 5 endpoints under a new `/api/admin/suppliers/{supplierId}/spocket/...` path group, reusing `#/components/responses/BadRequest`, `NotFound`, `UnprocessableEntity` (already defined at lines ~2455-2490) rather than redefining new response schemas. Add a `SupplierIntegration` and `SpocketCatalogItem` schema under `components/schemas`, following the existing `SupplierListResult`-style pagination schema at ~line 3291 for the `GET /catalog` response shape.
- `docs/development_guide.md`: document `SPOCKET_API_KEY`/`SPOCKET_API_BASE_URL` local setup.
- `docs/backend-standards.md`: optionally document the `ISpocketClient` port pattern if judged reusable for future integrations, alongside the existing Stripe client section.

---

## 12. Verification commands (for the implementer, per ai-specs/agents/backend-developer.md ESLint/CI note)

```
cd backend
npx prisma migrate dev --name add_spocket_integration
npx prisma generate
npm run lint
npm test -- --watchAll=false --testPathPattern=spocket
npm test -- --watchAll=false
```

ESLint reminders for the new test files: prefix intentionally-unused destructured/mock params with `_`, never use `any` (use `unknown` + narrowing, or `Record<string, unknown>` as done throughout `validator.ts`), mirror the existing `jest.mock('../../module', () => ({ ExportedThing: jest.fn().mockImplementation(...) }))` shape exactly rather than inventing a new mocking style.

Then proceed to tasks.md sections 9-13 (unit test + DB baseline verification, curl endpoint testing, documentation, commit/PR) exactly as written there — this plan only covers the code, not the mandatory verification/report/PR steps, which the parent agent executes after implementation.
