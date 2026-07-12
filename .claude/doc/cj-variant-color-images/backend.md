# Backend Implementation Plan: cj-variant-color-images

Scope: tasks.md sections **1–6** (data model, extraction, promotion, public API, admin endpoints, color backfill) and **9–11** (existing-test review, unit-test run + DB verification, curl testing). Frontend (7–8, 12) and docs/commit (13–14) are out of scope for this plan.

Read first: `openspec/changes/cj-variant-color-images/{proposal,design}.md`, `openspec/changes/cj-variant-color-images/tasks.md`, `openspec/changes/cj-variant-color-images/specs/{cj-catalog-media-capture,product-image-management,public-catalog-api}/spec.md`, `.claude/sessions/context_session_cj-variant-color-images.md`.

## Important discrepancy found during research — read before starting task 6

`design.md` and `.claude/sessions/context_session_cj-variant-color-images.md` both say the bulk `UPDATE ... FROM (VALUES ...)` fix for `cjVariantAttributeBackfill.ts` is "already fixed this session, PR #107". **It is not present on this branch.** The current `feature/cj-variant-color-images` branch (and its `develop` base) still has the *old* per-row-loop version of `backend/src/application/services/cjVariantAttributeBackfill.ts`. The actual bulk-SQL fix exists only in commit `9c37bf9` on branch `fix/cj-variant-backfill-bulk-sql` (also on `origin`), which is **not merged into `develop` or this branch**. Verified with:

```
git log --all --oneline -- backend/src/application/services/cjVariantAttributeBackfill.ts
# 9c37bf9 fix(suppliers): make CJ variant attribute backfill scale to production   <- NOT on this branch
# 76277f0 fix(suppliers): derive CJ variant size/color from variantKey ...          <- on this branch (old per-row loop)
git merge-base --is-ancestor 9c37bf9 HEAD   # exits non-zero: NOT an ancestor
```

Do not `git merge`/`cherry-pick` that branch in — just use it as a reference. Task 6 below gives you the exact bulk-SQL pattern to write directly into the new `cjImageColorBackfill.ts`, copied from that commit, so `cj-variant-color-images`'s backfill is correct from the start regardless of whether the other fix ever lands on `develop`.

---

## Task 1 — Data Model

### 1.1 `backend/prisma/schema.prisma`

Current `ProductImage` model (lines 89–97):

```prisma
model ProductImage {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id])
  url       String   @db.VarChar(500)
  altText   String?  @db.VarChar(250)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
}
```

Add `color` (nullable, mirrors `ProductVariant.color`'s `@db.VarChar(50)` at line 70):

```prisma
model ProductImage {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id])
  url       String   @db.VarChar(500)
  altText   String?  @db.VarChar(250)
  sortOrder Int      @default(0)
  color     String?  @db.VarChar(50)
  createdAt DateTime @default(now())
}
```

### 1.2 Migration

```bash
cd backend
npx prisma migrate dev --name add_product_image_color
```

Verify column exists:

```bash
docker exec -it ecommerce-db psql -U <user> -d <db> -c '\d "ProductImage"'
```

(or Prisma Studio: `npx prisma studio`). Confirm `color` is `character varying(50)`, nullable, no default. This is additive/nullable — no table rewrite, safe per design.md's Migration Plan step 1.

### 1.3 `backend/src/domain/models/productImage.ts`

Current (24 lines, no `color`). Full replacement:

```typescript
export class ProductImage {
  id?: number;
  productId: number;
  url: string;
  altText?: string | null;
  sortOrder: number;
  color: string | null;
  createdAt?: Date;

  constructor(data: {
    id?: number;
    productId: number;
    url: string;
    altText?: string | null;
    sortOrder?: number;
    color?: string | null;
    createdAt?: Date;
  }) {
    this.id = data.id;
    this.productId = data.productId;
    this.url = data.url;
    this.altText = data.altText ?? null;
    this.sortOrder = data.sortOrder ?? 0;
    this.color = data.color ?? null;
    this.createdAt = data.createdAt;
  }
}
```

No changes needed to `backend/src/domain/models/product.ts` — its `images` array is already built via `data.images.map((i) => new ProductImage(i))` (lines 56–57), so it picks up `color` automatically once the class above changes. Same for `backend/src/infrastructure/repositories/productRepository.ts` (line 127, `images: { orderBy: { sortOrder: 'asc' } }` under `include`) — Prisma returns the full row including the new column, no query change needed.

### Also needed for tasks 3/5 to compile — repository-layer types

These aren't explicitly called out under "Task 1" in tasks.md but are prerequisites the Prisma-typed layers need before task 3/5 code compiles. Do them as part of task 1's data-model pass:

**`backend/src/domain/repositories/productRepository.ts`** — add `color` to both image DTOs (lines 92–103):

```typescript
export interface ProductImageCreateData {
  productId: number;
  url: string;
  altText?: string | null;
  sortOrder?: number;
  color?: string | null;
}

export interface ProductImageUpdateData {
  url?: string;
  altText?: string | null;
  sortOrder?: number;
  color?: string | null;
}
```

**`backend/src/infrastructure/repositories/productImageRepository.ts`** — thread `color` through `create`/`update` (lines 34–59):

```typescript
async create(data: ProductImageCreateData): Promise<ProductImage> {
  const row = await prisma.productImage.create({
    data: {
      productId: data.productId,
      url: data.url,
      altText: data.altText ?? null,
      sortOrder: data.sortOrder ?? 0,
      color: data.color ?? null,
    },
  });
  return new ProductImage(row);
}

async update(id: number, data: ProductImageUpdateData): Promise<ProductImage> {
  const current = await this.findById(id);
  if (!current) throw new ImageNotFoundError();

  const row = await prisma.productImage.update({
    where: { id },
    data: {
      ...(data.url !== undefined && { url: data.url }),
      ...(data.altText !== undefined && { altText: data.altText }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.color !== undefined && { color: data.color }),
    },
  });
  return new ProductImage(row);
}
```

`productImageService.ts` and `productImageController.ts` need **zero code changes** — both are thin pass-throughs typed against these same interfaces (`add(data: ProductImageCreateData)`, `update(productId, id, data: ProductImageUpdateData)`, controller forwards `req.body` untyped-cast). Verify this explicitly (this satisfies tasks.md 5.1's "verify this explicitly" instruction) — do not add unnecessary code there.

**Optional but recommended — `backend/src/application/validator.ts`** `validateProductImageData` (lines 156–164), add a length guard consistent with the `@db.VarChar(50)` column (mirrors no existing pattern for `ProductVariant.color` since that's CJ-only-set today, but is good defensive practice for the new admin-settable field):

```typescript
export function validateProductImageData(data: Record<string, unknown>): void {
  const url = data['url'];
  if (url === undefined || url === null || url === '') {
    throw new ValidationError("Field 'url' is required");
  }
  if (typeof url === 'string' && url.length > 500) {
    throw new ValidationError("Field 'url' must not exceed 500 characters");
  }

  const color = data['color'];
  if (color !== undefined && color !== null && typeof color === 'string' && color.length > 50) {
    throw new ValidationError("Field 'color' must not exceed 50 characters");
  }
}
```

Note: `validateProductImageData` is only called from `ProductImageService.add()`, not `.update()` (existing asymmetry, line 39–45 of `productImageService.ts` has no validation call on update) — this plan does not change that asymmetry; it's pre-existing behavior outside this change's scope. There is no dedicated `validator.test.ts` coverage for `validateProductImageData` today (checked — not present); adding one is optional, not required by tasks.md.

**Verification for task 1**: `npx prisma migrate dev --name add_product_image_color` succeeds; `psql`/Prisma Studio shows the column; `cd backend && npx tsc --noEmit` compiles (will still show errors in files not yet updated by tasks 2–6 — that's expected until those land).

---

## Task 2 — CJ Image Extraction: Color Association (TDD)

### File: `backend/src/application/services/cjImageExtraction.ts`

Current shape (86 lines): `ExtractedCjImages { productImage?; variantImage? }`, `ImagePlanItem extends ExtractedCjImages { altText }`, `PlannedImage { url; altText }`, `planProductImages()` dedupes by raw `url` in a `Set<string>`, `extractCjImages()` reads `rawPayload.product.bigImage` / `rawPayload.variant.variantImage`.

Reuse `extractCjVariantAttributesFromRawPayload` from `backend/src/application/services/cjVariantAttributeExtraction.ts` (already imported nowhere in this file — add the import). That function already defensively handles non-record `rawPayload`/`variant` and returns `{ size: null, color: null }` on any failure — do not re-derive that defensiveness.

**Full replacement content:**

```typescript
import { extractCjVariantAttributesFromRawPayload } from './cjVariantAttributeExtraction';

export interface ExtractedCjImages {
  productImage?: string;
  variantImage?: string;
  color: string | null;
}

export interface ImagePlanItem extends ExtractedCjImages {
  altText: string;
}

export interface PlannedImage {
  url: string;
  altText: string;
  color: string | null;
}

export interface ImagePlan {
  mainImageUrl?: string;
  images: PlannedImage[]; // images[0] is always the main image when present; index = sortOrder
}

// Turns a pid group's per-item extracted images into a single, deduplicated
// image plan. The product-level image (identical across every item in a pid
// group in practice, since it comes from the same CJ product record) is
// preferred as the main image; if no item has one, the first *variant* image
// encountered becomes the main image instead — a product must not end up
// with ProductImage rows but a permanently-null mainImageUrl just because CJ
// only supplied a per-variant photo, not a per-product one.
//
// Dedup key is (url, color), not url alone (design.md D3): two variants of
// different colors sharing a URL must never collapse into one row, while
// same-color variants sharing a URL still collapse into one. The
// product-level image is always planned with color forced to null
// regardless of what extractCjImages derived for that item, since it is
// shared/product-level by definition (design.md D1).
export function planProductImages(items: ImagePlanItem[]): ImagePlan {
  const images: PlannedImage[] = [];
  const seenKeys = new Set<string>();

  function addImage(url: string | undefined, altText: string, color: string | null): void {
    if (!url) return;
    const key = `${url}\0${color ?? ''}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    images.push({ url, altText, color });
  }

  for (const item of items) {
    if (item.productImage) {
      addImage(item.productImage, item.altText, null);
      break;
    }
  }
  for (const item of items) {
    addImage(item.variantImage, item.altText, item.color);
  }

  return { mainImageUrl: images[0]?.url, images };
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
// actual runtime shape ever surprises this, matching this file's neighboring
// parseSizeColor()'s defensive style (cjCatalogSyncService.ts).
//
// color is derived via extractCjVariantAttributesFromRawPayload — the same
// function ProductVariant.color already uses (cj-variant-attribute-extraction)
// — so an image's color can never disagree with its own variant's color
// (design.md D2). It represents *this item's* derived variant color; callers
// decide whether to apply it (variantImage) or force it to null
// (productImage) — see planProductImages above.
export function extractCjImages(rawPayload: unknown): ExtractedCjImages {
  try {
    if (!isRecord(rawPayload)) return { color: null };

    const result: ExtractedCjImages = { color: null };

    const product = rawPayload['product'];
    if (isRecord(product) && isNonEmptyString(product['bigImage'])) {
      result.productImage = product['bigImage'];
    }

    const variant = rawPayload['variant'];
    if (isRecord(variant) && isNonEmptyString(variant['variantImage'])) {
      result.variantImage = variant['variantImage'];
    }

    result.color = extractCjVariantAttributesFromRawPayload(rawPayload).color;

    return result;
  } catch {
    return { color: null };
  }
}
```

### 2.1/2.3 — Test file: `backend/src/application/services/__tests__/cjImageExtraction.test.ts`

Every existing `extractCjImages(...)` assertion needs `color: null` (or the derived value) added — these payloads have no `variantKey`/`variantNameEn`/`variantProperty`, so `extractCjVariantAttributesFromRawPayload` always returns `color: null` for them. This is fixture-shape correction, not weakened assertions (tasks.md 9.1). Full replacement content:

```typescript
import { extractCjImages, planProductImages } from '../cjImageExtraction';

describe('extractCjImages', () => {
  it('should_return_both_images_when_present_and_valid', () => {
    const result = extractCjImages({
      product: { bigImage: 'https://a/p.jpg' },
      variant: { variantImage: 'https://a/v.jpg' },
    });

    expect(result).toEqual({ productImage: 'https://a/p.jpg', variantImage: 'https://a/v.jpg', color: null });
  });

  it('should_derive_color_from_the_variants_variantKey_alongside_variantImage', () => {
    const result = extractCjImages({
      variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' },
    });

    expect(result).toEqual({ variantImage: 'https://a/v.jpg', color: 'Black' });
  });

  it('should_return_only_productImage_when_variant_is_missing', () => {
    const result = extractCjImages({ product: { bigImage: 'https://a/p.jpg' } });

    expect(result).toEqual({ productImage: 'https://a/p.jpg', color: null });
  });

  it('should_return_only_variantImage_when_product_is_missing', () => {
    const result = extractCjImages({ variant: { variantImage: 'https://a/v.jpg' } });

    expect(result).toEqual({ variantImage: 'https://a/v.jpg', color: null });
  });

  it.each([null, undefined, 'a string', 42, [1, 2]])(
    'should_return_a_null_color_object_when_rawPayload_is_not_an_object (%p)',
    (value) => {
      expect(extractCjImages(value)).toEqual({ color: null });
    }
  );

  it('should_return_a_null_color_object_when_product_and_variant_keys_are_both_absent', () => {
    expect(extractCjImages({})).toEqual({ color: null });
  });

  it.each([12345, null, {}])('should_ignore_non_string_bigImage (%p)', (bigImage) => {
    expect(extractCjImages({ product: { bigImage } })).toEqual({ color: null });
  });

  it.each(['', '   '])('should_ignore_empty_or_whitespace_only_image_urls (%p)', (bigImage) => {
    expect(extractCjImages({ product: { bigImage } })).toEqual({ color: null });
  });

  it('should_ignore_a_non_object_product_or_variant_value', () => {
    expect(extractCjImages({ product: 'not-an-object', variant: ['a'] })).toEqual({ color: null });
  });

  it('should_never_throw_for_a_deeply_malformed_shape', () => {
    expect(() => extractCjImages(() => undefined)).not.toThrow();
    expect(extractCjImages(() => undefined)).toEqual({ color: null });
    expect(() => extractCjImages(Symbol('x'))).not.toThrow();
    expect(extractCjImages(Symbol('x'))).toEqual({ color: null });
  });
});

describe('planProductImages', () => {
  it('should_use_the_product_image_as_main_when_present', () => {
    const plan = planProductImages([{ productImage: 'A', altText: 'Dress', color: null }]);

    expect(plan.mainImageUrl).toBe('A');
    expect(plan.images).toEqual([{ url: 'A', altText: 'Dress', color: null }]);
  });

  it('should_fall_back_to_the_first_variant_image_as_main_when_no_product_image_exists', () => {
    // Regression: previously a product with only variant-level images ended up
    // with ProductImage rows but a permanently-null mainImageUrl.
    const plan = planProductImages([
      { variantImage: 'V1', altText: 'Dress Blue', color: 'Blue' },
      { variantImage: 'V2', altText: 'Dress Red', color: 'Red' },
    ]);

    expect(plan.mainImageUrl).toBe('V1');
    expect(plan.images).toEqual([
      { url: 'V1', altText: 'Dress Blue', color: 'Blue' },
      { url: 'V2', altText: 'Dress Red', color: 'Red' },
    ]);
  });

  it('should_prefer_a_product_image_found_on_a_later_item_over_an_earlier_variant_image', () => {
    const plan = planProductImages([
      { variantImage: 'V1', altText: 'Item 1', color: 'Blue' },
      { productImage: 'P', altText: 'Item 2', color: null },
    ]);

    // Product-level image always wins as main, regardless of item order —
    // then variant images are appended in item order.
    expect(plan.mainImageUrl).toBe('P');
    expect(plan.images).toEqual([
      { url: 'P', altText: 'Item 2', color: null },
      { url: 'V1', altText: 'Item 1', color: 'Blue' },
    ]);
  });

  it('should_deduplicate_identical_urls_across_items', () => {
    const plan = planProductImages([
      { productImage: 'A', variantImage: 'A', altText: 'Item 1', color: null },
      { variantImage: 'A', altText: 'Item 2', color: null },
    ]);

    expect(plan.images).toEqual([{ url: 'A', altText: 'Item 1', color: null }]);
  });

  it('should_force_the_product_level_image_color_to_null_even_if_the_item_has_a_derived_color', () => {
    // A product-level image is shared regardless of which variant supplied
    // the rawPayload it came from — design.md D1.
    const plan = planProductImages([{ productImage: 'P', altText: 'Item 1', color: 'Black' }]);

    expect(plan.images).toEqual([{ url: 'P', altText: 'Item 1', color: null }]);
  });

  it('should_keep_separate_rows_when_two_different_colors_share_the_same_variant_image_url', () => {
    const plan = planProductImages([
      { variantImage: 'SAME', altText: 'Black variant', color: 'Black' },
      { variantImage: 'SAME', altText: 'Red variant', color: 'Red' },
    ]);

    expect(plan.images).toEqual([
      { url: 'SAME', altText: 'Black variant', color: 'Black' },
      { url: 'SAME', altText: 'Red variant', color: 'Red' },
    ]);
  });

  it('should_dedupe_same_color_variant_images_sharing_a_url_into_one_row', () => {
    const plan = planProductImages([
      { variantImage: 'SAME', altText: 'Black M', color: 'Black' },
      { variantImage: 'SAME', altText: 'Black L', color: 'Black' },
    ]);

    expect(plan.images).toEqual([{ url: 'SAME', altText: 'Black M', color: 'Black' }]);
  });

  it('should_return_no_main_image_and_an_empty_list_when_no_item_has_any_image', () => {
    const plan = planProductImages([{ altText: 'Item 1', color: null }, { altText: 'Item 2', color: null }]);

    expect(plan.mainImageUrl).toBeUndefined();
    expect(plan.images).toEqual([]);
  });

  it('should_return_an_empty_plan_for_an_empty_items_array', () => {
    expect(planProductImages([])).toEqual({ mainImageUrl: undefined, images: [] });
  });
});
```

**Verification**: `cd backend && npm test -- --watchAll=false --testPathPattern=cjImageExtraction` — all pass.

---

## Task 3 — CJ Catalog Promotion: Persist Color

### 3.1 `backend/src/application/services/cjProductImageSync.ts`

`createProductImageRecord` (lines 15–20) needs a `color` field in its data param — it's the single shared write helper used by both the promotion service and the existing image backfill (per its own header comment, line 5–6):

```typescript
export async function createProductImageRecord(
  client: Prisma.TransactionClient,
  data: { productId: number; url: string; altText: string; sortOrder: number; color: string | null }
): Promise<void> {
  await client.productImage.create({ data });
}
```

### 3.1 (continued) `backend/src/application/services/cjCatalogPromotionService.ts`

Only line 221 changes — pass `image.color` through (the `image` variable is already a `PlannedImage`, which now carries `color`):

```typescript
for (let i = 0; i < imagePlan.images.length; i++) {
  const image = imagePlan.images[i]!;
  await createProductImageRecord(tx, { productId, url: image.url, altText: image.altText, sortOrder: i, color: image.color });
}
```

### Not in tasks.md's explicit list, but required for the codebase to keep compiling and behaving correctly — `backend/src/application/services/cjProductImageBackfill.ts`

This file (`groupVariantsByProduct` / `backfillProductImages`) is the **existing** production image backfill for products that were promoted before *any* image capture existed (distinct from the new `cjImageColorBackfill.ts` in task 6, which only sets `color` on already-imaged rows). It calls both `planProductImages` and `createProductImageRecord` (lines 41–52), so it must pass `color` through too — for free, since it already derives it via `extractCjImages`:

```typescript
export async function backfillProductImages(
  client: Prisma.TransactionClient,
  candidate: BackfillCandidate
): Promise<BackfillResult> {
  if (candidate.variants.length === 0) return { imaged: false };

  const plan = planProductImages(
    candidate.variants.map((v) => ({ ...extractCjImages(v.rawPayload), altText: v.title }))
  );
  if (plan.images.length === 0) return { imaged: false };

  if (plan.mainImageUrl) {
    await setProductMainImage(client, candidate.productId, plan.mainImageUrl);
  }
  for (let i = 0; i < plan.images.length; i++) {
    const image = plan.images[i]!;
    await createProductImageRecord(client, { productId: candidate.productId, url: image.url, altText: image.altText, sortOrder: i, color: image.color });
  }

  return { imaged: true };
}
```

(Only the `createProductImageRecord` call's argument object changes — one line.)

### 3.2 — Test files

**`backend/src/application/services/__tests__/cjCatalogPromotionService.test.ts`** — the mock setup (`mockProductImageCreate`) captures the `data` object passed to `productImage.create`, so every existing exact-match assertion on that shape needs `color` added. Specific edits (search-and-replace by test name):

1. `should_set_mainImageUrl_and_create_a_sortOrder_zero_image_when_a_new_product_has_a_product_image` (currently line 181–183):
```typescript
expect(mockProductImageCreate).toHaveBeenCalledWith({
  data: { productId: 20, url: 'https://img/p.jpg', altText: 'Test Dress', sortOrder: 0, color: null },
});
```

2. `should_create_an_additional_image_for_a_variant_whose_image_differs_from_the_product_image` (currently line 211–217) — both items' `rawPayload.variant` have no `variantKey`, so both derive `color: null`:
```typescript
expect(mockProductImageCreate).toHaveBeenCalledTimes(2);
expect(mockProductImageCreate).toHaveBeenNthCalledWith(1, {
  data: { productId: 20, url: 'A', altText: 'Test Dress', sortOrder: 0, color: null },
});
expect(mockProductImageCreate).toHaveBeenNthCalledWith(2, {
  data: { productId: 20, url: 'B', altText: 'Test Dress', sortOrder: 1, color: null },
});
```

3. `should_set_mainImageUrl_from_the_first_variant_image_when_no_product_image_exists` (currently line 230–233):
```typescript
expect(mockProductUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { mainImageUrl: 'https://img/v.jpg' } });
expect(mockProductImageCreate).toHaveBeenCalledWith({
  data: { productId: 20, url: 'https://img/v.jpg', altText: 'Test Dress', sortOrder: 0, color: null },
});
```

4. `should_not_duplicate_the_image_when_the_variant_image_exactly_matches_the_product_image` (line 236–245) — only asserts `toHaveBeenCalledTimes(1)`, no shape assertion, **no change needed**.

5. `should_create_no_images_when_no_image_data_is_present`, `should_never_copy_supplierCost_into_any_public_facing_field`, `should_group_items_sharing_the_same_pid_into_a_single_product`, etc. — no `data` shape assertions on images, **no change needed**.

6. **Add a new test** (this is what tasks.md 3.2 is actually asking for — coverage that a *real* derived color propagates end to end, plus explicit coverage of the `null` product-level case, which is already covered by #1 above):

```typescript
it('should_persist_the_variants_derived_color_on_its_image_record', async () => {
  const item = buildCatalogItem({
    rawPayload: { product: {}, variant: { variantImage: 'https://img/v.jpg', variantKey: 'Black-XXL' } },
  });
  catalogRepo.findManyByIds.mockResolvedValue([item]);
  mockProductCreate.mockResolvedValue({ id: 20 });
  mockVariantCreate.mockResolvedValue({ id: 50 });

  await service.promote(3, { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 });

  expect(mockProductImageCreate).toHaveBeenCalledWith({
    data: { productId: 20, url: 'https://img/v.jpg', altText: 'Test Dress', sortOrder: 0, color: 'Black' },
  });
});
```

Place it right after test #2 above (`should_create_an_additional_image_for_a_variant_whose_image_differs_from_the_product_image`), inside the same `describe('promote', ...)` block.

**`backend/src/application/services/__tests__/cjProductImageBackfill.test.ts`** (this is `cjProductImageBackfill.ts`'s own test file — covered under task 9's mandatory review since it references `planProductImages`/`extractCjImages`/`ProductImage`, see Task 9 below, but the edit is described here since it's mechanically identical to the promotion test edits):

- Line 53–55 (`should_backfill_the_main_image_from_the_first_variants_rawPayload_and_report_imaged_true`):
```typescript
expect(mockProductImageCreate).toHaveBeenCalledWith({
  data: { productId: 20, url: 'https://a/p.jpg', altText: 'Dress', sortOrder: 0, color: null },
});
```
- Line 71–73 (`should_backfill_a_distinct_variant_image_for_a_second_variant_in_the_group`, `toHaveBeenNthCalledWith(2, ...)`):
```typescript
expect(mockProductImageCreate).toHaveBeenNthCalledWith(2, {
  data: { productId: 20, url: 'B', altText: 'Dress Blue', sortOrder: 1, color: null },
});
```
- Other assertions in this file only check call counts/`imaged` booleans/`mainImageUrl` — no change needed.
- Optional additional coverage (recommended, mirrors the promotion service's new test): add a case where `rawPayload.variant.variantKey` is set and assert the created record's `color`.

**Verification**: `cd backend && npm test -- --watchAll=false --testPathPattern="cjCatalogPromotionService|cjProductImageBackfill"` — all pass.

---

## Task 4 — Public API: Expose Image Color

### 4.1 `backend/src/presentation/serializers/publicProduct.ts`

Two edits — `PublicProductImageDTO` (lines 25–30) and `serializeImage` (lines 61–68):

```typescript
export interface PublicProductImageDTO {
  id?: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  color: string | null;
}
```

```typescript
function serializeImage(image: ProductImage): PublicProductImageDTO {
  return {
    id: image.id,
    url: image.url,
    altText: image.altText ?? null,
    sortOrder: image.sortOrder,
    color: image.color ?? null,
  };
}
```

No other field is added — allow-list intact (satisfies tasks.md 4.1's explicit check).

### 4.2 `backend/src/presentation/serializers/__tests__/publicProduct.test.ts`

`makeProduct()`'s `images` fixture (lines 20–24) currently has no `color` key on any image — leave as-is for images where you don't need a specific value (the domain model defaults `color` to `null`), but change at least one to carry a real value so the new assertion below is meaningful:

```typescript
images: [
  { productId: 1, url: 'https://img/2.jpg', sortOrder: 2, color: 'Red' },
  { productId: 1, url: 'https://img/0.jpg', sortOrder: 0, color: null },
  { productId: 1, url: 'https://img/1.jpg', sortOrder: 1, color: 'Blue' },
],
```

Add two new tests (place near the existing `'orders images by sortOrder'` test, inside the top `describe('serializePublicProduct', ...)` block):

```typescript
it('exposes only the customer-safe allow-list of image fields', () => {
  const dto = serializePublicProduct(makeProduct());
  expect(Object.keys(dto.images[0]!).sort()).toEqual(['altText', 'color', 'id', 'sortOrder', 'url'].sort());
});

it('includes each image color, with null for shared/product-level images', () => {
  const dto = serializePublicProduct(makeProduct());
  // Ordered by sortOrder: 0 (null), 1 (Blue), 2 (Red)
  expect(dto.images.map((i) => i.color)).toEqual([null, 'Blue', 'Red']);
});
```

The existing top-level allow-list test (`'exposes only the customer-safe allow-list of fields'`, lines 28–50) asserts `Object.keys(dto)` and `Object.keys(dto.variants[0])` — **unaffected**, do not touch (image-level keys are a separate object, covered by the new test above).

The existing `'never emits supplier or internal fields...'` test (lines 120–137) — unaffected, no change needed.

**Verification**: `cd backend && npm test -- --watchAll=false --testPathPattern=publicProduct` — all pass.

---

## Task 5 — Admin Image Endpoints: Accept and Return Color

### 5.1

As established in Task 1's "Also needed for tasks 3/5" subsection: `ProductImageCreateData`/`ProductImageUpdateData` (domain repository interfaces) and `ProductImageRepository.create`/`.update` (infrastructure) already carry `color` through once Task 1's edits land. **`productImageService.ts` and `productImageController.ts` require no code changes** — verify this explicitly by reading both files after Task 1's edits and confirming they still compile and pass `color` through generically (they type against `ProductImageCreateData`/`ProductImageUpdateData` and spread `req.body`).

List (`GET /api/admin/products/:id/images`) and get responses already return the full `ProductImage` entity (`res.json({ data: images })` / `res.json({ data: image })` in `productImageController.ts`), so `color` appears automatically once the domain model has it — no serializer exists on the admin side to update.

### 5.2 `backend/src/presentation/controllers/__tests__/productImageController.test.ts`

Currently imports only `listImages, addImage, deleteImage` (line 28–32) — `updateImage` has **zero test coverage today**. Add the import and a new `describe('updateImage', ...)` block, plus a color-specific `addImage` test. Edits:

1. Update the import (line 28–32):
```typescript
import {
  listImages,
  addImage,
  updateImage,
  deleteImage,
} from '../productImageController';
```

2. Add inside `describe('addImage', ...)`, after the existing `'should inject productId from route param'` test:
```typescript
it('should pass color through to the service on create', async () => {
  const img = makeImage({ color: 'Black' });
  mockAdd.mockResolvedValue(img);
  const req = { params: { id: '1' }, body: { url: 'https://example.com/img.jpg', color: 'Black' } } as unknown as Request;
  const res = mockRes();
  await addImage(req, res, mockNext);
  expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'Black' }));
  expect(res.status).toHaveBeenCalledWith(201);
});
```

3. Add a new top-level `describe` block (place between `describe('addImage', ...)` and `describe('deleteImage', ...)`):
```typescript
describe('updateImage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with the updated image when color is provided', async () => {
    const img = makeImage({ color: 'Black' });
    mockUpdate.mockResolvedValue(img);
    const req = { params: { id: '1', imageId: '1' }, body: { color: 'Black' } } as unknown as Request;
    const res = mockRes();
    await updateImage(req, res, mockNext);
    expect(mockUpdate).toHaveBeenCalledWith(1, 1, { color: 'Black' });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: img,
      message: 'Image updated successfully',
    });
  });

  it('should call next when image not found', async () => {
    const err = Object.assign(new Error('not found'), { code: 'IMAGE_NOT_FOUND', status: 404 });
    mockUpdate.mockRejectedValue(err);
    const req = { params: { id: '1', imageId: '99' }, body: { color: 'Black' } } as unknown as Request;
    const res = mockRes();
    await updateImage(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});
```

`mockUpdate` is already declared and wired into the `jest.mock('../../../application/services/productImageService', ...)` block (lines 4–18) — no new mock plumbing needed. `makeImage()` helper (line 34–35) already accepts arbitrary overrides via `ConstructorParameters<typeof ProductImage>[0]`, so `makeImage({ color: 'Black' })` works with zero helper changes once `ProductImage`'s constructor accepts `color` (Task 1.3).

**Verification**: `cd backend && npm test -- --watchAll=false --testPathPattern=productImageController` — all pass.

---

## Task 6 — Color Backfill: Service and Script (TDD)

This is new code — no existing file to modify. Follow the **bulk SQL pattern from commit `9c37bf9`** (see the discrepancy note at the top of this plan), not the per-row-loop pattern currently sitting in `cjVariantAttributeBackfill.ts` on this branch.

### Design recap (this plan's concrete answer to an ambiguity design.md leaves open)

design.md's D5 says: match `(productId, url)` from re-derived `CjCatalogItem.rawPayload` against existing `ProductImage` rows, bulk-update matches. It does not explicitly address what happens when **two different `CjCatalogItem` rows derive conflicting colors for the same existing `(productId, url)` image row** — this is possible for data promoted *before* this feature existed, when dedup was by URL alone (today's `planProductImages`), so a single `ProductImage` row may already conflate what should have been two different-colored images. This plan resolves it the same way `cjVariantAttributeBackfill.ts`'s `planVariantAttributeUpdates` resolves its analogous sibling-collision case (see `attributePairKey`/`reservedPairs` there): **skip the ambiguous row, leave its `color` as `null`, log a warning, count it in `skippedAmbiguous`.** This is consistent with the spec's "An image cannot be matched to a derivable color... backfill SHALL leave that image's color as null and SHALL continue processing" scenario — an ambiguous match is a case where the color truly cannot be safely determined for that persisted row.

### 6.2 New file: `backend/src/application/services/cjImageColorBackfill.ts`

```typescript
import { Prisma } from '@prisma/client';
import { extractCjImages } from './cjImageExtraction';
import { logger } from '../../infrastructure/logger';

export interface BackfillCandidateRow {
  productId: number | null;
  rawPayload: unknown;
}

export interface ExistingImageRow {
  id: number;
  productId: number;
  url: string;
  color: string | null;
}

export interface PlannedImageColorUpdate {
  imageId: number;
  color: string;
}

export interface PlanImageColorUpdatesResult {
  updates: PlannedImageColorUpdate[];
  skippedAmbiguous: number;
}

function imageKey(productId: number, url: string): string {
  return `${productId}\0${url}`;
}

// Pure — no I/O — matches an already-persisted ProductImage row to the color
// derived from stored CjCatalogItem.rawPayload, purely by (productId, url).
// Only variantImage entries carry a non-null derivable color (the
// product-level image is always color=null — nothing to backfill there, and
// it's already null by default on every pre-existing row).
//
// A single existing image row can be referenced by more than one
// CjCatalogItem row (e.g. several sizes of the same color sharing one
// variantImage URL — expected and fine; or, for data promoted before this
// feature existed, two genuinely different colors that happened to share a
// URL under the old URL-only dedup). If two catalog item rows derive
// *different* colors for the same existing image row, the match is
// ambiguous and is skipped entirely (color stays null) rather than
// guessing — mirrors the sibling (size,color) collision handling in
// cjVariantAttributeBackfill.ts's planVariantAttributeUpdates.
export function planImageColorUpdates(
  candidateRows: BackfillCandidateRow[],
  existingImages: ExistingImageRow[]
): PlanImageColorUpdatesResult {
  const byProductUrl = new Map<string, ExistingImageRow>();
  const byId = new Map<number, ExistingImageRow>();
  for (const image of existingImages) {
    byProductUrl.set(imageKey(image.productId, image.url), image);
    byId.set(image.id, image);
  }

  const desiredColorByImageId = new Map<number, string | 'AMBIGUOUS'>();

  for (const row of candidateRows) {
    if (row.productId == null) continue;
    const extracted = extractCjImages(row.rawPayload);
    if (!extracted.variantImage || extracted.color == null) continue;

    const existing = byProductUrl.get(imageKey(row.productId, extracted.variantImage));
    if (!existing) continue; // no persisted row to backfill (design.md Risk: manually-added or non-CJ images)

    const current = desiredColorByImageId.get(existing.id);
    if (current === undefined) {
      desiredColorByImageId.set(existing.id, extracted.color);
    } else if (current !== 'AMBIGUOUS' && current !== extracted.color) {
      desiredColorByImageId.set(existing.id, 'AMBIGUOUS');
      logger.warn('Skipping CJ image color backfill due to conflicting colors for the same image URL', {
        imageId: existing.id,
        productId: existing.productId,
        url: existing.url,
      });
    }
  }

  const updates: PlannedImageColorUpdate[] = [];
  let skippedAmbiguous = 0;
  for (const [imageId, color] of desiredColorByImageId) {
    if (color === 'AMBIGUOUS') {
      skippedAmbiguous += 1;
      continue;
    }
    const existing = byId.get(imageId)!;
    if (existing.color === color) continue; // already correct — idempotent re-run
    updates.push({ imageId, color });
  }

  return { updates, skippedAmbiguous };
}

export interface BackfillImageColorsResult {
  imagesUpdated: number;
}

// Bulk UPDATE ... FROM (VALUES ...) from the start, chunked by the caller —
// the pattern proven necessary for this exact pipeline (production P2028
// "transaction not found" against ~11k CjCatalogItem rows with a per-row
// update() loop; see commit 9c37bf9 "fix(suppliers): make CJ variant
// attribute backfill scale to production" on branch
// fix/cj-variant-backfill-bulk-sql — not yet merged into develop as of this
// writing, so this file does NOT reuse that code, it mirrors its pattern).
export async function backfillImageColors(
  client: Prisma.TransactionClient,
  planned: PlannedImageColorUpdate[]
): Promise<BackfillImageColorsResult> {
  if (planned.length === 0) {
    return { imagesUpdated: 0 };
  }

  const rows = Prisma.join(
    planned.map((u) => Prisma.sql`(${u.imageId}::integer, ${u.color}::varchar(50))`)
  );
  const imagesUpdated = await client.$executeRaw`
    UPDATE "ProductImage" AS t
    SET color = v.color
    FROM (VALUES ${rows}) AS v(id, color)
    WHERE t.id = v.id
  `;

  return { imagesUpdated };
}
```

Note: `ProductImage` has no `updatedAt` column (only `createdAt`, per schema.prisma line 96) — unlike `CjCatalogItem`/`ProductVariant`, do not add an `updatedAt = now()` `SET` clause here; there is no such column to set.

### 6.1 — Test file: `backend/src/application/services/__tests__/cjImageColorBackfill.test.ts` (write first, TDD)

Mirrors `cjVariantAttributeBackfill.test.ts`'s structure exactly (same `$executeRaw` mock shape):

```typescript
import {
  planImageColorUpdates,
  backfillImageColors,
  BackfillCandidateRow,
  ExistingImageRow,
} from '../cjImageColorBackfill';

describe('planImageColorUpdates', () => {
  it('should_plan_a_color_update_when_a_persisted_image_matches_a_derivable_variant_color', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    const { updates, skippedAmbiguous } = planImageColorUpdates(candidates, existing);

    expect(skippedAmbiguous).toBe(0);
    expect(updates).toEqual([{ imageId: 100, color: 'Black' }]);
  });

  it('should_leave_non_matching_images_untouched', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/other.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    expect(planImageColorUpdates(candidates, existing).updates).toEqual([]);
  });

  it('should_report_zero_updates_when_already_backfilled', () => {
    // Idempotence: re-running after a complete run must produce zero changes.
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: 'Black' }];

    expect(planImageColorUpdates(candidates, existing).updates).toEqual([]);
  });

  it('should_skip_and_count_ambiguous_matches_when_two_catalog_items_derive_conflicting_colors_for_the_same_image', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Red-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    const { updates, skippedAmbiguous } = planImageColorUpdates(candidates, existing);

    expect(skippedAmbiguous).toBe(1);
    expect(updates).toEqual([]);
  });

  it('should_leave_color_null_when_the_variant_color_cannot_be_derived', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg' } } }, // no variantKey/NameEn/Property
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    expect(planImageColorUpdates(candidates, existing).updates).toEqual([]);
  });

  it('should_ignore_candidate_rows_with_no_promoted_product', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: null, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    expect(planImageColorUpdates(candidates, existing).updates).toEqual([]);
  });

  it('should_never_modify_url_altText_or_sortOrder_fields', () => {
    // planImageColorUpdates's return shape ({ imageId, color }) makes this
    // structurally true — documented as an explicit regression guard.
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    const { updates } = planImageColorUpdates(candidates, existing);

    expect(Object.keys(updates[0]!).sort()).toEqual(['color', 'imageId']);
  });
});

describe('backfillImageColors', () => {
  let executeRaw: jest.Mock;
  let client: { $executeRaw: jest.Mock };

  beforeEach(() => {
    executeRaw = jest.fn().mockResolvedValue(1);
    client = { $executeRaw: executeRaw };
  });

  function sqlTextOf(callArgs: unknown[]): string {
    const strings = callArgs[0] as TemplateStringsArray;
    return strings.join('');
  }

  it('should_bulk_update_image_colors_in_a_single_statement', async () => {
    const result = await backfillImageColors(client as never, [{ imageId: 100, color: 'Black' }]);

    expect(result).toEqual({ imagesUpdated: 1 });
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlTextOf(executeRaw.mock.calls[0])).toContain('"ProductImage"');
  });

  it('should_be_a_no_op_for_an_empty_plan', async () => {
    const result = await backfillImageColors(client as never, []);

    expect(result).toEqual({ imagesUpdated: 0 });
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
```

### 6.3 New file: `backend/scripts/backfillCjImageColors.ts`

Mirrors `backend/scripts/backfillCjVariantAttributes.ts` **after** commit `9c37bf9`'s fix (chunk size 2000, per-chunk transaction with `timeout: 60_000`, progress logging per chunk, final summary line):

```typescript
/**
 * One-off backfill: assigns ProductImage.color to already-persisted image
 * rows for products promoted from CJ Dropshipping before image-color
 * association existed. Re-derives color from stored CjCatalogItem.rawPayload
 * — zero CJ API calls. Idempotent (re-running after a complete run produces
 * zero updates).
 *
 * Uses bulk UPDATE...FROM(VALUES) SQL from the start, chunked — mirrors the
 * fix applied to backfillCjVariantAttributes.ts after its original per-row
 * update() loop hit Prisma's transaction timeout (P2028) against
 * production's ~11k rows. See cjImageColorBackfill.ts's backfillImageColors()
 * header comment for the precedent commit.
 *
 * Run with: npx ts-node --transpile-only scripts/backfillCjImageColors.ts
 * (from backend/, against the target DATABASE_URL)
 *
 * Safe to run as a local/manual process wrapping DB-only work in
 * prisma.$transaction — this is NOT safe to assume if ever ported into a
 * scheduled Lambda handler. See backfillCjProductImages.ts for the same caveat.
 */
import { prisma } from '../src/infrastructure/prismaClient';
import {
  planImageColorUpdates,
  backfillImageColors,
  BackfillCandidateRow,
  ExistingImageRow,
} from '../src/application/services/cjImageColorBackfill';

const CHUNK_SIZE = 2000;

async function main() {
  const rows = await prisma.cjCatalogItem.findMany({
    where: { promotedVariant: { isNot: null } },
    select: {
      rawPayload: true,
      promotedVariant: { select: { productId: true } },
    },
    orderBy: { id: 'asc' },
  });

  const candidates: BackfillCandidateRow[] = rows.map((row) => ({
    productId: row.promotedVariant?.productId ?? null,
    rawPayload: row.rawPayload,
  }));

  const productIds = Array.from(
    new Set(candidates.map((c) => c.productId).filter((id): id is number => id != null))
  );

  const existingImages: ExistingImageRow[] =
    productIds.length > 0
      ? await prisma.productImage.findMany({
          where: { productId: { in: productIds } },
          select: { id: true, productId: true, url: true, color: true },
        })
      : [];

  const { updates, skippedAmbiguous } = planImageColorUpdates(candidates, existingImages);

  let imagesUpdated = 0;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const result = await prisma.$transaction((tx) => backfillImageColors(tx, chunk), {
      timeout: 60_000,
    });
    imagesUpdated += result.imagesUpdated;
    console.log(
      `[backfill-cj-image-colors] progress: ${Math.min(i + CHUNK_SIZE, updates.length)}/${updates.length}`
    );
  }

  console.log(
    `[backfill-cj-image-colors] done. processed=${candidates.length} imagesUpdated=${imagesUpdated} skipped=${skippedAmbiguous}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Summary line matches tasks.md 6.3's required `processed / imagesUpdated / skipped` shape.

### 6.4 — Scratch-table / dev-DB validation

Before trusting this against the real dev DB in task 11, sanity-check the raw SQL shape in isolation (same spirit as the prior backfill's validation, no dedicated scratch-table script exists to copy from since that fix was never run through an OpenSpec change — do this ad hoc):

```bash
cd backend
docker exec -it ecommerce-db psql -U <user> -d <db> -c "
CREATE TABLE scratch_product_image_color_test AS SELECT id, color FROM \"ProductImage\" LIMIT 5;
UPDATE scratch_product_image_color_test AS t
SET color = v.color
FROM (VALUES (1, 'Black'::varchar(50)), (2, 'Red'::varchar(50))) AS v(id, color)
WHERE t.id = v.id;
SELECT * FROM scratch_product_image_color_test;
DROP TABLE scratch_product_image_color_test;
"
```

Confirms the `UPDATE ... FROM (VALUES ...)` syntax and casts are valid against the actual Postgres version in use before running the real script.

**Verification for 6.1–6.5**: `cd backend && npm test -- --watchAll=false --testPathPattern=cjImageColorBackfill` — all pass.

---

## Task 9 — Review and Update Existing Unit Tests (MANDATORY)

### 9.1

Already covered file-by-file above:
- `cjImageExtraction.test.ts` → Task 2 section.
- `cjCatalogPromotionService.test.ts` → Task 3 section.
- `publicProduct.test.ts` (serializer fixtures) → Task 4 section.
- `cjProductImageBackfill.test.ts` → Task 3 section (the two `mockProductImageCreate` exact-match assertions).
- `productImageController.test.ts` → Task 5 section.

### 9.2

Ran `grep -rln "ProductImage\|planProductImages\|extractCjImages" backend/src` during this plan's research. Full result set and disposition:

| File | Needs change? |
|---|---|
| `backend/src/api-spec.yml` | Out of scope for this plan (task 13, docs) |
| `backend/src/application/services/cjCatalogPromotionService.ts` | Yes — Task 3 |
| `backend/src/application/services/cjImageExtraction.ts` | Yes — Task 2 |
| `backend/src/application/services/cjProductImageBackfill.ts` | Yes — Task 3 |
| `backend/src/application/services/cjProductImageSync.ts` | Yes — Task 3 |
| `backend/src/application/services/productImageService.ts` | No — verified pass-through, Task 5 |
| `backend/src/application/services/__tests__/cjCatalogPromotionService.test.ts` | Yes — Task 3 |
| `backend/src/application/services/__tests__/cjImageExtraction.test.ts` | Yes — Task 2 |
| `backend/src/application/services/__tests__/cjProductImageBackfill.test.ts` | Yes — Task 3 |
| `backend/src/application/validator.ts` | Optional — Task 1 |
| `backend/src/domain/models/index.ts` | No — barrel re-export only, checked, no change |
| `backend/src/domain/models/product.ts` | No — verified, maps `ConstructorParameters<typeof ProductImage>[0]` generically |
| `backend/src/domain/models/productImage.ts` | Yes — Task 1 |
| `backend/src/domain/repositories/index.ts` | No — barrel re-export only, checked, no change |
| `backend/src/domain/repositories/productRepository.ts` | Yes — Task 1 |
| `backend/src/infrastructure/import/mapSupplierFeedProduct.ts` | No — only a comment mentions `ProductImage` (line 50, "zero ProductImage rows"), no actual construction; unrelated import path (non-CJ supplier feed) |
| `backend/src/infrastructure/import/supplierFeedImporter.ts` | No — only comments (lines 179–180), this importer explicitly never touches `ProductImage` |
| `backend/src/infrastructure/import/__tests__/supplierFeedImporter.test.ts` | No — test name mentions `ProductImage` in prose only (`'updates an existing product and replaces its variants without touching ProductImage'`), no `ProductImage` construction in the test body |
| `backend/src/infrastructure/repositories/productImageRepository.ts` | Yes — Task 1 |
| `backend/src/presentation/controllers/productImageController.ts` | No — verified pass-through, Task 5 |
| `backend/src/presentation/controllers/__tests__/productImageController.test.ts` | Yes — Task 5 |
| `backend/src/presentation/serializers/publicProduct.ts` | Yes — Task 4 |

No suite outside this list needs fixture updates.

---

## Task 10 — Run Unit Tests and Verify Database State (MANDATORY)

### 10.1 Baseline

```sql
SELECT
  (SELECT count(*) FROM "Product") AS product_count,
  (SELECT count(*) FROM "ProductVariant") AS variant_count,
  (SELECT count(*) FROM "ProductImage") AS image_count,
  (SELECT count(*) FROM "CjCatalogItem") AS cj_item_count;
```
Run via `docker exec -it ecommerce-db psql -U <user> -d <db> -c "..."` and record the output before running anything else.

### 10.2 Targeted tests

```bash
cd backend
npm test -- --watchAll=false --testPathPattern="cjImageExtraction|cjCatalogPromotion|cjImageColorBackfill|publicProduct"
```

Also run the two files not covered by that pattern but touched by this plan:

```bash
npm test -- --watchAll=false --testPathPattern="cjProductImageBackfill|productImageController"
```

### 10.3 Full suite

```bash
npm test
```

Record total test count, pass count, and runtime (compare against the `862/862` baseline noted in the prior `cj-variant-attribute-extraction` change's commit message, `76277f0` — the number should now be higher given the new `cjImageColorBackfill.test.ts` file and the added cases in existing files, and all must still be passing, 0 failing).

### 10.4 Post-test DB state

Re-run the same query as 10.1. Unit tests mock Prisma throughout (per `jest.mock('../../../infrastructure/prismaClient', ...)` pattern used in every service test file touched by this plan) so they should not mutate the real DB at all — counts must be identical. If any migration-verification step from Task 1.2 (`npx prisma migrate dev`) altered row counts, that's expected and should be documented separately from the "unit tests didn't mutate data" claim.

### 10.5 Report

Create `openspec/changes/cj-variant-color-images/reports/YYYY-MM-DD-step-10-unit-test-and-db-verification.md` (use the actual run date) documenting: baseline counts, test command outputs (targeted + full suite pass/fail counts and runtime), post-test counts, and an explicit statement that they match. Follow the format of `openspec/changes/cj-variant-attribute-extraction/reports/2026-07-11-step-4-unit-test-and-db-verification.md` as a template (same change lineage, same report shape expected by `docs/openspec-tasks-mandatory-steps.md`).

---

## Task 11 — Manual Endpoint Testing with curl (MANDATORY — AGENT MUST EXECUTE)

### 11.1 Pre-test baseline

```bash
docker exec -it ecommerce-db psql -U <user> -d <db> -c '
SELECT
  count(*) FILTER (WHERE color IS NULL) AS null_color,
  count(*) FILTER (WHERE color IS NOT NULL) AS non_null_color
FROM "ProductImage";'
```

Ensure backend (`:3000`) and the Docker DB are running (`docker compose up -d` from repo root per `docs/backend-standards.md`'s Development environment section).

### 11.2 Promotion with multi-color group

Requires a seeded/staging `CjCatalogItem` group (same `pid`, multiple `vid`s with different colors) not yet promoted. If no such fixture exists in the dev DB, either use a real staged CJ sync (`POST /api/admin/suppliers/:id/cj/catalog/sync` if that's the existing sync flow — check `cjCatalogSyncController`/routes for the exact path) or insert one or two `CjCatalogItem` rows directly via `psql`/Prisma Studio with distinct `rawPayload.variant.{variantKey,variantImage}` values (e.g. `Black-M` → `variantImage: 'https://.../black.jpg'`, `Red-M` → `variantImage: 'https://.../red.jpg'`) sharing the same `pid`.

```bash
# Get an admin bearer token first (existing admin auth flow)
curl -s -X POST http://localhost:3000/api/admin/suppliers/<supplierId>/cj/catalog/promote \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"categoryId": <id>, "items": [{"cjCatalogItemId": <id1>, "publicPrice": 39.99}, {"cjCatalogItemId": <id2>, "publicPrice": 39.99}]}'
```

Verify via psql:
```sql
SELECT id, url, "sortOrder", color FROM "ProductImage" WHERE "productId" = <productId> ORDER BY "sortOrder";
```
Expect: one row with `color IS NULL` (the product-level main image, if present) and one row per distinct color for the variant images.

### 11.3 Admin image create/update with color

```bash
curl -s -X POST http://localhost:3000/api/admin/products/<productId>/images \
  -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/test-black.jpg", "color": "Black"}'
# Expect 201, body.data.color === "Black"

curl -s -X PATCH http://localhost:3000/api/admin/products/<productId>/images/<imageId> \
  -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" \
  -d '{"color": "Red"}'
# Expect 200, body.data.color === "Red"
```
Delete the test image afterward (`DELETE /api/admin/products/:id/images/:imageId`) as part of restoration (11.6).

### 11.4 Public API

```bash
curl -s http://localhost:3000/api/public/products/<productId> | python -m json.tool
```
Verify every entry in `images[]` has a `color` key (`null` or a string), and confirm no `supplierCost`/`supplierReference`/`supplierId` string appears anywhere in the response body (grep the raw response).

### 11.5 Backfill script

```bash
cd backend
npx ts-node --transpile-only scripts/backfillCjImageColors.ts
```
Verify the summary line (`processed=... imagesUpdated=... skipped=...`) and spot-check a few updated rows via psql. Then run it again immediately and confirm `imagesUpdated=0` (idempotence).

### 11.6 Restore

Delete any test `CjCatalogItem`/`Product`/`ProductVariant`/`ProductImage` rows created purely for this manual test (unless they were pre-existing seed data), delete the ad hoc admin-created test image from 11.3, and re-run the 11.1 baseline query — document that counts match pre-test state (except for intentionally-kept promoted test data, if any — call that out explicitly).

### 11.7 Report

Create `openspec/changes/cj-variant-color-images/reports/YYYY-MM-DD-step-11-curl-endpoint-testing.md` documenting every curl command run, its response, the psql verification queries and their output, and the restoration confirmation. Follow `openspec/changes/cj-variant-attribute-extraction/reports/2026-07-11-step-5-curl-endpoint-testing.md` as the template.

---

## Summary of files touched (backend scope only)

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `color String? @db.VarChar(50)` to `ProductImage` |
| `backend/prisma/migrations/<ts>_add_product_image_color/` | New migration (generated) |
| `backend/src/domain/models/productImage.ts` | Add `color` field + constructor param |
| `backend/src/domain/repositories/productRepository.ts` | Add `color` to `ProductImageCreateData`/`ProductImageUpdateData` |
| `backend/src/infrastructure/repositories/productImageRepository.ts` | Thread `color` through `create`/`update` |
| `backend/src/application/validator.ts` | Optional: `color` length guard in `validateProductImageData` |
| `backend/src/application/services/cjImageExtraction.ts` | `color` on `ExtractedCjImages`/`ImagePlanItem`/`PlannedImage`; derive via `extractCjVariantAttributesFromRawPayload`; dedupe by `(url, color)` |
| `backend/src/application/services/cjProductImageSync.ts` | `createProductImageRecord` accepts `color` |
| `backend/src/application/services/cjCatalogPromotionService.ts` | Pass `image.color` through (1 line) |
| `backend/src/application/services/cjProductImageBackfill.ts` | Pass `image.color` through (1 line) |
| `backend/src/presentation/serializers/publicProduct.ts` | `PublicProductImageDTO` + `serializeImage` gain `color` |
| `backend/src/application/services/cjImageColorBackfill.ts` | **New** — `planImageColorUpdates` + `backfillImageColors` (bulk SQL) |
| `backend/scripts/backfillCjImageColors.ts` | **New** — chunked driver script |
| `backend/src/application/services/__tests__/cjImageExtraction.test.ts` | Full rewrite (fixtures + new dedup/color tests) |
| `backend/src/application/services/__tests__/cjCatalogPromotionService.test.ts` | 3 assertion edits + 1 new test |
| `backend/src/application/services/__tests__/cjProductImageBackfill.test.ts` | 2 assertion edits |
| `backend/src/presentation/serializers/__tests__/publicProduct.test.ts` | Fixture edit + 2 new tests |
| `backend/src/presentation/controllers/__tests__/productImageController.test.ts` | Import edit + 1 new `addImage` test + new `updateImage` describe block |
| `backend/src/application/services/__tests__/cjImageColorBackfill.test.ts` | **New** — full TDD suite |

Not touched (verified, no change needed): `productImageService.ts`, `productImageController.ts`, `product.ts` (domain model), `domain/models/index.ts`, `domain/repositories/index.ts`, `mapSupplierFeedProduct.ts`, `supplierFeedImporter.ts` (+ its test).

Out of scope for this plan (belongs to tasks 7–8, 12–14): frontend (`frontend/src/types/product.ts`, `ProductGallery.tsx`, `ProductPage.tsx`), `docs/data-model.md`, `docs/api-spec.yml` / `backend/src/api-spec.yml`, `docs/development_guide.md`, commit/PR.
