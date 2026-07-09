# Implementation Plan: cj-catalog-auto-provisioning (Backend, tasks.md groups 1-5)

Scope: config env vars, provider registry abstraction, auto-provision orchestrator
service + its unit tests, scheduled Lambda job handler + its unit test,
`serverless.yml` wiring. This plan does not implement anything — it is a
file-by-file blueprint for whoever runs group 1-5 of
`openspec/changes/cj-catalog-auto-provisioning/tasks.md`.

All business logic is reused as-is from `SupplierService`, `CjConnectionService`,
`CjCatalogSyncService`, `CjCatalogPromotionService`, and `cjClient`. Nothing in
this plan re-implements CJ API calls, catalog mapping, or promotion/pricing
logic.

---

## 0. Real gaps found in the existing code (read this before implementing)

These are concrete mismatches between what design.md/tasks.md assume and what
the current code actually exposes. The plan below is written to work around
each of them; flagging them up front so the parent agent doesn't rediscover
them mid-implementation.

1. **No repository method for "find SupplierIntegration by provider".**
   `ISupplierIntegrationRepository` (`backend/src/domain/repositories/supplierIntegrationRepository.ts`)
   only exposes `findBySupplierId`. Design decision D3 explicitly calls for
   `SupplierIntegration.findFirst({ where: { provider } })`, which doesn't
   exist on the interface and would require a schema-driven interface change
   to add "properly". Resolution: `supplierAutoProvisionService.ts` imports
   `prisma` directly from `backend/src/infrastructure/prismaClient.ts` and
   calls `prisma.supplierIntegration.findFirst({ where: { provider: descriptor.key } })`
   for this one lookup. This is **not** a new pattern in this codebase —
   `CjConnectionService.configureConnection` already reaches directly into
   `prisma.supplier.findUnique(...)` for a one-off existence check that isn't
   covered by `ISupplierIntegrationRepository` either (see
   `backend/src/application/services/cjConnectionService.ts` lines 22-23). Do
   not add a new repository method or a new `Supplier.providerKey` column —
   D3 explicitly rejected that.

2. **`listStagedCatalog` is paginated (default pageSize 20, hard max 100) but
   design.md describes selecting promotable items as a single call.**
   `CjCatalogSyncService.listStagedCatalog` (`backend/src/application/services/cjCatalogSyncService.ts`)
   clamps `pageSize` to `MAX_PAGE_SIZE = 100` and returns one page. A catalog
   with more than 100 `NotPromoted`/`Synced` items would silently promote only
   the first page on a naive single call. Resolution: the CJ descriptor's
   `runPipeline` must page through `listStagedCatalog` itself (page = 1, 2, 3,
   ... with `pageSize: 100`, stopping when a page returns fewer than 100
   items), collecting all `cjCatalogItemId`s before calling `promote` once.
   Mirror `CjCatalogSyncService.syncCatalog`'s own `MAX_SYNC_PAGES` safety-cap
   style so a corrupted `total`/pagination response can't loop forever (see
   §3 "Pagination loop" below for the exact constant/loop).

3. **`CjCatalogPromotionService.promote` can throw `CjPromotionValidationError`
   for a reason that isn't "category missing"**: if no item has an explicit
   `publicPrice` and `CJ_DEFAULT_MARKUP_MULTIPLIER` isn't configured, `promote`
   throws `CjPromotionValidationError` for the *entire* batch (see
   `cjCatalogPromotionService.ts` lines 99-117). Design.md/tasks.md only
   discuss the "default category missing" failure mode (§D4, task 1.3), but
   since auto-promotion never provides an explicit `publicPrice` per item
   (there's no admin choosing one), a missing/invalid
   `CJ_DEFAULT_MARKUP_MULTIPLIER` is an equally real, equally frequent way for
   promotion to fail on every auto-run. Resolution: the CJ descriptor must
   catch **both** `CjPromotionCategoryRequiredError` and
   `CjPromotionValidationError` around the `promote()` call, log a clear
   warning for each, and report a `promotionSkippedReason` without throwing —
   sync results still persist either way. Do not add a new error class for
   this; reuse `CjPromotionValidationError` as-is (task 1.3's instruction to
   reuse `CjPromotionCategoryRequiredError` if it fits extends naturally to
   also reusing `CjPromotionValidationError` for this sibling failure mode).

4. **Task 1.3 asks whether a new error class is needed for "default category
   missing/invalid" — it is not.** `CjCatalogPromotionService.promote` already
   throws `CjPromotionCategoryRequiredError` (defined in
   `backend/src/application/validator.ts`) both when `input.categoryId` is
   `undefined` **and** when `categoryRepo.findById(categoryId)` returns
   `null` (lines 65-68 of `cjCatalogPromotionService.ts`). That is exactly the
   "missing or invalid" scenario from the spec
   (`specs/supplier-catalog-auto-provisioning/spec.md` — "Default category
   missing or misconfigured"). No new validator error class is needed for
   task 1.3 — just catch this existing one in the descriptor's `runPipeline`.

5. **The CJ placeholder-API-key literal (`'cj_test_placeholder'`) is private
   to `cjClient.ts`.** The provider descriptor's `isConfigured()` needs to
   treat that exact placeholder value as "not configured" (per the context
   session's explicit instruction and `cjClient.ts`'s own fallback pattern at
   line 18), but the literal isn't exported today. Duplicating the string
   `'cj_test_placeholder'` in a second file is a silent-drift risk (if the
   fallback ever changes in `cjClient.ts`, `isConfigured()` would go stale
   without anyone noticing). Resolution: export it from `cjClient.ts` as
   `CJ_PLACEHOLDER_API_KEY` and have both `cjClient.ts` and
   `providerRegistry.ts` reference the single constant. This is a two-line,
   additive-only change to `cjClient.ts` (no behavior change) — see §2 below.

6. **`serverless-offline` doesn't execute `schedule` events.** Not a code gap,
   just an operational note for whoever does task 8 (manual execution
   testing): the new function must be exercised with
   `serverless invoke local -f supplierAutoProvision`, not by hitting an HTTP
   route — there is none (D9).

---

## 1. Configuration: env vars + domain error (tasks.md 1.1-1.3)

### 1.1 `backend/.env.example`

Add a new section after the existing `# ── CJ Dropshipping integration ──` block
(after the `CJ_DEFAULT_MARKUP_MULTIPLIER=2.5` line, before `# ── OAuth ──`):

```
# ── Supplier auto-provisioning (scheduled job) ────────────────────────────────
# Fixed default Category.id used when auto-promoting newly synced CJ catalog
# items into Draft products (no human available to pick a category per item
# at auto-promotion time). Must reference an EXISTING Category row — create
# one (e.g. "Uncategorized") via the admin Category management UI/API first,
# then set its id here. If unset or invalid, sync still runs but promotion is
# skipped for that run (logged clearly) — see design.md Decision D4.
CJ_DEFAULT_CATEGORY_ID=
# Kill-switch for the scheduled supplierAutoProvision job. Checked first on
# every invocation; the job short-circuits (no DB writes) and logs a single
# line when this is not the literal string 'true'. Defaults to disabled in
# these template files — enable explicitly once verified locally.
SUPPLIER_AUTO_PROVISION_ENABLED=false
```

### 1.2 `backend/.env.docker`

Same two lines, added after the existing `CJ_DEFAULT_MARKUP_MULTIPLIER=2.5`
line in that file:

```
# ── Supplier auto-provisioning (scheduled job) ────────────────────────────────
# Set CJ_DEFAULT_CATEGORY_ID after creating the "Uncategorized" Category row
# locally (task 1.2 of tasks.md) — leave SUPPLIER_AUTO_PROVISION_ENABLED=false
# except during the manual job-execution testing window (task 8).
CJ_DEFAULT_CATEGORY_ID=
SUPPLIER_AUTO_PROVISION_ENABLED=false
```

Do not put a real category id in either template file — both are checked into
git (unlike `.env`/`.env.docker`'s real per-developer copies which are
gitignored); leave the value blank as a template placeholder, matching how
`CJDROPSHIPPING_API_KEY` is handled in `.env.example` (placeholder text) vs.
the real key only living in the gitignored `.env.docker` a developer actually
runs with. (`.env.docker` already contains a real `CJDROPSHIPPING_API_KEY`
per the file as it exists today — that file is itself gitignored per its own
header comment "NEVER commit this file", so it's fine to leave
`CJ_DEFAULT_CATEGORY_ID=` blank there too and have a developer fill it in
locally per task 1.2, without needing a repo-wide secret.)

### 1.3 Domain error for missing/misconfigured default category

**No new error class.** Reuse `CjPromotionCategoryRequiredError` (already
exported from `backend/src/application/validator.ts`) — see gap #4 above. The
provider descriptor's `runPipeline` (§2 below) is the place that catches it.
No edits to `validator.ts` are needed for this specific requirement.

The one edit `validator.ts` does *not* need but `cjClient.ts` *does* need is
covered in §2's "Required small edit to cjClient.ts".

---

## 2. `backend/src/application/providers/providerRegistry.ts` (tasks.md 2.1-2.3)

### Required small edit to `backend/src/infrastructure/external/cjClient.ts`

Export the placeholder constant instead of leaving it as an inline literal
(gap #5). Change line 18 from:

```ts
const CJDROPSHIPPING_API_KEY = process.env.CJDROPSHIPPING_API_KEY ?? 'cj_test_placeholder';
```

to:

```ts
export const CJ_PLACEHOLDER_API_KEY = 'cj_test_placeholder';
const CJDROPSHIPPING_API_KEY = process.env.CJDROPSHIPPING_API_KEY ?? CJ_PLACEHOLDER_API_KEY;
```

No other line in `cjClient.ts` changes. This is purely additive (one new
named export); existing behavior and existing tests for `cjClient.ts` are
unaffected.

### New file: `backend/src/application/providers/providerRegistry.ts`

```ts
import { CjConnectionService } from '../services/cjConnectionService';
import { CjCatalogSyncService } from '../services/cjCatalogSyncService';
import { CjCatalogPromotionService } from '../services/cjCatalogPromotionService';
import { ProductService } from '../services/productService';
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { CjCatalogItemRepository } from '../../infrastructure/repositories/cjCatalogItemRepository';
import { CategoryRepository } from '../../infrastructure/repositories/categoryRepository';
import { ProductRepository } from '../../infrastructure/repositories/productRepository';
import { ProductVariantRepository } from '../../infrastructure/repositories/productVariantRepository';
import { ProductTranslationRepository } from '../../infrastructure/repositories/productTranslationRepository';
import { cjClient, CJ_PLACEHOLDER_API_KEY } from '../../infrastructure/external/cjClient';
import { CjPromotionCategoryRequiredError, CjPromotionValidationError } from '../validator';
import { logger } from '../../infrastructure/logger';

export type PromotionSkipReason = 'DEFAULT_CATEGORY_MISSING' | 'PRICE_RESOLUTION_FAILED' | 'NO_PROMOTABLE_ITEMS';

export interface ProviderPipelineResult {
  verifyHealthy: boolean;
  itemsUpserted: number;
  itemsFailed: number;
  variantsCreated: number;
  alreadyPromoted: number;
  promotionSkippedReason?: PromotionSkipReason;
}

export interface SupplierProviderDescriptor {
  key: string;
  isConfigured(): boolean;
  defaultSupplierName: string;
  runPipeline(supplierId: number): Promise<ProviderPipelineResult>;
}

// Module-level wiring — mirrors the exact pattern used by every existing CJ
// admin controller (see backend/src/presentation/controllers/cjCatalogPromotionController.ts):
// there is no composition root in this codebase, so each module that needs a
// service graph constructs its own instances once at import time.
const supplierIntegrationRepository = new SupplierIntegrationRepository();
const cjCatalogItemRepository = new CjCatalogItemRepository();
const categoryRepository = new CategoryRepository();
const productVariantRepository = new ProductVariantRepository();
const productService = new ProductService(
  new ProductRepository(),
  productVariantRepository,
  new ProductTranslationRepository()
);

const cjConnectionService = new CjConnectionService(supplierIntegrationRepository, cjClient);
const cjCatalogSyncService = new CjCatalogSyncService(supplierIntegrationRepository, cjCatalogItemRepository, cjClient);
const cjCatalogPromotionService = new CjCatalogPromotionService(
  cjCatalogItemRepository,
  categoryRepository,
  productService,
  productVariantRepository,
  supplierIntegrationRepository
);

// Mirrors CjCatalogSyncService.listStagedCatalog's own MAX_PAGE_SIZE clamp
// (100) and syncCatalog's MAX_SYNC_PAGES safety-cap style — see gap #2.
const PROMOTION_LIST_PAGE_SIZE = 100;
const MAX_PROMOTION_LIST_PAGES = Number(process.env.CJ_PROMOTION_LIST_MAX_PAGES ?? 500);

async function collectPromotableCatalogItemIds(supplierId: number): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; page <= MAX_PROMOTION_LIST_PAGES; page++) {
    const result = await cjCatalogSyncService.listStagedCatalog(supplierId, {
      page,
      pageSize: PROMOTION_LIST_PAGE_SIZE,
      syncStatus: 'Synced',
      promotionState: 'NotPromoted',
    });
    for (const entry of result.items) {
      if (entry.item.id !== undefined) ids.push(entry.item.id);
    }
    if (result.items.length < PROMOTION_LIST_PAGE_SIZE) break;
  }
  return ids;
}

function resolveDefaultCategoryId(): number | undefined {
  const raw = process.env.CJ_DEFAULT_CATEGORY_ID;
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function isConfigured(): boolean {
  const key = process.env.CJDROPSHIPPING_API_KEY;
  return typeof key === 'string' && key.trim().length > 0 && key !== CJ_PLACEHOLDER_API_KEY;
}

async function runPipeline(supplierId: number): Promise<ProviderPipelineResult> {
  const verifyResult = await cjConnectionService.verifyConnection(supplierId);
  if (!verifyResult.healthy) {
    return { verifyHealthy: false, itemsUpserted: 0, itemsFailed: 0, variantsCreated: 0, alreadyPromoted: 0 };
  }

  const syncResult = await cjCatalogSyncService.syncCatalog(supplierId);
  const base = { verifyHealthy: true, itemsUpserted: syncResult.itemsUpserted, itemsFailed: syncResult.itemsFailed };

  const promotableIds = await collectPromotableCatalogItemIds(supplierId);
  if (promotableIds.length === 0) {
    return { ...base, variantsCreated: 0, alreadyPromoted: 0, promotionSkippedReason: 'NO_PROMOTABLE_ITEMS' };
  }

  const categoryId = resolveDefaultCategoryId();
  try {
    const promoteResult = await cjCatalogPromotionService.promote(supplierId, {
      items: promotableIds.map((cjCatalogItemId) => ({ cjCatalogItemId })),
      categoryId,
      activate: false, // D5 — never change this to true
    });
    return {
      ...base,
      variantsCreated: promoteResult.variants.filter((v) => !v.wasAlreadyPromoted).length,
      alreadyPromoted: promoteResult.variants.filter((v) => v.wasAlreadyPromoted).length,
    };
  } catch (err) {
    if (err instanceof CjPromotionCategoryRequiredError) {
      logger.warn('CJ auto-promotion skipped: default category missing or invalid', { supplierId });
      return { ...base, variantsCreated: 0, alreadyPromoted: 0, promotionSkippedReason: 'DEFAULT_CATEGORY_MISSING' };
    }
    if (err instanceof CjPromotionValidationError) {
      logger.warn('CJ auto-promotion skipped: one or more items failed price/validation resolution', { supplierId });
      return { ...base, variantsCreated: 0, alreadyPromoted: 0, promotionSkippedReason: 'PRICE_RESOLUTION_FAILED' };
    }
    throw err; // unexpected — let the orchestrator record this as a hard per-provider failure
  }
}

export const cjProviderDescriptor: SupplierProviderDescriptor = {
  key: 'CJDropshipping',
  isConfigured,
  defaultSupplierName: 'CJ Dropshipping',
  runPipeline,
};

// Single-element array today (D7) — a future second provider is added here,
// not by editing supplierAutoProvisionService.ts or the job handler.
export const providerRegistry: SupplierProviderDescriptor[] = [cjProviderDescriptor];
```

### New test file: `backend/src/application/providers/__tests__/providerRegistry.test.ts`

Mock every class `providerRegistry.ts` constructs at module scope, exactly
the way `cjCatalogPromotionController.test.ts` mocks its own module-scope
service graph:

```ts
const mockVerifyConnection = jest.fn();
const mockSyncCatalog = jest.fn();
const mockListStagedCatalog = jest.fn();
const mockPromote = jest.fn();

jest.mock('../../services/cjConnectionService', () => ({
  CjConnectionService: jest.fn().mockImplementation(() => ({ verifyConnection: mockVerifyConnection })),
}));
jest.mock('../../services/cjCatalogSyncService', () => ({
  CjCatalogSyncService: jest.fn().mockImplementation(() => ({
    syncCatalog: mockSyncCatalog,
    listStagedCatalog: mockListStagedCatalog,
  })),
}));
jest.mock('../../services/cjCatalogPromotionService', () => ({
  CjCatalogPromotionService: jest.fn().mockImplementation(() => ({ promote: mockPromote })),
}));
jest.mock('../../services/productService', () => ({ ProductService: jest.fn().mockImplementation(() => ({})) }));
jest.mock('../../../infrastructure/repositories/supplierIntegrationRepository', () => ({
  SupplierIntegrationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/cjCatalogItemRepository', () => ({
  CjCatalogItemRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/categoryRepository', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/productRepository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/productVariantRepository', () => ({
  ProductVariantRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/productTranslationRepository', () => ({
  ProductTranslationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/external/cjClient', () => ({
  cjClient: {},
  CJ_PLACEHOLDER_API_KEY: 'cj_test_placeholder',
}));

import { cjProviderDescriptor, providerRegistry } from '../providerRegistry';
import { CjPromotionCategoryRequiredError, CjPromotionValidationError } from '../../validator';
```

Test cases (`describe('providerRegistry')`, `beforeEach(() => { jest.clearAllMocks(); delete process.env['CJDROPSHIPPING_API_KEY']; delete process.env['CJ_DEFAULT_CATEGORY_ID']; })`):

- `isConfigured()`
  - `should_report_configured_when_api_key_is_a_real_value` — set env to `'real_key_123'` → `true`.
  - `should_report_not_configured_when_api_key_is_missing` → `false`.
  - `should_report_not_configured_when_api_key_is_the_placeholder_value` — set env to `'cj_test_placeholder'` → `false`.
  - `should_report_not_configured_when_api_key_is_an_empty_string` → `false`.
- Descriptor shape
  - `should_expose_key_and_defaultSupplierName` — `cjProviderDescriptor.key === 'CJDropshipping'`, `defaultSupplierName === 'CJ Dropshipping'`.
  - `should_export_a_registry_containing_exactly_the_cj_descriptor` — `providerRegistry).toEqual([cjProviderDescriptor])`.
- `runPipeline`
  - `should_skip_sync_and_promote_when_verify_reports_unhealthy` — `mockVerifyConnection.mockResolvedValue({ healthy: false })` → result `{verifyHealthy:false, itemsUpserted:0, itemsFailed:0, variantsCreated:0, alreadyPromoted:0}`; `mockSyncCatalog`/`mockPromote` not called.
  - `should_page_through_listStagedCatalog_until_a_short_page_and_then_call_promote_once` — `mockVerifyConnection` healthy; `mockSyncCatalog.mockResolvedValue({itemsUpserted:150,itemsFailed:0,syncedAt:new Date()})`; `mockListStagedCatalog` first call returns 100 items (full page), second call returns 5 items; `mockPromote.mockResolvedValue({products:[],variants:[...],createdAny:true})` → assert `mockListStagedCatalog` called twice (`page:1` then `page:2`), `mockPromote` called once with `items` containing all 105 collected ids.
  - `should_report_NO_PROMOTABLE_ITEMS_and_not_call_promote_when_nothing_is_returned` — `mockListStagedCatalog.mockResolvedValue({items:[],total:0,page:1,pageSize:100})` → `mockPromote` not called; result `promotionSkippedReason:'NO_PROMOTABLE_ITEMS'`.
  - `should_catch_CjPromotionCategoryRequiredError_and_report_DEFAULT_CATEGORY_MISSING` — one staged item returned; `mockPromote.mockRejectedValue(new CjPromotionCategoryRequiredError())` → no throw; result `promotionSkippedReason:'DEFAULT_CATEGORY_MISSING'`, `itemsUpserted` still reflects sync.
  - `should_catch_CjPromotionValidationError_and_report_PRICE_RESOLUTION_FAILED` — same shape with `new CjPromotionValidationError([])`.
  - `should_rethrow_unexpected_errors_from_promote` — `mockPromote.mockRejectedValue(new Error('boom'))` → `await expect(cjProviderDescriptor.runPipeline(1)).rejects.toThrow('boom')`.
  - `should_report_variantsCreated_and_alreadyPromoted_split_from_promote_result` — `mockPromote.mockResolvedValue({products:[],variants:[{...,wasAlreadyPromoted:false},{...,wasAlreadyPromoted:true}],createdAny:true})` → `variantsCreated:1, alreadyPromoted:1`.

---

## 3. `backend/src/application/services/supplierAutoProvisionService.ts` (tasks.md 3.1-3.7)

### Advisory lock SQL — exact Prisma calls

Postgres `pg_try_advisory_lock` takes a single `bigint` (or two `int4`s). Use
`hashtext(...)` (built-in Postgres function, returns `int4`, implicitly
widens to `bigint`) keyed on `descriptor.key` so no JS-side hashing is
needed. This mirrors the existing tagged-template `prisma.$queryRaw<T>`
pattern already used in
`backend/src/infrastructure/repositories/customerOrderRepository.ts`
(`generateNextOrderNumber`, lines 242-248) and the plain
`` prisma.$queryRaw`SELECT 1` `` pattern in `backend/src/routes/healthRoutes.ts`.

```ts
async function tryAcquireLock(key: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext(${key})) AS locked
  `;
  return rows[0]?.locked === true;
}

async function releaseLock(key: string): Promise<void> {
  await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${key}))`;
}
```

Only call `releaseLock` when `tryAcquireLock` returned `true` for that key,
and always inside a `finally` around the provider's try/catch (so a thrown
pipeline error still releases the lock).

### New file: `backend/src/application/services/supplierAutoProvisionService.ts`

```ts
import { SupplierService } from './supplierService';
import { CjConnectionService } from './cjConnectionService';
import { SupplierProviderDescriptor } from '../providers/providerRegistry';
import { prisma } from '../../infrastructure/prismaClient';
import { logger } from '../../infrastructure/logger';

export type ProviderSkipReason = 'NOT_CONFIGURED' | 'LOCKED';

export interface ProviderRunOutcome {
  provider: string;
  skipped: boolean;
  skipReason?: ProviderSkipReason;
  provisioned: boolean;
  verifyHealthy?: boolean;
  itemsUpserted?: number;
  itemsFailed?: number;
  variantsCreated?: number;
  alreadyPromoted?: number;
  promotionSkippedReason?: 'DEFAULT_CATEGORY_MISSING' | 'PRICE_RESOLUTION_FAILED' | 'NO_PROMOTABLE_ITEMS';
  error?: string;
}

export interface SupplierAutoProvisionRunResult {
  enabled: boolean;
  providers: ProviderRunOutcome[];
}

export class SupplierAutoProvisionService {
  constructor(
    private readonly supplierService: SupplierService,
    private readonly connectionService: CjConnectionService,
    private readonly registry: SupplierProviderDescriptor[]
  ) {}

  async run(): Promise<SupplierAutoProvisionRunResult> {
    if (process.env.SUPPLIER_AUTO_PROVISION_ENABLED !== 'true') {
      logger.info('Supplier auto-provisioning disabled via SUPPLIER_AUTO_PROVISION_ENABLED', {});
      return { enabled: false, providers: [] };
    }

    const providers: ProviderRunOutcome[] = [];
    for (const descriptor of this.registry) {
      providers.push(await this.runForProvider(descriptor));
    }

    logger.info('Supplier auto-provision run completed', { providers });
    return { enabled: true, providers };
  }

  private async runForProvider(descriptor: SupplierProviderDescriptor): Promise<ProviderRunOutcome> {
    if (!descriptor.isConfigured()) {
      logger.info('Supplier auto-provisioning skipped: provider not configured', { provider: descriptor.key });
      return { provider: descriptor.key, skipped: true, skipReason: 'NOT_CONFIGURED', provisioned: false };
    }

    const acquired = await this.tryAcquireLock(descriptor.key);
    if (!acquired) {
      logger.warn('Supplier auto-provisioning skipped: advisory lock already held', { provider: descriptor.key });
      return { provider: descriptor.key, skipped: true, skipReason: 'LOCKED', provisioned: false };
    }

    try {
      const { supplierId, provisioned } = await this.ensureSupplierProvisioned(descriptor);
      const pipelineResult = await descriptor.runPipeline(supplierId);
      return { provider: descriptor.key, skipped: false, provisioned, ...pipelineResult };
    } catch (err) {
      logger.error('Supplier auto-provisioning failed for provider', {
        provider: descriptor.key,
        errorName: err instanceof Error ? err.name : 'unknown',
      });
      return {
        provider: descriptor.key,
        skipped: false,
        provisioned: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    } finally {
      await this.releaseLock(descriptor.key);
    }
  }

  private async ensureSupplierProvisioned(
    descriptor: SupplierProviderDescriptor
  ): Promise<{ supplierId: number; provisioned: boolean }> {
    // No ISupplierIntegrationRepository method covers this lookup — see
    // plan §0 gap #1. Direct prisma access here mirrors the existing
    // precedent in CjConnectionService.configureConnection (prisma.supplier.findUnique).
    const existing = await prisma.supplierIntegration.findFirst({ where: { provider: descriptor.key } });
    if (existing) {
      return { supplierId: existing.supplierId, provisioned: false };
    }

    const supplier = await this.supplierService.create({ name: descriptor.defaultSupplierName });
    await this.connectionService.configureConnection(supplier.id as number, {});
    logger.info('Auto-created Supplier and SupplierIntegration', { provider: descriptor.key, supplierId: supplier.id });
    return { supplierId: supplier.id as number, provisioned: true };
  }

  private async tryAcquireLock(key: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(hashtext(${key})) AS locked
    `;
    return rows[0]?.locked === true;
  }

  private async releaseLock(key: string): Promise<void> {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${key}))`;
  }
}
```

Notes:
- `supplier.id as number` mirrors the existing non-null-assertion style used
  throughout this codebase for freshly-created Prisma rows (e.g.
  `catalogItem.id!` in `cjCatalogPromotionService.ts`); prefer `as number`
  over `!` only if the lint config forbids non-null assertions — check
  `.eslintrc`/`eslint.config` for a `no-non-null-assertion` rule before
  implementing; if absent, use `supplier.id!` to match existing style exactly.
- `releaseLock` is called even when `tryAcquireLock` never ran or returned
  `false`? No — only called from inside the `try/finally` that starts *after*
  `acquired` is confirmed `true` (the `if (!acquired) return ...` happens
  before the `try` block), so `finally` only ever runs when the lock was
  actually acquired. Double-check this ordering carefully when implementing —
  it is easy to accidentally place the `finally` around the lock-acquire call
  itself and release a lock that was never taken.

### New test file: `backend/src/application/services/__tests__/supplierAutoProvisionService.test.ts`

Mock `prisma` (raw `supplierIntegration.findFirst` + `$queryRaw`) and build
hand-written fakes for `SupplierService`, `CjConnectionService`, and each
`SupplierProviderDescriptor` (do not construct the real CJ descriptor here —
that's what `providerRegistry.test.ts` is for):

```ts
jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    supplierIntegration: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '../../../infrastructure/prismaClient';
import { SupplierAutoProvisionService } from '../supplierAutoProvisionService';
import { SupplierService } from '../supplierService';
import { CjConnectionService } from '../cjConnectionService';
import { Supplier } from '../../../domain/models/supplier';
import { SupplierProviderDescriptor } from '../../providers/providerRegistry';

const mockFindFirst = prisma.supplierIntegration.findFirst as jest.Mock;
const mockQueryRaw = prisma.$queryRaw as jest.Mock;

function makeDescriptor(overrides: Partial<SupplierProviderDescriptor> = {}): jest.Mocked<SupplierProviderDescriptor> {
  return {
    key: 'CJDropshipping',
    isConfigured: jest.fn().mockReturnValue(true),
    defaultSupplierName: 'CJ Dropshipping',
    runPipeline: jest.fn(),
    ...overrides,
  } as jest.Mocked<SupplierProviderDescriptor>;
}
```

Give `mockQueryRaw` a default implementation in `beforeEach` that returns
`[{ locked: true }]` for the lock-acquire query and `[]` for the unlock query
(distinguish by asserting on the tagged-template `strings`/call order rather
than SQL text matching, since `$queryRaw` receives a `TemplateStringsArray`).

Test cases (per tasks.md 3.7, made concrete):

1. `should_noop_when_kill_switch_is_disabled` — `process.env.SUPPLIER_AUTO_PROVISION_ENABLED` unset → `run()` resolves `{enabled:false, providers:[]}`; `mockFindFirst` and any descriptor's `runPipeline` never called.
2. `should_skip_a_provider_that_is_not_configured` — enabled=`'true'`; descriptor `isConfigured` returns `false` → result contains `{provider:'CJDropshipping', skipped:true, skipReason:'NOT_CONFIGURED', provisioned:false}`; `mockFindFirst` never called.
3. `should_auto_create_supplier_and_integration_when_none_exists` — `mockFindFirst.mockResolvedValue(null)`; `supplierService.create` (constructed with a fake `ISupplierRepository`, or stub the whole `SupplierService` instance via `{ create: jest.fn() } as unknown as SupplierService`) resolves `new Supplier({id:5, name:'CJ Dropshipping'})`; `connectionService.configureConnection` stubbed similarly resolves `{integration: {...}, created:true}`; descriptor `runPipeline` resolves a full success shape → assert `supplierService.create` called with `{name:'CJ Dropshipping'}`, `connectionService.configureConnection` called with `(5, {})`, `runPipeline` called with `(5)`, result `provisioned:true`.
4. `should_reuse_an_existing_supplier_without_creating_a_duplicate` — `mockFindFirst.mockResolvedValue({id:1, supplierId:9, provider:'CJDropshipping'})` → `supplierService.create`/`connectionService.configureConnection` NOT called; `runPipeline` called with `(9)`; result `provisioned:false`.
5. `should_pass_through_an_unhealthy_verify_result_without_throwing` — `runPipeline.mockResolvedValue({verifyHealthy:false, itemsUpserted:0, itemsFailed:0, variantsCreated:0, alreadyPromoted:0})` → `run()` resolves normally; result reflects `verifyHealthy:false`. (Note: the actual "skip sync when unhealthy" *behavior* is exercised in `providerRegistry.test.ts`, not here — this test only proves the orchestrator doesn't choke on that shape.)
6. `should_pass_through_a_default_category_missing_result_while_keeping_sync_counts` — `runPipeline.mockResolvedValue({verifyHealthy:true, itemsUpserted:5, itemsFailed:0, variantsCreated:0, alreadyPromoted:0, promotionSkippedReason:'DEFAULT_CATEGORY_MISSING'})` → result passes those fields through unchanged.
7. `should_run_the_full_pipeline_successfully_end_to_end` — happy path (auto-create + healthy verify + sync + promote) → assert the final `providers[0]` object matches the exact expected shape (`provisioned:true, verifyHealthy:true, itemsUpserted, itemsFailed, variantsCreated, alreadyPromoted`, no `error`/`skipReason`).
8. `should_not_create_duplicate_records_on_a_second_run` — call `service.run()` twice; first call's `mockFindFirst` resolves `null` (triggers create), second call's `mockFindFirst` resolves the now-existing integration → assert `supplierService.create` called exactly once across both runs, `runPipeline` called twice with the same `supplierId` both times.
9. `should_isolate_one_providers_failure_from_another` — registry of two descriptors; first's `runPipeline` rejects `new Error('boom')`, second's resolves successfully → assert `providers[0].error === 'boom'`, `providers[1]` reflects success, and the second descriptor's `runPipeline` **was** called (not blocked by the first's rejection).
10. `should_skip_a_provider_when_its_advisory_lock_is_already_held` — `mockQueryRaw` resolves `[{locked:false}]` for the lock query → `runPipeline` NOT called; result `{skipped:true, skipReason:'LOCKED', provisioned:false}`; assert the unlock query is **not** issued (lock was never acquired).
11. `should_release_the_lock_even_when_runPipeline_throws` — lock acquired (`[{locked:true}]`), `runPipeline` rejects → assert `mockQueryRaw` was called a second time for the unlock (i.e. call count is 2: lock + unlock) despite the thrown error being caught.

---

## 4. `backend/src/jobs/supplierAutoProvisionHandler.ts` (tasks.md 4.1-4.2)

This is the **only** place in this change with no HTTP surface (D9) — it's a
plain async function exported as `handler`, invoked by EventBridge (or
`serverless invoke local -f supplierAutoProvision` for manual testing).

### New file: `backend/src/jobs/supplierAutoProvisionHandler.ts`

```ts
import { SupplierAutoProvisionService, SupplierAutoProvisionRunResult } from '../application/services/supplierAutoProvisionService';
import { SupplierService } from '../application/services/supplierService';
import { SupplierRepository } from '../infrastructure/repositories/supplierRepository';
import { CjConnectionService } from '../application/services/cjConnectionService';
import { SupplierIntegrationRepository } from '../infrastructure/repositories/supplierIntegrationRepository';
import { cjClient } from '../infrastructure/external/cjClient';
import { providerRegistry } from '../application/providers/providerRegistry';
import { logger } from '../infrastructure/logger';

// Manually wired, exactly like every existing CJ admin controller
// (backend/src/presentation/controllers/cjConnectionController.ts,
// cjCatalogSyncController.ts, cjCatalogPromotionController.ts) — this
// codebase has no composition root, so each entry point (HTTP controller or,
// here, a scheduled job) constructs its own service graph once at module
// load time.
const supplierAutoProvisionService = new SupplierAutoProvisionService(
  new SupplierService(new SupplierRepository()),
  new CjConnectionService(new SupplierIntegrationRepository(), cjClient),
  providerRegistry
);

export async function handler(_event?: unknown): Promise<SupplierAutoProvisionRunResult> {
  const result = await supplierAutoProvisionService.run();
  logger.info('supplierAutoProvision job finished', { enabled: result.enabled, providerCount: result.providers.length });
  return result;
}
```

`_event` is accepted (prefixed `_` per the ESLint unused-param convention)
but unused — EventBridge's scheduled-event payload carries nothing this job
needs (no per-invocation input, per design.md's non-goals). No
`context.callbackWaitsForEmptyEventLoop = false` handling is needed here the
way `src/lambda.ts` does it for the http proxy — that flag exists to stop
`serverless-http` waiting on open sockets from a *request*; a scheduled batch
job has no such concern and Lambda will simply await the returned promise.

### New test file: `backend/src/jobs/__tests__/supplierAutoProvisionHandler.test.ts`

Mock every constructor call the same way `cjCatalogPromotionController.test.ts`
does:

```ts
const mockRun = jest.fn();

jest.mock('../../application/services/supplierAutoProvisionService', () => ({
  SupplierAutoProvisionService: jest.fn().mockImplementation(() => ({ run: mockRun })),
}));
jest.mock('../../application/services/supplierService', () => ({
  SupplierService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/repositories/supplierRepository', () => ({
  SupplierRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../application/services/cjConnectionService', () => ({
  CjConnectionService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/repositories/supplierIntegrationRepository', () => ({
  SupplierIntegrationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/external/cjClient', () => ({ cjClient: {} }));
jest.mock('../../application/providers/providerRegistry', () => ({ providerRegistry: [] }));

import { handler } from '../supplierAutoProvisionHandler';
import { SupplierAutoProvisionService } from '../../application/services/supplierAutoProvisionService';
```

Test cases:

- `should_construct_SupplierAutoProvisionService_with_its_manually_wired_dependencies_exactly_once` — call `handler()`; assert `SupplierAutoProvisionService` (the mocked constructor) was called exactly once, with `providerRegistry` (`[]` from the mock) as its third argument.
- `should_delegate_to_service_run_and_return_its_result_unchanged` — `mockRun.mockResolvedValue({enabled:true, providers:[{provider:'CJDropshipping', skipped:false, provisioned:true}]})`; assert `handler()`'s resolved value strictly equals that object and `mockRun` was called with no arguments.
- `should_propagate_a_run_failure_rather_than_swallowing_it` — `mockRun.mockRejectedValue(new Error('unexpected'))` → `await expect(handler()).rejects.toThrow('unexpected')`.

Per task 4.2's instruction, do **not** re-test provisioning/lock/pipeline
logic here — that's fully covered by `supplierAutoProvisionService.test.ts`
and `providerRegistry.test.ts`.

---

## 5. `backend/serverless.yml` (tasks.md 5.1-5.2, note on 5.3)

### 5.1 + 5.2: new env vars and new function

In `provider.environment`, add two lines directly after the existing
`CJ_DEFAULT_MARKUP_MULTIPLIER: '2.5'` line:

```yaml
    CJ_DEFAULT_CATEGORY_ID: ${ssm:/ecommerce/prod/CJ_DEFAULT_CATEGORY_ID}
    SUPPLIER_AUTO_PROVISION_ENABLED: ${ssm:/ecommerce/prod/SUPPLIER_AUTO_PROVISION_ENABLED, 'false'}
```

Note the asymmetry (matches tasks.md 5.2 exactly and D8/the migration plan
step 3): `CJ_DEFAULT_CATEGORY_ID` has **no** default — if the SSM parameter
doesn't exist yet, `serverless deploy` will fail loudly, which is the
intended forcing function to create the "Uncategorized" category and its SSM
parameter *before* this can deploy. `SUPPLIER_AUTO_PROVISION_ENABLED` has an
explicit `'false'` fallback so a first deploy is always safe-by-default even
before the SSM parameter is created.

In `functions:`, add a new top-level function sibling to `app`:

```yaml
  supplierAutoProvision:
    handler: src/jobs/supplierAutoProvisionHandler.handler
    timeout: 900
    events:
      - schedule: rate(1 day)
```

No `http:` event (D9 — this function must never be reachable over HTTP). No
`cors` block, no IAM-role changes needed beyond what `serverless-esbuild`
already grants the default execution role (this job uses only Prisma/DB and
outbound HTTPS to CJ, both already permitted for the `app` function's
role/security group; if the Lambda's VPC/security-group config is scoped
per-function anywhere outside this file, verify the new function inherits
the same network path to the RDS instance — check for any
`vpc:`/`securityGroupIds` block elsewhere in `serverless.yml` or a linked
CloudFormation resource before deploying; none was found in the current
`serverless.yml` shown above, so this is likely a non-issue, but flag it for
verification since the file as read has no explicit `vpc:` section at all).

`serverless-esbuild` (`plugins: - serverless-esbuild`, already configured in
`custom.esbuild`) bundles per-function handler entry points automatically
based on each function's `handler:` path — no changes to `custom.esbuild` or
`package.patterns` are needed for the new `src/jobs/supplierAutoProvisionHandler.ts`
entry point; the existing `external: ['@prisma/client', '.prisma']` and the
`package.patterns` Prisma-engine re-inclusions already apply repo-wide, not
per-function.

### 5.3 (doc update, not code — flagged for completeness)

`docs/aws-infrastructure.md` should gain a short section documenting: the new
`supplierAutoProvision` function, its `rate(1 day)` EventBridge schedule, that
it has no HTTP trigger/API Gateway route, its `timeout: 900`, and the two new
required SSM parameters (`/ecommerce/prod/CJ_DEFAULT_CATEGORY_ID` — must be
created manually before first deploy with the schedule enabled;
`/ecommerce/prod/SUPPLIER_AUTO_PROVISION_ENABLED` — optional, defaults to
`'false'`). This plan doesn't draft that doc's prose since it's outside
groups 1-5's code scope, but the parent implementing tasks.md group 10 should
cross-reference this section instead of re-deriving the SSM parameter list.

---

## Verification commands (once groups 1-5 are implemented)

```
cd backend && npm run lint
cd backend && npm test -- --watchAll=false --testPathPattern=providerRegistry
cd backend && npm test -- --watchAll=false --testPathPattern=supplierAutoProvisionService
cd backend && npm test -- --watchAll=false --testPathPattern=supplierAutoProvisionHandler
cd backend && npx jest --watchAll=false --coverage
```

Confirm `npm run lint` passes with no `any` introduced and no unused params
(the `_event` prefix in the handler, and any mocked-but-unused constructor
args in tests, must follow the same `_`-prefix convention already used
elsewhere in this codebase, e.g. `_req`/`_res` patterns if present
elsewhere — grep for the project's own convention before finalizing
parameter names if unsure).
