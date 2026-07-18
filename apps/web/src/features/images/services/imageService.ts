import type { Prisma } from "@repo/db";
import { deleteB2Object } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";
import { ValidationError } from "@/errors/validation-error";
import {
  MAX_IMAGES_PER_TODO,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  type ImageListInput,
  type CreateImageListInput,
} from "@/features/images/schemas";

// Prisma標準の型を使う（将来Prismaが$metrics等を追加しても自動で追従する）
type TransactionClient = Prisma.TransactionClient;

// Todo単位で選択されたAlbumを、保存対象の全Imageへ一括適用するためのオプション。
// 画像ごとに異なるalbumIdを持たせる設計ではないため、この関数に閉じた単純な形にしている
// （必要になれば images 側の各要素にalbumIdを持たせる形へ拡張できる）。
// albumId: null = 未所属のまま保存（Default Album自動生成が未実装のため許可する）
// userId: albumIdの所有権検証に使う（他ユーザーのAlbum idが渡されていないか確認するため）
type ImageAlbumOptions = {
  albumId: string | null;
  userId: string;
};

/**
 * Todo作成/更新のPrismaトランザクション内から呼び出すヘルパー。
 * todoService.createTodo / updateTodo の $transaction ブロック内から呼ぶ。
 *
 * Todo-Image関係はTodoImage中間テーブル経由。
 *   - 「Todoから外す」= TodoImageのみ削除する。Image本体は削除しない。
 *   - 既存画像の並び替えはTodoImage.orderのみ更新する。
 *   - フロントの識別子は引き続きImage.id。所有権検証は
 *     「TodoImage(todoId, imageId)の存在確認」で行う。
 *
 * images の意味:
 *   undefined = 画像に関する変更なし
 *   配列      = 保存後の最終状態そのもの。配列のindexがそのままTodoImage.orderになる。
 *               既存TodoImageのうち配列に含まれないものは削除される（空配列 = 全削除）。
 *
 * 戻り値の deletedStorageKeys は常に空配列を返す（TodoImage削除はImage/B2に影響しないため）。
 *
 * Image.create と TodoImage.create は同一tx内で行う。
 * 「Imageは作成されたがTodoImageは失敗した」という中途半端な状態を防ぐため。
 */
export const applyImageChange = async (
  tx: TransactionClient,
  todoId: string,
  images: ImageListInput,
  options: ImageAlbumOptions,
): Promise<string[]> => {
  if (images === undefined) {
    return [];
  }

  if (images.length > MAX_IMAGES_PER_TODO) {
    throw new ValidationError(`添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`);
  }

  if (options.albumId !== null) {
    const album = await tx.album.findFirst({
      where: { id: options.albumId, userId: options.userId },
    });
    if (!album) {
      throw new ValidationError("不正なアルバムが指定されました");
    }
  }

  // 1. 現在のTodoImage状態を取得（imageをjoinして所有権確認・サイズ検証に使い回す）
  const existingTodoImages = await tx.todoImage.findMany({
    where: { todoId },
    include: { image: true },
  });
  const existingById = new Map(existingTodoImages.map((ti) => [ti.imageId, ti]));

  // 2. 所有権検証：existing.idが本当にこのTodoに紐づくTodoImageのimageIdか
  const existingIdsInRequest: string[] = [];
  for (const slot of images) {
    if (slot.kind === "existing") {
      if (!existingById.has(slot.id)) {
        throw new ValidationError("不正な画像が指定されました");
      }
      existingIdsInRequest.push(slot.id);
    }
  }

  if (new Set(existingIdsInRequest).size !== existingIdsInRequest.length) {
    throw new ValidationError("同じ画像が複数回指定されています");
  }

  // 3. 合計サイズ検証（残す既存 + 新規追加分）
  const totalSize = images.reduce((sum, slot) => {
    if (slot.kind === "existing") {
      return sum + (existingById.get(slot.id)?.image.fileSize ?? 0);
    }
    return sum + slot.data.fileSize;
  }, 0);
  if (totalSize > MAX_TOTAL_IMAGE_SIZE_BYTES) {
    throw new ValidationError("画像の合計サイズが上限を超えています");
  }

  // 4. 差分計算・適用
  //    削除はTodoImageのみ。Image本体・B2オブジェクトには触れない。
  const keepIds = new Set(images.filter((s) => s.kind === "existing").map((s) => s.id));
  const toDetach = existingTodoImages.filter((ti) => !keepIds.has(ti.imageId));

  if (toDetach.length > 0) {
    await tx.todoImage.deleteMany({
      where: { id: { in: toDetach.map((ti) => ti.id) } },
    });
  }

  // 最大20枚程度であり並列化の恩恵が小さいため、for...ofで順に処理する。
  for (const [index, slot] of images.entries()) {
    if (slot.kind === "existing") {
      const existingTodoImage = existingById.get(slot.id);
      if (!existingTodoImage) {
        throw new ValidationError("不正な画像が指定されました");
      }

      // 表示順はTodoImage.orderが正
      await tx.todoImage.update({
        where: { id: existingTodoImage.id },
        data: { order: index },
      });

      // albumId は Image の属性であり、TodoImage には保持しない。
      // TodoImage.order の更新とは独立して、Image 側へ反映する。
      // Album 未選択（albumId: null）の場合は Album 所属も解除される。
      // これは Phase2 から継続している仕様である。
      await tx.image.update({
        where: { id: slot.id },
        data: { albumId: options.albumId },
      });
      continue;
    }

    const image = await tx.image.create({
      data: {
        storageKey: slot.data.storageKey,
        originalFileName: slot.data.originalFileName,
        mimeType: slot.data.mimeType,
        fileSize: slot.data.fileSize,
        albumId: options.albumId,
      },
    });

    await tx.todoImage.create({
      data: { todoId, imageId: image.id, order: index },
    });
  }
  
  return [];
};

/**
 * トランザクション成功後、不要になったB2オブジェクトを削除する。
 * ここでの失敗はTodo保存自体には影響させない（ログのみ。Phase2でQStash委譲を検討）。
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
 * 削除対象は「今回新規アップロードした分」のみ。
 *
 * 引数を CreateImageListInput（kind:"new"のみを許容する型）に絞ることで、
 * 「existingは絶対に削除対象にならない」という制約をコメントだけでなく型でも表現する。
 * update失敗時であっても、ロールバックでexisting分のDB状態はそのまま残るため、
 * 呼び出し側は images のうち kind:"new" の要素だけを抽出して渡すこと。
 *
 * この時点では新規Todoの場合DBに存在しないため todoId は渡さない。
 */
export const compensateFailedUpload = async (
  images: CreateImageListInput,
  context: { correlationId: string },
): Promise<void> => {
  if (!images) {
    return;
  }

  await Promise.all(
    images.map(async (slot) => {
      try {
        await deleteB2Object(slot.data.storageKey);
      } catch (error) {
        logServiceError(error instanceof Error ? error : new Error(String(error)), {
          component: "image-cleanup",
          correlationId: context.correlationId,
          context: { storage_key: slot.data.storageKey },
        });
      }
    }),
  );
};