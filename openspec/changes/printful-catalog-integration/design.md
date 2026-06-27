## Context

The store's catalog is currently populated by a demo importer (`escuelaJsProductImporter.ts`) that pulls from a public test API (EscuelaJS). Products created this way have no real supplier, no operable `supplierCost`, and no `supplierReference` — making it impossible to fulfill orders through the admin panel.

Printful is a print-on-demand platform with a free REST API. Their **Sync Products** endpoint exposes products the store has configured in Printful, with real variant prices, sizes, colors, and supplier references (`sync_variant_id`). This is the correct source for a supplier-fulfilled catalog: products are vendible, costs are known, and order fulfillment can be automated in a future phase.

The existing infrastructure pattern (`escuelaJsProductImporter.ts` → `mapEscuelaJsProduct.ts` → `escuelaJsTypes.ts`) is the architectural template for this integration. The Printful importer follows the same layered shape to stay consistent and reviewable.

## Goals / Non-Goals

**Goals:**
- Introduce a typed Printful HTTP client with Bearer auth and pagination.
- Map Printful sync products/variants to internal `Product`/`ProductVariant` records with markup-based `publicPrice` and hidden `supplierCost`.
- Idempotently upsert the `Supplier` "Printful" and link all imported variants to it.
- Provide a safe, transactional catalog purge that hard-deletes unreferenced demo products and soft-deletes those with FK dependencies.
- Retire EscuelaJS as the active import source.

**Non-Goals:**
- Automatic `SupplierOrder` creation in Printful (Fase 2 — requires explicit approval per base-standards §13).
- Shipping rate retrieval from Printful at checkout (Fase 2).
- Printful webhook ingestion for order/shipment status (Fase 2).
- Any Prisma schema migration (all required fields already exist).
- Frontend changes (no new customer-facing behavior beyond having real products).

## Decisions

### Decision 1: Use Printful Sync Products, not the general catalog

**Chosen:** `GET /sync/products` + `GET /sync/products/{id}` (store-specific, vendible products).

**Why:** The general Printful product catalog (`/products`) contains blank templates with no prices and no direct link to the store's configured variants. Sync Products are the store's actual inventory with `sync_variant_id`, retail price, and variant options — the only source that maps 1:1 to `ProductVariant`.

**Alternative rejected:** General catalog `/products` — no prices, not store-specific, not fulfillable.

---

### Decision 2: Mirror the EscuelaJS importer pattern exactly

**Chosen:** Same three-file structure: `printfulTypes.ts` → `mapPrintfulProduct.ts` → `printfulProductImporter.ts`.

**Why:** The existing pattern is proven, already reviewed, and provides a consistent mental model across all supplier integrations. Diverging would create two patterns to maintain.

**Alternative rejected:** A single monolithic importer file — harder to unit-test the mapping logic in isolation.

---

### Decision 3: `publicPrice = supplierCost × PRINTFUL_PRICE_MARKUP`

**Chosen:** Configurable multiplier env var, default applied in `mapPrintfulProduct.ts` at import time.

**Why:** The markup must be applied before data reaches the DB, so it's consistently reflected in `ProductVariant.publicPrice`. A single env var keeps the logic simple and the source of truth obvious. The `supplierCost` is stored separately (hidden from public APIs) so margins can be audited internally.

**Alternative rejected:** Storing the raw Printful price as `publicPrice` — gives away margin and makes admin repricing opaque.

---

### Decision 4: Purge strategy — hard-delete unreferenced, soft-delete referenced

**Chosen:** `clearDemoCatalog.ts` checks each demo `ProductVariant` for FK references in `CustomerOrderItem`, `SupplierOrderItem`, and `WishlistItem` before deleting.
- No references → hard-delete (cascade: `ProductImage`, `ProductTranslation`, `ProductVariant`, then `Product`).
- Has references → soft-delete: `deletedAt = now()`, `status = "Archived"`.

**Why:** `CustomerOrderItem` stores a snapshot of product/variant data at purchase time, so the historical record is preserved regardless. However, Prisma FK constraints would prevent a hard-delete of referenced variants. Soft-delete avoids constraint violations and keeps the historical product visible in admin order views.

**Alternative rejected:** Hard-delete everything inside a transaction with FK cascade — would destroy referenced `CustomerOrderItem` / `WishlistItem` records and violate data integrity.

---

### Decision 5: No new Prisma migration for Fase 1

**Chosen:** Use existing schema fields only.

**Why:** `Supplier`, `ProductVariant.supplierId`, `supplierReference`, `supplierCost`, `stockPolicy`, `deletedAt` all exist. Introducing a migration solely for Fase 1 adds unnecessary risk. Fase 2 fields (`printfulOrderId`, `PrintfulWebhookEvent`) will be introduced with their own migration when that story is approved.

---

### Decision 6: Printful client as a thin infrastructure module

**Chosen:** `printfulClient.ts` exposes typed async fetch helpers. No SDK dependency — just `node-fetch`/`fetch` with Bearer auth header, pagination loop, and 429 backoff.

**Why:** Printful's free API is simple REST. Adding their official SDK introduces a versioned dependency that may lag behind the API. A thin client is easier to mock in tests and easier to replace in Fase 2.

**Alternative rejected:** `@printful-api-client` npm package — adds dependency surface, harder to control auth and rate limiting.

## Risks / Trade-offs

**[Risk] Printful returns prices in USD, store expects EUR** → Mitigation: document the currency assumption in env vars and in `mapPrintfulProduct.ts`. If `PRINTFUL_CURRENCY` is `USD`, apply a configurable exchange rate or use a fixed markup large enough to absorb variance. Log a warning at import time if currency mismatch is detected.

**[Risk] Rate limit (120 req/min) hit during large catalog import** → Mitigation: throttle between `GET /sync/products/{id}` calls (one per product detail); add exponential backoff on 429 responses. `PRINTFUL_IMPORT_LIMIT` caps the run for testing.

**[Risk] Purge accidentally deletes products with FK references** → Mitigation: the purge script runs a pre-check query before each delete; the entire operation is wrapped in a Prisma transaction that rolls back on any error. A dry-run mode (`--dry-run`) is added to preview what would be deleted.

**[Risk] EscuelaJS is still triggered by seed/scripts after this change** → Mitigation: the `ESCUELAJS_IMPORT` gate in `seed.ts` is replaced by `PRINTFUL_IMPORT`; old scripts are left but no longer called.

**[Risk] `slug` collisions between Printful products and demo products not yet purged** → Mitigation: run the purge script before the Printful import, or use `PF-{sync_product_id}` as the slug base (URL-safe, collision-free with EJS slugs).

## Migration Plan

1. Set `PRINTFUL_API_KEY` (and optionally `PRINTFUL_STORE_ID`, `PRINTFUL_PRICE_MARKUP`) in `.env`.
2. Run `npm run db:clear-demo` — purge EscuelaJS/seed demo products safely.
3. Run `npm run db:import:printful` — import Printful sync catalog.
4. Verify via `GET /api/public/products` and admin panel.

**Rollback:** Restore from a DB snapshot taken before step 2. The purge and import are destructive (hard-deletes); there is no automated undo. A pre-purge dump is recommended in the run guide.

## Open Questions

1. **Account type:** Does the Printful account use a store-level API key (requires `X-PF-Store-Id` header) or an OAuth token? This determines whether `PRINTFUL_STORE_ID` is required.
2. **Currency:** Does the Printful store have EUR pricing configured, or will prices arrive in USD? Determines whether a currency conversion step is needed in the mapper.
3. **Slug strategy:** Use Printful's own slug (if provided) or generate `pf-{sync_product_id}`? Need to confirm Printful returns a `slug` field or equivalent.
4. **Admin import endpoint:** Is a `POST /api/admin/catalog/import/printful` endpoint in scope for Fase 1, or is CLI-only sufficient?
