import { deleteB2Object } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";

/**
 * B2オブジェクト削除の内部インフラユーティリティ。
 *
 * ImageドメインロジックではなくB2（Backblaze）インフラ処理であるため、
 * imageService.ts固有ではなくfeatures/images/services/internal/に配置し、
 * imageService.ts・albumService.tsの両方から共有する。
 *
 * ここでの失敗はTransaction/Commit自体には影響させない（ログ+Sentryのみ、
 * 例外を上に伝播させない）。B2削除の補償・GCは別途スケジュールされた仕組みの責務。
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
            storage_key: key,
            ...(context.todoId ? { todo_id: context.todoId } : {}),
            ...(context.albumId ? { album_id: context.albumId } : {}),
          },
        });
      }
    }),
  );
};