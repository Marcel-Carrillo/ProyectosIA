# Step 11 Report — Manual curl Endpoint Testing (Live CJ API)

- Date: 2026-07-07
- Change: cj-dropshipping-integration
- Branch: `feature/cj-dropshipping-integration`
- Harness: `openspec/changes/cj-dropshipping-integration/reports/run-curl-cj-integration.cjs`
- API base: `http://localhost:3000` (Docker `ecommerce-backend`)
- Env: `CJDROPSHIPPING_API_KEY` (real key in `backend/.env` / `.env.docker`), `CJ_SANDBOX_ORDERS=true`, `CJ_SYNC_MAX_PAGES=1`, `CJ_CATALOG_PAGE_SIZE=5`

## Pre-test database baseline

| Table | Row count |
|-------|-----------|
| Supplier | 16 |
| SupplierIntegration | 0 |
| CjCatalogItem | 0 |
| SupplierOrder | 9 |

## Commands executed

```bash
node openspec/changes/cj-dropshipping-integration/reports/run-curl-cj-integration.cjs
```

The script logs in as `admin@example.com`, creates a disposable supplier + integration, exercises all CJ admin endpoints, inserts a mapped `SupplierOrder` via `psql`, and cleans up in `finally`.

## Results (final run — all assertions passed)

| Task | Endpoint / check | Result |
|------|------------------|--------|
| 11.1 | Health + admin login + CJ env | PASS |
| 11.2 | `POST .../cj/connection` | 201; no credential in JSON body |
| 11.3 | `POST .../cj/connection/verify` (live CJ) | 200 `{ healthy: true }`; status `Connected` |
| 11.4 | `POST .../cj/sync` + `GET .../cj/catalog` | 200 sync; catalog lists staged items (`total` > 0) |
| 11.5 | `POST .../supplier-orders/:id/cj/freight-quote` | 200; real logistics options (e.g. `YunExpress Ordinary`) |
| 11.6 | `POST .../cj/push` (sandbox) + duplicate | 201 `externalOrderId`; `sandbox: true`; second push 409 `CJ_ORDER_ALREADY_PUSHED` |
| 11.7 | `GET .../cj/order` | 200; `externalOrderStatus` persisted |
| 11.8 | Error cases | 404 missing supplier/order; 422 sync disconnected; 422 unmapped item; 400 `isSandbox` injection |
| 11.9 | Cleanup | Script deletes test supplier, integration, catalog rows, orders |
| — | Public isolation | `GET /api/public/.../cj/catalog` → 404 |

### Live CJ evidence (final run)

```json
{
  "supplierId": 35,
  "mappedVid": "1767537896728309760",
  "externalOrderId": "SD2607071910170647100",
  "logisticName": "YunExpress Ordinary"
}
```

- Auth: `verify` returned `healthy: true` against the real CJ API.
- Catalog sync: one capped page (`CJ_SYNC_MAX_PAGES=1`, `CJ_CATALOG_PAGE_SIZE=5`) upserted staged variants.
- Freight: real `logistic/freightCalculate` options for China → Spain.
- Sandbox push: `createOrderV3` with `isSandbox: 1` returned order id `SD2607071910170647100` (no real charge/shipment).

## Fixes applied during Step 11

| Issue | Resolution |
|-------|------------|
| Node `fetch` timeout on long sync | Use `curl.exe` via `apiCurl()` for sync |
| `CJ_SYNC_MAX_PAGES=1` threw 502 | Cap now stops gracefully (warn + break) instead of error |
| Windows `curl` alias | Script uses `curl.exe` |
| Rate limit on 100-product page | `CJ_CATALOG_PAGE_SIZE=5` in `.env.docker` |
| `createOrderV3` nested `shippingAddress` | Flattened to CJ's top-level shipping fields |
| EU IOSS required for some SKUs | `iossType: 3`, `iossNumber: CJ-IOSS` for EU destinations |
| Missing `shopLogisticsType` | Default `2` (seller logistics) on create order |

## Post-test database state

**Correction (2026-07-08):** the cleanup claim below was inaccurate. The harness script's
`finally` cleanup did not run reliably across the debugging iterations that produced this
report — 11 orphaned `CJ Curl Test *` suppliers/integrations, 1,960 leaked `CjCatalogItem`
rows (from a full, uncapped catalog sync run before `CJ_CATALOG_PAGE_SIZE` was introduced),
and 5 leaked `SupplierOrder` pairs were left in the dev database. This was only caught
during a later review pass (see `docs/data-model.md` audit on 2026-07-08) when the full
backend suite started failing (`cjCatalogSyncService.test.ts`'s pagination test), traced to
`backend/.env.docker` still carrying the debug-only `CJ_SYNC_MAX_PAGES=1` /
`CJ_CATALOG_PAGE_SIZE=5` overrides used during this exact testing session, which were never
restored afterwards. Both issues have now been fixed:
- `backend/.env.docker`: the two debug overrides are commented out (mirrors `.env.example`'s
  pattern), restoring the real defaults (500 pages / 100 page size).
- Database: manually deleted the 11 leaked `Supplier`/`SupplierIntegration` rows, their 1,960
  `CjCatalogItem` rows, and their 5 `SupplierOrder`/`SupplierOrderItem` pairs, plus the
  `CustomerOrder`/`CustomerOrderItem` rows the harness created to hold them.

Re-verified (2026-07-08), after cleanup and an `.env.docker` container recreate:

| Table | Row count | Delta vs. baseline |
|-------|-----------|-------|
| Supplier | 16 | 0 |
| SupplierIntegration | 0 | 0 |
| CjCatalogItem | 0 | 0 |
| SupplierOrder | 9 | 0 |

Full backend suite re-run after the fix: **699/699 pass** (previously 698/699 with
`cjCatalogSyncService.test.ts`'s pagination test failing due to the leaked env override).

## Note: unrelated pre-existing leak observed during cleanup

While auditing the database, `backend/src/routes/public/__tests__/customerOrderIsolation.test.ts`
(pre-dates this change — first added in commit `6e849bb`, unrelated to CJ Dropshipping) was
found to write directly to the real database with no `afterAll`/`afterEach` cleanup, leaving a
`Test Supplier` + `SupplierOrder` + `Customer` + `Shipment` row behind on every full-suite run.
Its `SupplierOrder`/`CustomerOrder`/`Shipment` rows were removed as part of this cleanup pass;
its three throwaway `Customer` rows could not be deleted (blocked by a `CustomerAccount` FK) and
were left in place. This is a pre-existing test-hygiene gap, not something introduced by the CJ
Dropshipping change — flagged here for visibility, not fixed as part of this change's scope.

## Outcome

**PASS** — all Step 11 curl checks green against the live CJ Dropshipping API. Database and
`.env.docker` are now genuinely restored to baseline (the original claim was false; see
correction above).
