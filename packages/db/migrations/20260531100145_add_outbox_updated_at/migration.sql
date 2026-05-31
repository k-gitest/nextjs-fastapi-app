-- DropIndex
DROP INDEX "outbox_events_next_retry_at_created_at_idx";

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "outbox_events_status_locked_at_next_retry_at_created_at_idx" ON "outbox_events"("status", "locked_at", "next_retry_at", "created_at");
