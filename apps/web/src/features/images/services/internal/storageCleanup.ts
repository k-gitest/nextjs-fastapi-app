import { deleteB2Object } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";
import { registerStorageCleanupTask } from "@/features/images/services/internal/storageCleanupTask";

/**
 * B2オブジェクト削除の内部インフラユーティリティ。
 *
 * ImageドメインロジックではなくB2（Backblaze）インフラ処理であるため、
 * imageService.ts固有ではなくfeatures/images/services/internal/に配置し、
 * imageService.ts・albumService.tsの両方から共有する。
 *
 * ここでの失敗はTransaction/Commit自体には影響させない（ログ+Sentryのみ、
 * 例外を上に伝播させない）。B2削除の補償・GCは別途スケジュールされた仕組みの責務。
 *
 * B2削除失敗時、Sentry記録に加えてStorageCleanupTaskへ登録する
 * （Type B: reason="b2_delete_failed"）。登録されたpendingレコードは、
 * Worker（apps/worker/storageCleanupWorkerService.ts）が定期ポーリングで
 * 再削除を試みる。
 */
export const cleanupDeletedStorageKeys = async (
  storageKeys: string[],
  context: { correlationId: string; todoId?: string; albumId?: string },
): Promise<void> => {
  await Promise.all(
    storageKeys.map(async (key) => {
      try {
        await deleteB2Object(key);
      } catch (error) {
        logServiceError(error instanceof Error ? error : new Error(String(error)), {
          component: "image-cleanup",
          correlationId: context.correlationId,
          context: {
            // "key" を含む名前だとSentryのデータスクラビングでマスキングされるため
            // b2_object_path で統一する（image-create側と同じ対応）
            b2_object_path: key,
            ...(context.todoId ? { todo_id: context.todoId } : {}),
            ...(context.albumId ? { album_id: context.albumId } : {}),
          },
        });

        await registerStorageCleanupTask({
          storageKey: key,
          reason: "b2_delete_failed",
          error,
          correlationId: context.correlationId,
        });
      }
    }),
  );
};