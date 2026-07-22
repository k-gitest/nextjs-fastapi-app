import { prisma } from "@/lib/prisma";
import type { Prisma } from "@repo/db";
import { logServiceError } from "@/lib/server-logger";
import { deleteB2Object } from "@/lib/b2";
import { ValidationError } from "@/errors/validation-error";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { createImageInTransaction } from "@/features/images/services/internal/createImage";
import { cleanupDeletedStorageKeys } from "@/features/images/services/internal/storageCleanup";
import type { ImageSummary } from "@/features/images/types";
import {
  MAX_IMAGES_PER_TODO,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  type ImageListInput,
  type CreateImageInput,
} from "@/features/images/schemas";

type TransactionClient = Prisma.TransactionClient;

type ImageAlbumOptions = {
  albumId: string | null;
  userId: string;
};

/**
 * Todo作成/更新のPrismaトランザクション内から呼び出すヘルパー。
 * todoService.createTodo / updateTodo の $transaction ブロック内から呼ぶ。
 *
 * PR3での変更点:
 *   Image作成はPOST /api/images（Todo保存より前）に完全に移ったため、
 *   ここでImageを新規作成することはない。受け取る imageIds は
 *   すべて既にDB上に存在するImageのidである前提で、TodoImageの同期のみを行う。
 *   （旧: images: ImageListInput が判別共用体の配列で、kind:"new"の場合は
 *    ここでImage本体を作成していた。この分岐はPR3で削除した）
 *
 *   所有権検証は「既存TodoImageに含まれるか」ではなく、Image.userIdへの
 *   直接問い合わせに変更した（PROJECT_RULES.mdのImage所有権原則に合わせ、
 *   Todo/Albumを経由しない判定にするため）。これによりcreateTodo/updateTodo
 *   どちらの呼び出しでも同じロジックで検証できる。
 *
 *   Album一括適用（Image.albumId更新）は、PR3では既存UXを維持するため
 *   引き続きここで行う。ただしTodoImage同期とAlbum分類は別責務であり、
 *   PR4でAlbumSelectorをTodoから撤去する際にこの部分を除去する
 *   （TodoImage同期のみのsyncTodoImages()へ縮小する）。
 */
export const applyImageChange = async (
  tx: TransactionClient,
  todoId: string,
  imageIds: ImageListInput,
  options: ImageAlbumOptions,
): Promise<string[]> => {
  if (imageIds === undefined) {
    return [];
  }

  if (imageIds.length > MAX_IMAGES_PER_TODO) {
    throw new ValidationError(`添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`);
  }

  if (new Set(imageIds).size !== imageIds.length) {
    throw new ValidationError("同じ画像が複数回指定されています");
  }

  if (options.albumId !== null) {
    const album = await tx.album.findFirst({
      where: { id: options.albumId, userId: options.userId },
    });
    if (!album) {
      throw new ValidationError("不正なアルバムが指定されました");
    }
  }

  // 所有権検証はImage.userIdへ直接問い合わせる（Todo/Albumを経由しない）。
  // 件数が一致しない場合、他ユーザーのImageまたは存在しないImageIdが
  // 混入していることを意味する。
  const images = await tx.image.findMany({
    where: { id: { in: imageIds }, userId: options.userId },
  });
  if (images.length !== imageIds.length) {
    throw new ValidationError("不正な画像が指定されました");
  }

  const totalSize = images.reduce((sum, image) => sum + image.fileSize, 0);
  if (totalSize > MAX_TOTAL_IMAGE_SIZE_BYTES) {
    throw new ValidationError("画像の合計サイズが上限を超えています");
  }

  const existingTodoImages = await tx.todoImage.findMany({ where: { todoId } });
  const existingByImageId = new Map(existingTodoImages.map((ti) => [ti.imageId, ti]));

  const keepIds = new Set(imageIds);
  const toDetach = existingTodoImages.filter((ti) => !keepIds.has(ti.imageId));
  if (toDetach.length > 0) {
    await tx.todoImage.deleteMany({
      where: { id: { in: toDetach.map((ti) => ti.id) } },
    });
  }

  for (const [index, imageId] of imageIds.entries()) {
    const existing = existingByImageId.get(imageId);
    if (existing) {
      await tx.todoImage.update({
        where: { id: existing.id },
        data: { order: index },
      });
    } else {
      await tx.todoImage.create({
        data: { todoId, imageId, order: index },
      });
    }
  }

  // Album一括適用（PR3では既存UXとして維持。PR4でAlbumSelector撤去とあわせて除去する）。
  if (imageIds.length > 0) {
    await tx.image.updateMany({
      where: { id: { in: imageIds } },
      data: { albumId: options.albumId },
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
 *
 * PR3での位置づけ:
 *   Image作成はPOST /api/images（Todo保存トランザクションの外側）に移ったため、
 *   Todo保存失敗時にB2オブジェクトを補償削除するという前提そのものが成立しなくなった。
 *   Todo保存が失敗しても、既に作成済みのImageは単に未所属のまま残るだけであり、
 *   これはPhase3-7 GCの対象として設計上想定済みである。
 *   関数本体は当面残すが、todoService.ts からの呼び出しはPR3で削除する
 *   （本体の削除・整理はPR4で行う）。
 */
export const compensateFailedUpload = async (
  images: { kind: "new"; data: { storageKey: string } }[] | undefined,
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

/**
 * 未所属画像一覧取得（albumId = null かつ userId一致）。
 *
 * usageCount（TodoImageの件数）は _count で1クエリに同梱して取得する（N+1回避）。
 * albumService.getAlbumDetail の images マッピングと同じパターンを踏襲する。
 */
export const getUnassignedImages = async (userId: string): Promise<ImageSummary[]> => {
  const images = await prisma.image.findMany({
    where: { userId, albumId: null },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { todoImages: true } },
    },
  });

  return images.map((image) => ({
    id: image.id,
    originalFileName: image.originalFileName,
    mimeType: image.mimeType,
    fileSize: image.fileSize,
    createdAt: image.createdAt,
    usageCount: image._count.todoImages,
  }));
};

/**
 * Image単体作成（ライブラリへの新規登録）。
 * Todoと無関係にImageを1件だけ作成する、Imageドメインの正面玄関。
 * 常にalbumId: nullで作成する（未所属として開始し、Album所属は別途PATCHで行う）。
 *
 * 実体はcreateImageInTransaction()に委譲する（applyImageChangeと共通のSingle Entry Point）。
 * 単一INSERTのため厳密にはtransaction不要だが、内部関数がtxクライアントを要求する
 * インターフェースのため、ここで生成して渡す。
 */
export const createImage = async (
  data: CreateImageInput,
  userId: string,
): Promise<ImageSummary> => {
  const image = await prisma.$transaction(async (tx) => {
    return await createImageInTransaction(tx, data, userId, null);
  });

  return {
    id: image.id,
    originalFileName: image.originalFileName,
    mimeType: image.mimeType,
    fileSize: image.fileSize,
    createdAt: image.createdAt,
    usageCount: 0,
  };
};