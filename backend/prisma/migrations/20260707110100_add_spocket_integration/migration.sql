-- CreateTable
CREATE TABLE "SupplierIntegration" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "provider" VARCHAR(50) NOT NULL DEFAULT 'Spocket',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Disconnected',
    "externalAccountRef" VARCHAR(150),
    "lastVerifiedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpocketCatalogItem" (
    "id" SERIAL NOT NULL,
    "supplierIntegrationId" INTEGER NOT NULL,
    "externalRef" VARCHAR(150) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "size" VARCHAR(50),
    "color" VARCHAR(50),
    "supplierCost" DECIMAL(10,2) NOT NULL,
    "stockQuantity" INTEGER NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "syncStatus" VARCHAR(20) NOT NULL DEFAULT 'Synced',
    "syncError" VARCHAR(500),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpocketCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierIntegration_supplierId_key" ON "SupplierIntegration"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierIntegration_supplierId_idx" ON "SupplierIntegration"("supplierId");

-- CreateIndex
CREATE INDEX "SpocketCatalogItem_supplierIntegrationId_idx" ON "SpocketCatalogItem"("supplierIntegrationId");

-- CreateIndex
CREATE INDEX "SpocketCatalogItem_syncStatus_idx" ON "SpocketCatalogItem"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SpocketCatalogItem_supplierIntegrationId_externalRef_key" ON "SpocketCatalogItem"("supplierIntegrationId", "externalRef");

-- AddForeignKey
ALTER TABLE "SupplierIntegration" ADD CONSTRAINT "SupplierIntegration_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpocketCatalogItem" ADD CONSTRAINT "SpocketCatalogItem_supplierIntegrationId_fkey" FOREIGN KEY ("supplierIntegrationId") REFERENCES "SupplierIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
