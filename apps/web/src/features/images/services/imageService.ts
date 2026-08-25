import { prisma } from "@/lib/prisma";
import type { Prisma } from "@repo/db";
import { ValidationError } from "@/errors/validation-error";
import { NotFoundError } from "@/errors/not-found-error";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { createImageInTransaction } from "@/features/images/services/internal/createImage";
import type { ImageSummary } from "@/features/images/types";
import {
  MAX_IMAGES_PER_TODO,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  type ImageListInput,
  type CreateImageInput,
} from "@/features/images/schemas";

type TransactionClient = Prisma.TransactionClient;

/**
 * Todo作成/更新のPrismaトランザクション内から呼び出すヘルパー。
 * todoService.createTodo / updateTodo の $transaction ブロック内から呼ぶ。
 *
 *   Image作成はPOST /api/images（Todo保存より前）に完全に移っているため、
 *   ここでImageを新規作成することはない。受け取る imageIds は
 *   すべて既にDB上に存在するImageのidである前提で、TodoImageの同期のみを行う。
 *
 *   所有権検証は「既存TodoImageに含まれるか」ではなく、Image.userIdへの
 *   直接問い合わせに変更した（PROJECT_RULES.mdのImage所有権原則に合わせ、
 *   Todo/Albumを経由しない判定にするため）。
 *
 *   Album所属の変更はAlbum画面から行う設計のため（TodoからAlbumを選択する
 *   UXは持たない）、この関数はTodoImageの同期のみに責務を絞る。
 *
 * 戻り値について:
 *   現状は常に空配列を返す（Todoからdetachしても Image本体・B2は削除しない設計のため）。
 *   Promise<string[]> という型自体は、将来的にB2クリーンアップ対象を返す拡張の
 *   受け皿としてtodoService.ts側の呼び出し規約と合わせて維持している
 *   （呼び出し元がdeletedStorageKeysとして受け取る前提を崩さないため）。
 */
export const syncTodoImages = async (
  tx: TransactionClient,
  todoId: string,
  imageIds: ImageListInput,
  userId: string,
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

  // 所有権検証はImage.userIdへ直接問い合わせる（Todo/Albumを経由しない）。
  // 件数が一致しない場合、他ユーザーのImageまたは存在しないImageIdが
  // 混入していることを意味する。
  const images = await tx.image.findMany({
    where: { id: { in: imageIds }, userId },
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

  return [];
};

/**
 * Image単体削除。Album画面（画像管理機能）から呼ばれる。
 *
 * 責務分担:
 *   deleteImageInTransaction() - ドメインルール・所有権検証・DB削除・Outbox書き込み
 *   ここ（imageService.deleteImage） - トランザクション管理
 *   Route Handler                    - HTTPレスポンス変換
 *
 * NotFoundErrorはdeleteImageInTransaction()からそのままthrowする
 * （握り潰さない・別例外に変換しない）。
 *
 * B2削除はWorkerがOutbox経由で非同期に実行する（image.storage_delete_requested）。
 * Commit後の同期的なB2削除（cleanupDeletedStorageKeys）は行わない
 * （Issue #6: Image削除のOutbox化）。
 */
export const deleteImage = async (
  imageId: string,
  userId: string,
  context: { correlationId: string },
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await deleteImageInTransaction(tx, imageId, userId, context.correlationId);
  });
};

/**
 * Imageの所属Album変更（未所属⇔Album間、Album間移動を含む汎用操作）。
 * albumIdにnullを指定すると未所属に戻し、Album IDを指定するとそのAlbumへ所属させる。
 *
 * 所有権検証は2段階:
 *   1. Image.userId === userId（対象Imageが自分のものか）
 *   2. albumIdがnullでなければ、そのAlbum.userId === userId（移動先Albumも自分のものか）
 * どちらもTodo/Albumを経由せず、各エンティティのuserIdを直接参照する
 * （PROJECT_RULES.mdのImage所有権原則、およびalbumService.updateAlbum等の
 *  既存の所有権チェックパターンを踏襲する）。
 *
 * NotFoundErrorは「対象Imageが存在しない、または他人のもの」の場合のみ投げる
 * （存在有無を秘匿するため404で統一。他のRoute Handlerと同じ方針）。
 * ValidationErrorは「指定されたalbumIdが存在しない、または他人のAlbum」の場合に投げる。
 */
export const updateImageAlbum = async (
  imageId: string,
  albumId: string | null,
  userId: string,
): Promise<ImageSummary> => {
  return await prisma.$transaction(async (tx) => {
    const image = await tx.image.findFirst({
      where: { id: imageId, userId },
    });
    if (!image) {
      throw new NotFoundError("Image not found or unauthorized");
    }

    if (albumId !== null) {
      const album = await tx.album.findFirst({ where: { id: albumId, userId } });
      if (!album) {
        throw new ValidationError("不正なアルバムが指定されました");
      }
    }

    const updated = await tx.image.update({
      where: { id: imageId },
      data: { albumId },
      include: { _count: { select: { todoImages: true } } },
    });

    return {
      id: updated.id,
      originalFileName: updated.originalFileName,
      mimeType: updated.mimeType,
      fileSize: updated.fileSize,
      createdAt: updated.createdAt,
      usageCount: updated._count.todoImages,
    };
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
 * 実体はcreateImageInTransaction()に委譲する（syncTodoImagesと共通のSingle Entry Point）。
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

// ===== switch layer（services/index.ts）用エクスポート =====
// resolvers.ts は上記の named export を直接使うため、このオブジェクトを経由しない。
export const imageService = {
  deleteImage,
  updateImageAlbum,
  getUnassignedImages,
};