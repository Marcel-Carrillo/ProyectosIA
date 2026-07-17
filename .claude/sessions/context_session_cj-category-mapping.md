# Context Session: cj-category-mapping

## Change location
`openspec/changes/cj-category-mapping/` — proposal.md, design.md, specs/{cj-catalog-promotion,supplier-catalog-auto-provisioning,category-management}/spec.md, tasks.md

## Summary
Promoted CJ Dropshipping products currently always land in a fixed "Uncategorized" `Category` (`CJ_DEFAULT_CATEGORY_ID`), even though CJ already reports each product's real category (`CjProductDto.categoryId`, already stored unused in `CjCatalogItem.categoryId`) and the client has an unused `fetchCategories()` method. This change resolves the real CJ category at promotion time (both the manual `CjPromoteModal` flow and the automated auto-provisioning job), auto-creating a local `Category` (default `status = Inactive`) when no mapping exists yet via a new `SupplierCategoryMapping` table, falling back to `CJ_DEFAULT_CATEGORY_ID` only when resolution fails. An admin-triggered idempotent backfill endpoint re-categorizes already-promoted legacy products still on the default category.

## Key files already touched by prior sessions (context, do not re-derive)
- `backend/src/application/services/cjCatalogPromotionService.ts` — `promote()`, `activate()`, `deactivate()`, `estimateFreight()` (added in a prior PR this week for shipping-cost auto-estimation in the CJ promote modal — unrelated but same file/service).
- `backend/src/application/providers/providerRegistry.ts` — automated auto-provisioning pipeline (`runPipeline()`), `resolveDefaultCategoryId()`.
- `backend/src/infrastructure/external/cjClient.ts` / `cjTypes.ts` — `fetchCategories()` implemented, never called; `CjCategoryDto` only models one tree level today.
- `backend/src/infrastructure/repositories/categoryRepository.ts` — existing CRUD, `findByName`, `findById`, `create` (throws `CategoryNameConflictError` on dup name).
- `frontend/src/components/admin/CjPromoteModal.tsx` — was just reworked in a prior PR this week to auto-fetch shipping estimates on open (no manual button) — this change adds a category auto/override toggle to the same modal, on top of that existing shipping-estimate UI. Read the current file before editing, don't assume the version described in older docs.

## Read first
1. `openspec/changes/cj-category-mapping/proposal.md`
2. `openspec/changes/cj-category-mapping/design.md` (full — has the key architecture decisions and rationale)
3. `openspec/changes/cj-category-mapping/specs/*/spec.md` (delta specs — exact required behavior/scenarios)
4. `openspec/changes/cj-category-mapping/tasks.md` (implementation checklist — section numbers map to design decisions)

## Planning task
Produce a per-file implementation plan (not the implementation itself) at `.claude/doc/cj-category-mapping/{backend,frontend}.md` covering, for your layer: exact files to create/modify, function signatures, the order to implement in (tasks.md sections are already ordered by dependency — follow them), and anything from design.md's "Decisions"/"Risks" that constrains the implementation. The parent session will build from your plan plus design.md.
