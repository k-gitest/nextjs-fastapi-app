-- CreateEnum
CREATE TYPE "StorageCleanupReason" AS ENUM ('image_create_failed', 'b2_delete_failed');

-- CreateEnum
CREATE TYPE "StorageCleanupStatus" AS ENUM ('pending', 'processing', 'resolved', 'failed');

-- CreateTable
CREATE TABLE "StorageCleanupTask" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "reason" "StorageCleanupReason" NOT NULL,
    "status" "StorageCleanupStatus" NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "StorageCleanupTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageCleanupTask_storageKey_key" ON "StorageCleanupTask"("storageKey");

-- CreateIndex
CREATE INDEX "StorageCleanupTask_status_nextRetryAt_createdAt_idx" ON "StorageCleanupTask"("status", "nextRetryAt", "createdAt");
