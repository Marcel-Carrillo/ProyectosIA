# Design: cj-variant-attribute-extraction

## Context

`parseSizeColor()` in `backend/src/application/services/cjCatalogSyncService.ts:43-54` parses only `variant.variantProperty` as a JSON array of `{key, value}` pairs. CJ's real `GET /product/variant/query` returns attributes in `variantKey` (hyphen-joined values, e.g. `"Black-XXL"`) and `variantNameEn`, while `variantProperty` arrives empty (verified against CJ's official API documentation). Result: every `CjCatalogItem` is stored with `size=null, color=null`; promotion (`cjCatalogPromotionService.ts:232-233`) copies the nulls to `ProductVariant`; the storefront `VariantSelector.tsx` computes option lists from `variant.size/color`, and with both empty it renders nothing and auto-selects the first Active variant. No test sets `variantProperty` — the assumed format was never validated against real data. `CjVariantDto` (`cjTypes.ts:42-51`) does not declare `variantKey`/`variantNameEn`, though `rawPayload.variant` retains them at runtime (JSON of the raw API object).

## Goals / Non-Goals

**Goals**
- Derive `size`/`color` at sync time from the fields CJ actually populates, without ever failing an item or a sync over extraction.
- Repair existing data (staged items + promoted variants) locally from `rawPayload`, zero CJ API calls, idempotent.
- Close the test gap with realistic CJ payloads.

**Non-goals**
- Color-name normalization/translation, size ordering, admin UI to correct misclassified attributes, re-fetching from CJ, storefront changes (`VariantSelector` already works when data is present), API contract or Prisma schema changes (`size`/`color` columns exist on both tables).

## Decisions

### D1 — Extraction precedence: `variantKey` → `variantNameEn` → `variantProperty`

`variantKey` is the documented, reliably-populated attribute carrier (`"Black-XXL"`). Split on `-`; classify each token with a size vocabulary; non-size tokens become the color (joined with a space when several). `variantNameEn` is a secondary signal only when `variantKey` yields nothing for a field — CJ appends option values to the product name there (e.g. `"… Black XXL"`), so match its trailing tokens against the same vocabulary; it never overrides a `variantKey`-derived value. The existing `variantProperty` JSON parsing is kept last so behavior is preserved if CJ ever populates it. First non-null wins per field, independently for `size` and `color`.

**Size vocabulary** (case-insensitive, token must match entirely): `XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL`, pure integers (`^\d{1,3}$`, covers `36`, `90`), `EU\s?\d{2}` and `One Size`/`Free Size`. Anything else is a color candidate. Ambiguity → `null` (degrades to today's behavior; a wrong label shown to a shopper is worse than no label).

### D2 — Non-throwing extraction, same failure semantics as today

Extraction failures must never mark an item `Failed` (that state is for real mapping errors: missing `vid`, invalid price/stock). `parseSizeColor` keeps returning `{size: null, color: null}` on any internal error, wrapped in try/catch exactly as now.

### D3 — Backfill mirrors the image backfill pattern

Pure derivation + DB update logic in a new service module `backend/src/application/services/cjVariantAttributeBackfill.ts` (unit-testable, like `cjProductImageBackfill.ts`); `backend/scripts/backfillCjVariantAttributes.ts` is a thin `ts-node --transpile-only` driver with console progress and a `processed / itemsUpdated / variantsUpdated / skippedAmbiguous` summary. Batched transactions, DB-only. It updates `CjCatalogItem.size/color` (when derivable) and the linked promoted `ProductVariant.size/color`; it never touches `status`, prices, stock, or supplier internals, so `reconcilePromotedVariantStock` is unaffected. Collision guard: before writing, check siblings under the same `productId`; if the new non-null `(size, color)` pair would duplicate another variant's, log and skip (variants stay distinguishable by SKU/`externalRef`, and `VariantSelector.findVariant` never sees two identical combinations). Same operational caveat as the image backfill: manual/local process, not a Lambda job.

### D4 — Type extension only, no schema/API change

Add `variantKey?: string` and `variantNameEn?: string` to `CjVariantDto`. `size`/`color` already exist on `CjCatalogItem`, `ProductVariant`, the admin CJ serializer, and the public variant DTO — nothing else changes. Supplier-internal fields (`supplierCost`, `vid`, `rawPayload`) remain unexposed.

## Risks / Trade-offs

- **Heuristic misclassification** (e.g. a color named `"Sand 38"`): mitigated by whole-token matching, `variantNameEn` cross-check, and the prefer-null rule; residual errors are cosmetic and correctable by re-running an improved backfill later.
- **`variantKey` with >2 tokens** (e.g. `"Ivory white-S"` → tokens `Ivory white`, `S` only if CJ hyphenates between options, not within values; if a value itself contains `-`, tokens misalign): accepted best-effort risk; prefer-null on ambiguity bounds the damage.
- **Backfill blast radius**: bounded by idempotence, status immutability, collision skipping, and batching.

## Migration Plan

1. Deploy the sync fix (new syncs store correct attributes).
2. Run `npx ts-node --transpile-only scripts/backfillCjVariantAttributes.ts` locally against the target DB (dev first, then production) to repair rows synced before the fix.
3. Verify a multi-variant CJ product in the storefront shows both selectors.

Rollback: revert the commit; backfilled data is correct-by-derivation and harmless to keep.

## Open Questions

None blocking. If CJ's `variantKey` proves inconsistent for some categories, extend the vocabulary in a follow-up — the prefer-null rule keeps wrong data out meanwhile.
