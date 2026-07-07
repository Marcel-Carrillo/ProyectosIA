## Context

The previous supplier-integration change built a generic placeholder (`SupplierIntegration`, `SpocketCatalogItem`, `ISpocketClient` port, `SpocketApiClient`) assuming a Spocket-shaped REST contract: `Authorization: Bearer <key>` auth and HTTP-status-based success/failure (`response.ok`). Live research since then established Spocket has no public developer API — that contract was never real. CJ Dropshipping's real, live API has since been validated end-to-end with a real account:

- Auth: `POST /authentication/getAccessToken` with `{ apiKey }` → `{ data: { accessToken, refreshToken, accessTokenExpiryDate, refreshTokenExpiryDate } }`. Authenticated calls require header `CJ-Access-Token: <accessToken>`.
- **Critical contract difference from the old placeholder**: CJ returns HTTP 200 even for logical errors (e.g. wrong HTTP method returned `200`-shaped-error... actually returned a JSON error body regardless of status); real success/failure is signaled by the body's `success`/`code`/`result` fields, and every response carries a `pointsInfo { total, usedToday, remaining }` quota object.
- Catalog: `GET /product/getCategory`, `GET /product/listV2` (paginated, response nested as `data.content[].productList[]`), `GET /product/variant/query?pid=`, stock queries.
- Freight: `POST /logistic/freightCalculate` (`startCountryCode`, `endCountryCode`, `products[]` with `vid`+`quantity`) → array of `{ logisticName, logisticAging, logisticPrice, totalPostageFee, ... }`. Live-tested China→Spain: fastest realistic options are 4-8 days (`CJPacket Ordinary`/`Fast Ordinary`); no confirmed EU-domestic fast lane surfaced via this API for the SKUs tested.
- Orders: `POST /shopping/order/createOrderV3` accepts `isSandbox: 1` — simulates payment (no real balance deducted) and creates no real logistics/fulfillment. This is distinct from CJ's separate "sandbox account" feature, which requires contacting a CJ account manager, is a one-way irreversible conversion of the whole account, and shares the same token as production — explicitly rejected as an option for this project.

The credential is a single CJ account API key (`.env`/SSM), not per-supplier, while the existing `SupplierIntegration` model is per-supplier (`supplierId @unique`). This tension is a key design decision below.

## Goals / Non-Goals

**Goals:**
- Replace the placeholder Spocket-shaped client/auth/response-handling with the real, validated CJ Dropshipping contract (token cache+refresh based on the API's own expiry timestamps, body-based success evaluation, real catalog field mapping).
- Add a new, admin-triggered capability to quote freight and push a `SupplierOrder` to CJ, always in sandbox mode in this increment, so the internal fulfillment pipeline (SupplierOrder → external order → status pull) can be exercised end-to-end against the real CJ sandbox behavior without spending money or shipping anything real.
- Keep the same layered architecture, staging-only catalog model, and admin-only/no-public-exposure guarantees already established by the prior (removed) Spocket placeholder.

**Non-Goals:**
- Inbound webhooks from CJ for order/shipment status — status is pulled on demand via `GET .../cj/order`, not pushed to us.
- Auto-publishing staged `CjCatalogItem` records to the live `Product`/`ProductVariant` catalog.
- Requesting or using CJ's full "sandbox account" conversion (irreversible, shares production token, requires a CJ account manager).
- Automatic order push on customer checkout — pushing to CJ remains an explicit admin action, consistent with "manual control before automation."
- Multi-account CJ support (one global account/credential for now, matching the current single-store scope).

## Decisions

### 1. Full replacement, not extension, of the Spocket placeholder
The prior `spocket-connection-management`/`spocket-catalog-sync` capabilities and their `/api/admin/suppliers/:supplierId/spocket/*` routes are removed outright and replaced with `/api/admin/suppliers/:supplierId/cj/*`. Files are renamed (`spocketClient.ts` → `cjClient.ts`, `SpocketCatalogItem` → `CjCatalogItem`, etc.) rather than kept under the old "Spocket" name with new CJ behavior underneath.

**Alternative considered**: keep the `Spocket*` names as a generic/vendor-neutral label and just change what's behind them. Rejected — the whole point of the prior increment's `ISpocketClient` port was to isolate provider-specific detail so a provider swap would be cheap; doing the swap now while keeping misleading "Spocket" names in the codebase would create permanent, compounding confusion for a one-time rename cost. Since this is the first and only real usage of that provider abstraction, renaming now is the cheapest it will ever be.

### 2. Token cache is a single global value, not per-`SupplierIntegration`
The CJ API key is one store-wide credential (`CJDROPSHIPPING_API_KEY` in env/SSM), not per-supplier, even though `SupplierIntegration.supplierId` is `@unique` (one row per supplier). The access/refresh token pair is cached at the `cjClient` module level (in-memory, keyed by nothing — there is only ever one CJ account), refreshed based on the **actual `accessTokenExpiryDate` returned by CJ**, not a hardcoded constant (CJ's own docs claim 15 days while a live test observed a token valid for ~180 days — this discrepancy is exactly why the expiry must be read from the response, not assumed).

**Alternative considered**: persist the token pair on the `SupplierIntegration` row. Rejected for this increment — since the credential and token are global (one CJ account), persisting per-supplier would be misleading (multiple `SupplierIntegration` rows could exist for different suppliers all pointing at the same CJ account) and adds unnecessary DB writes on every refresh. In-memory caching is sufficient for a single-process admin-triggered workflow; if the token needs to survive process restarts across Lambda invocations later, that's a follow-up concern once multi-instance behavior is actually observed.

### 3. Success/failure evaluated from the response body, not HTTP status
`cjClient.ts` replaces the old `RETRYABLE_STATUS`/`response.ok` logic entirely: every CJ response is parsed as JSON first, then `body.success === true` (or `body.code === 200`) determines success. `CjApiError` carries `body.code` and a fixed, non-sensitive message (never the raw `body.message` from CJ, since that could theoretically echo request data back). Retries on network failure or a small set of documented transient codes, bounded as before (timeout + max retries), but the decision to retry no longer keys off HTTP status.

### 4. `SupplierOrder` gets new, separate external-order fields — never reusing existing ones
`SupplierOrder.status`/`trackingNumber`/`trackingUrl` already model the *internal*, manually-driven fulfillment lifecycle (Draft→Requested→Confirmed→Shipped→Delivered). The new CJ order gets its own fields: `externalProvider`, `externalOrderId` (`@unique`, enforces one CJ order per `SupplierOrder` — the idempotency mechanism), `externalOrderStatus`, `externalTrackingNumber`, `externalTrackingProvider`, `sandbox` (`Boolean @default(true)`), `pushedAt`, `lastStatusSyncedAt`.

**Why not reuse `trackingNumber`/`trackingUrl`**: `docs/base-standards.md` explicitly requires "customer-facing order status and internal fulfillment status must be modeled separately" and "payment status, order status, fulfillment status, supplier order status, shipment status... must not be mixed" — the CJ order's own status is a *third* status alongside the internal `SupplierOrder.status` and the eventual `Shipment.status`, and conflating them would violate that principle and make the meaning of `trackingNumber` ambiguous (internal manual entry vs. CJ-reported).

### 5. `isSandbox` is forced server-side, never accepted from the request
`cjOrderPushService.pushOrder()` always sends `isSandbox: 1` to `createOrderV3` in this increment, gated by an env var `CJ_SANDBOX_ORDERS` (default `true`). The push endpoint does not accept an `isSandbox` field in its request body at all — there is no code path by which a client request could force a real order. Flipping to real orders in a future increment means changing this env var (and presumably adding an explicit, separately-reviewed opt-in), not passing a flag through the API.

### 6. Idempotency via a unique `externalOrderId`, checked before pushing
`pushOrder()` first checks `SupplierOrder.externalOrderId`; if already set, the push is rejected (`CJ_ORDER_ALREADY_PUSHED`) rather than silently creating a duplicate CJ order. This mirrors the existing idempotent-generation pattern already used by `SupplierOrderService.generateFromCustomerOrder`.

### 7. Freight quote is a separate, read-only step before push
`POST .../cj/freight-quote` calls `freightCalculate` and returns the raw list of logistics options (name, days, price) so the admin can pick a `logisticName` to pass into the subsequent push call. This mirrors the real CJ workflow (quote first, then include the chosen `logisticName` in `createOrderV3`) and keeps the (potentially slow, quota-consuming) freight lookup decoupled from the order-creation call.

## Risks / Trade-offs

- **[Risk] CJ's documented token lifetime (15 days) contradicts the live-observed value (~180 days).** → Mitigation: never hardcode a lifetime; always compute refresh timing from the `accessTokenExpiryDate` field in the actual response, with a safety margin (e.g. refresh when within 24h of the reported expiry).
- **[Risk] Global token cache in a serverless (Lambda) environment means cold starts re-authenticate.** → Mitigation: acceptable for this increment (auth is a single extra call, rate-limited to 1/s, not a hot path); revisit if Lambda invocation volume for CJ-touching endpoints becomes high enough to hit the 1 req/s auth limit.
- **[Risk] CJ's points/quota system (`pointsInfo`) could be exhausted by large catalog syncs.** → Mitigation: log `pointsInfo.remaining` on every call for observability; the existing `MAX_SYNC_PAGES` safety cap from the prior increment is retained.
- **[Risk] Renaming ~15 files is a larger-than-usual diff for one change.** → Mitigation: mechanical, low-risk rename (no logic change to unrelated code); full test suite re-run after rename catches any missed reference.
- **[Risk] Forcing `isSandbox` server-side could be quietly bypassed by a future change that adds a request-level override without re-reading this design.** → Mitigation: no `isSandbox` field exists anywhere in the push endpoint's request schema/validator in this increment — there is nothing to "turn off" without a deliberate code change, which is the point.
- **[Trade-off] No webhook means CJ order status can go stale between admin-triggered pulls.** → Accepted for this increment; acceptable since order push itself is a manual, low-frequency admin action in sandbox mode, not a production fulfillment path yet.

## Migration Plan

1. Add Prisma migration: rename `SpocketCatalogItem` → `CjCatalogItem` (with CJ-specific field additions), change `SupplierIntegration.provider` default, add new `SupplierOrder` external-order fields. Existing `SpocketCatalogItem`/`SupplierIntegration` rows are placeholder/test data from the prior increment (confirmed empty in the dev database) — no real data migration is required, a straight rename/add is sufficient.
2. Add `CJDROPSHIPPING_API_KEY`, `CJ_API_BASE_URL`, `CJ_SANDBOX_ORDERS` to `.env.example`; remove `SPOCKET_API_KEY`/`SPOCKET_API_BASE_URL`.
3. Rollback: since this replaces an already-archived, not-yet-production-critical placeholder with no real dependents, reverting the migration and code rename is safe if needed — nothing customer-facing depends on the old routes.

## Open Questions

1. Confirm CJ's real accessToken lifetime empirically over a longer window (the 15-day vs ~180-day discrepancy) before relying on any specific refresh cadence in production.
2. Whether the CJ account's rate/quota limits (`pointsInfo`) are sufficient for the eventual full-catalog sync volume Mavile will need — only knowable once real catalog size/sync frequency is exercised.
3. Whether a genuinely fast (sub-4-day) shipping lane to Spain exists for any CJ-warehoused SKUs — inconclusive from the freight-quote test on EU-tagged stock; worth re-testing once real product selection begins.
