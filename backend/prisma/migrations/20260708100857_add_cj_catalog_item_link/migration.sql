-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "cjCatalogItemId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_cjCatalogItemId_key" ON "ProductVariant"("cjCatalogItemId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_cjCatalogItemId_fkey" FOREIGN KEY ("cjCatalogItemId") REFERENCES "CjCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
