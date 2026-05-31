import { PrismaClient } from "@repo/db";

export async function recoverStaleEvents(
  prisma: PrismaClient,
): Promise<number> {
  return await prisma.$executeRaw`
    UPDATE outbox_events
    SET locked_at = NULL,
        updated_at = NOW(),
        status = CASE
                   WHEN retry_count > 0 THEN 'retrying'::"OutboxStatus"
                   ELSE 'pending'::"OutboxStatus"
                 END
    WHERE status = 'processing'
      AND locked_at < NOW() - INTERVAL '2 minutes'
  `;
}