/*
  Warnings:

  - You are about to drop the column `order` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `todoId` on the `Image` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Image" DROP CONSTRAINT "Image_todoId_fkey";

-- DropIndex
DROP INDEX "Image_todoId_order_idx";

-- AlterTable
ALTER TABLE "Image" DROP COLUMN "order",
DROP COLUMN "todoId";
