# Context Session: cj-dropshipping-integration

## OpenSpec change
- Location: `openspec/changes/cj-dropshipping-integration/`
- Artifacts: `proposal.md`, `design.md`, `specs/spocket-connection-management/spec.md` (REMOVED), `specs/spocket-catalog-sync/spec.md` (REMOVED), `specs/cj-connection-management/spec.md` (ADDED), `specs/cj-catalog-sync/spec.md` (ADDED), `specs/cj-supplier-order-push/spec.md` (ADDED), `tasks.md` (14 groups, 68 sub-tasks).

## Summary
Backend-only change. Replaces the prior `spocket-integration` placeholder (Spocket has no public API — confirmed via research) with a real, live-validated CJ Dropshipping integration:

1. **Real auth**: `apiKey` → `accessToken`/`refreshToken` via `POST https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken`. Success/failure determined by the response BODY (`success`/`code`), NOT HTTP status — CJ returns HTTP 200 even for logical errors. Token refresh timing must come from the response's own `accessTokenExpiryDate`, never a hardcoded constant (docs say 15 days, live test observed ~180 days — don't trust either blindly, read the actual field).
2. **Real catalog sync**: `GET /product/getCategory`, `GET /product/listV2` (paginated, response nested as `data.content[].productList[]`), `GET /product/variant/query?pid=`, stock queries. Still staging-only (`CjCatalogItem`, renamed from `SpocketCatalogItem`) — no auto-publish to `Product`/`ProductVariant`.
3. **New capability — sandbox order push**: freight quote (`POST /logistic/freightCalculate`), push a `SupplierOrder` to CJ via `POST /shopping/order/createOrderV3` with `isSandbox: 1` FORCED server-side (not accepted as a request field, gated by `CJ_SANDBOX_ORDERS` env var), and pull-based status check (`GET /shopping/order/getOrderDetail`) — no webhook in this increment.

## Real, live-validated facts (do not re-derive, use as ground truth)
- Base URL: `https://developers.cjdropshipping.com/api2.0/v1`
- Auth header on authenticated calls: `CJ-Access-Token: <accessToken>`
- Rate limit: 1 req/s on auth endpoints; general quota tracked via `pointsInfo: {total, usedToday, remaining}` on every response
- `product/listV2` params: `page` (1-1000), `size` (1-100), `keyWord`, `categoryId`, `countryCode`, price range, `sort`, `orderBy`
- Real API key already exists in `backend/.env` as `CJDROPSHIPPING_API_KEY` (format `CJUserNum@api@<hex>`) — already validated live by the user/session (auth, categories, product list, variant query, and freight-calculate all tested successfully against the real account).
- Freight to Spain from China: realistic fastest options are `CJPacket Ordinary`/`CJPacket Fast Ordinary` at 4-8 days; this is business context, not a blocker.

## Existing implementation to rename/replace (all under backend/src/**/spocket*)
- `backend/src/domain/models/spocketCatalogItem.ts`, `supplierIntegration.ts`
- `backend/src/domain/repositories/spocketCatalogItemRepository.ts`, `supplierIntegrationRepository.ts`
- `backend/src/infrastructure/external/spocketClient.ts` (decides success via `response.ok`/HTTP status — THIS is exactly what must change to body-based evaluation), `spocketTypes.ts`
- `backend/src/infrastructure/repositories/spocketCatalogItemRepository.ts`, `supplierIntegrationRepository.ts`
- `backend/src/application/services/spocketConnectionService.ts`, `spocketCatalogSyncService.ts`
- `backend/src/presentation/controllers/spocketConnectionController.ts`, `spocketCatalogSyncController.ts`
- `backend/src/presentation/serializers/spocketCatalogItemSerializer.ts`
- `backend/src/routes/admin/spocketRoutes.ts` (mounted in `supplierRoutes.ts` as `/:supplierId/spocket`)
- `backend/src/routes/public/__tests__/spocketIsolation.test.ts`
- Corresponding `__tests__` files alongside each of the above

## Existing conventions to reuse
- Layered architecture: domain/application/infrastructure/presentation, exactly as the removed spocket-integration change followed.
- `SupplierOrder` model (`backend/prisma/schema.prisma`) already has `status`/`trackingNumber`/`trackingUrl` for INTERNAL fulfillment — the new CJ order fields (`externalProvider`, `externalOrderId` unique, `externalOrderStatus`, `externalTrackingNumber`, `externalTrackingProvider`, `sandbox`, `pushedAt`, `lastStatusSyncedAt`) must stay separate, never overwrite/reuse those.
- `backend/src/application/services/supplierOrderService.ts` is the existing service for internal fulfillment — the new `cjOrderPushService.ts` is a sibling, not a replacement.
- Error handling pattern: `infrastructure/repositories/*` hosts NotFound-style errors; `application/validator.ts` hosts business-rule/state errors (`*NotReadyError`, `*UnavailableError`, etc.) — mirror this split for the new Cj* error classes.
- Rate limiter pattern already exists on the connection verify endpoint (`spocketVerifyLimiter` in the old `spocketRoutes.ts`, added after a CodeQL finding) — carry it over to `cjRoutes.ts`.
- **CRITICAL lesson from the prior change**: when running `npx prisma migrate dev` inside the Docker container, `docker cp` the resulting migration folder to the HOST `backend/prisma/migrations/` immediately, BEFORE any `docker compose build`/`up -d` that recreates the container — `backend/prisma` is NOT bind-mounted (only `backend/src` is), so a migration created only inside the container is lost on rebuild. This bit us once already in the spocket-integration change.
- `backend/Dockerfile`'s dev stage already has `jest.config.js`, `jest.setup.js`, `.eslintrc.json` copied in (fixed in the prior change) — testing/linting in Docker should already work.

## Your job (backend-developer planning agent)
Produce a per-file implementation plan at `.claude/doc/cj-dropshipping-integration/backend.md` covering, for EVERY file listed in `tasks.md` groups 1-8:
- Exact Prisma schema changes (model renames, new fields, migration name).
- Domain model/repository interface changes (renamed types, new methods for `SupplierOrder`'s external-order fields).
- `cjClient.ts`/`cjTypes.ts`: the real auth flow (token cache + refresh keyed off `accessTokenExpiryDate`), body-based success evaluation replacing the current `response.ok` check, and the DTOs/port methods needed for catalog + freight + order endpoints.
- Application services: `cjConnectionService.ts`, `cjCatalogSyncService.ts` (renamed), and the NEW `cjOrderPushService.ts` (freight quote, sandbox-forced push with idempotency via `externalOrderId`, status pull).
- Controllers/routes: renamed connection/catalog endpoints under `/cj/*`, and new supplier-order-scoped push/status endpoints.
- Validator additions (new Cj* error classes) and `errorHandler.ts` wiring.
- Test file plan for every renamed/new file, mirroring the exact Jest mocking idioms already used in the (now-being-replaced) `spocket*.test.ts` files.

Read `openspec/changes/cj-dropshipping-integration/{proposal.md,design.md,tasks.md,specs/**/*.md}` plus every existing `spocket*` file listed above (for the current implementation being replaced) before writing the plan. Do NOT implement — only plan.
