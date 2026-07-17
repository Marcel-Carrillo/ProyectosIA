## Read first (already done for you)

I read `openspec/changes/cj-category-mapping/{proposal,design}.md`, the three delta specs
(`specs/{cj-catalog-promotion,supplier-catalog-auto-provisioning,category-management}/spec.md`),
`tasks.md`, and the CURRENT content of every file the context-session doc flagged as touched by a
prior session (`cjCatalogPromotionService.ts` — has `estimateFreight()` now; `providerRegistry.ts`
— has the current `runPipeline()`/`resolveDefaultCategoryId()`; `categoryRepository.ts`;
`domain/repositories/index.ts`; `validator.ts`; `schema.prisma`). Line numbers/signatures below are
from that current state, not from any older report.

**One correction to design.md/tasks.md before you start section 6**: `validator.ts`'s
`CjPromotionRequestInput.categoryId` is **already optional** (`categoryId?: number`, line 1258) and
`validateCjPromotionData` already treats it as optional (comment at lines 1262-1266 explains why —
it's deliberately validated as "positive integer if present", never required). Task 6 is only a
verification + missing-test-coverage task, not a code change — see the section-6 writeup below.
The actual "categoryId becomes optional" gap is entirely in `cjCatalogPromotionService.promote()`
(line 87: `if (input.categoryId === undefined) throw new CjPromotionCategoryRequiredError();` — this
line unconditionally requires it today and is what section 5 must change).

## Task 1 — Validate the CJ category taxonomy shape (do this first)

I did the investigation the task calls for using CJ's own published docs (WebSearch +
WebFetch against `https://developers.cjdropshipping.cn/en/api/api2/api/product.html`, "1.1
Category List(GET)", `GET /product/getCategory` — the CN mirror of the official CJ developer
portal, same content). This **replaces** the open question in design.md; no live sandbox call was
needed or possible here (no CJ credentials in this dev environment, consistent with
`reports/2026-07-14-step-15-e2e-testing.md` from the prior change).

**Confirmed real response shape** (`data` is the top-level array):

```json
{
  "code": 200, "result": true, "message": "Success",
  "data": [
    {
      "categoryFirstName": "Computer & Office",
      "categoryFirstList": [
        {
          "categorySecondName": "Office Electronics",
          "categorySecondList": [
            { "categoryId": "2252588B-72E3-4397-8C92-7D9967161084", "categoryName": "Office & School Supplies" }
          ]
        }
      ]
    }
  ],
  "requestId": "..."
}
```

Key findings that matter for implementation:
- It's a **fixed 3-level tree**, not uniform recursion: level 1 uses `categoryFirstName`/
  `categoryFirstList`, level 2 uses `categorySecondName`/`categorySecondList`, level 3 (leaf) uses
  `categoryId`/`categoryName` — **different field names per level**, so a truly generic "recurse on
  the same field name at any depth" walker (as design.md Decision 5's prose literally suggests) isn't
  how the real payload is shaped. Write the walker to descend through all three known list field
  names defensively (see Task 4 below) rather than assuming uniform nesting — this still satisfies
  the *spirit* of Decision 5 (don't hardcode "one level down only") without inventing structure that
  doesn't exist.
- **The documented example has no `categoryFirstId` or `categorySecondId` field at all** — only the
  leaf level carries an id. The current `CjCategoryDto` (`cjTypes.ts:26-30`) has `categoryFirstId:
  string` as **required**, which does not match the real payload. No test or call site in this repo
  actually reads `.categoryFirstId` (I grepped `categoryFirstId|categoryFirstName|categoryFirstList|
  CjCategoryDto|fetchCategories` across `backend/src` — the only hits outside `cjTypes.ts`/
  `cjClient.ts` are `cjClient.test.ts`, which only ever mocks `data: []`, and unrelated `ICjClient`
  jest-mock stubs in other test files that just do `fetchCategories: jest.fn()`). So making
  `categoryFirstId` optional is safe and doesn't break "backward compatibility with existing tests"
  as task 1.2 worries about — there's nothing depending on it being required.
- `CjProductDto.categoryId` / `CjCatalogItem.categoryId` (the value we resolve) is the **leaf
  (third-level) id** — confirmed by the field naming symmetry (`categoryId`/`categoryName` only exist
  at the leaf) and matches design.md's assumption.

### 1.2/1.3 — `backend/src/infrastructure/external/cjTypes.ts`

Replace the current single-level `CjCategoryDto` (lines 26-30) with:

```typescript
// CJ's real `/product/getCategory` response is a fixed 3-level tree with a
// DIFFERENT field name per level (confirmed 2026-07-16 against CJ's published
// docs: https://developers.cjdropshipping.cn/en/api/api2/api/product.html,
// "1.1 Category List(GET)" — GET /product/getCategory; no live sandbox
// payload was available in this dev environment):
//   Level 1: { categoryFirstName, categoryFirstList: Level2[] }
//   Level 2: { categorySecondName, categorySecondList: Level3[] }
//   Level 3 (leaf — this is what CjProductDto.categoryId / CjCatalogItem.categoryId
//     reference): { categoryId, categoryName }, no further nesting.
// The documented example response has NO id field at all on levels 1-2 (only
// categoryFirstName/categorySecondName) — categoryFirstId below is kept
// OPTIONAL (not required, and not removed) only so any existing code
// constructing a CjCategoryDto by hand still compiles; nothing in this
// codebase reads it today.
export interface CjCategoryDto {
  categoryFirstId?: string;
  categoryFirstName: string;
  categoryFirstList?: CjCategorySecondDto[];
}

export interface CjCategorySecondDto {
  categorySecondId?: string;
  categorySecondName: string;
  categorySecondList?: CjCategoryLeafDto[];
}

export interface CjCategoryLeafDto {
  categoryId: string;
  categoryName: string;
}
```

`ICjClient.fetchCategories(): Promise<CjCategoryDto[]>` (line 116) stays as-is — return type
unchanged, just the shape behind it is now accurate. No change needed to `cjClient.ts`'s
`fetchCategories()` implementation (line 202-204) — it already just returns whatever the HTTP call
gives back, untyped-cast to `CjCategoryDto[]`.

No test file needs updating for this alone (`cjClient.test.ts`'s `fetchCategories` tests only ever
assert on `data: []`, unaffected by the type change).

## Task 2 — Prisma schema: `SupplierCategoryMapping`

### 2.1 `backend/prisma/schema.prisma`

Add a new model (I'd place it right after the `Category` model, before `Supplier`, since it's
conceptually a satellite of `Category`):

```prisma
model Category {
  id          Int        @id @default(autoincrement())
  name        String     @unique
  description String?
  imageUrl    String?
  status      String     @default("Active")
  parentId    Int?
  parent      Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryHierarchy")
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  products    Product[]
  supplierCategoryMappings SupplierCategoryMapping[]   // <-- ADD this line (reverse relation, task 2.1)
}

// Links an external supplier's own category taxonomy id to a local Category,
// so promotion (manual + auto-provisioning) can auto-create-once and then
// reuse a Category instead of creating a duplicate on every promotion run.
// `provider` is a free string (mirrors SupplierIntegration.provider), not an
// FK, so a second supplier's taxonomy can be added later without a schema
// change (design.md Decision 1). No default status/behavior here — Category
// creation policy (Inactive by default) lives in the repository method that
// uses this table (categoryRepository.findOrCreateByExternalRef), not here.
model SupplierCategoryMapping {
  id                 Int      @id @default(autoincrement())
  provider           String   @db.VarChar(50)
  externalCategoryId String   @db.VarChar(100)
  categoryId         Int
  category           Category @relation(fields: [categoryId], references: [id])
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([provider, externalCategoryId])
  @@index([categoryId])
}
```

(The `@@index([categoryId])` is a small addition beyond tasks.md's literal one-liner — every other
FK-bearing model in this schema indexes its FK column for reverse lookups; purely additive and
harmless, keep it unless you have a reason not to.)

### 2.2 Generate migration

`cd backend && npx prisma migrate dev --name add_supplier_category_mapping`. Needs the local
Postgres container running (Docker Desktop — per project convention, start it yourself if it's not
already up rather than asking).

### 2.3 Verify additive-only

Read the generated `backend/prisma/migrations/<timestamp>_add_supplier_category_mapping/
migration.sql` — expect exactly one `CREATE TABLE "SupplierCategoryMapping"`, one
`CREATE UNIQUE INDEX` for `(provider, externalCategoryId)`, one `CREATE INDEX` for `categoryId`, one
`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`. No `ALTER TABLE "Category"` — the reverse relation
field is Prisma-client-only, it doesn't touch the DB.

## Task 3 — `CategoryRepository.findOrCreateByExternalRef`

### 3.1 `backend/src/domain/repositories/index.ts`

Add to `ICategoryRepository` (after `softDelete`, line 49):

```typescript
export interface ICategoryRepository {
  findAll(includeInactive?: boolean): Promise<Category[]>;
  findById(id: number): Promise<Category | null>;
  findByName(name: string): Promise<Category | null>;
  create(data: CategoryCreateData): Promise<Category>;
  update(id: number, data: CategoryUpdateData): Promise<Category>;
  softDelete(id: number): Promise<Category>;
  // Find-or-create by external supplier taxonomy reference (design.md Decision
  // 1/category-management spec). Idempotent: reuses the mapped Category if one
  // exists; otherwise creates a new Inactive Category + its mapping. `name` is
  // only used on the create path (ignored when a mapping already exists, even
  // if CJ's category name has since changed — design.md non-goal: "not kept in
  // sync afterward").
  findOrCreateByExternalRef(provider: string, externalCategoryId: string, name: string): Promise<Category>;
}
```

### 3.2/3.3 `backend/src/infrastructure/repositories/categoryRepository.ts`

Add `import { Prisma } from '@prisma/client';` and `import { prisma } from '../prismaClient';` is
already imported. Implement:

```typescript
async findOrCreateByExternalRef(provider: string, externalCategoryId: string, name: string): Promise<Category> {
  const existingMapping = await prisma.supplierCategoryMapping.findUnique({
    where: { provider_externalCategoryId: { provider, externalCategoryId } },
    include: { category: true },
  });
  if (existingMapping) return new Category(existingMapping.category);

  try {
    // Short, DB-only transaction scoped to this single find-or-create — safe
    // to open here even though the CALLER (CjCatalogPromotionService.promote())
    // must not open ITS OWN long-running transaction until after all category
    // resolution is done (design.md Decision 2). Those are two different
    // transactions: this one is a few milliseconds of pure DB writes with no
    // external HTTP calls in it, opened and closed entirely before promote()'s
    // own prisma.$transaction(...) begins.
    const category = await prisma.$transaction(async (tx) => {
      // Reuse an existing Category by name rather than violating the `name`
      // unique constraint — e.g. an admin already created "Dresses" by hand,
      // or a prior CJ category resolved to the same name via a different
      // externalCategoryId (category-management spec: "Category CRUD is
      // unaffected" + must not throw CATEGORY_NAME_ALREADY_EXISTS here).
      let row = await tx.category.findUnique({ where: { name } });
      if (!row) {
        row = await tx.category.create({ data: { name, status: 'Inactive' } });
      }
      await tx.supplierCategoryMapping.create({
        data: { provider, externalCategoryId, categoryId: row.id },
      });
      return row;
    });
    return new Category(category);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Lost a concurrent race to create this exact (provider,
      // externalCategoryId) mapping — re-read and return the winner's
      // Category instead of throwing (design.md Risk: manual promote racing
      // the scheduled auto-provisioning job).
      const raceWinner = await prisma.supplierCategoryMapping.findUnique({
        where: { provider_externalCategoryId: { provider, externalCategoryId } },
        include: { category: true },
      });
      if (raceWinner) return new Category(raceWinner.category);
      throw err; // Unexpected: P2002 on something else — don't swallow it.
    }
    throw err;
  }
}
```

Note on `prisma.supplierCategoryMapping.findUnique({ where: { provider_externalCategoryId: {...} } })`:
Prisma names a compound `@@unique([provider, externalCategoryId])` selector
`provider_externalCategoryId` by default (field names joined with `_`, in declaration order) — this
will be confirmed/visible in the generated Prisma Client types once `npx prisma generate` runs after
the migration (task 2.2 does this automatically).

**Known minor gap, not worth solving now**: if two concurrent requests resolve two *different*
`externalCategoryId`s that happen to produce the *same* `name` at the exact same instant, the P2002
could come from `tx.category.create`'s name-uniqueness instead of the mapping's uniqueness, and the
catch block's re-read (keyed by `provider_externalCategoryId`) would find nothing and rethrow. This
is a much narrower race than the one design.md's Risk section calls out (same category, not a name
collision across different categories) and isn't in task 3.4's required test list — flagging it here
rather than adding speculative handling that isn't asked for.

### 3.4 `backend/src/infrastructure/repositories/__tests__/categoryRepository.test.ts` (new file)

No existing repository test file for `categoryRepository.ts` — create this one. Follow the mocking
style already used in `__tests__/supplierIntegrationRepository.test.ts` / `reviewRepository`'s tests
(mock `prisma` at the module level, not a real DB):

```typescript
jest.mock('../../prismaClient', () => ({
  prisma: {
    category: { findUnique: jest.fn(), create: jest.fn(), /* ...existing methods used elsewhere if you test them too */ },
    supplierCategoryMapping: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(async (cb) => cb({
      category: { findUnique: mockTxCategoryFindUnique, create: mockTxCategoryCreate },
      supplierCategoryMapping: { create: mockTxMappingCreate },
    })),
  },
}));
```

Cases required by task 3.4:
1. `should_create_category_and_mapping_when_no_mapping_exists` — top-level `supplierCategoryMapping.findUnique` → `null`; tx `category.findUnique` (by name) → `null`; tx `category.create` called with `{ name, status: 'Inactive' }`; tx `supplierCategoryMapping.create` called with the new category's id; assert returned `Category.status === 'Inactive'`.
2. `should_reuse_existing_mapping_without_a_transaction` — top-level `supplierCategoryMapping.findUnique` → a row with `.category`; assert `$transaction` is never called.
3. `should_resolve_a_P2002_race_without_throwing` — top-level `findUnique` → `null`; `$transaction` rejects with `new Prisma.PrismaClientKnownRequestError('...', { code: 'P2002', clientVersion: '6.x' })` (same construction pattern as `__tests__/customerRepository.addressDefault.test.ts:75`); the SECOND top-level `supplierCategoryMapping.findUnique` call (the re-read) resolves with the race winner's row; assert the method resolves to that Category instead of throwing.
4. `should_reuse_an_existing_local_category_with_the_same_name` — top-level `findUnique` → `null`; tx `category.findUnique` (by name) → an existing row (e.g. status `Active`, created directly via `POST /categories` previously); assert `category.create` is NOT called and the mapping links to that existing row.

## Task 4 — `cjCategoryResolution.ts` helper

### 4.1/4.2 `backend/src/application/services/cjCategoryResolution.ts` (new file)

```typescript
import { ICjClient, CjCategoryDto } from '../../infrastructure/external/cjTypes';
import { logger } from '../../infrastructure/logger';

export interface CjCategoryResolution {
  readonly map: ReadonlyMap<string, string>;
  resolve(categoryId: string): string | undefined;
}

// Descends through every known nested-list field name at every level rather
// than assuming a fixed depth (design.md Decision 5) — the confirmed real CJ
// shape (see cjTypes.ts's CjCategoryDto doc comment) is a fixed 3-level tree
// with a DIFFERENT field name per level (categoryFirstList -> categorySecondList
// -> leaf), not uniform recursion, so this tries all known list-field names
// at each node rather than hardcoding "one level down only". Also treats any
// node that already carries a bare categoryId/categoryName as a leaf
// immediately, regardless of depth, as a defensive fallback in case a branch
// is shallower than 3 levels or CJ changes the shape later.
function collectLeaves(nodes: unknown, map: Map<string, string>): void {
  if (!Array.isArray(nodes)) return;
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue;
    const node = raw as Record<string, unknown>;
    if (typeof node['categoryId'] === 'string' && typeof node['categoryName'] === 'string') {
      map.set(node['categoryId'] as string, node['categoryName'] as string);
    }
    for (const listField of ['categoryFirstList', 'categorySecondList', 'categoryThirdList']) {
      collectLeaves(node[listField], map);
    }
  }
}

// Called at most once per CjCatalogPromotionService.promote() invocation
// (design.md Decision 3) — build once, reuse the returned resolve()/map for
// every pid-group in that call. Never throws: a CJ API failure yields an
// empty, always-resolvable-to-undefined map so callers fall back per the
// cj-catalog-promotion spec's resolution order instead of aborting.
export async function buildCjCategoryResolution(cjClient: ICjClient): Promise<CjCategoryResolution> {
  const map = new Map<string, string>();
  try {
    const tree: CjCategoryDto[] = await cjClient.fetchCategories();
    collectLeaves(tree, map);
  } catch (err) {
    logger.warn('CJ category resolution: fetchCategories() failed, resolution will fall back for this promote() call', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return { map, resolve: (categoryId: string) => map.get(categoryId) };
}
```

### 4.3 `backend/src/application/services/__tests__/cjCategoryResolution.test.ts` (new file)

Build a fake `ICjClient` (`{ fetchCategories: jest.fn(), ...other methods as jest.fn() }`, same
pattern as `cjCatalogPromotionService.test.ts`'s `cjClient` mock). Cases:
1. `should_resolve_a_flat_one_level_tree` — mock `fetchCategories` to resolve with a single leaf-shaped array `[{ categoryId: 'X', categoryName: 'Dresses' }]` (edge case: CJ returns a shallower tree than 3 levels) → `resolve('X')` returns `'Dresses'`.
2. `should_resolve_a_leaf_nested_three_levels_deep` — the full documented shape (`categoryFirstList` → `categorySecondList` → leaf) → `resolve(leafId)` returns the leaf's `categoryName`.
3. `should_return_undefined_for_an_unmapped_id` — tree built, but `resolve('does-not-exist')` → `undefined`.
4. `should_never_throw_and_yield_an_empty_map_when_fetchCategories_rejects` — `fetchCategories.mockRejectedValue(new Error('network'))` → `buildCjCategoryResolution` resolves (doesn't reject); `resolve('anything')` → `undefined`; `.map.size === 0`.

## Task 5 — Wire resolution into `CjCatalogPromotionService.promote()`

This is the core of the change. Current `promote()` (lines 83-294 of
`cjCatalogPromotionService.ts`) does, in order: (a) integration lookup, (b) a single upfront
`categoryId` check (lines 87-90) that throws if missing/invalid, (c) fetch catalog items + per-item
price/sync validation (throws `CjPromotionValidationError` on any failure, nothing persisted), (d)
idempotency/grouping into `PidGroup`s, (e) the bulk `prisma.$transaction(...)`.

### 5.1-5.4 New control flow (same file, same method)

**Constructor** stays as-is (7 args, `cjClient: ICjClient` already the 7th param since the prior
`estimateFreight()` change) — no signature change needed, `cjClient` is already injected.

Replace step (b) with a **conditional** upfront check, and add category resolution as a **new step
between (d) and (e)** — i.e. still entirely before `prisma.$transaction(...)` opens (design.md
Decision 2):

```typescript
async promote(supplierId: number, input: CjPromotionRequestInput): Promise<PromoteResult> {
  const integration = await this.integrationRepo.findBySupplierId(supplierId);
  if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

  // Explicit categoryId is still validated up front and short-circuits CJ
  // resolution entirely for the whole request (design.md Decision 6) —
  // preserves today's exact behavior/error-ordering for anyone who still
  // sends it (existing test `should_reject_with_category_required_when_
  // categoryId_does_not_resolve` asserts this happens BEFORE
  // catalogRepo.findManyByIds is even called — keep that ordering).
  let explicitCategoryId: number | undefined;
  if (input.categoryId !== undefined) {
    const category = await this.categoryRepo.findById(input.categoryId);
    if (!category || category.id === undefined) throw new CjPromotionCategoryRequiredError();
    explicitCategoryId = category.id;
  }

  const requestedIds = input.items.map((i) => i.cjCatalogItemId);
  const catalogItems = await this.catalogRepo.findManyByIds(requestedIds);
  // ... (catalogItemsById map, price/sync validation loop, itemErrors throw — UNCHANGED, lines 94-139)
  // ... (alreadyLinked idempotency lookup — UNCHANGED, lines 141-171)
  // ... (groups Map<string, PidGroup> build — UNCHANGED, lines 173-189)

  // NEW: category resolution per group, only for groups that will create a
  // brand-new Product (existingProductId === null) — a mixed group joining an
  // already-existing product doesn't need a category at all (the product
  // already has one), so skip resolution work for it entirely.
  const categoryIdByPid = new Map<string, number>();
  if (groups.size > 0) {
    const groupsNeedingCategory = Array.from(groups.values()).filter((g) => g.existingProductId === null);
    if (explicitCategoryId !== undefined) {
      for (const g of groupsNeedingCategory) categoryIdByPid.set(g.pid, explicitCategoryId);
    } else if (groupsNeedingCategory.length > 0) {
      // fetchCategories() called at MOST once per promote() invocation
      // (design.md Decision 3) — build once here, reuse for every group below.
      const resolution = await buildCjCategoryResolution(this.cjClient);
      for (const g of groupsNeedingCategory) {
        const externalCategoryId = g.items[0]!.catalogItem.categoryId; // product-level, same across the group's items
        let resolvedCategoryId: number | undefined;
        if (externalCategoryId) {
          const name = resolution.resolve(externalCategoryId);
          if (name) {
            const category = await this.categoryRepo.findOrCreateByExternalRef('CJDropshipping', externalCategoryId, name);
            if (category.id !== undefined) resolvedCategoryId = category.id;
          }
        }
        if (resolvedCategoryId === undefined) {
          resolvedCategoryId = await this.resolveFallbackCategoryId();
        }
        if (resolvedCategoryId === undefined) {
          throw new CjPromotionCategoryRequiredError();
        }
        categoryIdByPid.set(g.pid, resolvedCategoryId);
      }
    }
  }

  const productsResult: ... // UNCHANGED from here
  if (groups.size > 0) {
    await prisma.$transaction(async (tx) => {
      for (const group of groups.values()) {
        let productId = group.existingProductId;
        const variantIds: number[] = [];
        if (productId === null) {
          const title = group.items[0]!.catalogItem.title;
          const slug = await this.productService.resolveUniqueSlug(title);
          const productStatus = input.activate ? 'Active' : 'Draft';
          const categoryId = categoryIdByPid.get(group.pid)!; // <-- was the single request-level `categoryId` constant before
          const createdProduct = await tx.product.create({
            data: { name: title, slug, status: productStatus, categoryId },
          });
          productId = createdProduct.id;
          // ... image capture unchanged
        }
        // ... variant creation loop unchanged
      }
    }, PROMOTE_TRANSACTION_OPTIONS);
  }
  // ... rest unchanged
}

private async resolveFallbackCategoryId(): Promise<number | undefined> {
  const raw = process.env['CJ_DEFAULT_CATEGORY_ID'];
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return undefined;
  const category = await this.categoryRepo.findById(value);
  return category?.id;
}
```

Add the import: `import { buildCjCategoryResolution } from './cjCategoryResolution';`.

**Why `resolveFallbackCategoryId()` lives here now, not in `providerRegistry.ts`**: task 7.1
explicitly says `providerRegistry.runPipeline()` stops passing a forced `categoryId` and relies on
`promote()`'s own fallback — so `promote()` must be able to read `CJ_DEFAULT_CATEGORY_ID` itself for
*both* callers (manual admin request with no `categoryId`, and the automated pipeline). This mirrors
the existing `getDefaultMarkupMultiplier()` private method (lines 76-81) reading
`CJ_DEFAULT_MARKUP_MULTIPLIER` directly — same pattern, same file.

**On "for that group" in task 5.2**: I read `CjPromotionCategoryRequiredError` as aborting the whole
`promote()` call (not a per-item entry in `itemErrors`), same as it does today — it's a plain
`Error`, not `CjPromotionValidationError`, and the existing test suite's only category-failure test
(`should_reject_with_category_required_when_categoryId_does_not_resolve`) asserts a single thrown
error, not an item-error list. The plan above throws as soon as the FIRST group fails to resolve by
any means, matching that shape. If you disagree and want per-item granularity instead, that's a
bigger change to `CjPromotionCategoryRequiredError` itself (would need an `itemErrors`-carrying
variant) — flagging so it's a deliberate choice, not an oversight.

### 5.5 `backend/src/application/services/__tests__/cjCatalogPromotionService.test.ts`

Existing tests all pass `categoryId: 1` explicitly and `categoryRepo.findById` is mocked to resolve
a `Category` in `beforeEach` (line 142) — **these keep passing unchanged** since the explicit-
`categoryId` path is untouched. Add new cases (all omit `categoryId` from the request):

1. `should_auto_resolve_and_create_a_new_category_from_cj_taxonomy` — `catalogRepo.findManyByIds` returns an item with `categoryId: 'CJ-EXT-1'`; `cjClient.fetchCategories` resolves a tree containing `{ categoryId: 'CJ-EXT-1', categoryName: 'Dresses' }` (nested however you like — leaf-only array is fine per the resolver's defensive leaf-detection); `categoryRepo.findOrCreateByExternalRef` is a new jest.fn() added to the `categoryRepo` mock object in `beforeEach` (it's part of `ICategoryRepository` now, so the mock object literal at lines 87-94 MUST add it or TS will fail to compile the mock), mocked to resolve `new Category({ id: 42, name: 'Dresses', status: 'Inactive' })`; assert `tx.product.create` was called with `categoryId: 42` and assert `categoryRepo.findOrCreateByExternalRef` was called with `('CJDropshipping', 'CJ-EXT-1', 'Dresses')`.
2. `should_reuse_an_already_mapped_category_without_creating_a_duplicate` — same as above but assert `findOrCreateByExternalRef` is the only category-creation touchpoint (i.e., there's nothing else to additionally assert beyond call-count — the repo method itself owns reuse-vs-create, already covered by task 3.4's tests; this test's job is just confirming `promote()` calls it and uses its return value).
3. `should_let_an_explicit_categoryId_override_cj_resolution` — request WITH `categoryId: 1` AND the catalog item ALSO has a `categoryId` (CJ external id) set; assert `cjClient.fetchCategories` is **never called** and `tx.product.create` uses `categoryId: 1` (the override value) — this directly tests design.md Decision 6.
4. `should_fall_back_to_CJ_DEFAULT_CATEGORY_ID_when_cj_resolution_fails` — no request `categoryId`; catalog item has no `categoryId` (or `cjClient.fetchCategories` rejects); set `process.env['CJ_DEFAULT_CATEGORY_ID'] = '7'`; `categoryRepo.findById` mocked so `findById(7)` resolves a Category — assert `tx.product.create` uses `categoryId: 7` and `findOrCreateByExternalRef` is NOT called (no externalCategoryId to resolve) or IS called but returns nothing usable, depending on which failure mode you're testing — write two sub-cases if it's cleaner (no-external-id vs. fetchCategories-rejects).
5. `should_throw_category_required_when_nothing_resolves` — no request `categoryId`, no catalog item `categoryId`, `CJ_DEFAULT_CATEGORY_ID` unset (already the default in `beforeEach` via `delete process.env[...]` if you add that line) → `expect(...).rejects.toThrow(CjPromotionCategoryRequiredError)`; assert `mockTransaction` is never called (nothing persisted).
6. **Regression, must still pass**: `should_reject_with_category_required_when_categoryId_does_not_resolve` (existing, line 366) — verify it still passes unmodified; it exercises the explicit-`categoryId`-invalid path which is untouched.
7. Add one test asserting `fetchCategories` is called **exactly once** even when the batch contains multiple pid-groups all needing auto-resolution (design.md Decision 3) — reuse the existing `should_group_items_sharing_the_same_pid_into_a_single_product`-style multi-item setup (3 items, but make them 2+ DIFFERENT pids so there are 2 groups) with `categoryId` omitted from the request and 2 different (or same) CJ category ids on the items; assert `cjClient.fetchCategories` `toHaveBeenCalledTimes(1)`.

Also **update the `categoryRepo` mock object literal** in `beforeEach` (line 87-94) to include
`findOrCreateByExternalRef: jest.fn()` — TypeScript will fail to compile `jest.Mocked<ICategoryRepository>`
otherwise once the interface gains the new method (task 3.1).

## Task 6 — Validator: `categoryId` optional (mostly already true)

### 6.1 `backend/src/application/validator.ts`

**No code change required.** `CjPromotionRequestInput.categoryId` (line 1258) is already `?: number`,
and `validateCjPromotionData` (lines 1267-1322) already treats `data['categoryId']` as optional
(lines 1304-1311: only validates shape *if present*, never requires it). Re-read the comment at
1262-1266 — it already documents exactly this design ("categoryId is intentionally NOT required
here... service layer throws CjPromotionCategoryRequiredError after a DB lookup"). Confirm this
during implementation (it's possible a stale mental model in tasks.md assumed an older version of
this file) rather than assuming a change is needed.

### 6.2 `backend/src/application/__tests__/validator.cjPromotion.test.ts` (new file)

There are currently **zero tests** for `validateCjPromotionData` anywhere in the repo (I grepped
`categoryId|validateCjPromotionData` across `validator.test.ts` and every `__tests__/validator.*.test.ts`
split file — no hits). This is a real gap independent of this change; task 6.2 is asking you to close
it, not just add one case. Follow the existing per-domain split-file convention (e.g.
`validator.supplier.test.ts`). Minimum cases:
1. `should_accept_a_request_with_no_categoryId` — `{ items: [{ cjCatalogItemId: 1 }] }` → returns `{ items: [...], categoryId: undefined, activate: undefined }`, does not throw.
2. `should_accept_a_valid_positive_integer_categoryId`.
3. `should_reject_a_non_integer_categoryId` (e.g. `1.5`, `"5"`, `0`, `-1`) → `ValidationError`.
4. `should_reject_when_items_is_missing_or_empty` (existing behavior, lines 1269-1271).
5. `should_reject_an_item_with_a_non_positive_cjCatalogItemId`.
6. `should_accept_a_valid_publicPrice_and_compareAtPrice` / reject invalid ones (lines 1283-1298) — cheap to cover alongside since you're already building the fixture.
7. `should_reject_a_non_boolean_activate` (lines 1313-1319).

## Task 7 — Auto-provisioning pipeline (`providerRegistry.ts`)

### 7.1 `backend/src/application/providers/providerRegistry.ts`

Delete `resolveDefaultCategoryId()` (lines 92-97) entirely — it becomes **dead code** once
`promote()` owns its own fallback (task 5's `resolveFallbackCategoryId()`), and nothing else in this
file needs it once the call site below stops passing `categoryId`.

Change `promoteExcludingPoisonItems`'s signature (currently `(supplierId, ids, categoryId)`, lines
112-141) to drop the `categoryId` parameter entirely:

```typescript
async function promoteExcludingPoisonItems(supplierId: number, ids: number[]): Promise<PromoteResult> {
  try {
    return await cjCatalogPromotionService.promote(supplierId, {
      items: ids.map((cjCatalogItemId) => ({ cjCatalogItemId })),
      activate: false, // never change to true — auto-promoted products must stay Draft (design.md D5)
    });
  } catch (err) {
    if (err instanceof CjPromotionValidationError && err.itemErrors.length > 0) {
      const failedIds = new Set(err.itemErrors.map((e) => e.cjCatalogItemId));
      const remaining = ids.filter((id) => !failedIds.has(id));
      if (remaining.length > 0 && remaining.length < ids.length) {
        logger.warn('CJ auto-promotion retrying batch excluding items that failed price/validation resolution', {
          supplierId,
          excludedItemIds: Array.from(failedIds),
        });
        return await cjCatalogPromotionService.promote(supplierId, {
          items: remaining.map((cjCatalogItemId) => ({ cjCatalogItemId })),
          activate: false,
        });
      }
    }
    throw err;
  }
}
```

In `runPipeline()` (lines 143-176), delete `const categoryId = resolveDefaultCategoryId();` (line
157) and change the call to `await promoteExcludingPoisonItems(supplierId, promotableIds);` (drop
the third argument). The rest of `runPipeline()` — including the `catch` block mapping
`CjPromotionCategoryRequiredError` → `DEFAULT_CATEGORY_MISSING` (lines 166-169) — is **unchanged**:
it already just catches whatever `promote()` throws, and `promote()` now only throws that error when
BOTH CJ resolution failed AND the env-var fallback is missing/invalid (task 5's new logic) — which is
exactly the revised trigger condition task 7.2 asks for. **Task 7.2 requires no code change**, only
confirm-by-reading once 7.1 is done.

### 7.3 `backend/src/application/providers/__tests__/providerRegistry.test.ts`

Important: `CjCatalogPromotionService` is `jest.mock()`'d at the module level in this file (line
15-17, `promote: mockPromote`) — the REAL CJ-resolution/fallback logic lives inside
`cjCatalogPromotionService.promote()` and is unit-tested at that layer (task 5.5), not here. Don't
try to re-test "successful CJ-based auto-categorization" or "fallback to default category" against a
mocked `promote()` — there's nothing real to assert there. What DOES need testing at this layer:

1. Update `should_page_through_listStagedCatalog_until_a_short_page_and_then_call_promote_once`
   (line 110) — add `expect(promoteArgs.categoryId).toBeUndefined();` (or
   `expect(promoteArgs).not.toHaveProperty('categoryId')`) alongside the existing
   `expect(promoteArgs.activate).toBe(false);` assertion, to lock in that `providerRegistry` no
   longer forces a category. Note: since no test in this file ever sets
   `process.env['CJ_DEFAULT_CATEGORY_ID']` (it's `delete`d in every `beforeEach`, line 54), the OLD
   `resolveDefaultCategoryId()` already returned `undefined` in every existing test — so this
   assertion would have passed even before your change; it's still worth adding explicitly so the
   removal of `resolveDefaultCategoryId()` is guarded by something other than coincidence.
2. `should_catch_CjPromotionCategoryRequiredError_and_report_DEFAULT_CATEGORY_MISSING` (line 163) —
   no change needed, still exercises the exact same catch-block behavior.
3. Everything else in this file (poison-item retry, dedup, `should_rethrow_unexpected_errors`, etc.)
   is orthogonal to category resolution — leave as-is.
4. You can delete the two `process.env['CJ_DEFAULT_CATEGORY_ID']` references in `beforeEach`
   (line 54) / any other spot in this file if a search turns up no remaining reason for them, since
   `providerRegistry.ts` no longer reads that env var at all after 7.1 — but leaving the
   `delete process.env[...]` line is harmless even if unnecessary now, so this is optional cleanup,
   not required.

## Task 8 — Backfill endpoint

This needs new repository read/write primitives that don't exist yet, because the existing
`ProductRepository`/`ProductVariantRepository` methods are deliberately narrow (customer-safe
selects that exclude `cjCatalogItemId`, paginated `findAll`). Rather than routing this internal admin
maintenance operation through those customer-safe methods, add two new narrow, admin-only methods —
mirroring the existing precedent of `IProductVariantRepository.findCjCatalogItemId()` (line 93,
already documented as "narrow, response-DTO-invisible... internal-only convention").

### 8.0 New repository methods (prerequisite for 8.1)

**`backend/src/domain/repositories/productRepository.ts`** — add to `IProductVariantRepository`:

```typescript
// Internal-only, admin-maintenance use (CJ category backfill). Returns every
// non-deleted variant belonging to a non-deleted Product currently in
// `categoryId`, with its cjCatalogItemId — deliberately bypasses the
// customer-safe variantSelect the same way findCjCatalogItemId does.
findManyByProductCategoryId(categoryId: number): Promise<{ productId: number; variantId: number; cjCatalogItemId: number | null }[]>;
```

Implement in `backend/src/infrastructure/repositories/productVariantRepository.ts` (add after
`findCjCatalogItemId`, around line 188):

```typescript
async findManyByProductCategoryId(categoryId: number): Promise<{ productId: number; variantId: number; cjCatalogItemId: number | null }[]> {
  const rows = await prisma.productVariant.findMany({
    where: { deletedAt: null, product: { categoryId, deletedAt: null } },
    select: { id: true, productId: true, cjCatalogItemId: true },
  });
  return rows.map((r) => ({ productId: r.productId, variantId: r.id, cjCatalogItemId: r.cjCatalogItemId }));
}
```

**`backend/src/domain/repositories/productRepository.ts`** — add to `IProductRepository`:

```typescript
// Atomic conditional reassignment: only writes if the product's categoryId is
// STILL `fromCategoryId` at the moment of the write (not just when read
// earlier) — this is what makes the backfill idempotent and race/manual-edit
// safe (design.md Decision 7 / Risk: never override a category an admin
// picked deliberately since the read). Returns false (no-op) if the product
// no longer matches, true if it was reassigned.
reassignCategoryIfCurrentlyCategory(productId: number, fromCategoryId: number, toCategoryId: number): Promise<boolean>;
```

Implement in `backend/src/infrastructure/repositories/productRepository.ts` (add near the end,
after `softDelete`):

```typescript
async reassignCategoryIfCurrentlyCategory(productId: number, fromCategoryId: number, toCategoryId: number): Promise<boolean> {
  const result = await prisma.product.updateMany({
    where: { id: productId, categoryId: fromCategoryId, deletedAt: null },
    data: { categoryId: toCategoryId },
  });
  return result.count > 0;
}
```

(Use `updateMany` rather than `update` deliberately — Prisma's `.update()` requires the `where`
clause to target only unique fields, and `{ id, categoryId }` together isn't a valid unique selector
even though `id` alone is; `updateMany`'s `where` has no such restriction and its `count` return value
is exactly the "did it actually change" signal this needs.)

### 8.1 New service: `backend/src/application/services/cjCategoryBackfillService.ts` (new file)

```typescript
import { ICategoryRepository } from '../../domain/repositories';
import { IProductRepository, IProductVariantRepository } from '../../domain/repositories/productRepository';
import { ICjCatalogItemRepository } from '../../domain/repositories/cjCatalogItemRepository';
import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import { ICjClient } from '../../infrastructure/external/cjTypes';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { CjPromotionCategoryRequiredError } from '../validator';
import { buildCjCategoryResolution } from './cjCategoryResolution';
import { logger } from '../../infrastructure/logger';

export type RecategorizeSkipReason =
  | 'NO_CJ_CATEGORY_MAPPING'
  | 'CONFLICTING_CJ_CATEGORIES'
  | 'CJ_CATEGORY_RESOLUTION_FAILED'
  | 'CATEGORY_CHANGED_CONCURRENTLY';

export interface RecategorizeResult {
  fromCategoryId: number;
  reassigned: { productId: number; toCategoryId: number }[];
  skipped: { productId: number; reason: RecategorizeSkipReason }[];
}

export class CjCategoryBackfillService {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly variantRepo: IProductVariantRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly cjClient: ICjClient
  ) {}

  async recategorize(supplierId: number): Promise<RecategorizeResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    const fromCategoryId = await this.resolveTargetCategoryId();
    if (fromCategoryId === undefined) throw new CjPromotionCategoryRequiredError();

    const rows = await this.variantRepo.findManyByProductCategoryId(fromCategoryId);
    const byProduct = new Map<number, { variantId: number; cjCatalogItemId: number | null }[]>();
    for (const row of rows) {
      const list = byProduct.get(row.productId) ?? [];
      list.push({ variantId: row.variantId, cjCatalogItemId: row.cjCatalogItemId });
      byProduct.set(row.productId, list);
    }

    const allCjCatalogItemIds = rows.map((r) => r.cjCatalogItemId).filter((id): id is number => id !== null);
    const catalogItems = allCjCatalogItemIds.length > 0 ? await this.catalogRepo.findManyByIds(allCjCatalogItemIds) : [];
    const catalogItemsById = new Map(catalogItems.filter((ci) => ci.id !== undefined).map((ci) => [ci.id!, ci]));

    const resolution = await buildCjCategoryResolution(this.cjClient);

    const reassigned: RecategorizeResult['reassigned'] = [];
    const skipped: RecategorizeResult['skipped'] = [];

    for (const [productId, variants] of byProduct) {
      // Only this supplier's own CJ catalog items count.
      const ownCategoryIds = new Set(
        variants
          .map((v) => (v.cjCatalogItemId !== null ? catalogItemsById.get(v.cjCatalogItemId) : undefined))
          .filter((ci): ci is NonNullable<typeof ci> => ci !== undefined && ci.supplierIntegrationId === integration.id)
          .map((ci) => ci.categoryId)
          .filter((id): id is string => !!id)
      );

      if (ownCategoryIds.size === 0) {
        skipped.push({ productId, reason: 'NO_CJ_CATEGORY_MAPPING' });
        continue;
      }
      if (ownCategoryIds.size > 1) {
        skipped.push({ productId, reason: 'CONFLICTING_CJ_CATEGORIES' });
        continue;
      }

      const externalCategoryId = [...ownCategoryIds][0]!;
      const name = resolution.resolve(externalCategoryId);
      if (!name) {
        skipped.push({ productId, reason: 'CJ_CATEGORY_RESOLUTION_FAILED' });
        continue;
      }

      const category = await this.categoryRepo.findOrCreateByExternalRef('CJDropshipping', externalCategoryId, name);
      if (category.id === undefined) {
        skipped.push({ productId, reason: 'CJ_CATEGORY_RESOLUTION_FAILED' });
        continue;
      }

      const didReassign = await this.productRepo.reassignCategoryIfCurrentlyCategory(productId, fromCategoryId, category.id);
      if (didReassign) {
        reassigned.push({ productId, toCategoryId: category.id });
      } else {
        skipped.push({ productId, reason: 'CATEGORY_CHANGED_CONCURRENTLY' });
      }
    }

    logger.info('CJ category backfill run completed', {
      supplierId, fromCategoryId, reassignedCount: reassigned.length, skippedCount: skipped.length,
    });

    return { fromCategoryId, reassigned, skipped };
  }

  private async resolveTargetCategoryId(): Promise<number | undefined> {
    const raw = process.env['CJ_DEFAULT_CATEGORY_ID'];
    if (!raw) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) return undefined;
    const category = await this.categoryRepo.findById(value);
    return category?.id;
  }
}
```

Notes:
- `resolveTargetCategoryId()` duplicates `CjCatalogPromotionService.resolveFallbackCategoryId()`
  (task 5) almost exactly. If you'd rather not duplicate it, extract a small shared helper (e.g.
  `backend/src/application/services/cjDefaultCategory.ts` exporting a single
  `resolveCjDefaultCategoryId(categoryRepo: ICategoryRepository): Promise<number | undefined>`) and
  have both services call it. Either is fine; the duplicated version above is simpler to review in
  isolation and this is a small enough function that duplication isn't a real maintenance burden —
  your call.
- `CjPromotionCategoryRequiredError` is reused here (rather than a new error class) for "no
  default/fallback category is currently configured, so there's nothing to backfill against" — same
  422 status, already wired in `errorHandler.ts`. This is a judgment call: if you'd rather have a
  distinctly-named error for the backfill endpoint's docs/api-spec clarity, that's reasonable too,
  but isn't required by tasks.md.
- Idempotency (8.2) falls out of the query itself: `findManyByProductCategoryId(fromCategoryId)` only
  ever returns products CURRENTLY in that category, so a second run naturally excludes anything
  already reassigned by the first run — no extra bookkeeping needed.
- Never touching an admin-recategorized product (8.2 / design.md Decision 7's accepted limitation)
  is enforced twice: once by the read-time filter (only products currently `= fromCategoryId` are
  candidates) and once more atomically by `reassignCategoryIfCurrentlyCategory`'s conditional
  `updateMany` at write time (closes the read-then-write race window).

### Controller + route

**`backend/src/presentation/controllers/cjCatalogPromotionController.ts`** — add a `recategorize`
handler and wire the new service (mirrors the existing `cjCatalogPromotionService` construction at
the top of this file, lines 26-35):

```typescript
import { CjCategoryBackfillService } from '../../application/services/cjCategoryBackfillService';
// ... existing imports

const cjCategoryBackfillService = new CjCategoryBackfillService(
  new ProductRepository(),
  productVariantRepository, // reuse the existing instance already constructed in this file
  new CategoryRepository(),
  new CjCatalogItemRepository(),
  new SupplierIntegrationRepository(),
  cjClient
);

export async function recategorize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const result = await cjCategoryBackfillService.recategorize(supplierId);
    res.json({ success: true, data: result, message: 'CJ category backfill completed' });
  } catch (err) {
    next(err);
  }
}
```

**`backend/src/routes/admin/cjRoutes.ts`** — add the route (heavy admin maintenance action touching
potentially hundreds of products — rate-limit it like `cjPromoteLimiter`, reuse that same limiter
instance or clone it):

```typescript
import { promote, activate, deactivate, freightEstimate, recategorize } from '../../presentation/controllers/cjCatalogPromotionController';
// ...
cjRouter.post('/recategorize', cjPromoteLimiter, recategorize);
```

Final path: `POST /api/admin/suppliers/:supplierId/cj/recategorize` (matches tasks.md 8.1 exactly —
`supplierRouter.use('/:supplierId/cj', cjRouter)` in `supplierRoutes.ts` already provides the
`:supplierId` prefix).

### 8.3 Tests

- **Service unit tests**: `backend/src/application/services/__tests__/cjCategoryBackfillService.test.ts` (new file, same mocking style as `cjCatalogPromotionService.test.ts`) — cases: reassigns an eligible product (single matching CJ category across its variants); skips a product with zero CJ-mapped variants (`NO_CJ_CATEGORY_MAPPING`); skips a product whose variants disagree on CJ category (`CONFLICTING_CJ_CATEGORIES`); a second call is a no-op because `findManyByProductCategoryId` no longer returns the already-reassigned product (mock the repo call to return an empty list the second time, or just assert reassignment logic is purely read-driven so this is implicitly true — pick whichever is easier to express); `reassignCategoryIfCurrentlyCategory` returning `false` → reported as `CATEGORY_CHANGED_CONCURRENTLY`, not silently dropped; `resolveTargetCategoryId()` returning `undefined` → throws `CjPromotionCategoryRequiredError` before any repo read happens.
- **Controller test**: `backend/src/presentation/controllers/__tests__/cjCatalogPromotionController.test.ts` (existing file) — add a `describe('recategorize', ...)` block mirroring the existing `promote`/`activate` describe blocks' mocking style.

### 8.4 `docs/api-spec.yml`

Add a new path entry right after `/api/admin/suppliers/{supplierId}/cj/catalog/promote` (around line
1377, before the `/activate` path):

```yaml
  /api/admin/suppliers/{supplierId}/cj/recategorize:
    post:
      summary: Backfill CJ category for already-promoted products still on the default category (admin)
      description: >
        Idempotent, admin-triggered maintenance action. Finds every Product whose categoryId
        currently equals the configured CJ_DEFAULT_CATEGORY_ID fallback, resolves the real CJ
        category from its variants' linked CjCatalogItem.categoryId, and reassigns it. Skips (and
        reports why) any product with no CJ-mapped variant, variants that disagree on CJ category,
        or whose category changed concurrently since the read. Never touches a product an admin has
        already moved off the default category. Safe to re-run — already-reassigned products are
        excluded on subsequent calls. Rate-limited. Never exposed on /api/public/*.
      tags:
        - Admin — CJ Dropshipping Integration
      parameters:
        - in: path
          name: supplierId
          required: true
          schema: { type: integer, minimum: 1 }
      responses:
        '200':
          description: Backfill run completed (may have reassigned zero products)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CjRecategorizeResult'
        '404':
          description: CJ Dropshipping connection not found (CJ_CONNECTION_NOT_FOUND)
        '422':
          description: No CJ_DEFAULT_CATEGORY_ID configured to backfill against (CJ_PROMOTION_CATEGORY_REQUIRED)
        '500':
          $ref: '#/components/responses/InternalServerError'
```

Add a matching `CjRecategorizeResult` schema near `CjPromoteResult` (~line 5282):

```yaml
    CjRecategorizeResult:
      type: object
      properties:
        fromCategoryId:
          type: integer
        reassigned:
          type: array
          items:
            type: object
            properties:
              productId: { type: integer }
              toCategoryId: { type: integer }
        skipped:
          type: array
          items:
            type: object
            properties:
              productId: { type: integer }
              reason:
                type: string
                enum: [NO_CJ_CATEGORY_MAPPING, CONFLICTING_CJ_CATEGORIES, CJ_CATEGORY_RESOLUTION_FAILED, CATEGORY_CHANGED_CONCURRENTLY]
```

Also update the existing `CjPromoteRequest` schema (line 5249-5264): remove `categoryId` from
`required: [items, categoryId]` → `required: [items]`, and update its `422` response description
(line 1358-1364) to mention the revised trigger ("...only when CJ-taxonomy auto-resolution also
fails and no CJ_DEFAULT_CATEGORY_ID fallback is configured").

## Task 10 — Review existing tests for invalidated assumptions

Beyond what's already called out above (5.5, 7.3):
- `backend/src/presentation/controllers/__tests__/cjCatalogPromotionController.test.ts` — check the
  `promote` describe block for any test asserting `categoryId` is required at the controller/
  validator boundary (a 400, not 422) — there shouldn't be one given validator.ts already treats it
  as optional (task 6 finding), but confirm.
- `backend/src/middleware/errorHandler.test.ts` — no new error classes are introduced by this plan
  (backfill reuses `CjPromotionCategoryRequiredError`), so no new branch to test there. If you DO
  decide to add a dedicated backfill error class instead (see task 8's "judgment call" note), add its
  test case here too.
- 10.2 "confirm no test relies on `fetchCategories()` never being called" — grep test files for
  `fetchCategories` after your changes; the only pre-existing hits are in `cjClient.test.ts` itself
  (testing the client, not a caller) — nothing else currently asserts non-invocation.

## Task 11 — Unit tests + DB verification

- 11.1 baseline: before running the migration, note `Category` row count and confirm
  `SupplierCategoryMapping` doesn't exist yet (it won't — new table). After the migration but before
  any test data, `SupplierCategoryMapping` count should be 0.
- 11.2 targeted: `cd backend && npx jest categoryRepository cjCategoryResolution cjCatalogPromotionService providerRegistry cjCategoryBackfillService validator.cjPromotion cjCatalogPromotionController --watchAll=false`.
- 11.3 full suite: `cd backend && npx jest --watchAll=false`.
- 11.4/11.5: standard — this change doesn't add any test that writes through the real DB (all new
  tests mock `prisma`), so "no leftover test data" should be automatic; still worth double-checking
  no `.only`/`.skip` was left in and that `npx prisma migrate status` is clean.
- Also run `cd backend && npm run lint` (ESLint/CI requirement) — watch for: unused
  `resolveDefaultCategoryId` import/reference after deleting it from `providerRegistry.ts`; the
  `CjCategorySecondDto`/`CjCategoryLeafDto` new exports need to actually be used somewhere or
  ESLint's no-unused-exports-style rules (if configured) may flag them — they ARE used, by
  `cjCategoryResolution.ts`'s `CjCategoryDto` typing chain, so this should be fine, just double-check.

## Task 12 — curl endpoint testing

Standard flow per tasks.md 12.1-12.7, using the four scenarios described there. One addition worth
doing given this environment has no real CJ credentials: for 12.2/12.3 (auto-resolution creating/
reusing a category), you'll need to seed a `CjCatalogItem` row with a non-null `categoryId` directly
via a throwaway script or `psql`/Prisma Studio (since `syncCatalog()` would otherwise need a real CJ
connection) AND make `cjClient.fetchCategories()` return something resolvable — since there's no
sandbox, either (a) temporarily point `CJDROPSHIPPING_API_KEY` at nothing and rely on
`CJ_DEFAULT_CATEGORY_ID` fallback for 12.2/12.3's "resolvable CJ category" framing, documenting that
substitution honestly in the report, or (b) stub `cjClient.fetchCategories` at the process level for
this one manual run only, which is harder to do via curl alone — recommend (a), and be explicit in
the report (`reports/2026-07-16-step-12-curl-endpoint-testing.md`) that CJ auto-resolution's "creates
a new Category from a real CJ name" path was verified via unit tests only (task 5.5/4.3), not curl,
for the same no-sandbox-credentials reason task 1 called out. Don't claim curl coverage you don't
actually have.

## Backend portions of Task 14 — Documentation

- **14.1 `docs/data-model.md`**: add a new numbered model section for `SupplierCategoryMapping`
  (after the `Category` section, ~line 52) describing its fields/purpose/uniqueness constraint; add
  a bullet to `Category`'s "Relationships" list (~line 51): `` `supplierCategoryMappings`: One-to-many
  relationship with SupplierCategoryMapping model ``; note in `Category`'s field docs that
  `status` defaults to `Active` normally but a Category **auto-created via this mechanism** defaults
  to `Inactive` (design.md Decision 4). Add a `SupplierCategoryMapping { ... }` block to the mermaid
  `erDiagram` (~line 926-940) plus a relationship line near `Category ||--o{ Category : "contains"`
  (~line 1161): `Category ||--o{ SupplierCategoryMapping : "mapped_from"`.
- **14.2 `docs/api-spec.yml`**: covered above in task 8.4 (new endpoint + schema + `categoryId`
  required-list change + revised 422 description).
- **14.3 `docs/backend-standards.md`**: add a short "find-or-create by external reference" example
  under "### Repository Pattern" (~line 1104-1139), using `CategoryRepository.findOrCreateByExternalRef`
  as the concrete example — this is a genuinely new reusable pattern in this codebase (nothing else
  does "look up by unique external key, create-with-transaction-and-P2002-retry if absent" today).
- **14.4 `docs/development_guide.md`**: update the `CJ_DEFAULT_CATEGORY_ID` row (line 106) — it's no
  longer *only* "used by the scheduled auto-provision job", it's now the shared fallback for BOTH
  the manual promote endpoint and the auto-provisioning job whenever CJ-taxonomy auto-resolution
  doesn't produce a category (not just "when no human is available to pick one"). Also revise the
  "Scheduled auto-provisioning job" paragraph (line 151) — it currently says auto-promoted products
  use `CJ_DEFAULT_CATEGORY_ID` unconditionally; that's no longer true, it's now the fallback after CJ
  taxonomy resolution is attempted first.

## Summary of every backend file touched

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | new `SupplierCategoryMapping` model + `Category` reverse relation |
| `backend/src/infrastructure/external/cjTypes.ts` | `CjCategoryDto` reshaped to real 3-level tree, `categoryFirstId` optional |
| `backend/src/domain/repositories/index.ts` | `ICategoryRepository.findOrCreateByExternalRef` |
| `backend/src/infrastructure/repositories/categoryRepository.ts` | implement `findOrCreateByExternalRef` (P2002-safe) |
| `backend/src/infrastructure/repositories/__tests__/categoryRepository.test.ts` | new |
| `backend/src/application/services/cjCategoryResolution.ts` | new — tree-walk + resolve() |
| `backend/src/application/services/__tests__/cjCategoryResolution.test.ts` | new |
| `backend/src/application/services/cjCatalogPromotionService.ts` | `promote()` category-resolution rewrite, new `resolveFallbackCategoryId()` |
| `backend/src/application/services/__tests__/cjCatalogPromotionService.test.ts` | new cases + mock update |
| `backend/src/application/validator.ts` | none (already optional) |
| `backend/src/application/__tests__/validator.cjPromotion.test.ts` | new |
| `backend/src/application/providers/providerRegistry.ts` | drop `resolveDefaultCategoryId()`, stop passing `categoryId` |
| `backend/src/application/providers/__tests__/providerRegistry.test.ts` | assert no forced `categoryId` |
| `backend/src/domain/repositories/productRepository.ts` | `findManyByProductCategoryId`, `reassignCategoryIfCurrentlyCategory` |
| `backend/src/infrastructure/repositories/productVariantRepository.ts` | implement `findManyByProductCategoryId` |
| `backend/src/infrastructure/repositories/productRepository.ts` | implement `reassignCategoryIfCurrentlyCategory` |
| `backend/src/application/services/cjCategoryBackfillService.ts` | new |
| `backend/src/application/services/__tests__/cjCategoryBackfillService.test.ts` | new |
| `backend/src/presentation/controllers/cjCatalogPromotionController.ts` | `recategorize` handler |
| `backend/src/presentation/controllers/__tests__/cjCatalogPromotionController.test.ts` | new describe block |
| `backend/src/routes/admin/cjRoutes.ts` | new route |
| `docs/api-spec.yml` | new endpoint/schema, `categoryId` optional, revised 422 |
| `docs/data-model.md` | new model section, ERD, Category relationship bullet |
| `docs/backend-standards.md` | find-or-create pattern example |
| `docs/development_guide.md` | `CJ_DEFAULT_CATEGORY_ID` semantics update |

Verification command once implemented: `cd backend && npm run lint && npm test -- --watchAll=false --testPathPattern=cj`
