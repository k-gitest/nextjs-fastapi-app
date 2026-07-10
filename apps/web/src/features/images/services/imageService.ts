import type { Prisma } from "@repo/db";
import { deleteB2Object } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";
import type { ImageInput } from "@/features/images/schemas";

// Prisma標準の型を使う（将来Prismaが$metrics等を追加しても自動で追従する）
type TransactionClient = Prisma.TransactionClient;

/**
 * Todo作成/更新のPrismaトランザクション内から呼び出すヘルパー。
 * todoService.createTodo / updateTodo の $transaction ブロック内から呼ぶ。
 *
 * image の意味:
 *   undefined = 画像に関する変更なし（呼び出し不要だが、呼ばれても何もしない）
 *   null      = 既存の添付を削除するのみ
 *   object    = 新規添付、または既存があれば差し替え
 *
 * 戻り値の deletedStorageKeys は、トランザクション成功後に
 * 呼び出し側でB2から実削除する対象キー（差し替え・削除で不要になった旧ファイル）。
 */
export const applyImageChange = async (
  tx: TransactionClient,
  todoId: string,
  image: ImageInput,
): Promise<string[]> => {
  if (image === undefined) {
    return [];
  }

  // Image.todoId には @@unique 制約があるため findUnique で1件に絞れる
  const existing = await tx.image.findUnique({ where: { todoId } });
  const deletedStorageKeys: string[] = [];

  if (existing) {
    await tx.image.delete({ where: { id: existing.id } });
    deletedStorageKeys.push(existing.storageKey);
  }

  if (image !== null) {
    await tx.image.create({
      data: {
        todoId,
        storageKey: image.storageKey,
        originalFileName: image.originalFileName,
        mimeType: image.mimeType,
        fileSize: image.fileSize,
      },
    });
  }

  return deletedStorageKeys;
};

/**
 * トランザクション成功後、不要になったB2オブジェクトを削除する。
 * ここでの失敗はTodo保存自体には影響させない（ログのみ。Phase2でQStash委譲を検討）。
 *
 */
export const cleanupDeletedStorageKeys = async (
  storageKeys: string[],
  context: { correlationId: string; todoId?: string },
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
          },
        });
      }
    }),
  );
};

/**
 * Todo保存トランザクションが失敗した場合の補償処理。
 * 新規アップロード分のみを削除する（差し替え対象だった旧画像はロールバックで元に戻るため触らない）。
 * この時点ではTodoがDBに存在しないため todoId は渡さない。
 */
export const compensateFailedUpload = async (
  image: ImageInput,
  context: { correlationId: string },
): Promise<void> => {
  if (!image) {
    return;
  }

  try {
    await deleteB2Object(image.storageKey);
  } catch (error) {
    logServiceError(error instanceof Error ? error : new Error(String(error)), {
      component: "image-cleanup",
      correlationId: context.correlationId,
      context: { storage_key: image.storageKey },
    });
  }
};