-- CreateTable
CREATE TABLE "Refund" (
    "id" SERIAL NOT NULL,
    "customerOrderId" INTEGER NOT NULL,
    "returnRequestId" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" VARCHAR(500),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "paymentProviderReference" VARCHAR(150),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_customerOrderId_idx" ON "Refund"("customerOrderId");

-- CreateIndex
CREATE INDEX "Refund_returnRequestId_idx" ON "Refund"("returnRequestId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
