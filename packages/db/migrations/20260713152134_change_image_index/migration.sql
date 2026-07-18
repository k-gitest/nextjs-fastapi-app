-- DropIndex
DROP INDEX "Image_todoId_key";

-- CreateIndex
CREATE INDEX "Image_todoId_order_idx" ON "Image"("todoId", "order");
