# Step 13: Frontend E2E Testing with Playwright MCP

## Environment

- Backend: `npm run dev` locally (port 3000), `CJ_DEFAULT_CATEGORY_ID=2` ("Women") set as the configured fallback.
- Frontend: `npm run dev` (Vite) locally — bound to port 3002 (3001 was already occupied by the stale Docker frontend container image from an earlier CRA build; ran locally instead, proxying `/api` to `localhost:3000` per `vite.config.ts`'s default).
- Logged in as `admin@example.com` at `/admin/login`.
- Test data: two `CjCatalogItem` rows seeded directly via `psql` under the existing connected CJ integration (supplier id 71, `SupplierIntegration` id 22) — no live CJ sandbox sync possible in this dev environment (same constraint documented in step 12's report).

## 13.2 — Default "auto" mode sends no `categoryId`

1. Navigated to `/suppliers/71/cj-catalog`, selected the seeded "E2E Test Dress" row, opened the promote modal via "Promocionar seleccionados".
2. Confirmed the modal's default state: the "Elegir categoría manualmente…" checkbox is **unchecked**, no category dropdown is rendered, and the hint text reads "Se usará automáticamente la categoría de CJ Dropshipping. Si no se puede determinar, se usará la categoría predeterminada." — matches task 9.1's spec exactly.
3. Left the public price blank (relies on `CJ_DEFAULT_MARKUP_MULTIPLIER=2.5`) and clicked "Promocionar" without touching the override checkbox.
4. Result: `201`-equivalent success — the modal closed, the catalog row updated to promotion state "Inactivo" (Draft) with a link to the new product (id 146).
5. Navigated to `/products/146` (the admin Products page) and verified via the page's own "Categoría" field: **"Women" is selected** — id 2, the configured `CJ_DEFAULT_CATEGORY_ID` fallback (real CJ resolution is unreachable in this dev environment, so the item correctly fell through to the fallback per the documented resolution order — same substitution noted in step 12). Public price shows `25,00 €` (10 × 2.5 default markup), confirming the price-fallback path also worked end-to-end.

## 13.3 — Override toggle forces a fixed category

1. Selected the second seeded item ("E2E Override Dress"), opened its promote modal.
2. Clicked the "Elegir categoría manualmente…" checkbox — confirmed the category `<select>` appears immediately, replacing the auto-mode hint text.
3. Selected "Accessories" from the dropdown, left price blank, clicked "Promocionar".
4. Result: success, new product id 147 created (promotion state "Inactivo").
5. Verified via the admin Products page / DB (`psql`) that `Product.categoryId = 3` ("Accessories") — the explicit override — **not** `2` ("Women", the configured fallback), confirming the override always wins over both CJ resolution and the fallback.

## Verification query

```sql
SELECT p.id, p.name, p."categoryId", c.name AS category_name
FROM "Product" p LEFT JOIN "Category" c ON c.id = p."categoryId"
WHERE p.id IN (146,147);
```
```
 id  |        name        | categoryId | category_name
-----+--------------------+------------+---------------
 146 | E2E Test Dress     |          2 | Women
 147 | E2E Override Dress |          3 | Accessories
```

## 13.4 — Environment restored

- Deleted the two created `ProductVariant`/`Product` rows (146/147) and the two seeded `CjCatalogItem` rows (4010/4011) via `psql`.
- Confirmed DB state matches the step-11/12 baseline: `Category`=29, `SupplierCategoryMapping`=0, non-deleted `Product` count=13.
- Closed the Playwright browser session and stopped both local dev servers (backend, frontend).

## Notes / limitations

- Two console errors were present throughout (shipping-estimate fetch failing with "No se pudo consultar el envío") — this is the pre-existing CJ freight-estimate feature (added in a prior, unrelated PR this week) failing because this dev environment has no working CJ sandbox credentials, not a regression from this change. It did not block promotion in either mode.
- As in step 12, the "CJ resolution succeeds and auto-creates/reuses a real Category from CJ's taxonomy" path could not be exercised live (no reachable CJ sandbox) — it remains unit-test-only coverage. What *was* verified live end-to-end through the real UI: the auto-mode default, the fallback-when-resolution-unavailable path, and the manual-override path, which is exactly the frontend behavior task 9 implemented.
