import { PrismaClient, type outbox_events } from '@prisma/client';
import { processEvent } from './processor';
import { logger } from './utils/logger';

const MAX_RETRIES = 5;
const BATCH_SIZE = 10;

// $queryRaw の戻り値には Prisma 生成型を使う
// 注意: $queryRaw はコンパイル時の型安全性しか提供しない（実行時検証なし）
// DBスキーマと型定義が乖離した場合はランタイムエラーになるため、
// スキーマ変更時は必ず再 generate すること
type OutboxEvent = outbox_events;

export async function startWorkerLoop(prisma: PrismaClient): Promise<void> {
  // グレースフルシャットダウン用フラグ
  let isShuttingDown = false;

  const shutdown = (): void => {
    logger.info("Shutdown signal received. Finishing current batch...");
    isShuttingDown = true;
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  while (isShuttingDown) {
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
      await new Promise<void>((r) => setTimeout(r, 1000));
      continue;
    }

    // aggregate_id 単位の順序保証のため直列処理
    // 複数 Worker Pod がある場合の完全な順序保証は
    // pg_advisory_lock(hashtext(aggregate_id)) の導入を検討すること
    for (const event of events) {
      if (isShuttingDown) break; // シャットダウン中は新規処理を開始しない

      try {
        await processEvent(event);

        await prisma.outbox_events.update({
          where: { id: event.id },
          data: {
            status: "sent",
            processed_at: new Date(),
            locked_at: null,
          },
        });

        logger.info("Outbox event sent successfully", {
          eventId: event.id,
          eventType: event.event_type,
          version: event.event_version,
        });

      } catch (err: unknown) {
        const isFailed = event.retry_count >= MAX_RETRIES;

        // unknown から安全に文字列を取り出す
        const errorDetail =
          err instanceof Error ? (err.stack ?? err.message) : String(err);
        const errorMessage =
          err instanceof Error ? err.message : String(err);

        if (isFailed) {
          await prisma.outbox_events.update({
            where: { id: event.id },
            data: {
              status: "failed",
              locked_at: null,
              last_error: errorDetail,
            },
          });

          logger.error("Outbox event FAILED (DLQ)", {
            eventId: event.id,
            eventType: event.event_type,
            error: errorDetail,
          });

        } else {
          // 指数バックオフ + ジッター
          const baseDelay = Math.pow(2, event.retry_count) * 1000;
          const jitter = Math.random() * 1000;
          const nextRetry = new Date(Date.now() + baseDelay + jitter);

          await prisma.outbox_events.update({
            where: { id: event.id },
            data: {
              status: "retrying",
              locked_at: null,
              retry_count: { increment: 1 },
              last_error: errorDetail,
              next_retry_at: nextRetry,
            },
          });

          logger.warn("Outbox event retrying", {
            eventId: event.id,
            retryCount: event.retry_count + 1,
            nextRetry: nextRetry.toISOString(),
            error: errorMessage,
          });
        }
      }
    }
  }
  logger.info("Worker loop exited gracefully.");
}