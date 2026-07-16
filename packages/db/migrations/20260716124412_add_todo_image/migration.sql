-- CreateTable
CREATE TABLE "TodoImage" (
    "id" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TodoImage_todoId_order_idx" ON "TodoImage"("todoId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TodoImage_todoId_imageId_key" ON "TodoImage"("todoId", "imageId");

-- AddForeignKey
ALTER TABLE "TodoImage" ADD CONSTRAINT "TodoImage_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoImage" ADD CONSTRAINT "TodoImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: 既存のImage（Todoに直接従属）から TodoImage レコードを生成する。
-- id は cuid ではなく gen_random_uuid() を使う（DB側にcuid生成関数がないため）。
-- TodoImage.id はアプリケーションから見て不透明な文字列IDであれば十分なため、
-- 生成方式が cuid と異なっていても問題ない（Prisma側は生成済みIDをそのまま読むだけ）。
-- order は既存 Image.order をそのまま引き継ぐ。
INSERT INTO "TodoImage" ("id", "todoId", "imageId", "order", "createdAt")
SELECT
  gen_random_uuid()::text,
  "todoId",
  "id",
  "order",
  "createdAt"
FROM "Image"
WHERE "todoId" IS NOT NULL;