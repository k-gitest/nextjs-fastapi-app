import { PrismaClient, Prisma, type outbox_events } from "@repo/db";
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

/**
 * 所有権を確認したうえで状態を更新する。
 *
 * claim 後に回収（pending / retrying へ戻される）や再 claim が起きていると、
 * locked_at が一致せず、更新は0件になる。その場合は、新しい所有者の状態を
 * 上書きしないよう何もしない。例外は投げない（ループを止めないため）。
 * 生SQLではないので、updated_at は @updatedAt で自動更新される。
 */
async function updateIfOwner(
  prisma: PrismaClient,
  event: OutboxEvent,
  lockToken: Date,
  data: Prisma.outbox_eventsUpdateManyMutationInput,
): Promise<boolean> {
  const { count } = await prisma.outbox_events.updateMany({
    where: { id: event.id, status: "processing", locked_at: lockToken },
    data,
  });
  if (count === 0) {
    logger.warn("Outbox event update skipped: ownership lost", {
      eventId: event.id,
      eventType: event.event_type,
    });
  }
  return count > 0;
}

/**
 * shutdown 時に、claim 済みだが処理を始めていないイベントを元の状態へ戻す。
 *
 * 一括 claim したイベントのうち、処理に着手する前に停止要求を受けたものは
 * processing のまま残り、次の起動時の回収まで再処理されない。
 * 未着手のイベントの locked_at は claim 時の値のままなので、それを条件にして、
 * すでに回収・再 claim されたイベントを巻き戻さない。
 * 失敗しても例外は投げない（shutdown を止めない）。残った行は、起動時の回収で戻る。
 */
async function releaseUnstartedEvents(
  prisma: PrismaClient,
  events: OutboxEvent[],
): Promise<void> {
  const claims = events.flatMap((e) =>
    e.locked_at ? [{ id: e.id, lockedAt: e.locked_at.toISOString() }] : [],
  );
  if (claims.length === 0) return;

  try {
    const released = await prisma.$executeRaw`
      UPDATE outbox_events AS o
      SET status = CASE
                     WHEN o.retry_count > 0 THEN 'retrying'::"OutboxStatus"
                     ELSE 'pending'::"OutboxStatus"
                   END,
          locked_at = NULL,
          updated_at = NOW()
      FROM unnest(
        ${claims.map((c) => c.id)}::uuid[],
        ${claims.map((c) => c.lockedAt)}::timestamptz[]
      ) AS t(id, locked_at)
      WHERE o.id = t.id
        AND o.status = 'processing'
        AND o.locked_at = t.locked_at
    `;
    logger.info("Released unstarted claimed events on shutdown", {
      requested: claims.length,
      released,
    });
  } catch (err: unknown) {
    logger.error("Failed to release unstarted claimed events on shutdown", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

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
    // RETURNING列を明示しているため、実際の返却値は outbox_events の部分集合。
    // 型は outbox_events のままだが、status/locked_at等は取得していない点に注意。
    // （RETURNING句の列と型定義が完全には一致しない）。
    const events = await prisma.$queryRaw<OutboxEvent[]>`
      UPDATE outbox_events
      SET status = 'processing', 
        locked_at = date_trunc('milliseconds', NOW()),
        updated_at = NOW()
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
      RETURNING
        id,
        event_type,
        event_version,
        payload,
        retry_count,
        idempotency_key,
        aggregate_id,
        created_at,
        locked_at
    `;

    if (events.length === 0) {
      // 固定1秒より、次のretrying イベントまでの時間を待つ方が効率的だが
      // 実装が複雑になるため、現状は固定1秒で許容範囲
      await new Promise<void>((r) => setTimeout(r, 1000));
      continue;
    }

    // UPDATE ... RETURNING は、サブクエリの ORDER BY の順で返す保証がない
    // （PostgreSQL は RETURNING の行の順序を規定していない）。
    // aggregate_id 内の処理順を保つため、処理の前に created_at の昇順へ並べ直す。
    events.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

    // aggregate_id 単位の順序保証のため直列処理
    // 複数 Worker Pod がある場合の完全な順序保証はpg_advisory_lock(hashtext(aggregate_id)) の導入を検討すること
    // events.entries() は、noUncheckedIndexedAccess でも undefined を含まない
    for (const [index, event] of events.entries()) {
      if (signal.aborted) {
        // シャットダウン中は新規処理を開始しない。未着手の claim 分は元に戻す
        await releaseUnstartedEvents(prisma, events.slice(index));
        break;
      }

      const claimedAt = event.locked_at;
      if (!claimedAt) {
        // claim の RETURNING に含まれるため通常は到達しない。放置しても stale 回収の対象になる
        logger.error("Claimed outbox event has no locked_at", { eventId: event.id });
        continue;
      }

      // 処理の直前に locked_at を更新する。
      // 一括 claim では、後続のイベントの locked_at が先行イベントの処理中に古くなるため、
      // 実際に処理を始める時点を基準にし直す。あわせて所有権を確認する:
      // 0件なら、claim 後に回収または再 claim されているため、この Worker は処理しない。
      // 返された locked_at は、以後の更新で所有権を示す値になる。
      const started = await prisma.$queryRaw<{ locked_at: Date }[]>`
        UPDATE outbox_events
        SET locked_at = date_trunc('milliseconds', NOW()),
            updated_at = NOW()
        WHERE id = ${event.id}::uuid
          AND status = 'processing'
          AND locked_at = ${claimedAt.toISOString()}::timestamptz
        RETURNING locked_at
      `;
      const [startedRow] = started;
      if (!startedRow) {
        logger.info("Outbox event skipped: ownership lost before processing", {
          eventId: event.id,
          eventType: event.event_type,
        });
        continue;
      }
      const lockToken = startedRow.locked_at;

      // 所有権の更新を待つ間に停止要求を受けた場合は、処理を始めずに解放する。
      // 現在のイベントは locked_at が更新済みなので、更新後の値で解放する。
      if (signal.aborted) {
        await releaseUnstartedEvents(prisma, [
          { ...event, locked_at: lockToken },
          ...events.slice(index + 1),
        ]);
        break;
      }

      // correlationIdの安全な取り出し
      const correlationId =
        typeof event.payload === "object" &&
          event.payload !== null &&
          "correlation_id" in event.payload
          ? String((event.payload as Record<string, unknown>).correlation_id)
          : undefined;

      try {
        await processEvent(event);

        const updated = await updateIfOwner(prisma, event, lockToken, {
          status: "sent",
          processed_at: new Date(),
          locked_at: null,
        });
        if (updated) {
          logger.info("Outbox event sent successfully", {
            eventId: event.id,
            eventType: event.event_type,
            version: event.event_version,
            correlation_id: correlationId,
          });
        }
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
            scope.setTag("outbox_event_id", event.id);
            scope.setTag("error_type", errorType);
            if (correlationId) {
              scope.setContext("correlation", { correlation_id: correlationId });
            }
            Sentry.captureException(err);
          });

          const updated = await updateIfOwner(prisma, event, lockToken, {
            status: "failed",
            locked_at: null,
            last_error: errorDetail,
          });

          if (updated) {
            logger.error("Outbox event FAILED (DLQ)", {
              eventId: event.id,
              eventType: event.event_type,
              retryCount: event.retry_count,
              attempts,
              errorType,
              error: errorDetail,
              correlation_id: correlationId,
            });
          }
        } else {
          // 指数バックオフ + ジッター
          const baseDelay = Math.min(
            Math.pow(2, event.retry_count) * BASE_DELAY_MS,
            MAX_DELAY_MS, // 上限キャップ
          );
          const jitter = Math.random() * 1000;
          const nextRetry = new Date(Date.now() + baseDelay + jitter);

          const updated = await updateIfOwner(prisma, event, lockToken, {
            status: "retrying",
            locked_at: null,
            retry_count: { increment: 1 },
            last_error: errorDetail,
            next_retry_at: nextRetry,
          });

          if (updated) {
            logger.warn("Outbox event retrying", {
              eventId: event.id,
              retryCount: event.retry_count + 1,
              nextRetry: nextRetry.toISOString(),
              attempts,
              errorType,
              error: errorMessage,
              correlation_id: correlationId,
            });
          }
        }
      }
    }
  }
  logger.info("Worker loop exited gracefully.");
}