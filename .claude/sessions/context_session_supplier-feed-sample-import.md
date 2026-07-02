# Context Session: supplier-feed-sample-import

## Change location
`openspec/changes/supplier-feed-sample-import/`

## Artifacts
- `proposal.md` — why: no offline, image-free way to exercise the admin panel's product intake flow for the supplier-fulfilled model.
- `design.md` — how: mirror `escuelaJsProductImporter.ts`/`mapEscuelaJsProduct.ts` file layout; static local fixture (no HTTP mock); products land in `Draft` with `mainImageUrl=null`; hard-delete clean step in FK order (`ProductImage` → `ProductVariant` → `Product`), preserving `Category`/`Supplier`/admin/coupons; dual guard on `NODE_ENV !== 'production'` and local `DATABASE_URL` host (`localhost`, `127.0.0.1`, or Docker Compose service `db`).
- `specs/supplier-feed-sample-import/spec.md` — 5 ADDED requirements with scenarios (see file).
- `tasks.md` — 45 sub-tasks across 11 groups; Step 0 (branch) already done.

## Scope
Backend-only. No new/modified API endpoints, no frontend code changes (frontend is only *manually exercised* in Step 8 E2E verification against existing admin UI — no frontend code changes).

## Branch
`feature/supplier-feed-sample-import`, branched from `develop` (already created and verified).

## Key precedent files to mirror
- `backend/src/infrastructure/external/escuelaJsTypes.ts`
- `backend/src/infrastructure/import/mapEscuelaJsProduct.ts`
- `backend/src/infrastructure/import/escuelaJsProductImporter.ts`
- `backend/prisma/importEscuelaJs.ts`
- `backend/src/infrastructure/import/__tests__/mapEscuelaJsProduct.test.ts`

## Critical constraints
- `supplierCost`/`supplierReference`/`supplierId` are INTERNAL ONLY on `ProductVariant` — never in API responses (enforced via `variantSelect` at the repository layer). Do not add any new read path around this.
- Imported products: `status='Draft'`, `mainImageUrl=null`, zero `ProductImage` rows created, even though the fixture optionally carries an `images: []` field.
- Clean step must NOT touch `Category`, `Supplier`, `AdminUser`, or coupon tables.
- Safety guard (`NODE_ENV` + `DATABASE_URL` host) must run and fail closed *before* any Prisma call.

## Backend planning task
Produce a per-file implementation plan at `.claude/doc/supplier-feed-sample-import/backend.md` covering task groups 1-4 of `tasks.md`:
1. Fixture (`backend/prisma/fixtures/supplier-feed.sample.json`) + types (`backend/src/infrastructure/external/supplierFeedTypes.ts`)
2. Mapper (`backend/src/infrastructure/import/mapSupplierFeedProduct.ts`) + its test
3. Importer + clean step (`backend/src/infrastructure/import/supplierFeedImporter.ts`) + its test
4. Script entry point (`backend/prisma/importSupplierFeed.ts`) with the dev-only guard, and the `backend/package.json` script entry
