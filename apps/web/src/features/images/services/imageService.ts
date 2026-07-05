import type { Prisma } from "@repo/db";
import { deleteB2Object } from "@/lib/b2";
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
 * TODO: errors/sentry-logger.ts のAPIを確認した上で、console.errorではなく
 * 共通のログ基盤経由でSentryへ送るように寄せる（現状は実ファイル未確認のため保留）。
 */
export const cleanupDeletedStorageKeys = async (storageKeys: string[]): Promise<void> => {
  await Promise.all(
    storageKeys.map(async (key) => {
      try {
        await deleteB2Object(key);
      } catch (error) {
        console.error("b2_object_delete_failed", { storageKey: key, error });
      }
    }),
  );
};

/**
 * Todo保存トランザクションが失敗した場合の補償処理。
 * 新規アップロード分（今回attachしようとしていたstorageKey）をB2から削除する。
 * 差し替え対象だった「旧画像」はトランザクションがロールバックされ元のまま残るため、
 * ここで削除してはいけない。
 */
export const compensateFailedUpload = async (image: ImageInput): Promise<void> => {
  if (!image) {
    return; // undefined（変更なし） or null（削除のみ）は補償不要
  }

  try {
    await deleteB2Object(image.storageKey);
  } catch (error) {
    console.error("compensating_b2_delete_failed", { storageKey: image.storageKey, error });
  }
};