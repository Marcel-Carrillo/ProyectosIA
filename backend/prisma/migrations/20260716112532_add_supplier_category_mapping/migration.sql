-- CreateTable
CREATE TABLE "SupplierCategoryMapping" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "externalCategoryId" VARCHAR(100) NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierCategoryMapping_categoryId_idx" ON "SupplierCategoryMapping"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCategoryMapping_provider_externalCategoryId_key" ON "SupplierCategoryMapping"("provider", "externalCategoryId");

-- AddForeignKey
ALTER TABLE "SupplierCategoryMapping" ADD CONSTRAINT "SupplierCategoryMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
