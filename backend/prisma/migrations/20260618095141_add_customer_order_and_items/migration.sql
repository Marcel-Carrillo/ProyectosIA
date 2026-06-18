-- CreateTable
CREATE TABLE "CustomerOrder" (
    "id" SERIAL NOT NULL,
    "orderNumber" VARCHAR(50) NOT NULL,
    "customerId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PendingPayment',
    "paymentStatus" TEXT NOT NULL DEFAULT 'Pending',
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'NotStarted',
    "subtotalAmount" DECIMAL(10,2) NOT NULL,
    "shippingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "shippingAddressSnapshot" JSONB NOT NULL,
    "billingAddressSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "CustomerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOrderItem" (
    "id" SERIAL NOT NULL,
    "customerOrderId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "productNameSnapshot" VARCHAR(150) NOT NULL,
    "variantSnapshot" JSONB NOT NULL,
    "skuSnapshot" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'NotStarted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOrder_orderNumber_key" ON "CustomerOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "CustomerOrder_customerId_idx" ON "CustomerOrder"("customerId");

-- CreateIndex
CREATE INDEX "CustomerOrder_status_idx" ON "CustomerOrder"("status");

-- CreateIndex
CREATE INDEX "CustomerOrder_paymentStatus_idx" ON "CustomerOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "CustomerOrder_fulfillmentStatus_idx" ON "CustomerOrder"("fulfillmentStatus");

-- CreateIndex
CREATE INDEX "CustomerOrder_createdAt_idx" ON "CustomerOrder"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerOrderItem_customerOrderId_idx" ON "CustomerOrderItem"("customerOrderId");

-- CreateIndex
CREATE INDEX "CustomerOrderItem_productVariantId_idx" ON "CustomerOrderItem"("productVariantId");

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrderItem" ADD CONSTRAINT "CustomerOrderItem_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrderItem" ADD CONSTRAINT "CustomerOrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
