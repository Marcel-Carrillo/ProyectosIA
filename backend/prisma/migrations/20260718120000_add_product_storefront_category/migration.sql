-- AlterTable
ALTER TABLE "Product" ADD COLUMN "storefrontCategoryId" INTEGER;

-- CreateIndex
CREATE INDEX "Product_storefrontCategoryId_idx" ON "Product"("storefrontCategoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storefrontCategoryId_fkey" FOREIGN KEY ("storefrontCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
