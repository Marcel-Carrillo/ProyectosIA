# Context Session: product-gtin-identifier

## Change location
`openspec/changes/product-gtin-identifier/` (proposal.md, design.md, specs/product-identifiers/spec.md, tasks.md)

## Summary
Add an optional `gtin` field (GTIN/EAN, string, digits only, length 8/12/13/14) to `Product`, exposed through the admin API and public API, mapped from the supplier feed import when available, and emitted as `gtin13`/`gtin` in the storefront Product JSON-LD (`frontend/src/pages/storefront/ProductPage.tsx`) only when present. Driven by a Google Search Console "Fichas de comerciante" notice about missing international product identifiers. `brand` was already added to the JSON-LD in a separate prior commit (`69d56c7` on `develop`) — this change is the remaining GTIN gap.

## Key design decisions (see design.md for full rationale)
- Field lives on `Product`, not `ProductVariant` (MVP scope).
- Storage type: `String? @db.VarChar(14)` — never numeric (leading zeros).
- Validation: digits only, length ∈ {8,12,13,14}. No mod-10 check digit in this iteration.
- Empty string normalizes to `null`.
- JSON-LD: `gtin13` for 13-digit values, generic `gtin` otherwise; omitted when `null`.
- Supplier feed mapping is best-effort: invalid/missing EAN → `null`, never throws, never fabricates.
- No new endpoints — rides on existing `POST/PATCH /api/admin/products` and public catalog serializer.

## Reference implementation: the `brand` field
`brand` was implemented end-to-end recently and is the exact template to follow for `gtin`:
- `backend/prisma/schema.prisma` — `Product.brand String?`
- `backend/src/domain/models/product.ts` — property + constructor
- `backend/src/domain/repositories/productRepository.ts` — `ProductCreateData`/`ProductUpdateData`
- `backend/src/infrastructure/repositories/productRepository.ts` — create/update persistence
- `backend/src/presentation/serializers/publicProduct.ts` (+ `__tests__/publicProduct.test.ts` allow-list)
- `frontend/src/types/product.ts` — `Product`, `CreateProductInput`, `UpdateProductInput`
- `frontend/src/components/admin/ProductFormModal.tsx` — form field
- `frontend/src/pages/storefront/ProductPage.tsx` — JSON-LD emission (already includes `brand`)

## Full requirements
See `openspec/changes/product-gtin-identifier/tasks.md` for the complete, ordered task list (sections 1–10 are implementation; 11–16 are mandatory verification/docs/PR steps handled by the parent session, not the planning agent).

## Ask of the planning agent
Produce a per-file implementation plan (exact edits, not just descriptions) for every file listed in the relevant tasks sections. Do not implement — only plan. Save the plan to `.claude/doc/product-gtin-identifier/<backend|frontend>.md`.
