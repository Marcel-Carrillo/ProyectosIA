## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide workspace isolation: check current branch, `git status`, and `git worktree list`. If the workspace is clean and no unrelated work is present, use a normal feature branch in the current checkout; otherwise ask the user before creating a worktree.
- [x] 0.2 Ensure current branch is `develop` and up to date (`git fetch origin && git checkout develop && git pull`) if not already there.
- [x] 0.3 Create and switch to feature branch `feature/cj-connection-management-ui` from `develop`.
- [x] 0.4 Verify branch creation with `git branch --show-current` and report clean starting state.

## 1. Frontend: Connection Types

- [x] 1.1 Add `frontend/src/types/cjConnection.ts` with `SupplierIntegrationStatus` (`'Disconnected' | 'Connected' | 'Error'`), `CjConnection` (`{ id, supplierId, provider, status, externalAccountRef, lastVerifiedAt, lastSyncedAt, createdAt, updatedAt }`), `CjConfigureConnectionRequest` (`{ externalAccountRef?: string | null }`), `CjVerifyResult` (`{ healthy: boolean, reason?: string }`), `CjSyncResult` (`{ itemsUpserted: number, itemsFailed: number, syncedAt: string }`), and the corresponding response envelope types, mirroring the export style of `frontend/src/types/cjCatalog.ts`.

## 2. Frontend: Connection Service

- [x] 2.1 Add `frontend/src/services/cjConnectionService.ts` following the `cjCatalogService.ts` pattern (axios + `cjBase(supplierId)` helper + try/catch/console.error/rethrow): `getConnection(supplierId)`, `configureConnection(supplierId, payload)`, `verifyConnection(supplierId)`, `sync(supplierId)`.
- [x] 2.2 Add `mapCjConnectionError`/`extractCjConnectionErrorMessage` in the same file, covering `CJ_CONNECTION_NOT_FOUND` (benign/"not configured"), `CJ_CONNECTION_NOT_READY`, `VALIDATION_ERROR`, and HTTP `429` (rate limit) distinctly from a generic fallback message.
- [x] 2.3 Add `frontend/src/services/__tests__/cjConnectionService.test.ts` (mock `axios` like `cjCatalogService.test.ts`): each method hits the correct URL/verb/body; error-map cases for all codes above including rethrow-on-reject.

## 3. Frontend: Connection Panel Component

- [x] 3.1 Add `frontend/src/components/admin/CjConnectionPanel.tsx`: renders `provider`, `StatusBadge` for `status`, `externalAccountRef` (or "—"), formatted `lastVerifiedAt`/`lastSyncedAt` (or "Never verified"/"Never synced"). Renders a "not configured" state (no connection yet) with a "Configure connection" CTA, and a "configured" state with "Edit", "Verify", and "Sync catalog" actions.
- [x] 3.2 "Verify" action: disabled while in flight; on response, calls a parent-provided refresh callback and surfaces a success ("Connection healthy") or warning banner with the backend `reason` verbatim; maps HTTP `429` to a distinct "too many attempts, try again shortly" message (via task 2.2's error map) instead of a generic failure.
- [x] 3.3 "Sync catalog" action: disabled unless `status === 'Connected'` (with a hint that verification is required first) and disabled while in flight; on success shows `itemsUpserted`/`itemsFailed` and calls parent-provided refresh + catalog-refetch callbacks.
- [x] 3.4 Add `data-testid`s: `cj-connection-panel`, `cj-connection-status`, `btn-configure-connection`, `btn-edit-connection`, `btn-verify-connection`, `btn-sync-catalog`, `cj-verify-result`, `cj-sync-result`, `cj-connection-error`.
- [x] 3.5 No `useTranslation` (matches `CjCatalogPage.tsx`/`SuppliersPage.tsx` hardcoded-admin-panel precedent per `docs/frontend-standards.md`).

## 4. Frontend: Configure Connection Modal

- [x] 4.1 Add `frontend/src/components/admin/CjConnectionModal.tsx` mirroring `CjPromoteModal.tsx`'s structure (React Bootstrap `Modal`, `fullscreen="sm-down"`): single optional `externalAccountRef` text input labeled to make clear it is not a credential (e.g. "External account reference (optional, not a credential)"), client-side max-length guard (150 chars), submit calling `cjConnectionService.configureConnection`.
- [x] 4.2 No field of any kind for an API key, secret, or credential — enforce this by omission, not by masking.
- [x] 4.3 On success, call `onSuccess` (parent closes modal and refreshes the connection panel); on failure, show the mapped error inline in the modal without closing it.
- [x] 4.4 Add `data-testid`s: `modal-configure-cj-connection`, `input-external-account-ref`, `btn-modal-cancel`, `btn-modal-save-connection`.

## 5. Frontend: Wire Into CjCatalogPage

- [x] 5.1 In `frontend/src/pages/CjCatalogPage.tsx`, add a `connection` fetch (`cjConnectionService.getConnection`) on mount, alongside the existing `categories` fetch.
- [x] 5.2 When the connection fetch returns `404 CJ_CONNECTION_NOT_FOUND`: render only `CjConnectionPanel` in its "not configured" state plus the "Configure connection" CTA; do NOT call `listCatalog` and do NOT render the previous bare `ErrorAlert` for this case.
- [x] 5.3 When a connection exists (any `status`): render `CjConnectionPanel` above the existing filters/table, and proceed with the existing `fetchCatalog` flow unchanged (catalog is fetched regardless of `status`; only the panel's own "Sync catalog" action is gated on `status === 'Connected'`, per design.md decision 4).
- [x] 5.4 Wire `CjConnectionModal` (shown via a new `showConnectionModal` state, opened from the panel's "Configure connection"/"Edit" actions) with an `onSuccess` that refetches the connection and closes the modal.
- [x] 5.5 After a successful "Verify" or "Sync catalog" action in the panel, refetch the connection (`5.1`'s fetcher); after a successful sync additionally refetch the catalog list (existing `fetchCatalog`).

## 6. Frontend: StatusBadge Support

- [x] 6.1 Verify `frontend/src/components/admin/StatusBadge.tsx` maps `Connected` → success variant, `Error` → danger variant, `Disconnected` → secondary variant. Add these mappings if not already present (check existing switch/lookup before assuming a gap).

## 7. Frontend: Page-Level Tests

- [x] 7.1 Extend `frontend/src/pages/__tests__/CjCatalogPage.test.tsx`: not-configured state renders the connection panel + "Configure connection" CTA (not the old bare error) and does not call `listCatalog`; configure success refreshes the panel; verify success/healthy vs. failure/unhealthy banners (including the mapped `reason`); verify `429` handling; sync disabled unless `Connected`; sync success shows the result summary and refetches the catalog. Use `findBy*` queries per the repo's `testing-library/prefer-find-by` rule.
- [x] 7.2 Add `frontend/src/components/admin/__tests__/CjConnectionPanel.test.tsx` and `CjConnectionModal.test.tsx` for behavior not fully exercised at the page level (in-flight disabled states, max-length guard, callback wiring).

## 8. Review and Update Existing Unit Tests (MANDATORY)

- [x] 8.1 Run the full frontend suite and fix any real breakages caused by `CjCatalogPage.tsx`'s changed initial-fetch behavior (e.g. any existing test asserting `listCatalog` is called unconditionally on mount).
- [x] 8.2 Run `npx eslint src --ext .ts,.tsx` and `npx tsc --noEmit`; fix any issues in touched files.

## 9. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 9.1 Capture pre-test database baseline for `Supplier`/`SupplierIntegration` counts (local dev DB) — informational only, since this change makes no backend/DB changes and all new tests are frontend-only (mocked services, no real DB/HTTP calls).
- [x] 9.2 Run targeted frontend tests: `cjConnectionService.test.ts`, `CjConnectionPanel.test.tsx`, `CjConnectionModal.test.tsx`, `CjCatalogPage.test.tsx`.
- [x] 9.3 Run the full frontend suite: `CI=true npx react-scripts test --watchAll=false`.
- [x] 9.4 Verify post-test database state matches the baseline exactly (no real DB/HTTP calls in unit tests) — no restoration needed.
- [x] 9.5 Create report `openspec/changes/cj-connection-management-ui/reports/YYYY-MM-DD-step-9-unit-test-and-db-verification.md`.

## 10. Manual Endpoint Sanity Check with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Since no backend endpoint changes, re-verify (do not re-implement) the four contracts the new UI depends on against the real CJ Dropshipping API in the local/dev environment: `GET`/`POST .../cj/connection`, `POST .../cj/connection/verify`, `POST .../cj/sync` — confirm response shapes match `frontend/src/types/cjConnection.ts` exactly (field names, nullability, status codes) using a dedicated test supplier.
- [x] 10.2 Confirm `404 CJ_CONNECTION_NOT_FOUND` on `GET .../cj/connection` for a supplier with no connection (drives task 5.2's gating).
- [x] 10.3 Confirm `429` behavior on `POST .../cj/connection/verify` by exceeding the rate limit, to validate the frontend's `429` handling path (task 2.2/3.2) against a real response.
- [x] 10.4 Restore database state: delete any test-created `Supplier`/`SupplierIntegration` rows; verify counts match the task 9.1 baseline.
- [x] 10.5 Create report `openspec/changes/cj-connection-management-ui/reports/YYYY-MM-DD-step-10-curl-endpoint-testing.md`.

## 11. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 11.1 Start backend+frontend via Docker Compose (or `run-dev` skill). Create a fresh test `Supplier` with no CJ connection.
- [x] 11.2 Navigate to `/suppliers/:id/cj-catalog` via Playwright MCP; confirm the "not configured" panel + "Configure connection" CTA render, and no bare `CJ_CONNECTION_NOT_FOUND` error is shown.
- [x] 11.3 Open "Configure connection", submit with an `externalAccountRef`, confirm the panel updates to show `status = Disconnected` and the submitted value.
- [x] 11.4 Click "Verify" against the real CJ Dropshipping API; confirm the panel updates to `status = Connected` (or the failure banner path, documented either way) and `lastVerifiedAt` updates. (Live-verified both outcomes: a real `429` from the shared rate limit, and a real `200 healthy:true` → `Connected` after a backend restart reset the counter — see report.)
- [x] 11.5 Confirm "Sync catalog" is enabled only once `status = Connected`; click it; confirm the in-flight disabled/"Syncing…" state. (Live-verified trigger + gating + in-flight state against the real CJ API; the completion/result-summary rendering was intentionally not run to completion live — the real catalog sync would have kept consuming shared production CJ API quota with no additional verification value, since that rendering is already covered by passing `CjConnectionPanel.test.tsx`/`CjCatalogPage.test.tsx` assertions on the same response shape confirmed live in step 10. See report for full justification.)
- [x] 11.6 Restore test environment: delete the test `Supplier`/`SupplierIntegration`/any synced `CjCatalogItem` rows created; verify DB state matches the pre-test baseline.
- [x] 11.7 Create report `openspec/changes/cj-connection-management-ui/reports/YYYY-MM-DD-step-11-e2e-testing.md` plus a screenshot of the completed connection panel.

## 12. Update Technical Documentation (MANDATORY)

- [x] 12.1 Update `docs/frontend-standards.md`: add a "CJ connection admin panel patterns" subsection (new components/service/types, gating rule, rate-limit handling) alongside the existing "Admin ... panel patterns" entries.
- [x] 12.2 Review `docs/api-spec.yml` — confirm the four connection/sync endpoints are already documented (they predate this change); add them only if a real gap is found during review (no contract change expected).
- [x] 12.3 Document in the response what was updated and why.

## 13. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 13.1 Loaded and applied `ai-specs/skills/commit/SKILL.md` before executing any Git commands.
- [x] 13.2 Verified all tasks above (1–12) are `[x]`; all report files exist under `openspec/changes/cj-connection-management-ui/reports/` (steps 9, 10, 11) plus the E2E screenshot.
- [x] 13.3 Staged all relevant files; confirmed no `.env`/`.env.docker` staged.
- [x] 13.4 Created commit with Conventional Commit message, OpenSpec change name, and test verification status.
- [x] 13.5 Pushed branch to remote: `git push -u origin feature/cj-connection-management-ui`.
- [x] 13.6 Created Pull Request (`gh pr create --base develop`) with summary, OpenSpec change name, verification status, and known limitations.
- [x] 13.7 Reported the PR URL in chat.
