import { PrismaClient, type outbox_events } from "@repo/db";
import { processEvent, PermanentError, TransientError } from "./processor";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";

const MAX_RETRIES = 8; // 再試行回数（初回除く）= 合計9回試行
const BATCH_SIZE = 10;
// 指数バックオフ + ジッター
const BASE_DELAY_MS = 5_000; // 初回リトライ: 5秒
const MAX_DELAY_MS = 10 * 60 * 1000; // 上限: 10分

// $queryRaw の戻り値には Prisma 生成型を使う
// 注意: $queryRaw はコンパイル時の型安全性しか提供しない（実行時検証なし）
// DBスキーマと型定義が乖離した場合はランタイムエラーになるため、
// スキーマ変更時は必ず再 generate すること
type OutboxEvent = outbox_events;

// stale lock 観測用の型（SELECT結果のみ）
type StaleEventRow = {
  id: string;
  event_type: string;
  locked_at: Date;
};

export async function startWorkerLoop(
  prisma: PrismaClient,
  signal: AbortSignal,
): Promise<void> {
  // stale lock は「2分経過後に発生」する異常なので毎秒チェックは不要
  // 1分間隔で間引くことで Postgres への無駄なクエリを避ける
  let lastStaleCheck = 0;

  while (!signal.aborted) {
    const now = Date.now();

    // ① stale lock の観測（loggingのみ・整合性はUPDATE側が保証）
    // 対象: processing のまま残っているイベント
    // - index.ts の起動時 sweep が pending/retrying に戻すが、
    //   Worker 稼働中の hang（processEvent timeout 等）はここで検出する
    // - stale lock は「2分経過後に発生」する異常なので毎秒チェックは不要
    // - SELECT と UPDATE の間でズレる可能性はあるが、
    //   logging 目的なので許容範囲（整合性は FOR UPDATE SKIP LOCKED が保証）
    if (now - lastStaleCheck > 60_000) {
      lastStaleCheck = now;

      const staleEvents = await prisma.$queryRaw<StaleEventRow[]>`
        SELECT id, event_type, locked_at
        FROM outbox_events
        WHERE status = 'processing'
          AND locked_at IS NOT NULL
          AND locked_at < NOW() - INTERVAL '2 minutes'
      `;

      if (staleEvents.length > 0) {
        logger.warn("Detected stale locked events", {
          count: staleEvents.length,
          events: staleEvents.map((e) => ({
            eventId: e.id,
            eventType: e.event_type,
            lockedAt: e.locked_at.toISOString(),
          })),
        });
      }
    }

    // ② 通常のポーリング：pending / retrying を取得してロック
    const events = await prisma.$queryRaw<OutboxEvent[]>`
      UPDATE outbox_events
      SET status = 'processing', locked_at = NOW()
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE status IN ('pending', 'retrying')
          AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '2 minutes')
          AND (
            next_retry_at IS NULL        -- pending の初回
            OR next_retry_at <= NOW()    -- retrying のバックオフ経過後
          )
        ORDER BY created_at ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    if (events.length === 0) {
      // 固定1秒より、次のretrying イベントまでの時間を待つ方が効率的だが
      // 実装が複雑になるため、現状は固定1秒で許容範囲
      await new Promise<void>((r) => setTimeout(r, 1000));
      continue;
    }

    // aggregate_id 単位の順序保証のため直列処理
    // 複数 Worker Pod がある場合の完全な順序保証は
    // pg_advisory_lock(hashtext(aggregate_id)) の導入を検討すること
    for (const event of events) {
      if (signal.aborted) break; // シャットダウン中は新規処理を開始しない

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
        const isPermanent = err instanceof PermanentError;
        const isTransient = err instanceof TransientError;
        const attempts = event.retry_count + 1; // 総試行回数（ログ用）
        // UNKNOWN/TransientErrorはリトライ対象。MAX_RETRIES到達でDLQ
        const shouldMoveToDLQ = isPermanent || event.retry_count >= MAX_RETRIES;

        // unknown から安全に文字列を取り出す
        const errorDetail =
          err instanceof Error
            ? (err.stack ?? err.message).slice(0, 2000)
            : String(err).slice(0, 2000);
        const errorMessage = err instanceof Error ? err.message : String(err);
        // エラー種別（ログ・デバッグ用）
        const errorType = isPermanent
          ? "PERMANENT"
          : isTransient
            ? "TRANSIENT"
            : "UNKNOWN";

        if (shouldMoveToDLQ) {
          Sentry.withScope((scope) => {
            scope.setTag("event_id", event.id);
            scope.setTag("event_type", event.event_type);
            scope.setTag("error_type", errorType);
            Sentry.captureException(err);
          });

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
            retryCount: event.retry_count,
            attempts,
            errorType,
            error: errorDetail,
          });
        } else {
          // 指数バックオフ + ジッター
          const baseDelay = Math.min(
            Math.pow(2, event.retry_count) * BASE_DELAY_MS,
            MAX_DELAY_MS, // 上限キャップ
          );
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
            attempts,
            errorType,
            error: errorMessage,
          });
        }
      }
    }
  }
  logger.info("Worker loop exited gracefully.");
}