import { prisma } from "@/lib/prisma";
import type { Prisma } from "@repo/db";
import { logServiceError } from "@/lib/server-logger";
import { deleteB2Object } from "@/lib/b2";
import { ValidationError } from "@/errors/validation-error";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { cleanupDeletedStorageKeys } from "@/features/images/services/internal/storageCleanup";
import {
  MAX_IMAGES_PER_TODO,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  type ImageListInput,
  type CreateImageListInput,
} from "@/features/images/schemas";

type TransactionClient = Prisma.TransactionClient;

type ImageAlbumOptions = {
  albumId: string | null;
  userId: string;
};

/**
 * Todo作成/更新のPrismaトランザクション内から呼び出すヘルパー。
 * todoService.createTodo / updateTodo の $transaction ブロック内から呼ぶ。
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

  const existingTodoImages = await tx.todoImage.findMany({
    where: { todoId },
    include: { image: true },
  });
  const existingById = new Map(existingTodoImages.map((ti) => [ti.imageId, ti]));

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

  const totalSize = images.reduce((sum, slot) => {
    if (slot.kind === "existing") {
      return sum + (existingById.get(slot.id)?.image.fileSize ?? 0);
    }
    return sum + slot.data.fileSize;
  }, 0);
  if (totalSize > MAX_TOTAL_IMAGE_SIZE_BYTES) {
    throw new ValidationError("画像の合計サイズが上限を超えています");
  }

  const keepIds = new Set(images.filter((s) => s.kind === "existing").map((s) => s.id));
  const toDetach = existingTodoImages.filter((ti) => !keepIds.has(ti.imageId));

  if (toDetach.length > 0) {
    await tx.todoImage.deleteMany({
      where: { id: { in: toDetach.map((ti) => ti.id) } },
    });
  }

  for (const [index, slot] of images.entries()) {
    if (slot.kind === "existing") {
      const existingTodoImage = existingById.get(slot.id);
      if (!existingTodoImage) {
        throw new ValidationError("不正な画像が指定されました");
      }

      await tx.todoImage.update({
        where: { id: existingTodoImage.id },
        data: { order: index },
      });

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
 * 実体は internal/storageCleanup.ts に移設した。
 * ここでは既存呼び出し元（todoService.ts）との互換のため import して使い回す。
 */
// NOTE: cleanupDeletedStorageKeys の実体定義はここにはない。
// todoService.ts は features/images/services/internal/storageCleanup から
// 直接importする形に変更済み（re-exportはしない）。

/**
 * Todo保存トランザクションが失敗した場合の補償処理。
 * （Phase2実装。今回のPRではスコープ外のため変更なし）
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

/**
 * Image単体削除。Album画面（画像管理機能）から呼ばれる。
 *
 * 責務分担:
 *   deleteImageInTransaction() - ドメインルール・所有権検証・DB削除
 *   ここ（imageService.deleteImage） - トランザクション管理・外部I/Oへの橋渡し
 *   Route Handler                    - HTTPレスポンス変換
 *
 * NotFoundErrorはdeleteImageInTransaction()からそのままthrowする
 * （握り潰さない・別例外に変換しない）。
 *
 * B2削除失敗はcleanupDeletedStorageKeys()に委譲する（ログ+Sentryのみ、
 * 例外は上に伝播させない）。
 *
 * Transaction開始 → deleteImageInTransaction() → Commit → cleanupDeletedStorageKeys() → return
 */
export const deleteImage = async (
  imageId: string,
  userId: string,
  context: { correlationId: string },
): Promise<void> => {
  const { storageKey } = await prisma.$transaction(async (tx) => {
    return await deleteImageInTransaction(tx, imageId, userId);
  });

  await cleanupDeletedStorageKeys([storageKey], {
    correlationId: context.correlationId,
  });
};