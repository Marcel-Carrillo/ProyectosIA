# Backend Implementation Plan: checkout-fulfillment-and-variant-ux

Scope: backend task groups **1 (Data Model)**, **2 (Stock-Aware Variant Availability)**, **4 (Self-Service Address Book)**, **6 (Shipping Margin Guardrail)**, **8 (Automatic Supplier-Order+CJ Push)**, **9 (Scheduled CJ Status Sync)**, **10 (Automation Alerting)**, from `openspec/changes/checkout-fulfillment-and-variant-ux/tasks.md`. Frontend (groups 3, 5, 7, 11) and mandatory verification/doc/PR steps (12–17) are out of scope for this document.

All paths below are relative to `backend/` unless stated otherwise.

---

## 0. FLAGS — where the real code differs from design.md/tasks.md assumptions

Read this section first. These are concrete discrepancies discovered by reading the actual source, not present in design.md's "Current-state grounding."

1. **Stock reconciliation already exists, but as a binary status flip, not a numeric field.** `cjCatalogItemRepository.ts`'s `reconcilePromotedVariantStock()` already flips `ProductVariant.status` between `Active`/`OutOfStock` based on `CjCatalogItem.stockQuantity <= 0` vs `> 0`, called from `cjCatalogSyncService.syncCatalog()`. Design.md's Decision 1 ("write `stockQuantity` during sync") is **additive** to this, not a replacement. Critically, `reconcilePromotedVariantStock`'s two `updateMany` calls only touch variants whose *status* crosses the zero boundary — a variant that stays `Active` while its CJ stock changes (e.g. 12 → 5) is untouched by either `updateMany`, so the numeric `stockQuantity` column would go stale unless a **third** step copies it unconditionally. Prisma's `updateMany` cannot set a column to a *related row's* value, so this requires a raw `$executeRaw` `UPDATE ... FROM` (see §2 below), following the exact pattern already used in `cjVariantAttributeBackfill.ts`.

2. **`cjCatalogItemId` is deliberately never selected by `ProductVariantRepository`.** Both `variantSelect` and `adminVariantSelect` in `productVariantRepository.ts` omit it (data-model.md: "internal only, never returned by any API, admin included"). The new freight-estimate endpoint needs variant → `CjCatalogItem` lookup for `calculateFreight`. Do **not** add `cjCatalogItemId` to `adminVariantSelect` (it would leak into `GET /api/admin/products/:id/variants` JSON, since admin variant responses are the raw domain object with no allow-list serializer). Add a narrow, dedicated repository method instead (§6).

3. **Design.md's own risk mitigation is factually wrong about the shipment state machine.** Design.md's Risks section claims "transitioning directly from `Pending`/`Shipped` to `Delivered` (both are legal per the existing state machine)". The real table (`domain/models/shipment.ts`):
   ```ts
   Pending:   ['Shipped', 'Failed', 'Returned'],   // Delivered is NOT reachable from Pending
   Shipped:   ['InTransit', 'Delivered', 'Failed', 'Returned'],
   InTransit: ['Delivered', 'Failed', 'Returned'],
   ```
   `Pending → Delivered` is **illegal**. Only `Shipped → Delivered` (skipping `InTransit`) is a legal single hop. §9 below designs a **chained/walked transition** (advance one legal hop at a time: `Pending→Shipped→InTransit→Delivered`) so a single sync that "missed" intermediate polls still reaches the right end state without ever attempting an illegal hop — this satisfies design.md's actual *intent* without repeating its factual error.

4. **`FULFILLMENT_AUTOMATION_ENABLED` should be an env var, not a DB column.** The `fulfillment-automation` spec is unambiguous: *"a server-side feature flag `FULFILLMENT_AUTOMATION_ENABLED` (default `false`)"* — this matches the existing `SUPPLIER_AUTO_PROVISION_ENABLED` env-var precedent (`supplierAutoProvisionService.run()`: `process.env.SUPPLIER_AUTO_PROVISION_ENABLED !== 'true'`) and its `serverless.yml` wiring. Tasks.md 1.4 redundantly also lists `fulfillmentAutomationEnabled` as a field on the new settings table. **Do not add that column** — implement the flag purely as `process.env.FULFILLMENT_AUTOMATION_ENABLED === 'true'`, checked first in every automation entry point (payment hook, scheduled job), exactly mirroring the `SUPPLIER_AUTO_PROVISION_ENABLED` kill-switch pattern. Flag this drop from tasks.md 1.4 explicitly when checking that task off.

5. **`paymentService.handlePaymentIntentSucceeded` early-returns when the order is already `Paid` — before any automation call would fire.** Current code (`paymentService.ts:210-215`):
   ```ts
   if (order.paymentStatus === 'Paid') {
     logger.info('payment_intent.succeeded: order already Paid — skipping', { orderId: order.id });
     return;
   }
   ```
   But `fulfillment-automation` spec's scenario *"Webhook retry does not duplicate supplier orders or CJ pushes"* requires automation to still run (idempotently, via the existing guards) on a webhook **retry** for an order that's already `Paid`. If we only call automation after the main (non-early-return) branch, a retry after the order is already `Paid` would never re-invoke automation — meaning a webhook that succeeded in marking the order `Paid` but then crashed before triggering automation would leave that order permanently unautomated even after Stripe retries. **The automation call must be reachable from both branches** — see §8.3.

6. **Fire-and-forget (used for welcome emails) is unsafe here — must `await`.** `backend-standards.md`'s documented Lambda incident: *"AWS Lambda freezes the execution environment's CPU as soon as the handler's returned promise resolves"* — an un-awaited async call left running after the HTTP response is sent can be frozen mid-flight and silently lost. Unlike a welcome email (acceptable to lose), losing the automation trigger silently defeats the entire alerting requirement ("a stalled order is never silent"). **`fulfillmentAutomationService.runForPaidOrder()` must be `await`-ed inside `handlePaymentIntentSucceeded`**, wrapped so its own errors never propagate out of the webhook handler (it must catch its own errors — see §8). This trades a bit of webhook response latency (bounded by `cjClient`'s existing 10s timeout × up to 3 retries per call) for correctness; document this trade-off, do not silently pick fire-and-forget by copying the email pattern.

7. **`cjOrderPushService.pushOrder`'s `logisticName` is currently required**, both by the TS type (`{ logisticName: string }`) and by `validateCjOrderPushData` (throws `ValidationError` if missing). Must become optional with server-side auto-selection (§8.2).

8. **No existing generic "Settings" or "Alert/Notification" table anywhere in the codebase** (grepped `prisma/schema.prisma` and `domain/models/`). This resolves design.md's Open Questions 1 and 3: yes, two new tables are needed (`AutomationSettings`, `AutomationAlert`) — nothing to reuse.

9. **Task 9.1 ("extract the existing manual status-pull logic into a reusable function") is effectively already done.** `CjOrderPushService.getOrderStatus(supplierOrderId)` is already a plain service method the controller calls — it is *already* callable by the scheduled job with no extraction/refactor needed. The real remaining work for group 9 is a repository query for "pushed + non-terminal" supplier orders and the shipment create-or-advance orchestration, not a refactor of `getOrderStatus`.

10. **`targetMargin`'s unit is ambiguous in every spec ("a percentage or fixed amount").** Since `netMargin = publicPrice - supplierCost - shippingCostEstimate` is a money value, this plan makes `targetMargin` a fixed `Decimal` (money) for dimensional consistency, defaulting to **€5.00** (documented, easily changed later). Flag this decision explicitly — it was not disambiguated upstream.

11. **No task in tasks.md adds an admin endpoint to edit `AutomationSettings`.** But design.md's own rationale for a settings *table* over env config is "admin-editability without a redeploy" — a table nobody can write to defeats that purpose. This plan adds a minimal `GET/PATCH /api/admin/settings/automation` endpoint (not explicitly in tasks.md) so the feature is actually usable; flag this as an addition beyond the literal task list for the parent session to confirm/adjust tasks.md.

12. **The `isDefault` "exactly one default per type" invariant cannot be fully guaranteed by an application-level transaction alone** under Postgres's default `READ COMMITTED` isolation (two concurrent transactions can both see "no existing default" before either commits). A DB-level **partial unique index** is required as the real backstop; Prisma's schema DSL cannot express a partial/filtered unique index, so it must be added by **hand-editing the generated migration SQL** (§1.6). This is a known, accepted Prisma limitation/pattern, not a codebase bug — flagged so the parent session doesn't skip it as "the ORM should have caught this."

---

## 1. Data Model: Prisma Schema and Migrations

**File to edit:** `prisma/schema.prisma`

### 1.1 `CustomerAddress.isDefault`

```prisma
model CustomerAddress {
  id          Int      @id @default(autoincrement())
  customerId  Int
  customer    Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  type        String   @db.VarChar(20)
  isDefault   Boolean  @default(false)   // NEW
  fullName    String   @db.VarChar(150)
  phone       String?  @db.VarChar(30)
  streetLine1 String   @db.VarChar(150)
  streetLine2 String?  @db.VarChar(150)
  city        String   @db.VarChar(100)
  province    String   @db.VarChar(100)
  postalCode  String   @db.VarChar(20)
  country     String   @db.VarChar(100)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 1.2 / 1.3 `ProductVariant.stockQuantity` / `shippingCostEstimate`

```prisma
model ProductVariant {
  id                   Int                 @id @default(autoincrement())
  productId            Int
  product              Product             @relation(fields: [productId], references: [id])
  sku                  String              @unique @db.VarChar(100)
  size                 String?             @db.VarChar(50)
  color                String?             @db.VarChar(50)
  publicPrice          Decimal             @db.Decimal(10, 2)
  compareAtPrice       Decimal?            @db.Decimal(10, 2)
  supplierId           Int?
  supplier             Supplier?           @relation(fields: [supplierId], references: [id])
  supplierReference    String?             @db.VarChar(150)
  supplierCost         Decimal?            @db.Decimal(10, 2)
  stockQuantity        Int                 @default(0)              // NEW — public-safe, supplier-synced
  shippingCostEstimate Decimal?            @db.Decimal(10, 2)       // NEW — admin-only
  stockPolicy          String              @default("SupplierManaged")
  status               String              @default("Active")
  cjCatalogItemId      Int?                @unique
  cjCatalogItem        CjCatalogItem?      @relation(fields: [cjCatalogItemId], references: [id])
  deletedAt            DateTime?
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt
  customerOrderItems   CustomerOrderItem[]
  supplierOrderItems   SupplierOrderItem[]
  wishlistItems        WishlistItem[]
  automationAlerts     AutomationAlert[]   // not needed — alerts reference orders, not variants; OMIT this line
}
```
(Ignore the last line above — variants are not referenced by `AutomationAlert`; see §1.5.)

### 1.4 New `AutomationSettings` model (singleton row)

Per Flag 4, this table does **not** include `fulfillmentAutomationEnabled`.

```prisma
model AutomationSettings {
  id                                Int      @id @default(autoincrement())
  // Money value, not percentage — see Flag 10. Documented default €5.00.
  targetMargin                      Decimal  @default(5.00) @db.Decimal(10, 2)
  // ISO 3166-1 alpha-2 default destination for the freight-estimate endpoint
  // and for automatic freight quoting, when no explicit destination is given.
  defaultFreightDestinationCountry  String   @default("ES") @db.VarChar(2)
  // Empty array = no restriction ("cheapest of everything" per design Decision 5).
  // Native Postgres text[] — Prisma supports scalar list fields on postgresql.
  carrierAllowList                  String[] @default([])
  createdAt                         DateTime @default(now())
  updatedAt                         DateTime @updatedAt
}
```
No unique/singleton constraint is enforced at the DB level (unnecessary complexity); the repository (`§1.7`) enforces "singleton" behavior by always reading the first row (`orderBy: { id: 'asc' }, take: 1`) and lazily creating it with defaults if none exists.

### 1.5 New `AutomationAlert` model

```prisma
model AutomationAlert {
  id              Int            @id @default(autoincrement())
  // 'SupplierOrderGenerationFailed' | 'CjPushFailed' | 'CjStatusSyncFailed' |
  // 'ShipmentTransitionSkipped' | 'CarrierAllowListExhausted'
  type            String         @db.VarChar(50)
  customerOrderId Int?
  customerOrder   CustomerOrder? @relation(fields: [customerOrderId], references: [id])
  supplierOrderId Int?
  supplierOrder   SupplierOrder? @relation(fields: [supplierOrderId], references: [id])
  // Fixed-vocabulary, non-sensitive summary only — never raw upstream error
  // bodies, never cost/secret values (same rule as CjApiError's message).
  message         String         @db.VarChar(500)
  resolvedAt      DateTime?
  createdAt       DateTime       @default(now())

  @@index([resolvedAt])
  @@index([customerOrderId])
  @@index([supplierOrderId])
  @@index([createdAt])
}
```
Add back-reference arrays on the two referenced models (matches this schema's existing bidirectional-relation convention):
- `CustomerOrder`: add `automationAlerts AutomationAlert[]`
- `SupplierOrder`: add `automationAlerts AutomationAlert[]`

No `onDelete` cascade specified (defaults to `Restrict`) — an alert should never silently disappear because its order was deleted (orders are never hard-deleted in this codebase anyway).

### 1.6 Generate the migration + hand-edit for the partial unique index

```bash
cd backend
npx prisma migrate dev --name add_checkout_fulfillment_and_variant_ux
```

After Prisma generates `prisma/migrations/<timestamp>_add_checkout_fulfillment_and_variant_ux/migration.sql`, **manually append** (per Flag 12 — Prisma's schema DSL cannot express partial/filtered unique indexes):

```sql
-- Enforces "at most one default CustomerAddress per (customerId, type)" at the
-- DB level. The application-level transaction (unset-then-set, see §4) is the
-- primary mechanism; this index is the concurrency backstop under READ
-- COMMITTED — a losing concurrent transaction gets a P2002 on this named
-- constraint, which the repository maps to a 409 rather than corrupting state.
CREATE UNIQUE INDEX "CustomerAddress_customerId_type_default_unique"
  ON "CustomerAddress" ("customerId", "type")
  WHERE "isDefault" = true;
```
Note for the parent session: because this index is not represented in `schema.prisma` itself, future `npx prisma migrate dev` runs will not see it as schema drift (they diff against migration history, not live introspection) — this is fine and is the standard accepted pattern for partial indexes with Prisma. Do **not** run `prisma db pull` against this database, as introspection would try to reverse-engineer it into the schema in a lossy way.

All new columns are additive (nullable or defaulted) — no backfill required to deploy, per design.md's Migration Plan.

### 1.7 Backfill script: `ProductVariant.stockQuantity` from linked `CjCatalogItem`

**New file:** `backend/scripts/backfillProductVariantStockQuantity.ts`

Mirror the existing `backend/scripts/backfillCjVariantAttributes.ts` pattern (idempotent, zero CJ API calls, invoked via `npx ts-node --transpile-only scripts/backfillProductVariantStockQuantity.ts`). Body: a single raw `$executeRaw` (same shape as §2.1 below) run once over **all** `supplierIntegrationId`s (no per-supplier loop needed since the query already joins on `cjCatalogItemId`):

```ts
import { prisma } from '../src/infrastructure/prismaClient';

async function main() {
  const updated = await prisma.$executeRaw`
    UPDATE "ProductVariant" AS t
    SET "stockQuantity" = c."stockQuantity", "updatedAt" = now()
    FROM "CjCatalogItem" AS c
    WHERE t."cjCatalogItemId" = c.id
      AND t."deletedAt" IS NULL
      AND t."stockQuantity" IS DISTINCT FROM c."stockQuantity"
  `;
  console.log(`Backfilled stockQuantity for ${updated} ProductVariant row(s).`);
}

main().finally(() => prisma.$disconnect());
```

### 1.8 Verify migration locally

```bash
cd backend
npx prisma migrate dev --name add_checkout_fulfillment_and_variant_ux
# hand-edit migration.sql per §1.6 BEFORE this next command if not yet applied
npx prisma generate
npx prisma studio   # or: psql ... -c "\d \"CustomerAddress\"" / "\d \"AutomationSettings\"" / "\d \"AutomationAlert\""
```

---

## 2. Backend: Stock-Aware Variant Availability

### 2.1 `cjCatalogItemRepository.ts` — extend `reconcilePromotedVariantStock`

**File:** `src/infrastructure/repositories/cjCatalogItemRepository.ts`
**File:** `src/domain/repositories/cjCatalogItemRepository.ts` (interface + return type)

Extend `reconcilePromotedVariantStock` (keep the name — "reconcile stock" now correctly covers both the status flip and the numeric copy) to add a third step, a raw `UPDATE ... FROM`, run in the **same** `prisma.$transaction` array as the two existing `updateMany` calls:

```ts
// domain/repositories/cjCatalogItemRepository.ts
reconcilePromotedVariantStock(
  supplierIntegrationId: number
): Promise<{ deactivated: number; reactivated: number; stockQuantitySynced: number }>;
```

```ts
// infrastructure/repositories/cjCatalogItemRepository.ts
async reconcilePromotedVariantStock(
  supplierIntegrationId: number
): Promise<{ deactivated: number; reactivated: number; stockQuantitySynced: number }> {
  const [deactivated, reactivated, stockQuantitySynced] = await prisma.$transaction([
    prisma.productVariant.updateMany({
      where: {
        status: 'Active',
        deletedAt: null,
        cjCatalogItem: { supplierIntegrationId, stockQuantity: { lte: 0 } },
      },
      data: { status: 'OutOfStock' },
    }),
    prisma.productVariant.updateMany({
      where: {
        status: 'OutOfStock',
        deletedAt: null,
        cjCatalogItem: { supplierIntegrationId, stockQuantity: { gt: 0 } },
      },
      data: { status: 'Active' },
    }),
    // NEW: copy the numeric stock value unconditionally (Prisma's updateMany
    // cannot set a column from a related row's value — see Flag 1). Keeps
    // ProductVariant.stockQuantity current even when the CJ stock change
    // doesn't cross the Active/OutOfStock boundary (e.g. 12 -> 5).
    prisma.$executeRaw`
      UPDATE "ProductVariant" AS t
      SET "stockQuantity" = c."stockQuantity", "updatedAt" = now()
      FROM "CjCatalogItem" AS c
      WHERE t."cjCatalogItemId" = c.id
        AND c."supplierIntegrationId" = ${supplierIntegrationId}
        AND t."deletedAt" IS NULL
        AND t."stockQuantity" IS DISTINCT FROM c."stockQuantity"
    `,
  ]);
  return { deactivated: deactivated.count, reactivated: reactivated.count, stockQuantitySynced };
}
```
`prisma.$transaction([...])` (array form, not the callback form) accepts a `$executeRaw` promise alongside `updateMany` promises — same style already used elsewhere in this file. No call-site change needed in `cjCatalogSyncService.syncCatalog()` beyond logging the new `stockQuantitySynced` count if desired (optional).

**Existing test to update:** `src/infrastructure/repositories/__tests__/cjCatalogItemRepository.test.ts` — mock `prisma.$transaction` to resolve `[{count}, {count}, number]` (3 elements, not 2) for `reconcilePromotedVariantStock`.

### 2.2 `cjCatalogPromotionService.ts` — set initial `stockQuantity` on promotion

**File:** `src/application/services/cjCatalogPromotionService.ts`, inside `promote()`, the `tx.productVariant.create({...})` call (~line 228):

```ts
const createdVariant = await tx.productVariant.create({
  data: {
    productId,
    sku,
    size: groupItem.catalogItem.size,
    color: groupItem.catalogItem.color,
    publicPrice: resolvedPrice,
    compareAtPrice: groupItem.compareAtPrice ?? null,
    supplierId: integration.supplierId,
    supplierReference: groupItem.catalogItem.externalRef,
    supplierCost: groupItem.catalogItem.supplierCost,
    stockQuantity: groupItem.catalogItem.stockQuantity,   // NEW
    stockPolicy: 'SupplierManaged',
    status: 'Active',
    cjCatalogItemId: groupItem.cjCatalogItemId,
  },
});
```
`CjCatalogItem.stockQuantity` is a plain `number` on the domain model — no conversion needed.

### 2.3 Admin variant select/serializer — read-only `stockQuantity`, ignore client writes

**File:** `src/infrastructure/repositories/productVariantRepository.ts`

Add `stockQuantity: true` to **both** `variantSelect` and `adminVariantSelect` (it's public-safe, unlike `shippingCostEstimate` which is admin-only — see §6.1 for that field). Add `shippingCostEstimate: true` to `adminVariantSelect` **only**.

```ts
const variantSelect = {
  id: true, productId: true, sku: true, size: true, color: true,
  publicPrice: true, compareAtPrice: true, stockPolicy: true, status: true,
  stockQuantity: true,          // NEW — public-safe
  deletedAt: true, createdAt: true, updatedAt: true,
} as const;

const adminVariantSelect = {
  ...variantSelect,
  supplierId: true, supplierReference: true, supplierCost: true,
  shippingCostEstimate: true,   // NEW — admin-only (§6)
  supplier: { select: { name: true } },
} as const;
```

**`ProductVariantUpdateData`/`ProductVariantCreateData`** (`src/domain/repositories/productRepository.ts`) — **do not add `stockQuantity`** to either interface, and **do not** add a `stockQuantity` write in `ProductVariantRepository.update()`/`.create()`. This is the entire mechanism for "PATCH ignores client-supplied `stockQuantity`" (task 2.2/spec scenario): the field simply has no write path through the generic update/create flow. Even if a client sends `{"stockQuantity": 999}` in the PATCH body, `req.body as ProductVariantUpdateData` is cast but the repository's `update()` only ever spreads fields it explicitly checks (`...(data.sku !== undefined && {...})` etc.) — `stockQuantity` is never one of them, so it's silently dropped. **Do not accidentally "complete" the type by adding a pass-through — that would break the read-only guarantee.**

### 2.4 `ProductVariant` domain model — new fields

**File:** `src/domain/models/productVariant.ts`

```ts
export class ProductVariant {
  // ...existing fields...
  stockQuantity: number;
  shippingCostEstimate?: number | null;   // present only when read via adminVariantSelect
  netMargin?: number | null;              // present only when read via adminVariantSelect (needs supplierCost)
  shippingEstimateMissing?: boolean;      // present only when read via adminVariantSelect

  constructor(data: {
    // ...existing fields...
    stockQuantity?: unknown;
    shippingCostEstimate?: unknown;
  }) {
    // ...existing assignments...
    this.stockQuantity = data.stockQuantity != null ? Number(data.stockQuantity) : 0;

    // Margin fields are only meaningful (and only ever populated) when the
    // row was fetched via adminVariantSelect, which always selects
    // supplierCost alongside shippingCostEstimate. Gating on
    // `data.supplierCost !== undefined` (not `!= null`) distinguishes
    // "field not selected at all" (customer-safe select) from "selected but
    // null" (admin select, no cost set yet) — this is what keeps these
    // fields structurally absent from any object built via the public
    // variantSelect, on top of publicProduct.ts's own explicit allow-list.
    if (data.supplierCost !== undefined) {
      const supplierCostNum = data.supplierCost != null ? Number(data.supplierCost) : 0;
      const shippingEstimateNum = data.shippingCostEstimate != null ? Number(data.shippingCostEstimate) : 0;
      this.shippingCostEstimate = data.shippingCostEstimate != null ? Number(data.shippingCostEstimate) : null;
      this.shippingEstimateMissing = data.shippingCostEstimate == null;
      this.netMargin = Number((this.publicPrice - supplierCostNum - shippingEstimateNum).toFixed(2));
    }
  }
}
```
Safety note: even though this adds admin-only fields to the shared `ProductVariant` class, `presentation/serializers/publicProduct.ts`'s `serializeVariant()` builds `PublicVariantDTO` via an **explicit allow-list** (never `...variant`), so these fields structurally cannot leak to `/api/public/*` regardless of which select populated the object — confirmed by reading `publicProduct.ts`. This is the existing project convention already documented in `productVariantRepository.ts`'s comments ("Public serializers additionally allow-list their own fields — never expose rows from this repository directly on a customer-facing endpoint").

### 2.5 Public variant allow-list — add `stockQuantity`

**File:** `src/presentation/serializers/publicProduct.ts`

```ts
export interface PublicVariantDTO {
  id?: number;
  sku: string;
  size: string | null;
  color: string | null;
  publicPrice: number;
  compareAtPrice: number | null;
  status: string;
  stockQuantity: number;   // NEW
}

function serializeVariant(variant: ProductVariant): PublicVariantDTO {
  return {
    id: variant.id,
    sku: variant.sku,
    size: variant.size ?? null,
    color: variant.color ?? null,
    publicPrice: variant.publicPrice,
    compareAtPrice: variant.compareAtPrice ?? null,
    status: variant.status,
    stockQuantity: variant.stockQuantity,   // NEW
  };
}
```

**File:** `src/infrastructure/repositories/productRepository.ts` — this file has its **own separate** local `variantSelect` constant (lines 55-68) that feeds `Product.variants` for both `findAll()` and `findById()` — this is the one that actually reaches `serializePublicProduct` via `publicProductController.ts`. Add `stockQuantity: true` to it:

```ts
const variantSelect = {
  id: true, productId: true, sku: true, size: true, color: true,
  publicPrice: true, compareAtPrice: true, stockPolicy: true, status: true,
  stockQuantity: true,   // NEW
  deletedAt: true, createdAt: true, updatedAt: true,
} as const;
```
This select does **not** include `supplierCost`, so `ProductVariant`'s constructor (§2.4) correctly leaves `netMargin`/`shippingCostEstimate`/`shippingEstimateMissing` unset for every product-detail/list read — no margin data ever reaches this path.

### 2.6 Tests to add/extend

- `src/infrastructure/repositories/__tests__/cjCatalogItemRepository.test.ts` — `reconcilePromotedVariantStock` returns `stockQuantitySynced`; update the `$transaction` mock to a 3-element array.
- `src/application/services/__tests__/cjCatalogPromotionService.test.ts` — promoted variant's `tx.productVariant.create` call includes `stockQuantity: <catalogItem.stockQuantity>`.
- `src/infrastructure/repositories/__tests__/productVariantRepository.test.ts` — `update()` with a `stockQuantity` field in the input object does not appear in the Prisma `data` argument (read-only guarantee).
- `src/presentation/serializers/__tests__/publicProduct.test.ts` — `stockQuantity` present on `variants[]`; extend the existing supplier-field-isolation test to also assert `netMargin`/`shippingCostEstimate`/`shippingEstimateMissing` are absent (they won't exist on the object at all, since `productRepository.ts`'s `variantSelect` never selects `supplierCost` — but assert explicitly since this is a supplier-isolation-adjacent guarantee).

---

## 4. Backend: Self-Service Address Book

### 4.1 `customerAddressRepository.ts` (Infrastructure) — **new file**

**New file:** `src/infrastructure/repositories/customerAddressRepository.ts`

This is a **new, dedicated** repository scoped to self-service address operations — do not reuse `CustomerRepository`'s address methods directly (those stay in place for the admin path, §4.5), because the self-service surface needs the transactional "unset previous default" logic that the admin path also needs, so it's cleanest as one small shared repository both controllers' services call into. Concretely:

```ts
export interface CustomerAddressCreateData {
  type: 'Shipping' | 'Billing';
  fullName: string;
  phone?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}
export type CustomerAddressUpdateData = Partial<CustomerAddressCreateData>;

export interface ICustomerAddressRepository {
  findAllByCustomerId(customerId: number): Promise<CustomerAddress[]>;
  findById(id: number, customerId: number): Promise<CustomerAddress | null>;
  create(customerId: number, data: CustomerAddressCreateData): Promise<CustomerAddress>;
  update(id: number, customerId: number, data: CustomerAddressUpdateData): Promise<CustomerAddress>;
  delete(id: number, customerId: number): Promise<void>;
  findDefault(customerId: number, type: 'Shipping' | 'Billing'): Promise<CustomerAddress | null>;
}
```

Implementation of `create`/`update` — the transactional unset-then-write, plus the P2002-from-the-partial-index catch (Flag 12):

```ts
async create(customerId: number, data: CustomerAddressCreateData): Promise<CustomerAddress> {
  try {
    return await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, type: data.type, isDefault: true },
          data: { isDefault: false },
        });
      }
      const row = await tx.customerAddress.create({
        data: { customerId, ...data, isDefault: data.isDefault ?? false },
      });
      return new CustomerAddress(row);
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Lost the race against a concurrent default-setting transaction for
      // the same (customerId, type) — surfaced as a 409 so the client can
      // retry, rather than corrupting the "exactly one default" invariant.
      throw new AddressDefaultConflictError();
    }
    throw err;
  }
}
```
`update()` mirrors this (unset-then-update inside `tx`, same P2002 handling), plus verifies the row belongs to `customerId` first (`findFirst({ where: { id, customerId } })` inside the same transaction) — reuse `AddressNotFoundError` already defined in `infrastructure/repositories/customerRepository.ts` (import it, don't redefine).

`delete()` is a plain `prisma.customerAddress.delete({ where: { id } })` after an ownership check — no default-unsetting needed (spec: deleting the default simply leaves no default of that type).

New error class `AddressDefaultConflictError` (409, code `ADDRESS_DEFAULT_CONFLICT`) — add to this same file, add to `errorHandler.ts`.

### 4.2 `customerAddressService.ts` (Application) — **new file**

**New file:** `src/application/services/customerAddressService.ts`

Thin orchestration + `validateCustomerAddressData` reuse (already exists in `validator.ts`, used today by the admin path — reuse as-is, it already supports `{ requireAll: false }` for partial updates):

```ts
export class CustomerAddressService {
  constructor(private readonly repo: ICustomerAddressRepository) {}

  async list(customerId: number): Promise<CustomerAddress[]> {
    return this.repo.findAllByCustomerId(customerId);
  }

  async create(customerId: number, data: Record<string, unknown>): Promise<CustomerAddress> {
    validateCustomerAddressData(data);
    return this.repo.create(customerId, data as CustomerAddressCreateData);
  }

  async update(customerId: number, addressId: number, data: Record<string, unknown>): Promise<CustomerAddress> {
    const existing = await this.repo.findById(addressId, customerId);
    if (!existing) throw new AddressNotFoundError();
    validateCustomerAddressData(data, { requireAll: false });
    return this.repo.update(addressId, customerId, data as CustomerAddressUpdateData);
  }

  async delete(customerId: number, addressId: number): Promise<void> {
    const existing = await this.repo.findById(addressId, customerId);
    if (!existing) throw new AddressNotFoundError();
    await this.repo.delete(addressId, customerId);
  }
}
```
Ownership is enforced by scoping every repository call to `customerId` derived from the JWT (§4.3), never from the request body/params — a cross-customer `addressId` simply matches zero rows and surfaces the existing `AddressNotFoundError` (404), never a 403 (matches the admin path's existing behavior and the spec's literal `ADDRESS_NOT_FOUND` wording).

### 4.3 `customerAddressController.ts` (Presentation) — **new file**

**New file:** `src/presentation/controllers/customerAddressController.ts`

Mirror `customerAccountController.ts`'s pattern: `CustomerAuthRequest` from `middleware/requireCustomerAuth.ts`, `req.customer!.customerId` as the sole source of `customerId` (never `req.body.customerId`/`req.params.customerId`):

```ts
import { Response, NextFunction } from 'express';
import { CustomerAuthRequest } from '../../middleware/requireCustomerAuth';
import { customerAddressService } from '../../application/services/customerAddressService'; // or constructed here, matching this codebase's no-composition-root convention

export async function listOwnAddresses(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const addresses = await customerAddressService.list(req.customer!.customerId);
    res.json({ success: true, data: addresses, message: 'Addresses retrieved successfully' });
  } catch (err) { next(err); }
}

export async function createOwnAddress(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const address = await customerAddressService.create(req.customer!.customerId, req.body);
    res.status(201).json({ success: true, data: address, message: 'Address created successfully' });
  } catch (err) { next(err); }
}

export async function updateOwnAddress(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const addressId = parseInt(req.params['id'] as string, 10);
    const address = await customerAddressService.update(req.customer!.customerId, addressId, req.body);
    res.json({ success: true, data: address, message: 'Address updated successfully' });
  } catch (err) { next(err); }
}

export async function deleteOwnAddress(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const addressId = parseInt(req.params['id'] as string, 10);
    await customerAddressService.delete(req.customer!.customerId, addressId);
    res.status(204).send();
  } catch (err) { next(err); }
}
```
No separate validator file needed — reuse `validateCustomerAddressData` from `application/validator.ts` exactly as `customerAddressService.ts` calls it above.

### 4.4 Register routes

**File:** `src/routes/public/accountRoutes.ts` — this router already has `router.use(requireCustomerAuth)` applied globally (line 36), so no per-route auth wiring needed:

```ts
import {
  listOwnAddresses,
  createOwnAddress,
  updateOwnAddress,
  deleteOwnAddress,
} from '../../presentation/controllers/customerAddressController';

// ...
router.get('/addresses', listOwnAddresses);
router.post('/addresses', createOwnAddress);
router.patch('/addresses/:id', updateOwnAddress);
router.delete('/addresses/:id', deleteOwnAddress);
```
This yields the spec's exact paths: `GET/POST/PATCH/DELETE /api/public/account/addresses[/:id]` (the router is mounted at `/api/public/account` in `index.ts`).

### 4.5 Extend the **existing admin** address path with `isDefault`

**Files:** `src/domain/models/customer.ts`, `src/domain/repositories/customerRepository.ts`, `src/infrastructure/repositories/customerRepository.ts`, `src/application/services/customerService.ts`

Add `isDefault: boolean` to the `CustomerAddress` domain class (default `false`) and to `AddressCreateData`/`AddressUpdateData` interfaces. In `CustomerRepository.createAddress`/`updateAddress` (`infrastructure/repositories/customerRepository.ts`), apply the **identical** unset-then-write transaction used in §4.1 — do not duplicate the logic ad hoc; extract it into a small shared helper, e.g. a free function in a new tiny module `src/infrastructure/repositories/customerAddressDefaultTransaction.ts`:

```ts
export async function writeAddressWithDefaultInvariant(
  tx: Prisma.TransactionClient,
  customerId: number,
  type: string,
  isDefault: boolean | undefined,
  write: (tx: Prisma.TransactionClient) => Promise<CustomerAddressRow>
): Promise<CustomerAddressRow> {
  if (isDefault) {
    await tx.customerAddress.updateMany({
      where: { customerId, type, isDefault: true },
      data: { isDefault: false },
    });
  }
  return write(tx);
}
```
Both `customerRepository.ts` (admin) and `customerAddressRepository.ts` (self-service, §4.1) call this same helper inside their own `prisma.$transaction(async (tx) => ...)`, so the invariant is provably identical on both paths (this directly satisfies the spec requirement "enforced identically on both the self-service and admin address endpoints" and design.md's risk mitigation for concurrent defaults).

`GET /api/admin/customers/:id` and `GET /api/admin/customers/:customerId/addresses` already return the full `CustomerAddress` domain object with no allow-list filtering (confirmed: `customerController.ts` does `res.json({ data: addresses })` directly) — once `isDefault` is on the domain class and included in the Prisma select (it will be, by default, since `CustomerRepository` doesn't use an explicit narrow `select` for addresses — confirmed `findAddressesByCustomerId`/`findById` do plain `prisma.customerAddress.findMany`/`findUnique` with no `select`), it appears automatically. No controller change needed for the read side.

### 4.6 Tests to add/extend

- `src/application/services/__tests__/customerAddressService.test.ts` (new) — create with `isDefault: true` unsets previous default; cross-customer `addressId` → `AddressNotFoundError`.
- `src/infrastructure/repositories/__tests__/customerAddressRepository.test.ts` (new) — transaction calls `updateMany` before `create` when `isDefault: true`; P2002 → `AddressDefaultConflictError`.
- `src/infrastructure/repositories/__tests__/customerRepository.test.ts` (extend) — admin `createAddress`/`updateAddress` with `isDefault: true` unsets the previous default via the shared helper.
- `src/presentation/controllers/__tests__/customerAddressController.test.ts` (new) — mirrors `customerAccountController.test.ts`'s mocking style for `CustomerAuthRequest`.

---

## 6. Backend: Shipping Margin Guardrail

### 6.0 New settings repository (shared prerequisite for §6 and §8)

**New file:** `src/domain/repositories/automationSettingsRepository.ts`
```ts
export interface AutomationSettingsData {
  id: number;
  targetMargin: number;
  defaultFreightDestinationCountry: string;
  carrierAllowList: string[];
}
export interface AutomationSettingsUpdateData {
  targetMargin?: number;
  defaultFreightDestinationCountry?: string;
  carrierAllowList?: string[];
}
export interface IAutomationSettingsRepository {
  get(): Promise<AutomationSettingsData>;   // lazily creates the singleton row with defaults if none exists
  update(data: AutomationSettingsUpdateData): Promise<AutomationSettingsData>;
}
```
**New file:** `src/infrastructure/repositories/automationSettingsRepository.ts` — `get()` does `findFirst({ orderBy: { id: 'asc' } })`, and if `null`, `create({ data: {} })` (all fields have `@default`s) then returns that row; `update()` does `update({ where: { id: (await this.get()).id }, data })`.

### 6.1 Admin variant select/serializer — margin breakdown

Already wired by §2.3/§2.4 (adding `shippingCostEstimate` to `adminVariantSelect`, and `netMargin`/`shippingEstimateMissing` computed in the `ProductVariant` constructor). The remaining piece is the **`marginWarning`** flag, which needs `AutomationSettings.targetMargin` — a config value the domain constructor cannot reach. Compute it in the service layer instead.

**File:** `src/application/services/productVariantService.ts`

```ts
export class ProductVariantService {
  constructor(
    private readonly variantRepo: IProductVariantRepository,
    private readonly productRepo: IProductRepository,
    private readonly settingsRepo: IAutomationSettingsRepository,      // NEW
    private readonly catalogRepo: ICjCatalogItemRepository,            // NEW — §6.2
    private readonly cjClient: ICjClient,                              // NEW — §6.2
  ) {}

  private applyMarginWarning(variant: ProductVariant, targetMargin: number): ProductVariant {
    if (variant.netMargin != null) {
      (variant as ProductVariant & { marginWarning?: boolean }).marginWarning =
        variant.netMargin < 0 || variant.netMargin < targetMargin;
    }
    return variant;
  }

  async listByProduct(productId: number): Promise<ProductVariant[]> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const variants = await this.variantRepo.findByProduct(productId);
    const { targetMargin } = await this.settingsRepo.get();
    return variants.map((v) => this.applyMarginWarning(v, targetMargin));
  }

  async findById(productId: number, id: number): Promise<ProductVariant> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const variant = await this.variantRepo.findById(id);
    if (!variant || variant.productId !== productId) throw new VariantNotFoundError();
    const { targetMargin } = await this.settingsRepo.get();
    return this.applyMarginWarning(variant, targetMargin);
  }
  // ...create/update/softDelete unchanged...
}
```
Add `marginWarning?: boolean` as a proper typed optional field on the `ProductVariant` domain class itself (§2.4) instead of the cast above — cleaner; the cast is shown only to make the "it's set outside the constructor, deliberately" point explicit. Prefer the typed field in the actual implementation.

Update instantiation in `src/presentation/controllers/productVariantController.ts`:
```ts
const variantService = new ProductVariantService(
  new ProductVariantRepository(),
  new ProductRepository(),
  new AutomationSettingsRepository(),
  new CjCatalogItemRepository(),
  cjClient,
);
```

### 6.2 `POST /api/admin/products/:id/variants/:variantId/freight-estimate`

**Repository additions** (`src/domain/repositories/productRepository.ts` + `infrastructure/repositories/productVariantRepository.ts`) — per Flag 2, two **narrow, response-DTO-invisible** methods, never merged into `adminVariantSelect`:

```ts
// IProductVariantRepository
findCjCatalogItemId(id: number): Promise<number | null>;
updateShippingCostEstimate(id: number, shippingCostEstimate: number): Promise<ProductVariant>;
```
```ts
async findCjCatalogItemId(id: number): Promise<number | null> {
  const row = await prisma.productVariant.findFirst({
    where: { id, deletedAt: null },
    select: { cjCatalogItemId: true },   // scoped select, never touches adminVariantSelect
  });
  return row?.cjCatalogItemId ?? null;
}

async updateShippingCostEstimate(id: number, shippingCostEstimate: number): Promise<ProductVariant> {
  const row = await prisma.productVariant.update({
    where: { id },
    data: { shippingCostEstimate },
    select: adminVariantSelect,
  });
  return new ProductVariant(row);
}
```
`shippingCostEstimate` is deliberately **not** added to `ProductVariantUpdateData`/the generic `update()` method (mirrors the `stockQuantity` read-only pattern, §2.3) — its only write path is this dedicated method, called only from the service method below, matching design.md Decision 6 ("never computed by calling CJ on the storefront hot path... refreshed via an explicit action").

**Service method** — `src/application/services/productVariantService.ts`:
```ts
async refreshFreightEstimate(
  productId: number,
  variantId: number,
  destinationCountry?: string
): Promise<ProductVariant> {
  const product = await this.productRepo.findById(productId);
  if (!product) throw new ProductNotFoundError();
  const variant = await this.variantRepo.findById(variantId);
  if (!variant || variant.productId !== productId) throw new VariantNotFoundError();

  const cjCatalogItemId = await this.variantRepo.findCjCatalogItemId(variantId);
  if (cjCatalogItemId === null) throw new CjItemNotMappedError();
  const catalogItem = await this.catalogRepo.findById(cjCatalogItemId);
  if (!catalogItem) throw new CjItemNotMappedError();

  const settings = await this.settingsRepo.get();
  const country = destinationCountry ?? settings.defaultFreightDestinationCountry;

  let quote;
  try {
    quote = await this.cjClient.calculateFreight({
      startCountryCode: 'CN',
      endCountryCode: country,
      products: [{ vid: catalogItem.externalRef, quantity: 1 }],
    });
  } catch (err) {
    throw new CjApiUnavailableError();
  }
  if (quote.length === 0) throw new CjApiUnavailableError('No freight options returned');

  const lowest = quote.reduce((min, opt) => (opt.logisticPrice < min.logisticPrice ? opt : min));
  const updated = await this.variantRepo.updateShippingCostEstimate(variantId, lowest.logisticPrice);
  return this.applyMarginWarning(updated, settings.targetMargin);
}
```

**Controller** — `src/presentation/controllers/productVariantController.ts`:
```ts
export async function refreshFreightEstimate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['id'] as string, 10);
    const variantId = parseInt(req.params['variantId'] as string, 10);
    const destinationCountry = req.body?.destinationCountry as string | undefined;
    const variant = await variantService.refreshFreightEstimate(productId, variantId, destinationCountry);
    res.json({ success: true, data: variant, message: 'Freight estimate refreshed successfully' });
  } catch (err) { next(err); }
}
```

**Route** — `src/routes/admin/productRoutes.ts`:
```ts
variantRouter.post('/:variantId/freight-estimate', refreshFreightEstimate);
```
(inside the existing `variantRouter`, alongside the other variant routes — `mergeParams: true` already gives access to `req.params['id']`).

### 6.3 Warning badge — already covered by §6.1's `marginWarning` field.

### 6.4 Confirm `checkoutService.ts` untouched

Re-confirmed by direct read: `checkoutService.ts:137` — `const shipping = new Decimal(0);` — no code path in this plan touches `checkoutService.ts`. **Regression test to add:** `src/application/services/__tests__/checkoutService.test.ts` — a new/extended test that creates an order with a variant whose `netMargin` would be negative (mocked margin fields don't even reach checkout's `variantSelectForOrder`, which is a separate raw select with no `supplierCost`/`shippingCostEstimate` fields at all — the test should assert `order.shippingAmount === '0.00'` regardless).

### 6.5 Tests to add/extend

- `src/application/services/__tests__/productVariantService.test.ts` — `refreshFreightEstimate` happy path (lowest price persisted); unmapped variant → `CjItemNotMappedError`; `listByProduct`/`findById` attach `marginWarning` correctly for below-target, negative, and at-target margins.
- `src/infrastructure/repositories/__tests__/productVariantRepository.test.ts` — `findCjCatalogItemId` / `updateShippingCostEstimate`.
- `src/infrastructure/repositories/__tests__/automationSettingsRepository.test.ts` (new) — `get()` lazily creates defaults.
- Extend `publicProduct.test.ts` isolation test (already noted in §2.6) to also cover `marginWarning`.

---

## 8. Backend: Automatic Supplier-Order Generation and CJ Push

### 8.1 `fulfillmentAutomationService.ts` — **new file**

**New file:** `src/application/services/fulfillmentAutomationService.ts`

```ts
export class FulfillmentAutomationService {
  constructor(
    private readonly supplierOrderService: SupplierOrderService,
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly cjOrderPushService: CjOrderPushService,
    private readonly alertRepo: IAutomationAlertRepository,   // §10
  ) {}

  isEnabled(): boolean {
    // Flag 4: pure env var, mirrors SUPPLIER_AUTO_PROVISION_ENABLED exactly.
    return process.env.FULFILLMENT_AUTOMATION_ENABLED === 'true';
  }

  // Never throws — every failure is caught, logged, and recorded as an
  // alert, per the spec's explicit requirement that automation failures
  // must never roll back or block the payment/order Paid status (Flag 5/6:
  // the caller in paymentService awaits this, so it must be exception-safe
  // on its own, not rely on the caller's try/catch).
  async runForPaidOrder(customerOrderId: number): Promise<void> {
    if (!this.isEnabled()) return;

    let orders;
    try {
      const result = await this.supplierOrderService.generateFromCustomerOrder(customerOrderId);
      orders = result.orders;
    } catch (err) {
      await this.recordAlert('SupplierOrderGenerationFailed', customerOrderId, undefined, err);
      return;
    }

    for (const order of orders) {
      if (order.externalOrderId) continue;          // already pushed — idempotent no-op
      if (order.id === undefined) continue;

      const integration = await this.integrationRepo.findBySupplierId(order.supplierId);
      // Not every SupplierOrder is CJ-fulfilled (supplier-fulfilled-first
      // business model, base-standards.md §3) — only attempt an automatic
      // push when this supplier has a Connected CJDropshipping integration.
      // Non-CJ suppliers are left for manual/other fulfillment, unchanged.
      if (!integration || integration.status !== 'Connected' || integration.provider !== 'CJDropshipping') {
        continue;
      }

      try {
        await this.cjOrderPushService.pushOrder(order.id, {});   // {} => auto-select logistics, §8.2
      } catch (err) {
        if (err instanceof CjOrderAlreadyPushedError) continue;  // idempotent no-op on webhook retry
        await this.recordAlert('CjPushFailed', customerOrderId, order.id, err);
      }
    }
  }

  private async recordAlert(
    type: string, customerOrderId: number | undefined, supplierOrderId: number | undefined, err: unknown
  ): Promise<void> {
    const message = err instanceof Error ? err.message : 'Unknown automation failure';
    logger.error('Fulfillment automation step failed', { type, customerOrderId, supplierOrderId, error: message });
    // recordAlert itself must never throw — a broken alert-write must not
    // mask the original failure or crash the caller.
    try {
      await this.alertRepo.create({ type, customerOrderId, supplierOrderId, message });
    } catch (alertErr) {
      logger.error('Failed to record automation alert', {
        error: alertErr instanceof Error ? alertErr.message : String(alertErr),
      });
    }
  }
}

export const fulfillmentAutomationService = new FulfillmentAutomationService(
  new SupplierOrderService(new SupplierOrderRepository()),
  new SupplierIntegrationRepository(),
  new CjOrderPushService(
    new SupplierOrderRepository(),
    new SupplierIntegrationRepository(),
    new CjCatalogItemRepository(),
    cjClient,
    new AutomationSettingsRepository(),   // §8.2
  ),
  new AutomationAlertRepository(),        // §10
);
```
Error messages passed into `recordAlert` come only from caught `Error.message` of this codebase's own domain error classes (e.g. `CjApiUnavailableError`'s fixed message) or Prisma error messages — never raw CJ response bodies, matching the "no secrets or costs in automation logs" requirement (these error classes already never embed cost figures by construction).

### 8.2 Auto-logistics selection inside `cjOrderPushService.ts`

**File:** `src/application/services/cjOrderPushService.ts`

Change the constructor to take the new settings repo, and make `logisticName` optional:

```ts
export class CjOrderPushService {
  constructor(
    private readonly supplierOrderRepo: ISupplierOrderRepository,
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly cjClient: ICjClient,
    private readonly settingsRepo: IAutomationSettingsRepository,   // NEW
  ) {}

  async pushOrder(supplierOrderId: number, input: { logisticName?: string }): Promise<SupplierOrder> {
    const order = await this.supplierOrderRepo.findById(supplierOrderId);
    if (!order) throw new SupplierOrderNotFoundError();
    if (order.externalOrderId) throw new CjOrderAlreadyPushedError();

    const integration = await this.integrationRepo.findBySupplierId(order.supplierId);
    if (!integration?.id) throw new SupplierIntegrationNotFoundError();

    const products = await this.resolveVids(order, integration.id);
    const address = await this.resolveShippingAddress(order);
    const countryCode = resolveCountryCode(address.country);

    let logisticName = input.logisticName;
    if (!logisticName) {
      let quote: CjFreightOption[];
      try {
        quote = await this.cjClient.calculateFreight({ startCountryCode: 'CN', endCountryCode: countryCode, products });
      } catch (err) {
        logger.error('CJ Dropshipping freight quote failed during auto-selection', { supplierOrderId });
        throw new CjApiUnavailableError();
      }
      const settings = await this.settingsRepo.get();
      logisticName = selectCheapestLogistic(quote, settings.carrierAllowList);
      if (!logisticName) throw new CjCarrierAllowListExhaustedError();
    }

    // ...rest of the method unchanged, using `logisticName` (now guaranteed defined)...
  }
}

// Pure helper, exported for unit testing in isolation.
export function selectCheapestLogistic(options: CjFreightOption[], allowList: string[]): string | null {
  const candidates = allowList.length > 0
    ? options.filter((o) => allowList.includes(o.logisticName))
    : options;
  if (candidates.length === 0) return null;
  return candidates.reduce((min, o) => (o.logisticPrice < min.logisticPrice ? o : min)).logisticName;
}
```

**New error class** — `src/application/validator.ts`:
```ts
export class CjCarrierAllowListExhaustedError extends Error {
  readonly code = 'CJ_CARRIER_ALLOWLIST_EXHAUSTED' as const;
  readonly status = 422;
  constructor(message = 'No freight option matches the configured carrier allow-list') {
    super(message);
    this.name = 'CjCarrierAllowListExhaustedError';
    Object.setPrototypeOf(this, CjCarrierAllowListExhaustedError.prototype);
  }
}
```
Add to `errorHandler.ts`'s if/else chain (or rely on the generic `status`-property fallback — but follow existing convention and add it explicitly).

**Validator change** — `validateCjOrderPushData` (`validator.ts`) — make `logisticName` optional (Flag 7):
```ts
export function validateCjOrderPushData(data: Record<string, unknown>): { logisticName?: string } {
  const logisticName = data['logisticName'];
  if (logisticName !== undefined && (typeof logisticName !== 'string' || logisticName.trim().length === 0)) {
    throw new ValidationError("Field 'logisticName' must be a non-empty string when provided");
  }
  if ('isSandbox' in data) {
    throw new ValidationError("Field 'isSandbox' is not accepted — sandbox mode is always forced server-side");
  }
  return { logisticName: typeof logisticName === 'string' ? logisticName : undefined };
}
```
**Controller** — `cjOrderPushController.ts`'s `push()` needs no change beyond the type now allowing `undefined`; update the `CjOrderPushService` construction to pass the new `AutomationSettingsRepository()` dependency (5th constructor arg).

### 8.3 Wire `paymentService.handlePaymentIntentSucceeded`

**File:** `src/application/services/paymentService.ts`

Add a top-level import: `import { fulfillmentAutomationService } from './fulfillmentAutomationService';` (module-level singleton import, matching the existing precedent where `checkoutService.ts` imports the `paymentService` singleton directly rather than via constructor injection — see Flag 6 for why this is the right call-site pattern here, not fire-and-forget).

Per Flag 5, the call must be reachable from **both** the early-return "already Paid" branch and the main success branch:

```ts
private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
  const intent = event.data.object as Stripe.PaymentIntent;
  const order = await this.orderRepo.findByStripePaymentIntentId(intent.id);

  if (!order) {
    logger.warn('payment_intent.succeeded: order not found for PaymentIntent', { stripePaymentIntentId: intent.id });
    return;
  }

  if (order.paymentStatus === 'Paid') {
    logger.info('payment_intent.succeeded: order already Paid — skipping', { orderId: order.id });
    // Still (idempotently) run automation on a webhook retry — the
    // generate/push guards are the actual idempotency mechanism (design.md
    // Decision 3), so re-invoking here is safe and is required by the
    // "webhook retry does not duplicate..." spec scenario (Flag 5).
    await this.runFulfillmentAutomation(order.id!);
    return;
  }

  // ...existing amount-mismatch check and prisma.customerOrder.update...

  logger.info('payment_intent.succeeded: order marked Paid', { /* ...unchanged... */ });

  // Flag 6: AWAIT, not fire-and-forget — see comment on runFulfillmentAutomation.
  await this.runFulfillmentAutomation(order.id!);
}

// Awaited (not fire-and-forget) deliberately: this Lambda deployment freezes
// its execution environment as soon as the handler's returned promise
// resolves (documented incident in backend-standards.md's CJ integration
// section), so an un-awaited call here could be silently lost mid-flight —
// unlike the welcome-email fire-and-forget pattern, losing this silently
// would defeat the "a stalled order is never silent" alerting requirement.
// fulfillmentAutomationService.runForPaidOrder() never throws (it catches
// and alerts internally), so this await cannot itself break webhook
// processing — this wrapper is a defense-in-depth safety net only.
private async runFulfillmentAutomation(customerOrderId: number): Promise<void> {
  try {
    await fulfillmentAutomationService.runForPaidOrder(customerOrderId);
  } catch (err) {
    logger.error('Unexpected error from fulfillmentAutomationService', {
      customerOrderId, error: err instanceof Error ? err.message : String(err),
    });
  }
}
```
Note the latency trade-off explicitly in the PR description (Flag 6): the webhook response now waits for supplier-order generation + (when applicable) a CJ freight-quote + create-order round trip before responding to Stripe. This is bounded by `cjClient`'s existing `REQUEST_TIMEOUT_MS = 10_000` × up to `MAX_RETRIES = 3` per call, across up to 2 sequential CJ calls (quote + create) — worst case tens of seconds. A slow-but-eventual Stripe webhook response is safe (Stripe retries are deduped by the existing `StripeWebhookEvent` idempotency log — but note the dedupe record is only written *after* the whole handler succeeds, so a Stripe-side timeout-triggered retry would re-run the whole handler, which is fine because every step here is independently idempotent).

### 8.4 Failures do not roll back `Paid` status

Already satisfied by construction: `runFulfillmentAutomation` never throws, and it runs strictly after the `prisma.customerOrder.update({ data: { status: 'Paid', ... } })` call has already completed and returned.

### 8.5 Tests to add/extend

- `src/application/services/__tests__/fulfillmentAutomationService.test.ts` (new): disabled flag → no calls; enabled → generate + push both invoked; `CjOrderAlreadyPushedError` on push → no alert recorded (idempotent no-op); non-CJ supplier (no/disconnected integration) → push skipped entirely; generation throws → alert recorded with `type: 'SupplierOrderGenerationFailed'`, no push attempted.
- `src/application/services/__tests__/cjOrderPushService.test.ts` (extend): `pushOrder` with no `logisticName` calls `calculateFreight` then selects cheapest; allow-list configured + no match → `CjCarrierAllowListExhaustedError`, no `createOrder` call. New `describe('selectCheapestLogistic')` unit tests for the pure helper directly.
- `src/application/services/__tests__/paymentService.test.ts` (extend): `handlePaymentIntentSucceeded` on the "already Paid" branch calls `fulfillmentAutomationService.runForPaidOrder` (mock the module: `jest.mock('./fulfillmentAutomationService')`); on the main success branch too; a thrown error from the mocked service does not propagate out of `handleWebhookEvent` (webhook event still gets recorded via `webhookEventRepo.create`).

---

## 9. Backend: Scheduled CJ Status Sync and Automatic Shipment Updates

### 9.1 CJ status vocabulary and Shipment mapping — **new domain file**

**⚠ Unverified against live CJ docs/sandbox — flagged per design.md Open Question 2.** The exact string values CJ Dropshipping's `getOrderDetail` returns are not present anywhere in this codebase (only one test fixture uses the literal string `'PROCESSING'`, `src/application/services/__tests__/cjOrderPushService.test.ts:234`). The table below is a best-effort starting point based on the vendor's commonly documented order-status vocabulary. **The parent session must confirm actual values against a real sandbox `getOrderDetail` response before treating this as final** — until then, any unrecognized status string must be treated as a safe no-op (logged, not alerted, not errored), never crash the job.

**New file:** `src/domain/models/cjOrderStatus.ts`

```ts
import { ShipmentStatus } from './shipment';

// Best-effort mapping — VERIFY against a live CJ sandbox order before
// relying on this in production (design.md Open Question 2). Unrecognized
// values fall through to `null` (no-op), never a crash or a false alert.
const CJ_STATUS_TO_SHIPMENT_TARGET: Record<string, ShipmentStatus> = {
  CREATED: 'Pending',
  IN_CART: 'Pending',
  UNAUDITED: 'Pending',
  UNSHIPPED: 'Pending',
  UNDELIVERY: 'Shipped',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'InTransit',
  DELIVERED: 'Delivered',
  RECEIVED: 'Delivered',
  CANCELLED: 'Failed',
  CANCELED: 'Failed',
  RETURNED: 'Returned',
};

export const CJ_TERMINAL_STATUSES: readonly string[] = [
  'DELIVERED', 'RECEIVED', 'CANCELLED', 'CANCELED', 'RETURNED',
];

export function mapCjExternalStatusToShipmentTarget(externalOrderStatus: string): ShipmentStatus | null {
  return CJ_STATUS_TO_SHIPMENT_TARGET[externalOrderStatus.toUpperCase()] ?? null;
}

export function isCjStatusTerminal(externalOrderStatus: string): boolean {
  return CJ_TERMINAL_STATUSES.includes(externalOrderStatus.toUpperCase());
}
```

### 9.2 Chained shipment-transition walker (Flag 3 fix)

**New file:** `src/application/services/cjOrderStatusSyncService.ts`

```ts
import { ShipmentStatus, isValidShipmentTransition } from '../../domain/models/shipment';

// Linear happy-path chain. Failed/Returned are branch-offs handled
// separately (single-hop only, from any non-terminal current status) — they
// are not part of the "advance forward" chain.
const HAPPY_PATH: ShipmentStatus[] = ['Pending', 'Shipped', 'InTransit', 'Delivered'];

export interface AdvanceResult {
  advanced: boolean;      // true if at least one transition was applied
  finalStatus: ShipmentStatus;
  illegal: boolean;       // true if the target could not be reached at all (skip + alert)
}

// Walks the shipment forward one legal hop at a time toward `target`,
// instead of attempting a single direct jump — this is what makes
// Pending -> Delivered (illegal per SHIPMENT_TRANSITIONS, see Flag 3)
// reachable via a single sync run without ever attempting an illegal
// transition: Pending -> Shipped -> InTransit -> Delivered, one legal hop
// per call to the shipment status-update. Failed/Returned targets are
// applied directly (single hop) since they are not part of the linear chain.
export async function advanceShipmentTowards(
  currentStatus: ShipmentStatus,
  target: ShipmentStatus,
  applyTransition: (next: ShipmentStatus) => Promise<void>,
): Promise<AdvanceResult> {
  if (target === 'Failed' || target === 'Returned') {
    if (!isValidShipmentTransition(currentStatus, target)) {
      return { advanced: false, finalStatus: currentStatus, illegal: true };
    }
    await applyTransition(target);
    return { advanced: true, finalStatus: target, illegal: false };
  }

  const currentIdx = HAPPY_PATH.indexOf(currentStatus);
  const targetIdx = HAPPY_PATH.indexOf(target);
  if (currentIdx === -1) {
    // current status is Failed/Returned (terminal, not on the happy path) —
    // per the terminal-state rule, no further transition is ever legal.
    return { advanced: false, finalStatus: currentStatus, illegal: true };
  }
  if (targetIdx === -1 || targetIdx <= currentIdx) {
    // Already there, or CJ reports a "backward" status — never regress, and
    // this is NOT an alert-worthy illegal transition, just a no-op
    // (re-entrancy requirement: "running the job twice with no CJ change
    // makes no further changes").
    return { advanced: false, finalStatus: currentStatus, illegal: false };
  }

  let status = currentStatus;
  for (let i = currentIdx + 1; i <= targetIdx; i++) {
    const next = HAPPY_PATH[i]!;
    if (!isValidShipmentTransition(status, next)) {
      return { advanced: status !== currentStatus, finalStatus: status, illegal: true };
    }
    await applyTransition(next);
    status = next;
  }
  return { advanced: true, finalStatus: status, illegal: false };
}
```

### 9.3 Shipment repository additions

**File:** `src/domain/repositories/shipmentRepository.ts` + `src/infrastructure/repositories/shipmentRepository.ts`

```ts
// domain
findBySupplierOrderId(supplierOrderId: number): Promise<Shipment | null>;
```
```ts
// infrastructure
async findBySupplierOrderId(supplierOrderId: number): Promise<Shipment | null> {
  const row = await prisma.shipment.findFirst({
    where: { supplierOrderId },
    orderBy: { createdAt: 'desc' },
    select: shipmentListSelect,
  });
  return row ? mapShipment(row) : null;
}
```

### 9.4 `cjOrderStatusSyncService.ts` — create-or-advance orchestration

Add to the same new file (`src/application/services/cjOrderStatusSyncService.ts`), composing `CjOrderPushService.getOrderStatus`, `ShipmentService`, and the walker from §9.2:

```ts
export class CjOrderStatusSyncOrchestrator {
  constructor(
    private readonly cjOrderPushService: CjOrderPushService,
    private readonly shipmentRepo: IShipmentRepository,
    private readonly shipmentService: ShipmentService,
    private readonly alertRepo: IAutomationAlertRepository,
  ) {}

  // Returns true if anything changed (for the job's "updated" counter).
  async syncOne(supplierOrder: SupplierOrder): Promise<boolean> {
    // Reuses the existing, already-shared status-pull logic (Flag 9 — no
    // extraction needed, it's already a plain service method).
    const updated = await this.cjOrderPushService.getOrderStatus(supplierOrder.id!);
    if (!updated.externalOrderStatus) return false;

    const target = mapCjExternalStatusToShipmentTarget(updated.externalOrderStatus);
    if (!target) {
      logger.warn('Unrecognized CJ externalOrderStatus — no shipment mapping applied', {
        supplierOrderId: supplierOrder.id, externalOrderStatus: updated.externalOrderStatus,
      });
      return false;
    }

    let shipment = await this.shipmentRepo.findBySupplierOrderId(supplierOrder.id!);
    if (!shipment) {
      shipment = await this.shipmentService.createShipment({
        customerOrderId: updated.customerOrderId,
        supplierOrderId: supplierOrder.id,
        carrier: updated.externalTrackingProvider ?? null,
        trackingNumber: updated.externalTrackingNumber ?? null,
      });
    }

    const result = await advanceShipmentTowards(shipment.status, target, async (next) => {
      await this.shipmentService.updateShipmentStatus(shipment!.id!, { status: next });
    });

    if (result.illegal) {
      await this.recordAlert('ShipmentTransitionSkipped', updated.customerOrderId, supplierOrder.id, shipment.status, target);
    }
    return result.advanced;
  }

  private async recordAlert(
    type: string, customerOrderId: number, supplierOrderId: number | undefined,
    from: string, to: string
  ): Promise<void> {
    const message = `Cannot transition shipment from ${from} to mapped CJ target ${to}`;
    logger.warn('Skipped illegal shipment transition mapped from CJ status', { customerOrderId, supplierOrderId, from, to });
    try {
      await this.alertRepo.create({ type, customerOrderId, supplierOrderId, message });
    } catch (err) {
      logger.error('Failed to record shipment-transition alert', { error: err instanceof Error ? err.message : String(err) });
    }
  }
}
```
Note: `updated.customerOrderId` — confirm `SupplierOrder` domain model exposes `customerOrderId` directly (it does — `orderSelect` in `supplierOrderRepository.ts` includes `customerOrderId: true`).

### 9.5 Repository query for the job's candidate set

**File:** `src/domain/repositories/supplierOrderRepository.ts` + `src/infrastructure/repositories/supplierOrderRepository.ts`

```ts
// domain
findPushedNonTerminal(): Promise<SupplierOrder[]>;
```
```ts
// infrastructure — import CJ_TERMINAL_STATUSES from '../../domain/models/cjOrderStatus'
async findPushedNonTerminal(): Promise<SupplierOrder[]> {
  const rows = await prisma.supplierOrder.findMany({
    where: {
      externalOrderId: { not: null },
      OR: [
        { externalOrderStatus: null },
        { externalOrderStatus: { notIn: [...CJ_TERMINAL_STATUSES] } },
      ],
    },
    select: orderSelect,
  });
  return rows.map(mapOrder);
}
```

### 9.6 `jobs/cjOrderStatusSyncHandler.ts` — **new file**, mirrors `supplierAutoProvisionHandler.ts`

**New file:** `src/jobs/cjOrderStatusSyncHandler.ts`

```ts
import { CjOrderPushService } from '../application/services/cjOrderPushService';
import { CjOrderStatusSyncOrchestrator } from '../application/services/cjOrderStatusSyncService';
import { SupplierOrderRepository } from '../infrastructure/repositories/supplierOrderRepository';
import { SupplierIntegrationRepository } from '../infrastructure/repositories/supplierIntegrationRepository';
import { CjCatalogItemRepository } from '../infrastructure/repositories/cjCatalogItemRepository';
import { ShipmentRepository } from '../infrastructure/repositories/shipmentRepository';
import { ShipmentService } from '../application/services/shipmentService';
import { AutomationSettingsRepository } from '../infrastructure/repositories/automationSettingsRepository';
import { AutomationAlertRepository } from '../infrastructure/repositories/automationAlertRepository';
import { cjClient } from '../infrastructure/external/cjClient';
import { logger } from '../infrastructure/logger';

const supplierOrderRepo = new SupplierOrderRepository();
const orchestrator = new CjOrderStatusSyncOrchestrator(
  new CjOrderPushService(
    supplierOrderRepo,
    new SupplierIntegrationRepository(),
    new CjCatalogItemRepository(),
    cjClient,
    new AutomationSettingsRepository(),
  ),
  new ShipmentRepository(),
  new ShipmentService(new ShipmentRepository()),
  new AutomationAlertRepository(),
);

export interface CjOrderStatusSyncRunResult {
  enabled: boolean;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
}

// No HTTP surface — invoked only by the EventBridge `schedule` event in
// serverless.yml, or manually via `serverless invoke local -f cjOrderStatusSync`.
export async function handler(_event?: unknown): Promise<CjOrderStatusSyncRunResult> {
  if (process.env.FULFILLMENT_AUTOMATION_ENABLED !== 'true') {
    logger.info('CJ order status sync disabled via FULFILLMENT_AUTOMATION_ENABLED', {});
    return { enabled: false, processed: 0, updated: 0, skipped: 0, failed: 0 };
  }

  const candidates = await supplierOrderRepo.findPushedNonTerminal();
  let updated = 0, skipped = 0, failed = 0;

  for (const order of candidates) {
    try {
      const changed = await orchestrator.syncOne(order);
      if (changed) updated++; else skipped++;
    } catch (err) {
      failed++;
      logger.error('cjOrderStatusSync: sync failed for supplier order', {
        supplierOrderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Best-effort alert; do not let a broken alert write abort the loop.
      try {
        await new AutomationAlertRepository().create({
          type: 'CjStatusSyncFailed',
          customerOrderId: order.customerOrderId,
          supplierOrderId: order.id,
          message: err instanceof Error ? err.message : 'Unknown status-sync failure',
        });
      } catch { /* logged above; swallow */ }
    }
  }

  logger.info('cjOrderStatusSync job finished', { processed: candidates.length, updated, skipped, failed });
  return { enabled: true, processed: candidates.length, updated, skipped, failed };
}
```

### 9.7 `serverless.yml` — new scheduled function

**File:** `serverless.yml`

```yaml
functions:
  # ...existing app, supplierAutoProvision...

  cjOrderStatusSync:
    handler: src/jobs/cjOrderStatusSyncHandler.handler
    timeout: 900
    events:
      - schedule: rate(1 hour)   # more frequent than the daily catalog sync — status changes matter to customers in near-real-time
```
Also add `FULFILLMENT_AUTOMATION_ENABLED: ${ssm:/ecommerce/prod/FULFILLMENT_AUTOMATION_ENABLED, 'false'}` to `provider.environment` (same block as `SUPPLIER_AUTO_PROVISION_ENABLED`) — this env var also gates `paymentService`'s automation call (§8.3) and must be defined once at the provider level, not per-function, since `handlePaymentIntentSucceeded` runs inside the `app` Lambda, not this new one.

### 9.8 Tests to add/extend

- `src/application/services/__tests__/cjOrderStatusSyncService.test.ts` (new, covering both the pure `advanceShipmentTowards` walker and `CjOrderStatusSyncOrchestrator.syncOne`): first sync creates shipment + advances Pending→Shipped when CJ reports "shipped"; later sync from Shipped to CJ "delivered" advances Shipped→Delivered directly (single legal hop); a sync that would need Pending→Delivered in one jump instead chains through Shipped→InTransit→Delivered (three `updateShipmentStatus` calls, not one); sync skips supplier orders with no `externalOrderId` is verified at the **repository** query level, not here; illegal transition (current already `Delivered`) → `illegal: true`, alert recorded, no further calls; re-run with unchanged CJ status → `advanced: false`, no alert.
- `src/infrastructure/repositories/__tests__/supplierOrderRepository.test.ts` (extend): `findPushedNonTerminal` excludes rows with `externalOrderId: null` and rows whose `externalOrderStatus` is in the terminal set.
- `src/infrastructure/repositories/__tests__/shipmentRepository.test.ts` (extend): `findBySupplierOrderId`.
- `src/jobs/__tests__/cjOrderStatusSyncHandler.test.ts` (new, mirrors `supplierAutoProvisionHandler.test.ts`): disabled flag → no DB calls; enabled → processes candidates, counts correctly; one candidate throwing doesn't abort the loop for the rest.

---

## 10. Backend: Automation Alerting Surface

### 10.1 Alert-recording call sites

Already designed inline in §8.1 (`FulfillmentAutomationService.recordAlert`) and §9.4/§9.6 (`CjOrderStatusSyncOrchestrator.recordAlert` + the job's own catch block). No further wiring needed beyond what's specified there.

**New files:**
- `src/domain/repositories/automationAlertRepository.ts`:
  ```ts
  export interface AutomationAlertCreateData {
    type: string;
    customerOrderId?: number;
    supplierOrderId?: number;
    message: string;
  }
  export interface AutomationAlertListFilters { resolvedOnly?: boolean; page?: number; pageSize?: number; }
  export interface AutomationAlertListResult { items: AutomationAlert[]; total: number; page: number; pageSize: number; }
  export interface IAutomationAlertRepository {
    create(data: AutomationAlertCreateData): Promise<AutomationAlert>;
    findAll(filters?: AutomationAlertListFilters): Promise<AutomationAlertListResult>;
  }
  ```
- `src/domain/models/automationAlert.ts` — plain data class, same shape as the Prisma model (§1.5).
- `src/infrastructure/repositories/automationAlertRepository.ts` — `create()` is a plain `prisma.automationAlert.create`; `findAll()` defaults to `where: { resolvedAt: null }` unless `filters.resolvedOnly === false` is explicitly passed, paginated like every other list endpoint in this codebase (`skip`/`take`, default `pageSize: 20`).

### 10.2 `GET /api/admin/fulfillment-automation/alerts`

**New files:**
- `src/presentation/controllers/fulfillmentAutomationAlertController.ts`:
  ```ts
  const alertRepo = new AutomationAlertRepository();
  export async function listAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, pageSize } = req.query;
      const result = await alertRepo.findAll({
        page: page ? parseInt(String(page), 10) : undefined,
        pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
      });
      res.json({ success: true, data: result, message: 'Automation alerts retrieved successfully' });
    } catch (err) { next(err); }
  }
  ```
- `src/routes/admin/fulfillmentAutomationRoutes.ts`:
  ```ts
  const router = Router();
  router.get('/alerts', listAlerts);
  export default router;
  ```
- **`src/index.ts`**: `import fulfillmentAutomationAdminRoutes from './routes/admin/fulfillmentAutomationRoutes';` + `adminRouter.use('/fulfillment-automation', fulfillmentAutomationAdminRoutes);` (alongside the other `adminRouter.use(...)` lines, after `requireAdminAuth` is applied — no per-route auth needed).

Response DTO fields per task 10.2: `id`, `type`, `customerOrderId`, `supplierOrderId`, `message`, `createdAt` — the raw domain object already matches this shape 1:1 (no separate serializer needed, but note `resolvedAt` will also appear — harmless, it's not sensitive).

### 10.3 Tests to add/extend

- `src/infrastructure/repositories/__tests__/automationAlertRepository.test.ts` (new): `create`; `findAll` defaults to unresolved-only.
- `src/presentation/controllers/__tests__/fulfillmentAutomationAlertController.test.ts` (new): 200 with paginated list.
- Extend `fulfillmentAutomationService.test.ts` / `cjOrderStatusSyncService.test.ts` (already listed in §8.5/§9.8) with an explicit assertion that alert `message` strings never contain `supplierCost`, `logisticPrice`, or any CJ/Stripe key-shaped substring — a cheap regex assertion (`expect(message).not.toMatch(/sk_|cj_|\d+\.\d{2}/)`) is enough to catch an accidental interpolation regression.

---

## Cross-cutting: `errorHandler.ts` additions

Add explicit branches (matching existing convention) for the two new error classes:
```ts
} else if (err instanceof AddressDefaultConflictError) {
  statusCode = 409; code = err.code; message = err.message;
} else if (err instanceof CjCarrierAllowListExhaustedError) {
  statusCode = 422; code = err.code; message = err.message;
```
(Both would also be caught by the existing generic `'status' in err` fallback at the bottom, but explicit branches match this file's established style.)

## Cross-cutting: files touched — summary

**New files:**
- `backend/scripts/backfillProductVariantStockQuantity.ts`
- `src/domain/repositories/customerAddressRepository.ts`, `src/infrastructure/repositories/customerAddressRepository.ts`, `src/infrastructure/repositories/customerAddressDefaultTransaction.ts`
- `src/application/services/customerAddressService.ts`
- `src/presentation/controllers/customerAddressController.ts`
- `src/domain/repositories/automationSettingsRepository.ts`, `src/infrastructure/repositories/automationSettingsRepository.ts`
- `src/domain/models/automationAlert.ts`, `src/domain/repositories/automationAlertRepository.ts`, `src/infrastructure/repositories/automationAlertRepository.ts`
- `src/presentation/controllers/fulfillmentAutomationAlertController.ts`, `src/routes/admin/fulfillmentAutomationRoutes.ts`
- `src/application/services/fulfillmentAutomationService.ts`
- `src/domain/models/cjOrderStatus.ts`
- `src/application/services/cjOrderStatusSyncService.ts`
- `src/jobs/cjOrderStatusSyncHandler.ts`

**Edited files:**
- `prisma/schema.prisma` (+ generated migration, hand-edited for the partial index)
- `serverless.yml` (new function + new env var)
- `src/index.ts` (mount new admin router)
- `src/routes/public/accountRoutes.ts` (new address routes)
- `src/routes/admin/productRoutes.ts` (new freight-estimate route)
- `src/domain/models/customer.ts`, `src/domain/repositories/customerRepository.ts`, `src/infrastructure/repositories/customerRepository.ts`, `src/application/services/customerService.ts` (admin `isDefault`)
- `src/domain/models/productVariant.ts`, `src/domain/repositories/productRepository.ts`, `src/infrastructure/repositories/productVariantRepository.ts`, `src/infrastructure/repositories/productRepository.ts` (stock/margin fields)
- `src/application/services/productVariantService.ts`, `src/presentation/controllers/productVariantController.ts` (margin warning, freight-estimate)
- `src/presentation/serializers/publicProduct.ts` (`stockQuantity`)
- `src/infrastructure/repositories/cjCatalogItemRepository.ts`, `src/domain/repositories/cjCatalogItemRepository.ts` (stock sync)
- `src/application/services/cjCatalogPromotionService.ts` (initial stockQuantity)
- `src/application/services/cjOrderPushService.ts` (optional logisticName, auto-select)
- `src/presentation/controllers/cjOrderPushController.ts` (new constructor dep)
- `src/application/validator.ts` (`validateCjOrderPushData`, `CjCarrierAllowListExhaustedError`)
- `src/application/services/paymentService.ts` (automation hook)
- `src/domain/repositories/shipmentRepository.ts`, `src/infrastructure/repositories/shipmentRepository.ts` (`findBySupplierOrderId`)
- `src/domain/repositories/supplierOrderRepository.ts`, `src/infrastructure/repositories/supplierOrderRepository.ts` (`findPushedNonTerminal`)
- `src/middleware/errorHandler.ts` (new error branches)

No changes needed to: `checkoutService.ts` (confirmed, §6.4), `cjClient.ts`/`cjTypes.ts` (existing signatures already sufficient), `supplierOrderCjRoutes.ts` (no route shape change, only body validation loosened).
