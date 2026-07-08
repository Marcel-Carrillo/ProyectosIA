# Step 11 Report - E2E Testing with Playwright MCP

- Date: 2026-07-08
- Change: cj-catalog-promotion
- Agent: Claude (Sonnet 5)

## Setup

- Backend + frontend running via `docker compose up -d db backend frontend`.
- **Real bug found and fixed**: the `frontend` Docker service has no bind mount for `frontend/src` (unlike `backend`, which mounts `backend/src`) — the running container's image was built before this change's frontend files existed, so the new route 404'd. Rebuilt the image (`docker compose build frontend` + `up -d --force-recreate frontend`) to pick up the new page/route/service files.
- Created a dedicated test supplier ("E2E CJ Test Supplier", id 48) via the real admin API, configured + verified its CJ connection, and synced its real catalog (19 items, reusing the `CJ_SYNC_MAX_PAGES=1`/`CJ_CATALOG_PAGE_SIZE=5` local-testing pattern to avoid re-spending a large amount of real API quota — reverted after this session, same as Step 10).

## Workflows Executed

1. **Login and navigation**: logged in as admin, navigated to `/suppliers/48/cj-catalog` via the app's own "CJ Catalog" link (verified present on every row of `/suppliers`, correct `href` pattern `/suppliers/:id/cj-catalog`).
2. **Initial render**: confirmed the full 19-item real synced catalog renders in the desktop table, all with `NotPromoted` badges, matching the live API data exactly (titles, SKUs, cost, stock).
3. **Selection**: selected 2 of the 3 "Glowing Knitting Doll..." items (same CJ product, 3 variants) via row checkboxes; bulk-action bar appeared showing "2 selected".
4. **Promote (multi-item, same pid, with immediate activation)**: opened the promote modal — confirmed it showed only the 2 selected items (not the third sibling, not other products); selected category "Dresses"; checked "Activate immediately"; submitted. Modal closed, list refetched, both rows updated to `Active` badge with a working link to the newly created product (`/products/124`); the un-selected third sibling remained `NotPromoted`. This is a single Product (id 124) with 2 linked ProductVariants, confirming the pid-grouping behavior end-to-end through the real UI.
5. **Deactivate**: clicked "Deactivate" on one of the two promoted rows — badge updated to `Inactive`, button flipped to "Activate", product link preserved. Verified live via `fetch()` against `GET /api/public/products/124`: the response still returned `200` with `status: "Active"` but `variants` contained only the still-active sibling (1 item) — the deactivated variant correctly excluded, matching design decision 4.
6. **Reactivate**: clicked "Activate" again on the same row — badge returned to `Active`, reusing the same linked `productId`/`productVariantId` (no duplicate created).
7. **Validation error**: selected the still-`NotPromoted` third sibling, opened the promote modal, submitted **without** selecting a category — modal stayed open and displayed "Select a category before promoting." (client-side guard, no API call made), exactly matching the mapped error message for `CJ_PROMOTION_CATEGORY_REQUIRED`.

Screenshot captured: `cj-catalog-page-final-state.png` (full page, desktop table view with mixed `Active`/`NotPromoted` rows).

## Assertions Verified

- Full real CJ catalog listed with correct `NotPromoted` state before any promotion.
- Bulk selection reflected accurately in the action bar and the promote modal's item list.
- Promoting multiple items sharing a CJ `pid` created exactly one `Product` with multiple linked `ProductVariant`s (confirmed via the same product id `124` appearing for both rows).
- Activate/deactivate/reactivate cycle works end-to-end through the real UI against the real backend, with real storefront-visibility changes confirmed via a direct `fetch()` to the public API from within the browser context.
- Client-side validation (missing category) blocks the API call and surfaces the correct message without needing a server round-trip.

## Cleanup

- Deleted the test-created `Product`/`ProductVariant` (id 124), all 19 `CjCatalogItem` rows, the `SupplierIntegration`, and the `Supplier` (id 48) in one transaction.
- Reverted the temporary `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE` overrides in `backend/.env.docker`.
- Recreated the backend container to apply the reverted env; verified final DB state matches baseline exactly (`Product: 12, ProductVariant: 24, CjCatalogItem: 0, Supplier: 16`).
- Closed the Playwright browser session.

## Outcome

- Step 11 status: **PASS**
- Blocking issues found and fixed: frontend Docker image staleness (no `src` bind mount — required a rebuild to test any frontend change against Docker Compose; noted here for future sessions working on this project).
