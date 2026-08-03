-- CreateTable
CREATE TABLE "AdminLoginChallenge" (
    "id" SERIAL NOT NULL,
    "adminUserId" INTEGER NOT NULL,
    "codeHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminLoginChallenge_adminUserId_idx" ON "AdminLoginChallenge"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminLoginChallenge_expiresAt_idx" ON "AdminLoginChallenge"("expiresAt");

-- AddForeignKey
ALTER TABLE "AdminLoginChallenge" ADD CONSTRAINT "AdminLoginChallenge_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
