# Implementation Plan: cj-catalog-cursor-and-media (backend, tasks.md groups 1-8)

This plan covers only tasks.md groups 1-8 (schema, repository, sync cursor logic, DTO
extension, image extraction helper, promote() wiring, serverless.yml defaults, backfill
script). Groups 9-13 (test/doc review, manual verification, docs, commit/PR) are not
implemented here — the parent agent handles those after this plan's code changes land.

All line numbers below are from the files as read on this planning pass (branch
`feature/cj-catalog-cursor-and-media`). Re-check them before editing if other changes
land first.

---

## 1. Prisma migration: `SupplierIntegration` cursor fields

**File:** `backend/prisma/schema.prisma`

Current `SupplierIntegration` model (lines 473-487):

```prisma
model SupplierIntegration {
  id                 Int                  @id @default(autoincrement())
  supplierId         Int                  @unique
  supplier           Supplier             @relation(fields: [supplierId], references: [id])
  provider           String               @default("CJDropshipping") @db.VarChar(50)
  status             String               @default("Disconnected") @db.VarChar(20)
  externalAccountRef String?              @db.VarChar(150)
  lastVerifiedAt     DateTime?
  lastSyncedAt       DateTime?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt
  catalogItems       CjCatalogItem[]

  @@index([supplierId])
}
```

**Exact diff** — add three fields immediately after `lastSyncedAt` (line 481):

```diff
   externalAccountRef String?              @db.VarChar(150)
   lastVerifiedAt     DateTime?
   lastSyncedAt       DateTime?
+  catalogSyncCursorPage Int               @default(0)
+  catalogSyncTotalPages Int?
+  catalogSyncWrappedAt  DateTime?
   createdAt          DateTime             @default(now())
   updatedAt          DateTime             @updatedAt
   catalogItems       CjCatalogItem[]
```

(Field alignment/whitespace will be auto-fixed by `prisma format` — don't hand-align.)

**Migration command** (run from `backend/`):

```bash
npx prisma format
npx prisma migrate dev --name add_cj_catalog_sync_cursor
npx prisma generate
```

This follows the exact naming convention of the most recent migration folder already in
the repo (`backend/prisma/migrations/20260708100857_add_cj_catalog_item_link/`), which
contains a plain `ALTER TABLE ... ADD COLUMN` + no data backfill — expect Prisma to
generate something equivalent to:

```sql
-- AlterTable
ALTER TABLE "SupplierIntegration"
ADD COLUMN "catalogSyncCursorPage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "catalogSyncTotalPages" INTEGER,
ADD COLUMN "catalogSyncWrappedAt" TIMESTAMP(3);
```

Additive-only, nullable/defaulted — the existing single production `SupplierIntegration`
row needs no backfill (`catalogSyncCursorPage` defaults to `0`, matching "never synced
before" semantics exactly).

Verify with `npx prisma migrate status` (should report "Database schema is up to date").

---

## 2. Domain/Infrastructure: cursor repository method

### 2.1 `backend/src/domain/repositories/supplierIntegrationRepository.ts` (currently 18 lines, full file read)

Add one method to the interface, after `updateLastSyncedAt`:

```ts
export interface ISupplierIntegrationRepository {
  findBySupplierId(supplierId: number): Promise<SupplierIntegration | null>;
  upsert(
    supplierId: number,
    data: SupplierIntegrationUpsertData
  ): Promise<{ integration: SupplierIntegration; created: boolean }>;
  updateStatus(
    id: number,
    data: { status: 'Connected' | 'Error'; lastVerifiedAt: Date }
  ): Promise<SupplierIntegration>;
  updateLastSyncedAt(id: number, lastSyncedAt: Date): Promise<SupplierIntegration>;
  updateCatalogSyncCursor(
    id: number,
    data: { cursorPage: number; totalPages: number; wrappedAt?: Date }
  ): Promise<SupplierIntegration>;
}
```

Signature exactly as specified in tasks.md 2.1 / the context session. `wrappedAt` is
**optional** — omitted means "don't touch `catalogSyncWrappedAt`" (leave whatever was
persisted on a prior wrap), present means "this run wrapped, stamp it now."

### 2.2 `backend/src/infrastructure/repositories/supplierIntegrationRepository.ts` (68 lines, full file read)

Add the implementation after `updateLastSyncedAt` (after line 67, before the closing
`}` of the class):

```ts
  async updateCatalogSyncCursor(
    id: number,
    data: { cursorPage: number; totalPages: number; wrappedAt?: Date }
  ): Promise<SupplierIntegration> {
    const row = await prisma.supplierIntegration.update({
      where: { id },
      data: {
        catalogSyncCursorPage: data.cursorPage,
        catalogSyncTotalPages: data.totalPages,
        ...(data.wrappedAt !== undefined && { catalogSyncWrappedAt: data.wrappedAt }),
      },
    });
    return new SupplierIntegration(row);
  }
```

This mirrors the exact conditional-spread style already used in this codebase for
optional-field updates (see `ProductImageRepository.update`,
`backend/src/infrastructure/repositories/productImageRepository.ts:52-56`, which does
the identical `...(data.x !== undefined && { x: data.x })` pattern).

### 2.3 `backend/src/domain/models/supplierIntegration.ts` (48 lines, full file read)

Add three fields + constructor params, mirroring the existing `lastSyncedAt` pattern
exactly:

```ts
export class SupplierIntegration {
  id?: number;
  supplierId: number;
  provider: string;
  status: SupplierIntegrationStatus;
  externalAccountRef?: string | null;
  lastVerifiedAt?: Date | null;
  lastSyncedAt?: Date | null;
  catalogSyncCursorPage: number;
  catalogSyncTotalPages?: number | null;
  catalogSyncWrappedAt?: Date | null;
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
    catalogSyncCursorPage?: number | null;
    catalogSyncTotalPages?: number | null;
    catalogSyncWrappedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.supplierId = data.supplierId;
    this.provider = data.provider ?? 'CJDropshipping';
    this.status = (data.status as SupplierIntegrationStatus) ?? 'Disconnected';
    this.externalAccountRef = data.externalAccountRef ?? null;
    this.lastVerifiedAt = data.lastVerifiedAt ?? null;
    this.lastSyncedAt = data.lastSyncedAt ?? null;
    this.catalogSyncCursorPage = data.catalogSyncCursorPage ?? 0;
    this.catalogSyncTotalPages = data.catalogSyncTotalPages ?? null;
    this.catalogSyncWrappedAt = data.catalogSyncWrappedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  markConnected(verifiedAt: Date = new Date()): void { /* unchanged */ }
  markError(verifiedAt: Date = new Date()): void { /* unchanged */ }
}
```

`catalogSyncCursorPage` defaults to `0` here (not just at the DB level) so that
`CjCatalogSyncService.syncCatalog` (task 3) can always read
`integration.catalogSyncCursorPage` without a null-check, and so existing tests that
construct `new SupplierIntegration({ id: 1, supplierId: 10, status })` (e.g.
`cjCatalogSyncService.test.ts:9-11`, `cjCatalogPromotionService.test.ts:108`) keep
working unchanged — cursor defaults to 0, matching current always-page-1 behavior for
any test that doesn't care about the cursor.

### 2.4 Unit tests — `backend/src/infrastructure/repositories/__tests__/supplierIntegrationRepository.test.ts`

Check whether this test file already exists before assuming its current shape; if it
doesn't exist yet, create it following the same mocking pattern as
`productImageRepository`'s tests (mock `../prismaClient`'s `prisma.supplierIntegration.*`
methods). Test cases for `updateCatalogSyncCursor`:

1. `should_update_cursorPage_and_totalPages_without_touching_wrappedAt_when_wrappedAt_is_omitted` —
   call with `{ cursorPage: 3, totalPages: 10 }`, assert
   `prisma.supplierIntegration.update` called with `data` **not containing** a
   `catalogSyncWrappedAt` key at all (use `expect(...).not.toHaveProperty(...)` or
   `expect(callArgs.data.catalogSyncWrappedAt).toBeUndefined()` — but note plain
   `toEqual` on the whole `data` object is safer: assert
   `data: { catalogSyncCursorPage: 3, catalogSyncTotalPages: 10 }` exactly, no extra
   key).
2. `should_set_wrappedAt_when_provided` — call with
   `{ cursorPage: 0, totalPages: 10, wrappedAt: someDate }`, assert `data` includes
   `catalogSyncWrappedAt: someDate`.
3. `should_return_a_SupplierIntegration_domain_instance` — assert result
   `instanceof SupplierIntegration` and its `catalogSyncCursorPage` reflects the mocked
   row.

---

## 3. Application: windowed, wrap-around sync cursor logic

**File:** `backend/src/application/services/cjCatalogSyncService.ts` (191 lines, full
file read)

### 3.0 Required refactor for testability (flagged gap — do this first)

Lines 14-16 today:

```ts
const MAX_PAGE_SIZE = 100;
const MAX_SYNC_PAGES = Number(process.env.CJ_SYNC_MAX_PAGES ?? 500);
const CATALOG_PAGE_SIZE = Number(process.env.CJ_CATALOG_PAGE_SIZE ?? 100);
```

`MAX_SYNC_PAGES`/`CATALOG_PAGE_SIZE` are **module-level constants evaluated once at
import time**. The new wrap-around test matrix (task 3.4) needs different window sizes
per test (e.g. a window of 2 pages to force a wrap, vs. a window ending before
`totalPages` for the no-wrap case) — with the current pattern, setting
`process.env.CJ_SYNC_MAX_PAGES` inside a test has **no effect**, because the constant
was already frozen when the test file's top-level `import { CjCatalogSyncService } from
'../cjCatalogSyncService'` ran, long before any test body executes. Working around this
with `jest.resetModules()` + dynamic re-`require()` per test is possible but awkward and
inconsistent with every other test file in this codebase (none use that pattern).

**Recommended fix:** move the two env reads into the constructor, as instance fields,
so each `new CjCatalogSyncService(...)` call captures the *current* `process.env` value
at construction time — tests can then just set `process.env.CJ_SYNC_MAX_PAGES` and
construct a fresh service instance inline in the test body, no module reset needed.
`MAX_PAGE_SIZE` (used only by `listStagedCatalog`'s clamp, unrelated to the sync window)
stays a module const.

```ts
const MAX_PAGE_SIZE = 100;

export class CjCatalogSyncService {
  private readonly maxSyncPages: number;
  private readonly catalogPageSize: number;

  constructor(
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly cjClient: ICjClient
  ) {
    this.maxSyncPages = Number(process.env.CJ_SYNC_MAX_PAGES ?? 500);
    this.catalogPageSize = Number(process.env.CJ_CATALOG_PAGE_SIZE ?? 100);
  }
  ...
```

Replace all in-method uses of `MAX_SYNC_PAGES`/`CATALOG_PAGE_SIZE` with
`this.maxSyncPages`/`this.catalogPageSize`. This is behavior-neutral in production (env
vars don't change at runtime after Lambda cold start; reading them at construction time
vs. module-import time is equivalent), but is the difference between the group-3 test
matrix being straightforward vs. requiring hacky module-reset gymnastics. Flag this
explicitly if implementing without this refactor — the wrap-around tests below assume
it.

### 3.1-3.3 Rewrite the pagination loop

**Current code, lines 48-177** (full method):

```ts
  async syncCatalog(supplierId: number): Promise<SyncCatalogResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();
    if (integration.status !== 'Connected') throw new CjConnectionNotReadyError();

    const items: CjCatalogItemUpsertInput[] = [];
    let itemsFailed = 0;
    let failedItemSequence = 0;
    const now = new Date();

    // CJ's listV2 is page-number based (page/size), not a nextPageToken cursor
    // — bounded both by the response's own totalPages AND the MAX_SYNC_PAGES
    // safety cap (a totalPages that's wildly wrong shouldn't loop forever).
    let page = 1;
    let totalPages = 1;
    do {
      let listPage;
      try {
        listPage = await this.cjClient.fetchCatalog(page, CATALOG_PAGE_SIZE);
      } catch (err) {
        logger.error('CJ Dropshipping catalog fetch failed', { ... });
        throw new CjApiUnavailableError();
      }
      totalPages = listPage.totalPages || 1;

      const products = listPage.content.flatMap((entry) => entry.productList);
      for (const product of products) {
        /* ...fetchVariants + item-building loop, unchanged, lines 78-160... */
      }

      page += 1;
      if (page > MAX_SYNC_PAGES && page <= totalPages) {
        logger.warn('CJ Dropshipping catalog sync capped at MAX_SYNC_PAGES', { ... });
        break;
      }
    } while (page <= totalPages);

    const { upserted } = await this.catalogRepo.upsertMany(integration.id, items);
    await this.integrationRepo.updateLastSyncedAt(integration.id, now);

    return { itemsUpserted: upserted - itemsFailed, itemsFailed, syncedAt: now };
  }
```

**New code** — replace the pagination-control block (the `let page = 1; ... } while
(page <= totalPages);` section, i.e. lines 58-171) and the two persistence calls
(lines 173-174):

```ts
    const cursorPage = integration.catalogSyncCursorPage ?? 0;
    const startPage = cursorPage + 1;
    const endPage = startPage + this.maxSyncPages - 1;

    // CJ's listV2 is page-number based (page/size), not a nextPageToken cursor.
    // Each run processes a *window* of `this.maxSyncPages` pages starting right
    // after the last page this connection finished (design.md D1) — not
    // "pages 1..N from the start" like the old always-restart-at-page-1 code.
    let page = startPage;
    let totalPages = 1;
    let lastPageProcessed = cursorPage;

    while (page <= endPage) {
      let listPage;
      try {
        listPage = await this.cjClient.fetchCatalog(page, this.catalogPageSize);
      } catch (err) {
        logger.error('CJ Dropshipping catalog fetch failed', {
          supplierId,
          status: err instanceof CjApiError ? err.status : undefined,
        });
        throw new CjApiUnavailableError();
      }
      totalPages = listPage.totalPages || 1;

      if (page > totalPages) {
        // This run's window starts at or advances past the end of the
        // catalog (normal at the tail of a pass, or if totalPages shrank
        // since the last run) — nothing to process on this page, stop here.
        break;
      }

      const products = listPage.content.flatMap((entry) => entry.productList);
      for (const product of products) {
        /* ...fetchVariants + item-building loop, UNCHANGED, same as current
           lines 78-160 verbatim... */
      }

      lastPageProcessed = page;
      page += 1;
    }

    const wrapped = lastPageProcessed >= totalPages;
    const newCursorPage = wrapped ? 0 : lastPageProcessed;

    logger.info('CJ Dropshipping catalog sync window complete', {
      supplierId,
      startPage,
      lastPageProcessed,
      totalPages,
      wrapped,
    });

    const { upserted } = await this.catalogRepo.upsertMany(integration.id, items);
    await this.integrationRepo.updateCatalogSyncCursor(integration.id, {
      cursorPage: newCursorPage,
      totalPages,
      ...(wrapped && { wrappedAt: now }),
    });
    await this.integrationRepo.updateLastSyncedAt(integration.id, now);

    return { itemsUpserted: upserted - itemsFailed, itemsFailed, syncedAt: now };
```

Notes on this rewrite:

- The old `logger.warn('... capped at MAX_SYNC_PAGES ...')` is **removed** — hitting the
  window boundary is now the designed, expected behavior every run, not an emergency
  cap worth warning about. Replaced with an `logger.info` for per-run observability
  (start/end page, wrap flag) — useful for verifying task 11.1/11.7's "did it advance"
  checks in production without a DB query.
- **On `updateLastSyncedAt` vs. "same call" wording:** design.md/tasks.md 3.3 says
  "Persist `catalogSyncTotalPages` and `lastSyncedAt` together with the cursor update in
  the same call," but the task-2.1-specified `updateCatalogSyncCursor` signature (given
  verbatim in both tasks.md and this session's brief) is
  `(id, { cursorPage, totalPages, wrappedAt? })` — no `lastSyncedAt` param. Rather than
  widen that signature (which would deviate from the explicitly-specified contract), this
  plan keeps `updateLastSyncedAt` as a second, immediately-following call in the same
  method body — "same call" read as "same code path/step," not literally one SQL
  statement. Both calls target the same row and run sequentially with no intervening
  awaits that could interleave with a concurrent sync of the *same* supplier (there is no
  broader transaction wrapping either today). If atomicity across both columns turns out
  to matter later, fold `lastSyncedAt` into `updateCatalogSyncCursor`'s `data` object
  instead — flagging this as a judgment call, not a hard blocker.
- `wrapped = lastPageProcessed >= totalPages` reads as "reached or passed the last page,"
  matching spec.md's "reaches or exceeds" wording exactly.
- Zero-iteration edge case: if `startPage` is already past `totalPages` on the very
  first fetch (e.g. the upstream catalog shrank since the last run), the loop breaks
  immediately with `lastPageProcessed` still equal to the *old* `cursorPage`; `wrapped`
  then evaluates against the old cursor vs. the fresh (smaller) `totalPages`, self-
  correcting into a wrap on the very next check — consistent with D1's accepted
  page-drift trade-off philosophy (no special-case code needed).

### 3.4 Test cases — `backend/src/application/services/__tests__/cjCatalogSyncService.test.ts`

Existing tests (lines 51-230, full file read) construct integrations via
`makeIntegration()` (`new SupplierIntegration({ id: 1, supplierId: 10, status })`,
no cursor override) — with §2.3's domain-model default (`catalogSyncCursorPage: 0`),
these are unaffected: `startPage` still resolves to `1`. **Every existing test in this
file should keep passing unchanged** given the refactor above. Confirm this by running
the suite before writing new cases (do not assume).

New cases to add inside `describe('syncCatalog', ...)`:

1. `should_start_pagination_at_cursorPage_plus_one_when_a_non_zero_cursor_exists` —
   `integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 10, status: 'Connected', catalogSyncCursorPage: 5 }))`;
   mock a single-page `fetchCatalog` response with `totalPages: 20`; assert
   `cjClient.fetchCatalog` was called with `(6, expect.any(Number))` (first arg, not
   `1`).
2. `should_wrap_around_and_reset_cursor_to_zero_when_the_window_reaches_totalPages_exactly` —
   cursor `0`, mock `fetchCatalog` to return `totalPages: 1` on page 1 (default
   `maxSyncPages` of 500 comfortably covers this — no env override needed since the
   *catalog's own* `totalPages` ends the window here, not the page cap); assert
   `integrationRepo.updateCatalogSyncCursor` called with
   `{ cursorPage: 0, totalPages: 1, wrappedAt: expect.any(Date) }`.
3. `should_wrap_around_when_the_configured_window_overshoots_totalPages` — construct the
   service with `process.env.CJ_SYNC_MAX_PAGES = '5'` set **before** calling
   `new CjCatalogSyncService(...)` in this test body (per §3.0's refactor — don't rely
   on the `beforeEach`-constructed `service`, build a fresh one here); mock `totalPages:
   2` (smaller than the 5-page window); assert `updateCatalogSyncCursor` called with
   `{ cursorPage: 0, totalPages: 2, wrappedAt: expect.any(Date) }` and that
   `fetchCatalog` was called only twice (page 1, page 2), not five times — confirms the
   early-break-on-`page > totalPages` path, not a full 5-page loop.
   Remember to `delete process.env.CJ_SYNC_MAX_PAGES;` in an `afterEach` (or wrap in
   try/finally) so this doesn't leak into other test files run in the same worker.
4. `should_persist_the_window_end_page_as_the_new_cursor_without_wrapping_when_totalPages_is_larger` —
   set `process.env.CJ_SYNC_MAX_PAGES = '2'` before constructing the service; cursor
   `0`; mock `fetchCatalog` to return `totalPages: 20` on both requested pages (1 and 2);
   assert `fetchCatalog` called exactly twice (pages 1, 2) and
   `updateCatalogSyncCursor` called with `{ cursorPage: 2, totalPages: 20 }` **and no
   `wrappedAt` key present** (assert on the full `data`/call-args shape, not just a
   `.not.toBeCalledWith(expect.objectContaining({wrappedAt: ...}))`, to catch an
   accidental always-included key).
5. Update the existing `should_paginate_across_multiple_pages_using_page_numbers` test
   (lines 143-168) — no changes needed to its assertions, but re-verify it still passes
   given cursor starts at 0 → page 1 (unchanged).
6. Confirm `should_call_upsertMany_again_on_a_second_run_idempotently` (lines 97-107)
   still passes unchanged — the mocked `integrationRepo.findBySupplierId` returns the
   **same** integration instance across both calls (`mockResolvedValue`, not
   `mockResolvedValueOnce` twice), so both runs see `catalogSyncCursorPage: 0` (the
   service never mutates the fetched integration object in place — it only computes and
   persists a new value via the repository) — this test only asserts call count, so it's
   unaffected either way.

---

## 4. `cjTypes.ts` DTO extensions — confirmed purely additive

**File:** `backend/src/infrastructure/external/cjTypes.ts` (119 lines, full file read)

**Exact diff:**

```diff
 export interface CjProductDto {
   id: string; // CJ's `pid`
   nameEn: string;
   sku: string;
   sellPrice: number;
   categoryId: string;
   warehouseInventoryNum?: number;
+  bigImage?: string;
 }

 export interface CjVariantDto {
   vid: string;
   pid: string;
   variantSku: string;
   variantProperty?: string; // JSON-encoded array of { key, value } attribute pairs
   variantWeight?: number;
   variantSellPrice: number;
   inventoryNum?: number;
+  variantImage?: string;
 }
```

**Confirmed: no `cjClient.ts` changes needed.** Read the full file
(`backend/src/infrastructure/external/cjClient.ts`, 227 lines). Every CJ call goes
through the generic `requestWithRetry<T>(path, init)` (lines 116-162), which does:

```ts
const body = (await response.json().catch(() => null)) as CjEnvelope<T> | null;
...
if (body && body.success === true) {
  ...
  return body.data;
}
```

`response.json()` parses the full upstream payload; `body.data` is returned **as-is** —
there is no field allow-listing, no `pick()`/destructuring/mapping step anywhere that
would strip unlisted keys. `fetchCatalog`/`fetchVariants` (lines 180-190) simply call
`requestWithRetry<CjListV2Response>`/`requestWithRetry<CjVariantDto[]>` and return the
result directly. TypeScript interfaces are compile-time-only and erased at runtime —
`bigImage`/`variantImage` were already present in the real JSON object flowing through
this code path before this change (confirmed live in production per the context
session); adding them to the DTO only makes them **visible to TypeScript** (e.g. for a
future `product.bigImage` access without a cast), it changes zero runtime behavior.
`cjCatalogSyncService.ts`'s `rawPayload: { product, variant }` (lines 97, 137, 153)
already captures the full raw objects regardless of what's declared on the DTO, which is
exactly why `extractCjImages` (task 5) reads from `rawPayload`, not from these typed
DTO fields.

### 4.2 `backend/src/infrastructure/external/__tests__/cjClient.test.ts`

Run as-is after the diff — expect no failures (additive optional fields on an
interface used only for typing responses that are never destructured/validated
field-by-field in this file). If any test does an exact-shape assertion like
`toEqual({ id: ..., nameEn: ..., ... })` against a full `CjProductDto` object without
`bigImage`, that would still pass (`toEqual` treats a missing optional key the same as
`undefined`); only worth double-checking if a test uses `toMatchObject` combined with a
literal object *type* check, which doesn't apply here since Jest matchers work on values,
not compile-time types.

---

## 5. New: `backend/src/application/services/cjImageExtraction.ts`

Brand-new file. Exports:

```ts
export interface ExtractedCjImages {
  productImage?: string;
  variantImage?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Derives display images from a CjCatalogItem's stored rawPayload
// ({ product, variant } — see cjCatalogSyncService.ts's item-building loop).
// Defensive by construction: every step is a typeof/Array.isArray guard, no
// JSON.parse or external call is involved, so this cannot throw — the
// try/catch below is redundant belt-and-suspenders in case rawPayload's
// actual runtime shape ever surprises this (e.g. a future Prisma/JSON
// change), matching this file's neighboring parseSizeColor()'s defensive
// style (cjCatalogSyncService.ts:28-39).
export function extractCjImages(rawPayload: unknown): ExtractedCjImages {
  try {
    if (!isRecord(rawPayload)) return {};

    const result: ExtractedCjImages = {};

    const product = rawPayload['product'];
    if (isRecord(product) && isNonEmptyString(product['bigImage'])) {
      result.productImage = product['bigImage'];
    }

    const variant = rawPayload['variant'];
    if (isRecord(variant) && isNonEmptyString(variant['variantImage'])) {
      result.variantImage = variant['variantImage'];
    }

    return result;
  } catch {
    return {};
  }
}
```

### 5.2 Tests — `backend/src/application/services/__tests__/cjImageExtraction.test.ts` (new file)

1. `should_return_both_images_when_present_and_valid` —
   `extractCjImages({ product: { bigImage: 'https://a/p.jpg' }, variant: { variantImage: 'https://a/v.jpg' } })`
   → `{ productImage: 'https://a/p.jpg', variantImage: 'https://a/v.jpg' }`.
2. `should_return_only_productImage_when_variant_is_missing`.
3. `should_return_only_variantImage_when_product_is_missing`.
4. `should_return_empty_object_when_rawPayload_is_not_an_object` — parametrize over
   `null`, `undefined`, `'a string'`, `42`, `[1, 2]` (array excluded by `isRecord`).
5. `should_return_empty_object_when_product_and_variant_keys_are_both_absent` —
   `extractCjImages({})`.
6. `should_ignore_non_string_bigImage_or_variantImage` — e.g.
   `{ product: { bigImage: 12345 } }`, `{ product: { bigImage: null } }`,
   `{ product: { bigImage: {} } }`.
7. `should_ignore_empty_or_whitespace_only_image_urls` —
   `{ product: { bigImage: '' } }`, `{ product: { bigImage: '   ' } }`.
8. `should_ignore_a_non_object_product_or_variant_value` —
   `{ product: 'not-an-object', variant: ['a'] }` → `{}`.
9. `should_never_throw_for_a_deeply_malformed_shape` — e.g. `extractCjImages(() => {})`,
   `extractCjImages(Symbol('x'))` — assert no throw and result is `{}`.

---

## 6. `promote()` image capture wiring

### 6.1 New shared write-helper module: `backend/src/application/services/cjProductImageSync.ts`

New file (separate from `cjImageExtraction.ts`, which design.md scopes specifically to
the *extraction* function — this second module owns the *write* side, reusable by both
`promote()` and the backfill script per task 8):

```ts
import { Prisma } from '@prisma/client';

// Accepts either `tx` (inside prisma.$transaction) or the top-level `prisma`
// singleton — both structurally satisfy Prisma.TransactionClient (PrismaClient
// is a strict superset adding $connect/$disconnect/$transaction/etc., which
// aren't used here). Same typing convention already used for
// supplierFeedImporter.ts's cleanLocalCatalog/importSupplierFeedProducts and
// refundService.ts/reviewService.ts/shipmentService.ts's tx callbacks.
export async function setProductMainImage(
  client: Prisma.TransactionClient,
  productId: number,
  imageUrl: string
): Promise<void> {
  await client.product.update({ where: { id: productId }, data: { mainImageUrl: imageUrl } });
}

export async function createProductImageRecord(
  client: Prisma.TransactionClient,
  data: { productId: number; url: string; altText: string; sortOrder: number }
): Promise<void> {
  await client.productImage.create({ data });
}
```

Kept as two small named functions rather than one combined "create everything" function
— `promote()`'s new-product branch needs `setProductMainImage` + `createProductImageRecord(sortOrder:
0)` together, but the per-variant branch (and the backfill script's per-variant pass)
only ever needs `createProductImageRecord` alone. This deliberately bypasses
`IProductImageRepository`/`ProductImageRepository` (task's established precedent: this
file's `$transaction` already bypasses repositories for `tx.product.create`/
`tx.productVariant.create` — see design.md D4 and the context session's explicit
instruction not to introduce a repository call mid-transaction).

### 6.2 `cjCatalogPromotionService.ts` changes

**File:** `backend/src/application/services/cjCatalogPromotionService.ts` (295 lines,
full file read).

Add imports near the top (after line 16):

```ts
import { extractCjImages } from './cjImageExtraction';
import { setProductMainImage, createProductImageRecord } from './cjProductImageSync';
```

**Current transaction block, lines 172-226:**

```ts
    if (groups.size > 0) {
      await prisma.$transaction(async (tx) => {
        for (const group of groups.values()) {
          let productId = group.existingProductId;
          const variantIds: number[] = [];

          if (productId === null) {
            const title = group.items[0]!.catalogItem.title;
            const slug = await this.productService.resolveUniqueSlug(title);
            const productStatus = input.activate ? 'Active' : 'Draft';
            const createdProduct = await tx.product.create({
              data: { name: title, slug, status: productStatus, categoryId },
            });
            productId = createdProduct.id;
          }

          for (const groupItem of group.items) {
            const resolvedPrice = resolvedPrices.get(groupItem.cjCatalogItemId)!;
            const sku = `CJ-${groupItem.catalogItem.externalRef}`;
            const createdVariant = await tx.productVariant.create({
              data: { /* ... unchanged ... */ },
            });
            variantIds.push(createdVariant.id);
            variantsResult.push({ /* ... unchanged ... */ });
          }

          productsResult.push({ productId, variantIds });
        }
      });
    }
```

**New version** (only the additions are new; everything else is byte-identical to
today):

```ts
    if (groups.size > 0) {
      await prisma.$transaction(async (tx) => {
        for (const group of groups.values()) {
          const isNewProduct = group.existingProductId === null;
          let productId = group.existingProductId;
          const variantIds: number[] = [];

          let productMainImageUrl: string | undefined;
          let nextImageSortOrder = 0;

          if (productId === null) {
            const title = group.items[0]!.catalogItem.title;
            const slug = await this.productService.resolveUniqueSlug(title);
            const productStatus = input.activate ? 'Active' : 'Draft';
            const createdProduct = await tx.product.create({
              data: { name: title, slug, status: productStatus, categoryId },
            });
            productId = createdProduct.id;

            const { productImage } = extractCjImages(group.items[0]!.catalogItem.rawPayload);
            if (productImage) {
              await setProductMainImage(tx, productId, productImage);
              await createProductImageRecord(tx, {
                productId,
                url: productImage,
                altText: title,
                sortOrder: 0,
              });
              productMainImageUrl = productImage;
              nextImageSortOrder = 1;
            }
          }

          for (const groupItem of group.items) {
            const resolvedPrice = resolvedPrices.get(groupItem.cjCatalogItemId)!;
            const sku = `CJ-${groupItem.catalogItem.externalRef}`;
            const createdVariant = await tx.productVariant.create({
              data: { /* ... unchanged ... */ },
            });
            variantIds.push(createdVariant.id);
            variantsResult.push({ /* ... unchanged ... */ });

            if (isNewProduct) {
              const { variantImage } = extractCjImages(groupItem.catalogItem.rawPayload);
              if (variantImage && variantImage !== productMainImageUrl) {
                await createProductImageRecord(tx, {
                  productId: productId!,
                  url: variantImage,
                  altText: groupItem.catalogItem.title,
                  sortOrder: nextImageSortOrder,
                });
                nextImageSortOrder += 1;
              }
            }
          }

          productsResult.push({ productId, variantIds });
        }
      });
    }
```

`sortOrder` increments correctly across multiple variants in the same pid group because
`nextImageSortOrder` is declared once per group (outside the variant loop) and only
mutated after an image row is actually created — `0` is reserved for the product's main
image (only consumed if `productImage` was present), variant images consume `1, 2, 3, ...`
in item-processing order.

**FLAGGED GAP — scope decision on the "joining an existing product" branch:**
`isNewProduct` is `false` whenever `group.existingProductId !== null` (a pid group where
some sibling variant was already promoted in a prior request, and this request adds a
*new* sibling variant to it — this exact shape is exercised by the existing test
`should_join_the_existing_product_when_a_mixed_group_has_one_already_promoted_and_one_
already_new_item`, `cjCatalogPromotionService.test.ts:263-290`). This plan **does not**
attempt image capture for new variants joining an already-existing product, even though
spec.md's "Variant-specific images are captured when they differ from the product's
main image" requirement doesn't textually exclude this case. Rationale:

- Doing it properly requires reading the existing product's current `mainImageUrl` via
  an extra `tx.product.findUnique(...)` call (there's no in-memory value for it, unlike
  the brand-new-product branch where we just derived it) **and** seeding
  `nextImageSortOrder` from `tx.productImage.count({ where: { productId } })` to avoid
  colliding `sortOrder` values with images that product may already have.
- Adding those two extra `tx.*` calls, unconditionally, on every "join an existing
  product" group, means the shared `mockTransaction`'s `tx` fixture in the *existing*
  test file (`cjCatalogPromotionService.test.ts:16-22`, currently only stubbing
  `product.create` and `productVariant.create`) would need `product.findUnique` and
  `productImage.count` added too, **and** the existing
  `should_join_the_existing_product_when_a_mixed_group_...` test would need new mock
  setup (`tx.product.findUnique.mockResolvedValue(...)`,
  `tx.productImage.count.mockResolvedValue(...)`) or it throws a "not a function" error
  at runtime the moment this code path executes.
- design.md D4's own wording frames image derivation specifically as happening "on
  `Product` creation (`productId === null` branch)" — supporting the narrower reading.
- This is a genuinely rare shape in practice (a partial promotion followed later by a
  second promotion request adding a sibling color/size variant with a *different*
  photo than what was already captured) and is not covered by any spec.md scenario
  explicitly.

**Recommendation:** ship the narrower `isNewProduct`-gated version above for this
change; if the wider case turns out to matter, it's a small, isolable follow-up (add the
`tx.product.findUnique`/`tx.productImage.count` calls + extend the shared `tx` mock +
one new test) rather than something to speculatively build and test now. Flag this
explicitly to the user/parent agent as a deliberate scope cut, not an oversight.

**Confirmed untouched — the `alreadyLinked` re-promotion loop, lines 228-236:**

```ts
    for (const [cjCatalogItemId, linked] of alreadyLinked) {
      variantsResult.push({
        cjCatalogItemId,
        productId: linked.productId,
        productVariantId: linked.variantId,
        sku: linked.sku,
        wasAlreadyPromoted: true,
      });
    }
```

This loop runs entirely outside `prisma.$transaction` and never touches
`extractCjImages`/`setProductMainImage`/`createProductImageRecord` — re-promoting an
already-linked item can never create a duplicate `ProductImage` row, by construction
(there is no code path from this loop into the transaction).

### 6.3-6.5 (graceful degradation / idempotency / no-supplier-cost-leak)

All three already fall out of the design above:
- No image data → `extractCjImages` returns `{}` → both `if` guards are false → zero
  `ProductImage` rows, `Product`/`ProductVariant` creation proceeds normally (no early
  return, no thrown error).
- Re-promotion → covered above (structurally impossible to reach the image code).
- No supplier-cost leak → `createProductImageRecord`'s `data` object only ever contains
  `productId`/`url`/`altText`/`sortOrder`; `setProductMainImage`'s `data` only contains
  `mainImageUrl`. Neither function's signature has any parameter through which
  `supplierCost`/`CjCatalogItem` internal fields could flow in even by mistake — this is
  enforced by the helper's type signature, not just by care at the call site.

### 6.6 Test file changes — `backend/src/application/services/__tests__/cjCatalogPromotionService.test.ts`

**Required change to the shared transaction mock** (currently lines 14-28):

```ts
const mockProductCreate = jest.fn();
const mockVariantCreate = jest.fn();
const mockTransaction = jest.fn(async (cb: (tx: unknown) => unknown) => {
  const tx = {
    product: { create: mockProductCreate },
    productVariant: { create: mockVariantCreate },
  };
  return cb(tx);
});
```

becomes:

```ts
const mockProductCreate = jest.fn();
const mockProductUpdate = jest.fn();
const mockVariantCreate = jest.fn();
const mockProductImageCreate = jest.fn();
const mockTransaction = jest.fn(async (cb: (tx: unknown) => unknown) => {
  const tx = {
    product: { create: mockProductCreate, update: mockProductUpdate },
    productVariant: { create: mockVariantCreate },
    productImage: { create: mockProductImageCreate },
  };
  return cb(tx);
});
```

Add `mockProductUpdate.mockResolvedValue({})` / `mockProductImageCreate.mockResolvedValue({})`
alongside the existing `jest.clearAllMocks()` in `beforeEach` (or per-test as needed).
Because `isNewProduct`-gated calls only fire when `extractCjImages` finds an image, and
every *existing* test's `buildCatalogItem()` defaults `rawPayload: {}` (line 42) →
`extractCjImages({})` → `{}` → both new `if` guards false → **no existing test triggers
`mockProductUpdate`/`mockProductImageCreate` at all**, so no existing assertions need to
change, only the mock *fixture* needs the two new stub methods added (so calling them
doesn't throw "not a function" if a new test's data happens to route through a shared
group differently than expected).

**New test cases** (inside `describe('promote', ...)`):

1. `should_set_mainImageUrl_and_create_a_sortOrder_zero_image_when_a_new_product_has_a_product_image` —
   `buildCatalogItem({ rawPayload: { product: { bigImage: 'https://img/p.jpg' }, variant: {} } })`;
   assert `mockProductUpdate` called with
   `{ where: { id: 20 }, data: { mainImageUrl: 'https://img/p.jpg' } }`; assert
   `mockProductImageCreate` called with
   `{ data: { productId: 20, url: 'https://img/p.jpg', altText: 'Test Dress', sortOrder: 0 } }`.
2. `should_create_an_additional_image_for_a_variant_whose_image_differs_from_the_product_image` —
   two items sharing a pid, item 1's `rawPayload.product.bigImage = 'A'`
   (drives the product's main image), item 2's `rawPayload.variant.variantImage = 'B'`
   (`'B' !== 'A'`); assert `mockProductImageCreate` called twice total: once with
   `sortOrder: 0` (product image) and once with `sortOrder: 1` for item 2's variant
   image; assert it was **not** called a third time for item 1 (no `variantImage` on
   its own `rawPayload.variant`).
3. `should_not_duplicate_the_image_when_the_variant_image_exactly_matches_the_product_image` —
   `rawPayload.product.bigImage = 'A'`, `rawPayload.variant.variantImage = 'A'` (same
   string) on the same item; assert `mockProductImageCreate` called exactly once
   (`sortOrder: 0`, the product image) — never a second time for the identical variant
   image.
4. `should_create_no_images_when_no_image_data_is_present` — default
   `buildCatalogItem()` (`rawPayload: {}`); assert `mockProductUpdate` and
   `mockProductImageCreate` are never called; assert promotion still resolves with
   `createdAny: true` (mirrors the existing first test's success-path assertions).
5. Extend the existing `should_be_idempotent_when_item_is_already_promoted` test
   (lines 247-261) with additional assertions:
   `expect(mockProductUpdate).not.toHaveBeenCalled(); expect(mockProductImageCreate).not.toHaveBeenCalled();`
   — makes task 6.4's idempotency requirement an explicit, checked assertion rather than
   an implicit side effect of `mockTransaction` not being called at all (which the test
   already asserts via `expect(mockTransaction).not.toHaveBeenCalled()` — wait, verify:
   actually for this specific test, `groups.size === 0` since the only item is already
   linked, so the `if (groups.size > 0)` guard means `prisma.$transaction` is never
   invoked at all — `mockProductUpdate`/`mockProductImageCreate` are trivially never
   called since the whole transaction callback never runs; still worth the explicit
   assertion for readability/documentation of the guarantee under test).
6. `should_not_attempt_image_capture_when_a_new_variant_joins_an_already_existing_product_group` —
   extends `should_join_the_existing_product_when_a_mixed_group_has_one_already_promoted_and_one_new_item`
   (lines 263-290) with `item2`'s `rawPayload` containing a `variantImage` (to prove the
   scope-cut in §6.2's flagged gap is real, not accidental): assert
   `mockProductImageCreate` is **not** called even though `item2`'s `rawPayload` has a
   `variantImage` present, because `isNewProduct` is `false` for this group. Document
   in a comment that this is the intentional scope cut from the plan, not a missed case.
7. `should_never_copy_supplierCost_into_any_public_facing_field` — regression assertion:
   after a successful promote with image data present, assert
   `expect(mockProductUpdate.mock.calls[0][0].data).not.toHaveProperty('supplierCost')`
   and same for `mockProductImageCreate.mock.calls` — cheap, explicit re-verification of
   the standing business rule per design.md/spec.md's "Only public-safe data is copied"
   requirement.

---

## 7. `backend/serverless.yml` — production defaults

**Exact current lines (37-47, full context read):**

```yaml
    # Caps supplierAutoProvision's per-run catalog sync so one invocation
    # finishes well within the Lambda's 900s timeout instead of syncing the
    # entire (very large) CJ catalog in one run. syncCatalog makes one
    # fetchVariants call PER PRODUCT on every page (not just one call per
    # page), so both page count AND page size must stay small — at the
    # observed ~1 call/sec effective throughput, unbounded defaults
    # (500 pages x 100/page) cannot complete within 900s. Sync is
    # incremental across daily runs by design — this does not need to be
    # unbounded.
    CJ_SYNC_MAX_PAGES: ${ssm:/ecommerce/prod/CJ_SYNC_MAX_PAGES, '5'}
    CJ_CATALOG_PAGE_SIZE: ${ssm:/ecommerce/prod/CJ_CATALOG_PAGE_SIZE, '20'}
```

**Exact diff (task 7.1 — the two default values):**

```diff
-    CJ_SYNC_MAX_PAGES: ${ssm:/ecommerce/prod/CJ_SYNC_MAX_PAGES, '5'}
-    CJ_CATALOG_PAGE_SIZE: ${ssm:/ecommerce/prod/CJ_CATALOG_PAGE_SIZE, '20'}
+    CJ_SYNC_MAX_PAGES: ${ssm:/ecommerce/prod/CJ_SYNC_MAX_PAGES, '3'}
+    CJ_CATALOG_PAGE_SIZE: ${ssm:/ecommerce/prod/CJ_CATALOG_PAGE_SIZE, '100'}
```

Still SSM-overridable without a redeploy (unchanged mechanism — only the literal
fallback default changes), per design.md D2's recommended values (300 products/run,
~442s estimated, ~49% of the 900s timeout).

**Recommended companion edit (not strictly required by task 7.1, but the adjacent
comment block is now factually stale and should not ship pointing at outdated
reasoning):** update the comment above these two lines to reflect the now-documented
`calls = pages × (1 + pageSize)` cost model (design.md D2) instead of the old
"500 pages x 100/page" framing, e.g.:

```yaml
    # Bounds supplierAutoProvision's per-run catalog sync window (design.md D2
    # in openspec/changes/cj-catalog-cursor-and-media). Cost is
    # calls = pages * (1 + pageSize) — one fetchCatalog call per page PLUS one
    # fetchVariants call per product — so both page count AND page size drive
    # runtime. At ~1.46s/product observed in production, 3 pages x 100/page
    # (300 products/run) completes in ~442s, comfortably under the 900s Lambda
    # timeout. syncCatalog now advances via a persisted per-connection cursor
    # (SupplierIntegration.catalogSyncCursorPage) rather than always restarting
    # at page 1, wrapping back to page 1 once the catalog end is reached.
    CJ_SYNC_MAX_PAGES: ${ssm:/ecommerce/prod/CJ_SYNC_MAX_PAGES, '3'}
    CJ_CATALOG_PAGE_SIZE: ${ssm:/ecommerce/prod/CJ_CATALOG_PAGE_SIZE, '100'}
```

(Task 7.2 — updating `.env.example`/`.env.docker` comments similarly — is in tasks.md
group 7 but not explicitly requested for this plan's groups 1-8 focus per the parent
prompt; flagging it here for completeness since it's the same rationale change, but
leaving it to whoever executes task 7.2 directly.)

---

## 8. New script: `backend/scripts/backfillCjProductImages.ts`

### 8.0 Structural constraint (flagged gap): `backend/scripts/` is outside Jest's `roots`

`backend/jest.config.js` sets `roots: ['<rootDir>/src']` — Jest never looks inside
`backend/scripts/` for test files, and none of the existing scripts there
(`backfillProductTranslations.ts`, `verify-supplier-orders-api.js`) have any unit tests
today. Task 8.2 asks for a unit-testable extraction of the backfill's core logic — this
is only achievable by putting the actual logic under `src/` (where Jest can see it) and
leaving `backend/scripts/backfillCjProductImages.ts` itself as a thin, untested
entry-point wrapper (consistent with how `src/lambda.ts`/`src/index.ts` are excluded
from `collectCoverageFrom` in `jest.config.js` — thin wrappers around tested logic are
this codebase's existing convention for "not directly unit-tested entry points").

### 8.1 New module: `backend/src/application/services/cjProductImageBackfill.ts`

```ts
import { Prisma } from '@prisma/client';
import { extractCjImages } from './cjImageExtraction';
import { setProductMainImage, createProductImageRecord } from './cjProductImageSync';

export interface EligibleVariantRow {
  productId: number;
  rawPayload: unknown;
  title: string;
}

export interface BackfillCandidate {
  productId: number;
  variants: EligibleVariantRow[];
}

export interface BackfillResult {
  imaged: boolean;
}

// Pure grouping — no I/O — fully unit-testable with hand-built fixtures.
export function groupVariantsByProduct(rows: EligibleVariantRow[]): BackfillCandidate[] {
  const byProduct = new Map<number, EligibleVariantRow[]>();
  for (const row of rows) {
    const list = byProduct.get(row.productId) ?? [];
    list.push(row);
    byProduct.set(row.productId, list);
  }
  return Array.from(byProduct.entries()).map(([productId, variants]) => ({ productId, variants }));
}

// Mirrors promote()'s new-product image logic (cjCatalogPromotionService.ts),
// applied to a product that already exists. First variant in the group
// (query orders by variant id ascending — see the script) supplies the
// product-level image; every variant's own image is captured too if present
// and different from the product's.
export async function backfillProductImages(
  client: Prisma.TransactionClient,
  candidate: BackfillCandidate
): Promise<BackfillResult> {
  const [first, ...rest] = candidate.variants;
  if (!first) return { imaged: false };

  let productMainImageUrl: string | undefined;
  let nextSortOrder = 0;
  let imaged = false;

  const { productImage: firstProductImage, variantImage: firstVariantImage } = extractCjImages(first.rawPayload);
  if (firstProductImage) {
    await setProductMainImage(client, candidate.productId, firstProductImage);
    await createProductImageRecord(client, {
      productId: candidate.productId,
      url: firstProductImage,
      altText: first.title,
      sortOrder: nextSortOrder,
    });
    productMainImageUrl = firstProductImage;
    nextSortOrder += 1;
    imaged = true;
  }
  if (firstVariantImage && firstVariantImage !== productMainImageUrl) {
    await createProductImageRecord(client, {
      productId: candidate.productId,
      url: firstVariantImage,
      altText: first.title,
      sortOrder: nextSortOrder,
    });
    nextSortOrder += 1;
    imaged = true;
  }

  for (const variant of rest) {
    const { variantImage } = extractCjImages(variant.rawPayload);
    if (variantImage && variantImage !== productMainImageUrl) {
      await createProductImageRecord(client, {
        productId: candidate.productId,
        url: variantImage,
        altText: variant.title,
        sortOrder: nextSortOrder,
      });
      nextSortOrder += 1;
      imaged = true;
    }
  }

  return { imaged };
}
```

### 8.2 Tests — `backend/src/application/services/__tests__/cjProductImageBackfill.test.ts` (new file)

For `groupVariantsByProduct` (pure function, no mocks needed):
1. `should_group_multiple_rows_sharing_the_same_productId_into_one_candidate`.
2. `should_keep_distinct_productIds_as_separate_candidates`.
3. `should_return_an_empty_array_for_empty_input`.

For `backfillProductImages` (mock `client` the same way
`cjCatalogPromotionService.test.ts` mocks `tx` — a plain object with jest.fn()s for
`product.update`/`productImage.create`):
4. `should_backfill_the_main_image_from_the_first_variants_rawPayload_and_report_imaged_true`.
5. `should_backfill_a_distinct_variant_image_for_a_second_variant_in_the_group`.
6. `should_not_duplicate_when_a_variants_image_matches_the_product_image`.
7. `should_report_imaged_false_and_write_nothing_when_no_candidate_has_any_image_data`.
8. `should_return_imaged_false_for_an_empty_variants_array` (defensive — `groupVariantsByProduct`
   should never actually produce this, but keep the function safe standalone).

Note: "already-imaged products are skipped (idempotent re-run)" (tasks.md 8.2's third
bullet) is enforced by the **query** (§8.3 below), not by `backfillProductImages`
itself — that guarantee is validated at the integration/manual-testing level (task
11.6), not unit-testable without a real DB unless the query's `where` clause is
asserted via a mocked `prisma.productVariant.findMany` call-args check in the script's
own (thin, untested-by-design per §8.0) wrapper. If stronger unit coverage of the query
shape is wanted, it's straightforward to add one more test asserting
`prisma.productVariant.findMany` was called with the exact `where` object below by
mocking `../../infrastructure/prismaClient` the same way
`cjCatalogPromotionService.test.ts` does — flagging as optional, not blocking.

### 8.3 Thin script: `backend/scripts/backfillCjProductImages.ts` (new file)

```ts
/**
 * One-off backfill: populates ProductImage/Product.mainImageUrl for products
 * that were promoted from CJ Dropshipping catalog items before image capture
 * existed. Reads already-stored CjCatalogItem.rawPayload — makes zero CJ API
 * calls. Idempotent (already-imaged products are excluded by the query).
 *
 * Run with: npx ts-node --transpile-only scripts/backfillCjProductImages.ts
 * (from backend/, against the target DATABASE_URL)
 */
import { prisma } from '../src/infrastructure/prismaClient';
import {
  groupVariantsByProduct,
  backfillProductImages,
  EligibleVariantRow,
} from '../src/application/services/cjProductImageBackfill';

async function main() {
  const rows = await prisma.productVariant.findMany({
    where: {
      cjCatalogItemId: { not: null },
      product: {
        deletedAt: null,
        mainImageUrl: null,
        images: { none: {} },
      },
    },
    include: {
      cjCatalogItem: { select: { rawPayload: true, title: true } },
    },
    orderBy: { id: 'asc' },
  });

  const eligibleRows: EligibleVariantRow[] = rows
    .filter((r) => r.cjCatalogItem !== null)
    .map((r) => ({
      productId: r.productId,
      rawPayload: r.cjCatalogItem!.rawPayload,
      title: r.cjCatalogItem!.title,
    }));

  const candidates = groupVariantsByProduct(eligibleRows);

  let imaged = 0;
  let noImageAvailable = 0;
  for (const candidate of candidates) {
    const result = await prisma.$transaction((tx) => backfillProductImages(tx, candidate));
    if (result.imaged) {
      imaged += 1;
      console.log(`[backfill-cj-images] imaged product ${candidate.productId}`);
    } else {
      noImageAvailable += 1;
      console.log(`[backfill-cj-images] no image data available for product ${candidate.productId}`);
    }
  }

  console.log(
    `[backfill-cj-images] done. processed=${candidates.length} imaged=${imaged} noImageAvailable=${noImageAvailable}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Notes:
- `product: { images: { none: {} } }` is Prisma's standard "no related rows" filter on
  the `Product.images ProductImage[]` relation (`backend/prisma/schema.prisma:59`).
- `include: { cjCatalogItem: { select: { rawPayload: true, title: true } } }` — since
  `ProductVariant.cjCatalogItem` is optional (`CjCatalogItem?`,
  `backend/prisma/schema.prisma:79-80`), TypeScript sees it as possibly `null`; the
  `.filter((r) => r.cjCatalogItem !== null)` + non-null assertion in the `.map(...)`
  handles that (in practice this should never be null given the `cjCatalogItemId: {
  not: null }` filter on the same row, but Prisma's generated types don't encode that
  correlation, so the filter is a defensive/type-narrowing no-op, not dead code from a
  business-logic standpoint).
- Matches this repo's one existing precedent script's invocation style exactly
  (`backend/scripts/backfillProductTranslations.ts`'s `main().catch(console.error).finally(() =>
  prisma.$disconnect())`), and its `console.log('[backfill-...] ...')` prefixing
  convention.
- Uses the `prisma` singleton from `src/infrastructure/prismaClient.ts` (not a second
  `new PrismaClient()` instance like `backfillProductTranslations.ts` does) — either
  works, but reusing the app's singleton avoids a second connection pool for a script
  that's calling straight into the same application-layer helpers used by `promote()`;
  flag this as a minor deviation from the one existing script's own pattern, done
  deliberately since this script, unlike that one, imports from `src/application/
  services/*` rather than only using the raw Prisma client.

---

## Summary of all files touched (groups 1-8)

**Modified:**
- `backend/prisma/schema.prisma`
- `backend/src/domain/repositories/supplierIntegrationRepository.ts`
- `backend/src/infrastructure/repositories/supplierIntegrationRepository.ts`
- `backend/src/domain/models/supplierIntegration.ts`
- `backend/src/application/services/cjCatalogSyncService.ts`
- `backend/src/infrastructure/external/cjTypes.ts`
- `backend/src/application/services/cjCatalogPromotionService.ts`
- `backend/serverless.yml`
- `backend/src/application/services/__tests__/cjCatalogSyncService.test.ts`
- `backend/src/application/services/__tests__/cjCatalogPromotionService.test.ts`

**New:**
- `backend/prisma/migrations/<timestamp>_add_cj_catalog_sync_cursor/migration.sql` (generated)
- `backend/src/infrastructure/repositories/__tests__/supplierIntegrationRepository.test.ts` (or extended, if it already exists — verify first)
- `backend/src/application/services/cjImageExtraction.ts`
- `backend/src/application/services/__tests__/cjImageExtraction.test.ts`
- `backend/src/application/services/cjProductImageSync.ts`
- `backend/src/application/services/cjProductImageBackfill.ts`
- `backend/src/application/services/__tests__/cjProductImageBackfill.test.ts`
- `backend/scripts/backfillCjProductImages.ts`

**Not touched (confirmed no changes needed):**
- `backend/src/infrastructure/external/cjClient.ts` (see §4)
- `backend/src/application/validator.ts` (no cursor/image-specific error class needed —
  none of the new logic throws a new domain error type; graceful degradation everywhere)
- `backend/src/infrastructure/repositories/productImageRepository.ts` /
  `backend/src/domain/repositories/productRepository.ts`'s `IProductImageRepository` —
  intentionally bypassed inside `promote()`'s transaction and the backfill script, per
  established precedent; read only for the `ProductImageCreateData` shape reference.

## Flagged gaps requiring a decision before/while implementing

1. **§3.0** — `MAX_SYNC_PAGES`/`CATALOG_PAGE_SIZE` must move from module-level consts to
   constructor-read instance fields, or the group-3 wrap-around test matrix cannot be
   written without awkward `jest.resetModules()` gymnastics not used elsewhere in this
   codebase. Recommended and assumed by the test plan above.
2. **§3.3** — `updateCatalogSyncCursor`'s fixed signature (no `lastSyncedAt` param, per
   the explicitly-given task-2.1 contract) means `updateLastSyncedAt` stays a second,
   separate repository call rather than one atomic write — flagged as a judgment call,
   not a blocker.
3. **§6.2** — Deliberate scope cut: image capture does **not** apply to new variants
   joining an already-existing product from a prior partial promotion
   (`group.existingProductId !== null`). Recommended default: skip (matches D4's literal
   "on Product creation" framing, avoids extra `tx.product.findUnique`/
   `tx.productImage.count` calls and the existing test-mock breakage they'd cause). Flag
   to the user/parent agent explicitly — this is a real, spec-ambiguous edge case, not an
   oversight.
4. **§8.0** — `backend/scripts/` sits outside Jest's `roots: ['<rootDir>/src']`; task
   8.2's "testable extraction" requirement is only satisfiable by placing the real logic
   in `src/application/services/cjProductImageBackfill.ts` and keeping the script itself
   a thin, deliberately-untested wrapper (consistent with this repo's existing
   `collectCoverageFrom` exclusions for `src/lambda.ts`/`src/index.ts`).

## Verification commands

```bash
cd backend
npx prisma format && npx prisma migrate dev --name add_cj_catalog_sync_cursor && npx prisma generate
npm run lint
npm test -- --watchAll=false --testPathPattern=cjCatalog
npm test -- --watchAll=false --testPathPattern=supplierIntegrationRepository
npm test -- --watchAll=false --testPathPattern=cjImageExtraction
npm test -- --watchAll=false --testPathPattern=cjProductImageBackfill
npm test -- --watchAll=false
```
