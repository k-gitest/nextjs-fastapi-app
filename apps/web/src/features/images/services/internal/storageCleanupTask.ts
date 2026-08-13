import { prisma } from "@/lib/prisma";
import { logServiceError } from "@/lib/server-logger";
import type { StorageCleanupReason } from "@repo/db";

/**
 * Type A: B2 PUT成功後にImage DB作成が失敗し、B2オブジェクトが孤立するケース
 * Type B: Image DB削除後にB2削除が失敗し、B2オブジェクトが残存するケース
 *
 * Type A（image_create_failed）/ Type B（b2_delete_failed）共通の
 * GC対象タスク登録処理。
 *
 * 同一storageKeyへの再失敗はUPSERTで1レコードのライフサイクルとして扱う
 * （retryCountをインクリメント）。
 *
 * statusは常にpendingを明示する。同じstorageKeyについて新たな失敗が発生した場合は、
 * 既存タスクがprocessing中であってもpendingへ戻し、WorkerによるB2削除の
 * 再試行対象とする。
 *
 * ここでの失敗（UPSERT自体の失敗）はログのみに留める。呼び出し元には
 * 伝播させない（既にSentryには元の失敗（B2削除失敗 or Image作成失敗）が
 * 記録済みのため、運用上はそちらで気づける）。
 */
export const registerStorageCleanupTask = async (params: {
  storageKey: string;
  reason: StorageCleanupReason;
  error: unknown;
  correlationId: string;
}): Promise<void> => {
  const errorMessage = params.error instanceof Error ? params.error.message : String(params.error);

  try {
    await prisma.storageCleanupTask.upsert({
      where: { storageKey: params.storageKey },
      create: {
        storageKey: params.storageKey,
        reason: params.reason,
        status: "pending",
        lastError: errorMessage,
        lastAttemptAt: new Date(),
      },
      update: {
        status: "pending",
        retryCount: { increment: 1 },
        lastError: errorMessage,
        lastAttemptAt: new Date(),
      },
    });
  } catch (upsertError) {
    logServiceError(
      upsertError instanceof Error ? upsertError : new Error(String(upsertError)),
      {
        component: "storage-cleanup-task-upsert",
        correlationId: params.correlationId,
        context: { b2_object_path: params.storageKey, reason: params.reason },
      },
    );
  }
};