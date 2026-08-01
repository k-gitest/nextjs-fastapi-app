import { PrismaClient, type StorageCleanupTask } from "@repo/db";
import { deleteB2Object } from "./lib/b2";
import { logger } from "./utils/logger";
import { STORAGE_CLEANUP_MAX_RETRIES } from "./config";
import * as Sentry from "@sentry/node";

const CLAIM_BATCH_SIZE = 10;
// 指数バックオフ + ジッター（Outboxの考え方を踏襲するが、
// StorageCleanupは単純な外部I/O再試行のため独自の定数を持つ）
const BASE_DELAY_MS = 5_000; // 初回リトライ: 5秒
const MAX_DELAY_MS = 10 * 60 * 1000; // 上限: 10分

/**
 * StorageCleanupTaskの原子的claim。
 *
 * 既存Outbox Worker（worker.ts pollOnce相当）と同じ
 * `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING ...`
 * パターンを踏襲する。findFirst/findMany + updateMany のような非原子的な
 * claimでは複数Workerインスタンス間の二重処理を防げないため、$queryRawで
 * 実装する（プロジェクト全体では$queryRaw回避が原則だが、Outbox Workerでも
 * 並行制御が必要な箇所でのみ例外的に採用されている前例に倣う）。
 *
 * Worker（定期実行）専用。apps/web/scripts/storageCleanup.tsの--runは
 * このclaimロジックを使わない独立した実装のため、Worker稼働中は
 * 通常使用しない運用ルールとする（詳細はstorageCleanup.tsのコメント参照）。
 *
 * ロック期限（5分）はワーカーのstale lock回収のため。既存worker.tsの
 * stale lock観測クエリと同じくリテラルのINTERVALで固定する（$queryRawの
 * タグ付きテンプレートはINTERVAL句内の変数展開に対応しないため）。
 */
export async function claimStorageCleanupTasks(
  prisma: PrismaClient,
): Promise<StorageCleanupTask[]> {
  return prisma.$queryRaw<StorageCleanupTask[]>`
    UPDATE "StorageCleanupTask"
    SET status = 'processing',
        "lockedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "StorageCleanupTask"
      WHERE status = 'pending'
        AND "nextRetryAt" <= NOW()
        AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '5 minutes')
      ORDER BY "createdAt" ASC
      LIMIT ${CLAIM_BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      id,
      "storageKey",
      reason,
      status,
      "retryCount",
      "nextRetryAt",
      "lockedAt",
      "lastError",
      "createdAt",
      "lastAttemptAt",
      "resolvedAt"
  `;
}

/**
 * claimしたタスク1件分の処理（B2削除リトライ）。
 *
 * 失敗時のリトライ方針（Outboxより簡略化）:
 *   指数バックオフでnextRetryAtを更新する点はOutboxと同様だが、
 *   PermanentError/TransientErrorの区分・DLQ相当の仕組みは導入しない
 *   （B2 DeleteObjectは単純な外部I/Oであり、エラー種別による分岐の必要性が低いため）。
 *   retryCountがSTORAGE_CLEANUP_MAX_RETRIESに達したらfailedへ遷移し、Sentryで通知する
 *   （failed = 自動リトライ上限に達し、Workerの自動処理対象から外れた状態。
 *    以降は手動調査・手動再実行の対象になる）。
 */
export async function processStorageCleanupTask(
  prisma: PrismaClient,
  task: StorageCleanupTask,
): Promise<void> {
  try {
    await deleteB2Object(task.storageKey);
    await prisma.storageCleanupTask.update({
      where: { id: task.id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        lastAttemptAt: new Date(),
        lockedAt: null,
      },
    });
    logger.info("storage_cleanup_resolved", {
      storage_cleanup_task_id: task.id,
      reason: task.reason,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const nextRetryCount = task.retryCount + 1;
    const exceededMaxRetries = nextRetryCount >= STORAGE_CLEANUP_MAX_RETRIES;

    if (exceededMaxRetries) {
      await prisma.storageCleanupTask.update({
        where: { id: task.id },
        data: {
          status: "failed",
          retryCount: { increment: 1 },
          lastError: errorMessage,
          lastAttemptAt: new Date(),
          lockedAt: null,
        },
      });

      logger.error("storage_cleanup_failed_max_retries", {
        storage_cleanup_task_id: task.id,
        reason: task.reason,
        retry_count: nextRetryCount,
        error: errorMessage,
      });

      Sentry.withScope((scope) => {
        scope.setTag("component", "storage-cleanup-worker");
        scope.setTag("storage_cleanup_reason", task.reason);
        scope.setLevel("error");
        scope.setContext("storage_cleanup_task", {
          id: task.id,
          b2_object_path: task.storageKey,
          retry_count: nextRetryCount,
        });
        Sentry.captureMessage(
          `[Error] StorageCleanupTask exceeded max retries: ${task.id}`,
        );
      });
    } else {
      const baseDelay = Math.min(
        Math.pow(2, task.retryCount) * BASE_DELAY_MS,
        MAX_DELAY_MS,
      );
      const jitter = Math.random() * 1000;
      const nextRetryAt = new Date(Date.now() + baseDelay + jitter);

      await prisma.storageCleanupTask.update({
        where: { id: task.id },
        data: {
          status: "pending",
          retryCount: { increment: 1 },
          lastError: errorMessage,
          lastAttemptAt: new Date(),
          nextRetryAt,
          lockedAt: null,
        },
      });

      logger.warn("storage_cleanup_retry_scheduled", {
        storage_cleanup_task_id: task.id,
        reason: task.reason,
        retry_count: nextRetryCount,
        next_retry_at: nextRetryAt.toISOString(),
        error: errorMessage,
      });
    }
  }
}

export async function runStorageCleanupOnce(prisma: PrismaClient): Promise<void> {
  const tasks = await claimStorageCleanupTasks(prisma);

  if (tasks.length === 0) {
    logger.info("storage_cleanup_no_pending_tasks");
    return;
  }

  for (const task of tasks) {
    await processStorageCleanupTask(prisma, task);
  }
}