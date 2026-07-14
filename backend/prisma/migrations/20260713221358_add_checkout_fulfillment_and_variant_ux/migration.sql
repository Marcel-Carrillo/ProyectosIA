-- AlterTable
ALTER TABLE "CustomerAddress" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Enforces "at most one default CustomerAddress per (customerId, type)" at the
-- DB level. The application-level transaction (unset-then-set) is the
-- primary mechanism; this partial unique index is the concurrency backstop
-- under READ COMMITTED — a losing concurrent transaction gets a P2002 on
-- this named constraint, which the repository maps to a 409 rather than
-- corrupting state. Prisma's schema DSL cannot express a partial/filtered
-- unique index, hence this hand-added SQL.
CREATE UNIQUE INDEX "CustomerAddress_customerId_type_default_unique"
  ON "CustomerAddress" ("customerId", "type")
  WHERE "isDefault" = true;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "shippingCostEstimate" DECIMAL(10,2),
ADD COLUMN     "stockQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AutomationSettings" (
    "id" SERIAL NOT NULL,
    "targetMargin" DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    "defaultFreightDestinationCountry" VARCHAR(2) NOT NULL DEFAULT 'ES',
    "carrierAllowList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAlert" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "customerOrderId" INTEGER,
    "supplierOrderId" INTEGER,
    "message" VARCHAR(500) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationAlert_resolvedAt_idx" ON "AutomationAlert"("resolvedAt");

-- CreateIndex
CREATE INDEX "AutomationAlert_customerOrderId_idx" ON "AutomationAlert"("customerOrderId");

-- CreateIndex
CREATE INDEX "AutomationAlert_supplierOrderId_idx" ON "AutomationAlert"("supplierOrderId");

-- CreateIndex
CREATE INDEX "AutomationAlert_createdAt_idx" ON "AutomationAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "AutomationAlert" ADD CONSTRAINT "AutomationAlert_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAlert" ADD CONSTRAINT "AutomationAlert_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
