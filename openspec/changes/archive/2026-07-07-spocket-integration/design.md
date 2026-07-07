## Context

The store currently has zero real external supplier integration. `supplier-management` provides admin CRUD for `Supplier` master records; `supplier-order-management` tracks fulfillment manually through a `Draft→Requested→Confirmed→Shipped→Delivered` lifecycle driven entirely by admin actions; `supplier-feed-sample-import` reads a local JSON fixture, not an HTTP API. `ProductVariant` already has internal-only `supplierId`, `supplierReference`, `supplierCost`, and `stockPolicy` fields, protected from customer-facing responses via the existing `variantSelect` allow-list.

Spocket (spocket.co) is a real dropshipping platform with a REST API for product/inventory data. This change builds the first real outbound integration in the codebase. The closest existing precedent is the Stripe integration (`backend/src/infrastructure/stripe/stripeClient.ts`): a module-level singleton client constructed from an environment-sourced secret, with strict rules that the secret never leaves the server and idempotency keys guard against duplicate side effects on retry.

Per `docs/base-standards.md` section 4 and section 17, the supplier-fulfilled business model and its manual-first posture are not being changed — this is an additive tool that removes manual data entry for catalog/cost/stock while leaving order placement and fulfillment tracking exactly as they are today.

## Goals / Non-Goals

**Goals:**
- Provide a typed, testable Spocket API client adapter following the existing layered architecture and the Stripe client precedent.
- Let an admin configure and verify a Spocket connection per `Supplier` without ever persisting or returning the API key.
- Let an admin pull Spocket catalog/inventory data into an internal staging table for review, fully isolated from the live public catalog.
- Keep the change reviewable in one PR: no scheduling, no order automation, no webhook receiver.

**Non-Goals:**
- Do not push `SupplierOrder` data to Spocket (order placement automation) — deferred to a future change.
- Do not build an inbound webhook receiver for Spocket fulfillment/tracking events — deferred to a future change (would mirror the Stripe webhook raw-body pattern).
- Do not auto-publish staged data to `Product`/`ProductVariant` — promotion remains a manual, existing admin workflow, untouched by this change.
- Do not add scheduled/cron-driven sync — sync is admin-triggered only, consistent with "manual control first."
- Do not change the Supplier/SupplierOrder domain model's existing requirements — this change only adds new capabilities alongside them.

## Decisions

### 1. One `SupplierIntegration` record per `Supplier`, credentials never in a returnable column
A `SupplierIntegration` model stores `supplierId` (unique FK), `provider` (`"Spocket"`, so the shape can later support additional providers without a schema rewrite), `status` (`Disconnected | Connected | Error`), `externalAccountRef?`, `lastVerifiedAt?`, `lastSyncedAt?`, and timestamps. The Spocket API key is **not** a column on this model — it is read from `process.env.SPOCKET_API_KEY` (local `.env.docker`) / SSM `/ecommerce/prod/SPOCKET_API_KEY` (production), exactly like `STRIPE_SECRET_KEY`. This guarantees the key can never be serialized by an ORM `select: { ... }` mistake, because it is never in the row to begin with.

**Alternative considered**: store an encrypted key column on `SupplierIntegration` to support genuinely per-supplier credentials (multiple independent Spocket accounts). Rejected for this increment — the proposal's scope assumes a single store-level Spocket account; encrypted-column key storage adds meaningful complexity (KMS/encryption-at-rest key management) that isn't justified until multi-account is a real requirement. `externalAccountRef` is kept on the model precisely so multi-account support is additive later, not a breaking migration.

### 2. Spocket client as a module-level singleton in `infrastructure/external`, mirroring `infrastructure/stripe`
`backend/src/infrastructure/external/spocketClient.ts` exports a configured HTTP client (base URL + API key from env, request timeout, bounded retry with backoff on `429`/`5xx`) and `spocketTypes.ts` defines typed request/response DTOs (mirroring the `escuelaJsTypes.ts` / `supplierFeedTypes.ts` convention already in that folder). A `SpocketApiError` normalizes upstream failures (status code, non-sensitive message) so application services never handle raw HTTP/axios errors.

**Alternative considered**: put the Spocket client directly in the application layer service. Rejected — violates the existing DIP convention (`backend-standards.md` "Domain classes should not directly depend on concrete implementations") and breaks the pattern already established for Stripe, where the infrastructure client is injected/imported by services, not embedded in them.

### 3. Application layer depends on a `SpocketClient` port, not the concrete client
`application/services` (e.g. `spocketConnectionService.ts`, `spocketCatalogSyncService.ts`) depend on an interface (`ISpocketClient`) implemented by the infrastructure adapter. This keeps unit tests mockable without HTTP calls and matches the Repository/Service pattern already used for `Supplier`/`SupplierOrder`.

### 4. Staging table (`SpocketCatalogItem`) instead of writing directly to `ProductVariant`
Spocket data lands in a new `SpocketCatalogItem` table (`supplierIntegrationId` FK, `externalRef` unique-per-integration, `title`, variant attributes, `supplierCost`, `stockQuantity`, `rawPayload Json`, `syncStatus`, `lastSyncedAt`), upserted on `(supplierIntegrationId, externalRef)`.

**Alternative considered**: sync directly into `ProductVariant.supplierCost`/stock-related fields. Rejected — this would auto-mutate the live, customer-facing-adjacent catalog from unreviewed upstream data, contradicting "manual control first" and the requirement that supplier data stay separate from public product data. A staging table makes promotion an explicit, auditable, future admin action.

### 5. Sync is a single admin-triggered request, not a background job
`POST /spocket/sync` runs synchronously within the request (bounded by the Spocket client's own timeout/retry policy) and returns a summary. Per-item failures are caught and recorded as `syncStatus = Failed` without aborting the batch; a total upstream outage aborts with `502 SPOCKET_API_UNAVAILABLE`.

**Alternative considered**: a queued/background job with polling status. Rejected for this increment — adds infrastructure (queue, worker, job status polling endpoint) disproportionate to a first, admin-triggered, low-frequency sync. Revisit if catalog size or sync frequency grows.

### 6. Error codes and response shape reuse existing conventions
New error codes (`SPOCKET_CONNECTION_NOT_FOUND`, `SPOCKET_CONNECTION_NOT_READY`, `SPOCKET_API_UNAVAILABLE`) follow the existing `{ success, error: { message, code } }` format and HTTP status mapping already used by `SUPPLIER_NOT_FOUND`, `CUSTOMER_ORDER_NOT_ELIGIBLE`, etc.

## Risks / Trade-offs

- **[Risk] Spocket's real API contract (auth model, endpoints, rate limits) is unverified against actual Spocket docs before this design.** → Mitigation: the `SpocketApiClient` is built behind the `ISpocketClient` port with typed DTOs isolated in `spocketTypes.ts`; if the real contract differs (e.g., OAuth instead of static key), only the infrastructure adapter and config change, not application services or the data model. Flagged as an open question below.
- **[Risk] Credential leakage through logs or error messages.** → Mitigation: `SpocketApiError` messages are constructed from a fixed non-sensitive vocabulary (status code + generic reason), never from raw upstream body content that might echo request headers; logger calls never include the resolved API key.
- **[Risk] A large Spocket catalog makes synchronous sync slow or timeout-prone.** → Mitigation: sync is explicitly scoped as best-effort for this increment (admin-triggered, not customer-facing critical path); pagination on the Spocket read side keeps individual upstream calls bounded even though the endpoint itself is synchronous.
- **[Risk] Staging data growing unbounded if never cleaned up.** → Mitigation: out of scope for this increment (no retention policy required yet, since this is a review surface, not production data); revisit once real usage patterns are known.
- **[Trade-off] No background job/queue means the admin must wait for the sync request to complete.** → Accepted for now given low expected sync frequency (admin-triggered, not scheduled); documented as a candidate follow-up if usage grows.

## Migration Plan

1. Add `SupplierIntegration` and `SpocketCatalogItem` Prisma models + indexes; run `npx prisma migrate dev --name add_spocket_integration`.
2. Deploy is additive-only — no existing table/column is altered, so no backfill or data migration is required.
3. Add `SPOCKET_API_KEY` and `SPOCKET_API_BASE_URL` to `.env.example`, local `.env.docker`, and production SSM (`/ecommerce/prod/SPOCKET_API_KEY`, `/ecommerce/prod/SPOCKET_API_BASE_URL`) before the feature is usable in an environment; absence of these vars must not crash the app (mirrors the `sk_test_placeholder` fallback pattern for Stripe) so existing tests and non-Spocket flows are unaffected.
4. Rollback: the new tables and routes can be dropped/disabled independently since nothing else depends on them yet; no destructive rollback path is needed for existing data.

## Open Questions

1. Does Spocket's real partner/API program offer server-to-server access with a static API key, or is it OAuth/partner-gated? This must be confirmed against Spocket's actual API documentation before implementation starts, since it determines the shape of `SPOCKET_API_KEY` config and the auth step in `SpocketApiClient`.
2. What are the exact Spocket endpoints, request/response shapes, pagination mechanism, and rate limits for listing products/variants and inventory/cost? Needed to finalize `spocketTypes.ts` DTOs.
3. What is the precise mapping between a Spocket product/variant identity and the store's `externalRef` — is it stable across syncs, and does it map 1:1 to a future `ProductVariant.supplierReference`?
4. Confirm currency/unit assumptions for Spocket's cost and stock fields before mapping into `supplierCost`/`stockQuantity`.
