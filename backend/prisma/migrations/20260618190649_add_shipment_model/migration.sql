-- CreateTable
CREATE TABLE "Shipment" (
    "id" SERIAL NOT NULL,
    "customerOrderId" INTEGER NOT NULL,
    "supplierOrderId" INTEGER,
    "carrier" VARCHAR(100),
    "trackingNumber" VARCHAR(100),
    "trackingUrl" VARCHAR(500),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shipment_customerOrderId_idx" ON "Shipment"("customerOrderId");

-- CreateIndex
CREATE INDEX "Shipment_supplierOrderId_idx" ON "Shipment"("supplierOrderId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_createdAt_idx" ON "Shipment"("createdAt");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
