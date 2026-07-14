# Step 15 Report - E2E Testing with Playwright MCP

- Date: 2026-07-14
- Change: checkout-fulfillment-and-variant-ux
- Agent: Claude Code (Sonnet 5)
- Tooling: Playwright MCP (real Chromium browser), frontend on `http://localhost:3001` (Vite dev), backend on `http://localhost:3000` (`npm run dev`, host-run — see the docker-compose `predev` bug already documented in the step-14 report), Postgres via `ecommerce-db` docker container.

## Environment Setup

Docker Desktop was not running at the start of this step; started it, then `docker compose up -d db mailpit`, then ran backend and frontend dev servers directly on the host (same workaround as step 14 — the docker-compose backend image's `predev` script can't see `../docs` from its build context, a pre-existing bug unrelated to this change).

Pre-E2E database baseline (tracked tables):

| customers | addresses | orders | supplier_orders | shipments | alerts |
|---|---|---|---|---|---|
| 1360 | 3 | 294 | 9 | 9 | 1 |

## 15.2 — Stock-aware variant selector + main-image-only gallery

Used the pre-existing `E2E Test Tee` fixture product (id 143, slug `e2e-test-tee`) at `/catalog/143`, purpose-built with exactly the fixture shape this scenario needs: size S has Black (stock 5), Blue (stock 3), White (stock 0); size M has Black only (stock 5). Two images: a shared "front" photo and a Black-only "detail" photo.

- Default state loaded with S + Black selected; **White button rendered `disabled` with `aria-label="Color White (no disponible)"`**. Black/Blue remained selectable.
- Selected **Blue** (no dedicated photo for Blue): hero image stayed `Black detail` (fallback-to-current behavior confirmed) and the thumbnail strip stayed at 2 images (`Shared front`, `Black detail`) — verified via `browser_evaluate` reading `[role="list"][aria-label*="Imágenes"] img[alt]`.
- With Blue selected, **M became disabled** (`Talla M (no disponible)`) since M only has a Black variant — confirms combination-availability cross-filtering works together with the stock rule.
- Clicked the `Shared front` thumbnail directly: hero switched to `Shared front` immediately, confirming direct thumbnail override still works independent of color selection.

Result: **PASS** — matches `product-detail` spec and Group 3 unit tests.

## 15.3 — Checkout prefill, "usar mismos datos", save-as-default

Registered a fresh customer (`e2e-checkout-1784018875@example.com`, id 1579) via `POST /api/public/auth/register`, then created a default Shipping address (`POST /api/public/account/addresses`, id 10, Madrid) via the API — precondition setup only, not the behavior under test.

- Logged in through the UI (`/login`), added `E2E Test Tee` (S/Black) to cart, opened `/checkout`.
- **Prefill confirmed**: all shipping fields (name, phone, street, street2, city, province, postal code, country) matched the default address exactly. Billing showed only the profile-name fallback (no default Billing-type address exists), country defaulted to Spain — matches the documented fallback behavior.
- Checked **"Usar los mismos datos para la facturación"**: billing fields instantly mirrored shipping and became `disabled`. Edited shipping city to `Barcelona` afterward — billing mirrored the edit live, confirming continuous mirroring (not just an initial copy).
- Checked **"Guardar como mi dirección predeterminada"** on the shipping section, continued to payment, and completed a real Stripe test-mode payment (card `4242 4242 4242 4242`, `12/34`, `123`) — order `ORD-000326` (id 716) was created and the browser reached `/order-confirmation/ORD-000326`.
- Verified via `GET /api/public/account/addresses`: the original default (id 10, Madrid) is now `isDefault: false`; a new address (id 11, Barcelona — the edited shipping address) is `isDefault: true`. Confirms `handlePaymentSuccess` correctly persists the "save as default" address client-side, independent of the Stripe webhook (which does not reach `localhost` in this dev environment — see 15.5).

Result: **PASS** — matches `checkout-mvp` and `customer-management` spec requirements and Group 5 unit tests.

## 15.4 — Admin margin breakdown + freight-estimate refresh

Logged into `/admin/login`, opened `/products/143` (variants table).

- All four `E2E Test Tee` variants have `supplierCost: null` (no supplier fixture data) — the table correctly renders `—` for "Margen neto" rather than a misleading `netMargin` computed against an unknown cost (per `VariantTable.tsx`'s `NetMargin` component, `supplierCost == null → '—'`).
- Clicked **"Actualizar envío"** on `E2E-TEE-S-Black` (no linked `CjCatalogItem`): backend returned `422 CJ_ITEM_NOT_MAPPED` and the UI rendered the alert **"Esta variante no está vinculada a un artículo del catálogo del proveedor; no se puede estimar el envío."** — confirmed via `browser_snapshot`, not just the console error.
- This dev database has **zero** `ProductVariant` rows with a non-null `supplierCost` anywhere (confirmed via SQL scan), so a genuine below-target/negative-margin variant does not exist organically. Temporarily set `E2E-TEE-S-Black.supplierCost = 18.00` (`publicPrice = 19.99`, `targetMargin = 5.00`) via direct SQL:
  - Reloaded the page → **"Margen bajo"** (yellow) badge appeared, net margin shown as `1,99 € (10%) *` (asterisk = missing shipping estimate, treated as €0).
  - Raised `supplierCost` to `25.00` → **"Vendiendo con pérdida"** (red) badge appeared, net margin `-5,01 € (-25%) *`.
  - Reset `supplierCost` back to `NULL` → reloaded → badge disappeared, column reverted to `—`.

Result: **PASS**. Note: the below/negative-margin badge states required a temporary, reverted SQL mutation because this dev database has no fixture data with a known supplier cost — documented here per the same pattern already used in the step-14 report for the duplicate-CJ-push case.

## 15.5 — Sandbox automation: checkout → status sync → account page

`FULFILLMENT_AUTOMATION_ENABLED=true` was already set in `backend/.env`.

**Payment webhook.** Stripe cannot reach `localhost` in this dev environment (no `stripe listen` / ngrok configured — same limitation already documented in the step-14 report for task 14.7). Retrieved the real, already-`succeeded` PaymentIntent for order 716 (`pi_3Tt21UDhzetI24391RhfmZCT`) from Stripe's API, then built and sent a **genuinely-signed** `payment_intent.succeeded` webhook event (via the `stripe` SDK's `webhooks.generateTestHeaderString` against the real `STRIPE_WEBHOOK_SECRET`) to `POST /api/public/payments/webhook`. This exercises the real signature-verification path, not just the internal handler. Response: `200 {"success":true}`.

- Confirmed via DB: `CustomerOrder` 716 → `status: Paid`, `paymentStatus: Paid`, `paidAt` set.
- `fulfillmentAutomationService` ran automatically as part of the webhook handling and correctly recorded `AutomationAlert` id 2, type `SupplierOrderGenerationFailed`, message `"Product variant has no supplier assigned"` — genuinely correct behavior, since the purchased variant (`E2E-TEE-S-Black`) has no `supplierId` in this dev fixture. No supplier order was generated (correct), and the order's `Paid` status was **not** rolled back (per the spec's "failures never roll back Paid" requirement).

**Status-sync job.** This dev database has **zero** `SupplierIntegration`/`CjCatalogItem` rows anywhere (no supplier has ever been connected to CJ Dropshipping in this environment), so no order in the database could ever reach the real CJ status-pull step organically. To still exercise the real shipment-advancement pipeline end-to-end (per the task's own wording: "trigger the job handler directly... rather than waiting for the real schedule"), temporarily inserted a fabricated `SupplierOrder`/`SupplierOrderItem` pair for order 716 via direct SQL (externalOrderId set, status `Pushed`), then ran the **real** `CjOrderStatusSyncOrchestrator` (real `ShipmentService`, real repositories, real DB writes) with only the outbound CJ Dropshipping HTTP call stubbed to return `{ externalOrderStatus: 'SHIPPED', externalTrackingNumber: 'TEST-TRACK-123', externalTrackingProvider: 'TestCarrier' }` (no CJ credentials exist in this environment to call the real API).

- `syncOne()` returned `changed: true`; a `Shipment` row was created (`status: Shipped`, `carrier: TestCarrier`, `trackingNumber: TEST-TRACK-123`).
- Logged back in as the E2E buyer, navigated via in-app links (not hard reloads, to preserve the in-memory auth token) to `/account/orders` → order list showed **"Enviado"** for `ORD-000326`; opened `/account/orders/716` → **"Envío: Enviado"**, carrier `TestCarrier`, "Enviado el 14/7/2026" — confirms `deriveShippingStatus` correctly surfaces the new shipment on the real account UI.
- Cleaned up: deleted the fabricated `Shipment`, `SupplierOrderItem`, `SupplierOrder` rows immediately after (see Cleanup section) — `CustomerOrder` 716 itself was left as the genuine test order it now legitimately is (see 15.3).

Result: **PASS** with a documented environment limitation (no real CJ sandbox credentials configured in this dev environment — same limitation already flagged in the step-14 report and in `design.md` Open Question 2).

## Cleanup / Final DB State

Temporary/simulation artifacts removed immediately after use:
- `ProductVariant.supplierCost` for id 2088 reset `18.00 → 25.00 → NULL` (final: `NULL`, matching original).
- Fabricated `SupplierOrder` id 67, `SupplierOrderItem` id 15, `Shipment` id 65 (CJ status-sync simulation) — deleted.
- Two temporary Node/TS helper scripts (`simulateWebhook.tmp.js`, `simulateCjStatusSync.tmp.ts`) used to send a signed Stripe webhook and to invoke the real sync orchestrator — deleted, never committed.

Genuine artifacts intentionally **kept** (real output of driving the real UI, not simulation — consistent with the existing `e2e-buyer-*`/`curltest-*` fixtures already present in this dev database from prior sessions):
- Customer id 1579 (`e2e-checkout-1784018875@example.com`) and its 2 addresses (ids 10, 11).
- `CustomerOrder` 716 (`ORD-000326`), `Paid`, `shippingStatus: Preparing` (post-cleanup, since the simulated shipment was removed) — a real order with a real, correctly-recorded `AutomationAlert` for its unassigned-supplier variant.
- `AutomationAlert` id 2 (genuine automation output, not simulated).

Post-E2E database counts (tracked tables):

| customers | addresses | orders | supplier_orders | shipments | alerts |
|---|---|---|---|---|---|
| 1361 (+1) | 5 (+2) | 295 (+1) | 9 (+0) | 9 (+0) | 2 (+1) |

`supplier_orders` and `shipments` are back to the exact baseline count (fabricated rows fully removed); the other deltas are the genuine, intentional output of real checkout/automation runs through the actual UI and are not test pollution.

All browser sessions closed at the end of the run.
