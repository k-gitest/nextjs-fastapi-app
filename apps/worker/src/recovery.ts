import { PrismaClient } from "@repo/db";

export type RecoveredEvent = {
  id: string;
  event_type: string;
  stale_locked_at: Date;
};

/**
 * processing のまま locked_at が2分より前のイベントを pending / retrying に戻し、
 * 戻したイベントを返す。retry_count は変更しない。
 *
 * 戻す前の locked_at は、UPDATE 後には NULL になるため、RETURNING では取れない。
 * 副問い合わせで先に取得し、行をロックしたまま更新する。
 */
export async function recoverStaleEventsWithDetails(
  prisma: PrismaClient,
): Promise<RecoveredEvent[]> {
  return await prisma.$queryRaw<RecoveredEvent[]>`
    UPDATE outbox_events AS o
    SET locked_at = NULL,
        updated_at = NOW(),
        status = CASE
                   WHEN o.retry_count > 0 THEN 'retrying'::"OutboxStatus"
                   ELSE 'pending'::"OutboxStatus"
                 END
    FROM (
      SELECT id, locked_at AS stale_locked_at
      FROM outbox_events
      WHERE status = 'processing'
        AND locked_at < NOW() - INTERVAL '2 minutes'
      FOR UPDATE
    ) AS s
    WHERE o.id = s.id
    RETURNING o.id, o.event_type, s.stale_locked_at
  `;
}

export async function recoverStaleEvents(prisma: PrismaClient): Promise<number> {
  return (await recoverStaleEventsWithDetails(prisma)).length;
}