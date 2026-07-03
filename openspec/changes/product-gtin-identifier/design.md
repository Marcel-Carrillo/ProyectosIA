## Context

`ProductPage.tsx` already emits `Product` JSON-LD (`name`, `image`, `description`, `brand`, `sku`, `offers` with `hasMerchantReturnPolicy`/`shippingDetails`). Google Search Console's Merchant listing check still flags the absence of an international product identifier. `Product` (`backend/prisma/schema.prisma`) has no such field today, and the supplier feed sample (`backend/prisma/fixtures/supplier-feed.sample.json`) carries no EAN/barcode, so this is purely additive plumbing plus a future-facing mapping hook.

The `brand` field is the closest existing analog end-to-end (schema → domain model → repository → validator → serializer → admin form → JSON-LD), so this design follows the same path for `gtin`.

## Goals / Non-Goals

**Goals:**
- Add an optional, validated `gtin` string field on `Product`, exposed through the admin API and the public API.
- Map `gtin` from the supplier feed importer when the source provides an EAN/barcode, defaulting to `null` otherwise.
- Emit `gtin13`/`gtin` in the storefront Product JSON-LD only when a real value exists.
- Keep the change additive and backward compatible.

**Non-Goals:**
- Per-variant GTIN (size/color-level barcodes).
- GTIN check-digit (mod-10) validation.
- Backfilling real GTIN values into existing seed/fixture data.
- Any change to supplier-sensitive fields or their exposure rules.

## Decisions

- **Field lives on `Product`, not `ProductVariant`.** Products are the unit the storefront JSON-LD is built around today (`ProductPage.tsx` builds one `Product` block per page), and the current supplier feed has no per-variant barcode data. Modeling at variant level would be more correct long-term but adds scope with no available data source right now. Documented as deferred future work.
- **Storage type: `String? @db.VarChar(14)`, not `Int`/`BigInt`.** GTINs can have significant leading zeros (e.g., `00012345678905`) and are never used arithmetically; a numeric type would silently corrupt values. This mirrors how `sku` is already stored as `String`.
- **Validation: format/length only (digits, length ∈ {8,12,13,14}), no mod-10 check digit in this iteration.** Keeps the validator change small and testable; check-digit validation is called out as an explicit non-goal to avoid scope creep, consistent with "keep changes small, focused, and incremental" (base-standards §1).
- **Normalization**: trim input; convert empty string to `null` at the validator boundary, matching the existing `brand` handling pattern in `ProductFormModal.tsx` and `UpdateProductInput`.
- **JSON-LD property selection**: emit `gtin13` when the stored value is exactly 13 digits (the common EAN-13 case for EU retail), and the generic `gtin` property otherwise (covers UPC-A/8/12/14). This matches Google's structured data guidance of preferring the specific property when known.
- **Supplier feed mapping is best-effort and additive.** `SupplierFeedProduct` gains an optional source field (e.g. `ean`); `mapSupplierFeedProduct.ts` normalizes and validates it with the same format rule as the backend validator, mapping to `null` on missing/invalid input rather than throwing, so a bad or absent barcode in a feed never blocks product import.
- **No new endpoints.** `gtin` rides on the existing `POST/PATCH /api/admin/products` and `GET` responses, and the existing public catalog serializer — consistent with keeping this an additive, low-risk contract change.

## Risks / Trade-offs

- **[Risk] A malformed GTIN silently becomes `null` during feed import instead of surfacing an import error.** → Mitigation: log a debug-level note in the mapper (consistent with how other optional/soft-mapped fields are handled) and cover the invalid-format case explicitly in `mapSupplierFeedProduct.test.ts` so the behavior is intentional and visible, not accidental.
- **[Risk] Forgetting to update the public serializer allow-list test causes a false "field leak" test failure, or worse, an unnoticed omission.** → Mitigation: task list explicitly includes updating `publicProduct.test.ts`'s expected key list as its own verified sub-task.
- **[Trade-off] Product-level (not variant-level) GTIN is a simplification** that doesn't fully match real-world retail data (each size/color often has a distinct barcode). Accepted for MVP scope; documented in proposal's Non-goals and revisited only if/when the supplier feed can supply per-variant barcodes.
- **[Risk] Emitting an invalid `gtin13` when a 13-digit value fails a check-digit test** (since check-digit validation is out of scope) **could still trigger a Search Console warning for that specific product.** → Mitigation: format/length validation catches the majority of garbage input; check-digit validation is explicitly flagged as follow-up work if Search Console continues to flag specific products after this change ships.

## Migration Plan

1. Add `gtin` column via Prisma migration (`prisma migrate dev --name add_product_gtin`) — additive, nullable, no data backfill needed, no downtime.
2. Ship backend changes (domain model, repository, validator, serializer) behind the same deploy as the migration.
3. Ship frontend changes (admin form field, JSON-LD emission) in the same PR/deploy since both sides are additive and independently safe if deployed slightly out of order (old frontend simply won't render/send `gtin`; old backend simply ignores/ drops an unknown `gtin` key if frontend deployed first, since it's not yet in the Prisma schema — to avoid that edge case, backend ships first or atomically with frontend).
4. No rollback complexity: dropping the column (if ever needed) is a standard reversible Prisma migration since no other field depends on it.
5. Post-deploy verification: create/edit a product with a real 13-digit GTIN in the admin UI, confirm it appears in the public API response and in the PDP's JSON-LD via Google's Rich Results Test.

## Open Questions

- None blocking. Per-variant GTIN and check-digit validation are explicitly deferred (see Non-Goals) rather than open questions requiring a decision now.

## Amendments (found during implementation planning)

- **`ProductDetailPage.tsx` added to scope.** The original task breakdown only touched the create-only `ProductFormModal.tsx`. Planning discovered the separate admin *edit* page (`ProductDetailPage.tsx`) already exposes `brand` for editing; leaving `gtin` out of it would let admins set a GTIN at creation but never correct it afterward. Added as tasks 9.6–9.8.
- **Scoped `gtin`-only validation added to the update path.** Planning discovered `ProductService.update()` does not call `validateProductData` at all today (pre-existing gap, all fields). Rather than silently enabling full validation on update (a bigger behavior change affecting `name`/`status` too, requiring separate approval), a small `gtin`-only check was added to the update path so `PATCH` rejects invalid-format GTINs and normalizes empty strings to `null`, matching spec.md's create-and-update-agnostic wording. Added as tasks 4.4–4.5.
