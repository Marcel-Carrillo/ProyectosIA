## Context

`CjCatalogPage.tsx` (route `suppliers/:supplierId/cj-catalog`) currently assumes a working, already-configured CJ Dropshipping connection: on mount it calls `cjCatalogService.listCatalog`, and if the backend returns `404 CJ_CONNECTION_NOT_FOUND` it renders that message via the existing `ErrorAlert`/`extractCjCatalogErrorMessage` path with no recovery action. The backend connection lifecycle (`GET/POST .../cj/connection`, `POST .../cj/connection/verify`, `POST .../cj/sync`) is fully implemented, admin-auth-protected, and curl-verified (see `cj-dropshipping-integration` reports) but has no frontend caller anywhere in the codebase (confirmed by repo-wide grep — no `cjConnectionService`, no connection-related component). This is a pure frontend wiring gap: no backend change is required.

Constraints:
- Admin panel is hardcoded (no `useTranslation`), matching every existing admin file (`CjCatalogPage.tsx`, `SuppliersPage.tsx`).
- `verify` is rate-limited (30/15 min per `cjVerifyLimiter`) and has a real side effect (flips persisted `status`), so the UI must not call it automatically or in a retry loop.
- `sync` can be slow (paginated upstream fetch against the real CJ API) and must not block the page.
- `externalAccountRef` is the only writable connection field; no credential/API-key input may exist anywhere in this UI.

## Goals / Non-Goals

**Goals:**
- Let an admin go from "no connection" to "connected + synced" entirely within `CjCatalogPage`, without curl.
- Gate the existing catalog list/promote/activate UI behind a usable connection (`status === 'Connected'` for sync; any existing connection record to view/edit).
- Reuse existing patterns (`cjCatalogService.ts` axios/error-map style, `CjPromoteModal.tsx` modal style, `StatusBadge` component) rather than inventing new ones.

**Non-Goals:**
- No backend changes (endpoints, rate limits, error codes are all final as-is).
- No connection-health indicator on `SuppliersPage`'s list/table (deferred — `Supplier` DTO has no connection field today and adding one would require a backend list-join change).
- No sync history/audit trail or background job polling — `sync` stays a single synchronous request/response like `promote`/`activate` already are.
- No multi-provider abstraction — CJ Dropshipping remains the only supplier integration provider modeled in the UI.

## Decisions

### 1. New sibling service `cjConnectionService.ts` instead of extending `cjCatalogService.ts`
The catalog service is scoped to catalog listing/promotion concerns and already has its own error-map (`mapCjCatalogError`). Connection lifecycle has a distinct set of error codes (`CJ_CONNECTION_NOT_FOUND`, `CJ_CONNECTION_NOT_READY`, plus `429` rate-limiting) and a distinct resource (`SupplierIntegration`, not `CjCatalogItem`). Mirroring the existing one-service-per-resource convention (`supplierService.ts`, `customerService.ts`, `customerOrderService.ts`) keeps each file focused. **Alternative considered**: add connection methods to `cjCatalogService.ts` — rejected, it would mix two error-code vocabularies in one `mapCjCatalogError` function and bloat an already-tested file.

### 2. New types file `cjConnection.ts` instead of extending `cjCatalog.ts`
Same reasoning as above — `cjCatalog.ts` models `CjCatalogItem`/promotion DTOs; connection DTOs (`CjConnection`, `CjConfigureConnectionRequest`, `CjVerifyResult`, `CjSyncResult`) are a separate concern with their own lifecycle. Kept as a sibling file per existing precedent (`customer.ts` vs `customerOrder.ts` as separate type files for related-but-distinct resources).

### 3. Connection panel lives inside `CjCatalogPage`, not a separate route
The proposal and existing navigation (`SuppliersPage`'s single "CJ Catalog" link) intentionally funnel the admin through one screen per supplier. Splitting connection setup into its own page/route would require a second nav entry and an extra click for the common case (admin already knows they need to connect-then-sync-then-promote in one sitting). **Alternative considered**: a dedicated `/suppliers/:id/cj-connection` page — rejected as unnecessary indirection; the existing `CjPromoteModal` precedent shows this project keeps related actions on one page via modals, not sub-routes.

### 4. Gating rule: hide catalog list/filters until a connection exists; disable Sync until `status === 'Connected'`
- If `GET .../cj/connection` returns `404 CJ_CONNECTION_NOT_FOUND`: render only the connection panel (status = "Not configured") + "Configure connection" CTA. Do not attempt `listCatalog` at all (avoids a guaranteed second error round-trip).
- Once a connection exists (`Disconnected`, `Connected`, or `Error` status), render the panel above the existing catalog UI. The catalog list itself is still fetched and shown regardless of `status` (an admin may want to review previously-synced items even if the connection later errors) — only the **Sync** button is disabled unless `status === 'Connected'`, mirroring the backend's own guard (`422 CJ_CONNECTION_NOT_READY`).
- This means `CjCatalogPage`'s existing `fetchCatalog` effect only needs a small change: skip the initial call when there is no connection at all, not when `status !== 'Connected'`.

### 5. Verify and Sync are explicit user-triggered actions only
No auto-verify-on-mount and no polling. Both actions render a per-button disabled+spinner state while in-flight (mirroring `CjCatalogPage`'s existing `actioningId` pattern for activate/deactivate) and a dismissible result banner afterward. This respects the verify rate limit and avoids surprising side effects (verify mutates persisted `status`).

### 6. Error mapping extends the existing `extract*ErrorMessage` convention
`cjConnectionService.ts` exports its own `mapCjConnectionError`/`extractCjConnectionErrorMessage`, following the exact shape of `cjCatalogService.ts`'s equivalents, adding cases for `CJ_CONNECTION_NOT_FOUND` (benign — "not configured yet", not a scary error), `CJ_CONNECTION_NOT_READY`, `VALIDATION_ERROR`, and HTTP `429` (rate limit — message tells the admin to wait, no code from the backend since 429 is layer-level, not an app error code).

## Risks / Trade-offs

- **[Risk] Admin clicks Verify repeatedly and hits the 15-minute rate limit, then reports the UI as "broken".** → Mitigation: disable the Verify button immediately on click until the response returns, and show the exact backend-mapped message ("Too many verification attempts — try again later") rather than a generic error on `429`.
- **[Risk] Sync takes long enough that the admin thinks the page is frozen.** → Mitigation: explicit disabled+spinner state on the Sync button (not a full-page loading overlay), so the rest of the page (existing catalog table) remains interactive/visible.
- **[Trade-off] Catalog list is fetched even when `status` is `Error`, not just `Connected`.** Chosen deliberately (decision 4) so an admin can still see/promote previously-synced items after a connection later breaks; only new syncs are blocked. This slightly diverges from "gate everything on Connected" but matches real operational need (a broken upstream connection shouldn't hide already-curated data).
- **[Risk] `externalAccountRef` being freely editable could be mistaken by an admin for where to paste the CJ API key.** → Mitigation: modal label explicitly reads "External account reference (optional, not a credential)" and no field resembling a secret input (no password-type field) is rendered.

## Migration Plan

No data migration — this is additive frontend-only code with no schema or API contract change. Rollout is a normal PR merge to `develop` → `master` → existing CI/CD deploy pipeline (frontend build + S3 sync + CloudFront invalidation only; no backend/Lambda redeploy needed since no backend files change). Rollback is a plain revert of the frontend PR; no backward-compatibility concern since no persisted data shape changes.

## Open Questions

- Should `SuppliersPage` eventually show a connection-health badge per supplier row? Deferred per Non-Goals; would need a backend list-join change (`Supplier` → `SupplierIntegration.status`) and should be its own change if requested.
