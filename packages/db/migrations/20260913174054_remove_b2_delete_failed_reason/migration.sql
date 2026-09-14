/*
  Warnings:

  - The values [b2_delete_failed] on the enum `StorageCleanupReason` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;

DELETE FROM "StorageCleanupTask"
WHERE reason = 'b2_delete_failed';

CREATE TYPE "StorageCleanupReason_new" AS ENUM ('image_create_failed');
ALTER TABLE "StorageCleanupTask"
  ALTER COLUMN "reason"
  TYPE "StorageCleanupReason_new"
  USING ("reason"::text::"StorageCleanupReason_new");
ALTER TYPE "StorageCleanupReason" RENAME TO "StorageCleanupReason_old";
ALTER TYPE "StorageCleanupReason_new" RENAME TO "StorageCleanupReason";
DROP TYPE "public"."StorageCleanupReason_old";

COMMIT;