## Why

Google Search Console flags `mavile.es` under "Datos estructurados de Fichas de comerciante" with "No se ha proporcionado ningún identificador internacional, como el GTIN o la marca". The `brand` field is already emitted in the storefront Product JSON-LD, but `Product` has no international trade item identifier (GTIN/EAN), so Merchant listing rich results remain ineligible for products lacking one. This change adds an optional, real (never fabricated) GTIN field end-to-end so products with a known barcode can close that gap.

## What Changes

- Add an optional `gtin` field (`string | null`, digits only, length 8/12/13/14) to the `Product` model in `schema.prisma`, with a new Prisma migration.
- Add `gtin` validation to `backend/src/application/validator.ts` (format check: digits only, length in {8,12,13,14}; empty string normalizes to `null`).
- Add `gtin` to the domain `Product` model, `ProductCreateData`/`ProductUpdateData` repository contracts, and the Prisma-backed repository create/update paths.
- Add `gtin` (nullable) to the public product serializer (`publicProduct.ts`) and update its allow-list guard test.
- Add `gtin` to the admin product form (`ProductFormModal.tsx`) as an optional text input, and to `CreateProductInput`/`UpdateProductInput` frontend types.
- Map `gtin` from the supplier feed import (`mapSupplierFeedProduct.ts`) when the source provides an EAN/barcode field; add the source field to `supplierFeedTypes.ts`. When absent or invalid, map to `null` — never fabricate a value.
- Emit `gtin13` (13-digit values) or generic `gtin` (8/12/14-digit values) at the root of the storefront Product JSON-LD (`ProductPage.tsx`) only when `product.gtin` is present; omit the property otherwise.
- Update `docs/data-model.md` and `docs/api-spec.yml` to document the new field and its validation rules.

Non-breaking, additive change. No **BREAKING** changes.

## Capabilities

### New Capabilities
- `product-identifiers`: optional international trade item identifier (GTIN/EAN) on `Product`, validated, exposed publicly, mapped from supplier feed imports when available, and emitted in storefront structured data.

### Modified Capabilities
(none — no existing spec's requirements change; this introduces a new capability)

## Impact

- **Affected code**: `backend/prisma/schema.prisma` (+migration), `backend/src/domain/models/product.ts`, `backend/src/domain/repositories/productRepository.ts`, `backend/src/infrastructure/repositories/productRepository.ts`, `backend/src/infrastructure/external/supplierFeedTypes.ts`, `backend/src/infrastructure/import/mapSupplierFeedProduct.ts`, `backend/src/infrastructure/import/supplierFeedImporter.ts`, `backend/src/application/validator.ts`, `backend/src/presentation/serializers/publicProduct.ts` (+test), `frontend/src/types/product.ts`, `frontend/src/components/admin/ProductFormModal.tsx`, `frontend/src/pages/storefront/ProductPage.tsx`.
- **Affected APIs**: `GET/POST/PATCH /api/admin/products[/:id]` request/response bodies gain optional `gtin`; public catalog `PublicProduct` response gains nullable `gtin`. No new routes.
- **Customer-facing vs internal**: affects both — internal (admin form to enter the identifier) and customer-facing (public API + storefront structured data). No visible UI change beyond the admin form field.
- **Supplier data exposure**: none — GTIN is public catalog data, not supplier-sensitive data (unlike `supplierCost`/`supplierReference`); no change to supplier data isolation rules.
- **Order lifecycle / fulfillment / payment / returns / refunds**: not affected.
- **Dependencies**: none beyond existing Prisma/Express/React stack.

## Non-goals

- GTIN at the `ProductVariant` level (per-size/color barcodes) — deferred; MVP models GTIN at the `Product` level only.
- Other identifiers such as `mpn` or `isbn`.
- Enriching the supplier feed sample fixture with real EAN values.
- GTIN check-digit (mod-10) validation — format/length validation only in this iteration.
