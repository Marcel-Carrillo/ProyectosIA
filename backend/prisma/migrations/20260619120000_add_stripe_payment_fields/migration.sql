-- AlterTable
ALTER TABLE "CustomerOrder" ADD COLUMN "stripeChargeId" VARCHAR(255),
ADD COLUMN "stripePaymentIntentId" VARCHAR(255);

-- CreateIndex
CREATE INDEX "CustomerOrder_stripePaymentIntentId_idx" ON "CustomerOrder"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "CustomerOrder_stripeChargeId_idx" ON "CustomerOrder"("stripeChargeId");

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" SERIAL NOT NULL,
    "stripeEventId" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "customerOrderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_stripeEventId_idx" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_customerOrderId_idx" ON "StripeWebhookEvent"("customerOrderId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_createdAt_idx" ON "StripeWebhookEvent"("createdAt");

-- CreateIndex (unique constraint on stripePaymentIntentId)
CREATE UNIQUE INDEX "CustomerOrder_stripePaymentIntentId_key" ON "CustomerOrder"("stripePaymentIntentId");
