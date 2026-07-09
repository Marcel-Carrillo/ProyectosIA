-- AlterTable
ALTER TABLE "SupplierIntegration" ADD COLUMN     "catalogSyncCursorPage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "catalogSyncTotalPages" INTEGER,
ADD COLUMN     "catalogSyncWrappedAt" TIMESTAMP(3);
