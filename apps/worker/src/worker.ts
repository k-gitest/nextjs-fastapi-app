import { PrismaClient, type outbox_events } from '@prisma/client';
import { processEvent } from './processor';
import { logger } from './utils/logger';

const MAX_RETRIES = 5;
const BATCH_SIZE = 10;

// raw queryの結果を定義（Prismaが生成したモデル型を再利用）
type OutboxEvent = outbox_events;

export async function startWorkerLoop(prisma: PrismaClient): Promise<void> {
  while (true) {
    const events = await prisma.$queryRaw<OutboxEvent[]>`
      UPDATE outbox_events
      SET status = 'processing', locked_at = NOW()
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE status IN ('pending', 'retrying')
          AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '2 minutes')
          AND next_retry_at <= NOW()
        ORDER BY created_at ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    if (events.length === 0) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    // aggregate_id の順序逆転を防ぐため、安全側に倒して直列処理(for...of)
    for (const event of events) {
      try {
        await processEvent(event);

        await prisma.outbox_events.update({
          where: { id: event.id },
          data: { status: 'sent', processed_at: new Date(), locked_at: null }
        });

        logger.info('Outbox event sent successfully', {
          eventId: event.id,
          eventType: event.event_type,
          version: event.event_version // バージョンもログに残す
        });

      } catch (err: unknown) {
        const isFailed = event.retry_count >= MAX_RETRIES;
        // 修正: err.message だけでなく err.stack を取得して詳細な原因を追えるようにする
        // エラー詳細の抽出を型安全に行う
        const errorDetail = err instanceof Error 
          ? (err.stack || err.message) 
          : String(err);

        const errorMessage = err instanceof Error ? err.message : String(err);

        if (isFailed) {
          await prisma.outbox_events.update({
            where: { id: event.id },
            data: { status: 'failed', locked_at: null, last_error: errorDetail }
          });
          logger.error('Outbox event FAILED (DLQ)', {
            eventId: event.id, eventType: event.event_type, error: errorDetail
          });
        } else {
          const baseDelay = Math.pow(2, event.retry_count) * 1000;
          const jitter = Math.random() * 1000;
          const nextRetry = new Date(Date.now() + baseDelay + jitter);

          await prisma.outbox_events.update({
            where: { id: event.id },
            data: {
              status: 'retrying',
              locked_at: null,
              retry_count: { increment: 1 },
              last_error: errorDetail,
              next_retry_at: nextRetry
            }
          });
          logger.warn('Outbox event retrying', {
            eventId: event.id, retryCount: event.retry_count + 1, error: errorMessage
          });
        }
      }
    }
  }
}