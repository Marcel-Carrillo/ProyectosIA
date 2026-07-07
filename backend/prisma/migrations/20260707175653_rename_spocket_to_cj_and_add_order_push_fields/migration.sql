-- DropForeignKey
ALTER TABLE "SpocketCatalogItem" DROP CONSTRAINT "SpocketCatalogItem_supplierIntegrationId_fkey";

-- AlterTable
ALTER TABLE "SupplierIntegration" ALTER COLUMN "provider" SET DEFAULT 'CJDropshipping';

-- AlterTable
ALTER TABLE "SupplierOrder" ADD COLUMN     "externalOrderId" VARCHAR(150),
ADD COLUMN     "externalOrderStatus" VARCHAR(50),
ADD COLUMN     "externalProvider" VARCHAR(50),
ADD COLUMN     "externalTrackingNumber" VARCHAR(100),
ADD COLUMN     "externalTrackingProvider" VARCHAR(100),
ADD COLUMN     "lastStatusSyncedAt" TIMESTAMP(3),
ADD COLUMN     "pushedAt" TIMESTAMP(3),
ADD COLUMN     "sandbox" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "SpocketCatalogItem";

-- CreateTable
CREATE TABLE "CjCatalogItem" (
    "id" SERIAL NOT NULL,
    "supplierIntegrationId" INTEGER NOT NULL,
    "externalRef" VARCHAR(150) NOT NULL,
    "pid" VARCHAR(150),
    "vid" VARCHAR(150),
    "sku" VARCHAR(100),
    "categoryId" VARCHAR(100),
    "title" VARCHAR(150) NOT NULL,
    "size" VARCHAR(50),
    "color" VARCHAR(50),
    "supplierCost" DECIMAL(10,2) NOT NULL,
    "sellPrice" DECIMAL(10,2),
    "stockQuantity" INTEGER NOT NULL,
    "warehouseInventoryNum" INTEGER,
    "rawPayload" JSONB NOT NULL,
    "syncStatus" VARCHAR(20) NOT NULL DEFAULT 'Synced',
    "syncError" VARCHAR(500),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CjCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CjCatalogItem_supplierIntegrationId_idx" ON "CjCatalogItem"("supplierIntegrationId");

-- CreateIndex
CREATE INDEX "CjCatalogItem_syncStatus_idx" ON "CjCatalogItem"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CjCatalogItem_supplierIntegrationId_externalRef_key" ON "CjCatalogItem"("supplierIntegrationId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOrder_externalOrderId_key" ON "SupplierOrder"("externalOrderId");

-- AddForeignKey
ALTER TABLE "CjCatalogItem" ADD CONSTRAINT "CjCatalogItem_supplierIntegrationId_fkey" FOREIGN KEY ("supplierIntegrationId") REFERENCES "SupplierIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
