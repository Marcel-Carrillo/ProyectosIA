# Context Session: cj-variant-attribute-extraction

## Branch

`feature/cj-variant-attribute-extraction` (from `develop`)

## Change artifacts

- `openspec/changes/cj-variant-attribute-extraction/proposal.md`
- `openspec/changes/cj-variant-attribute-extraction/design.md`
- `openspec/changes/cj-variant-attribute-extraction/specs/cj-catalog-sync/spec.md`
- `openspec/changes/cj-variant-attribute-extraction/tasks.md`

## Scope summary

Backend-only fix: CJ sync stores `size=null, color=null` because `parseSizeColor` only reads empty `variantProperty`. Rewrite extraction to use `variantKey` → `variantNameEn` → `variantProperty` precedence. Add idempotent DB backfill for existing rows. No Prisma migration, no frontend/API changes.

## Key files

- New: `backend/src/application/services/cjVariantAttributeExtraction.ts`
- New: `backend/src/application/services/cjVariantAttributeBackfill.ts`
- New: `backend/scripts/backfillCjVariantAttributes.ts`
- Modify: `backend/src/infrastructure/external/cjTypes.ts`
- Modify: `backend/src/application/services/cjCatalogSyncService.ts`
