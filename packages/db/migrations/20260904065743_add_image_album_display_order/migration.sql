-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "albumDisplayOrder" INTEGER;

-- CreateIndex
CREATE INDEX "Image_albumId_albumDisplayOrder_idx" ON "Image"("albumId", "albumDisplayOrder");

-- Backfill: 既存のAlbum所属Imageに対し、Albumごとに createdAt ASC（tie-breakerとして id ASC）で
-- 0始まりの連番を albumDisplayOrder として採番する。
-- 未所属（albumId IS NULL）のImageは対象外（albumDisplayOrder は NULL のまま、不変条件どおり）。
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "albumId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) - 1 AS "rn"
  FROM "Image"
  WHERE "albumId" IS NOT NULL
)
UPDATE "Image"
SET "albumDisplayOrder" = ranked."rn"
FROM ranked
WHERE "Image"."id" = ranked."id";