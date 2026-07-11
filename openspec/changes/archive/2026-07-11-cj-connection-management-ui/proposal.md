## Why

The CJ Dropshipping connection lifecycle (configure, verify, sync) has been fully built and curl-tested on the backend across three prior changes (`spocket-integration`, `cj-dropshipping-integration`, `cj-catalog-promotion`), but no admin UI was ever wired to it. In production, an administrator creates a `Supplier`, opens the "CJ Catalog" page, and hits a dead end: the page calls `GET .../cj/catalog`, receives `404 CJ_CONNECTION_NOT_FOUND`, and has no way to configure, verify, or sync the connection from the panel. This blocks onboarding any CJ supplier end-to-end and is why production currently has zero storefront products despite the CJ integration and API key being live. This must be fixed now to unblock the first real production catalog.

## What Changes

- Add a CJ connection status panel at the top of `CjCatalogPage` showing `provider`, `status` (`Disconnected`/`Connected`/`Error`), `externalAccountRef`, `lastVerifiedAt`, `lastSyncedAt`.
- Add a "Configure connection" modal that submits `POST .../cj/connection` with only an optional `externalAccountRef` text field (never an API key or credential field — the key is server-side configuration).
- Add a "Verify" action calling `POST .../cj/connection/verify`, surfacing `{ healthy, reason }` and refreshing the panel's `status`/`lastVerifiedAt`.
- Add a "Sync catalog" action calling `POST .../cj/sync`, enabled only when `status = Connected`, surfacing `{ itemsUpserted, itemsFailed, syncedAt }` and refreshing both the panel and the existing catalog list.
- Replace the current bare `CJ_CONNECTION_NOT_FOUND` error message with the connection panel + "Configure connection" call to action, gating the existing catalog list/promote/activate UI until a usable connection exists.
- No backend changes: `POST .../cj/connection`, `GET .../cj/connection`, `POST .../cj/connection/verify`, and `POST .../cj/sync` already exist, are routed under admin auth, and are stable.

## Capabilities

### New Capabilities
(none — this wires existing backend capabilities into the admin UI; no new backend-observable capability is introduced)

### Modified Capabilities
- `cj-connection-management`: adds admin-UI-observable requirements for configuring, viewing, and verifying the CJ Dropshipping connection from the CJ Catalog admin page (previously API-only, curl-verified).
- `cj-catalog-sync`: adds an admin-UI-observable requirement for triggering a catalog sync from the CJ Catalog admin page, gated on connection status (previously API-only, curl-verified).

## Impact

- **Frontend only**: `frontend/src/pages/CjCatalogPage.tsx` (add panel + gating), new `frontend/src/components/admin/CjConnectionPanel.tsx`, new `frontend/src/components/admin/CjConnectionModal.tsx`, new `frontend/src/services/cjConnectionService.ts`, new `frontend/src/types/cjConnection.ts`.
- **Backend**: none. `backend/src/routes/admin/cjRoutes.ts` and its controllers/services are unchanged.
- **Customer-facing behavior**: none directly. Indirectly unblocks onboarding CJ suppliers, which is a prerequisite for any product reaching the public catalog.
- **Supplier data exposure**: no change to what is exposed — `externalAccountRef` is the only editable/displayed connection field; the CJ Dropshipping API key remains server-side only and is never rendered or accepted as input.
- **Order lifecycle / fulfillment / payment / returns / refunds**: not affected.
- **Documentation**: `docs/frontend-standards.md` (new admin components/services/routes for the connection lifecycle).

## Non-goals

- No changes to backend connection/sync endpoints, rate limiting, or error codes.
- No per-supplier connection health badge on `SuppliersPage` (deferred).
- No sync history/audit log or background/async sync progress UI (deferred).
- No support for multiple suppliers per CJ connection or multiple dropshipping providers (CJ remains the only provider).
- No automation of promotion/activation — this change only unblocks the configure/verify/sync step that precedes the already-built promote/activate UI.
