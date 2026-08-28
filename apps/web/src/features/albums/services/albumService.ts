import { prisma } from "@/lib/prisma";
import { Prisma } from "@repo/db";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";
import { ValidationError } from "@/errors/validation-error";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { createAlbumSchema, updateAlbumSchema } from "../schemas";
import type { AlbumDetail, CreateAlbumInput, UpdateAlbumInput } from "../types";

export const albumService = {
  // 一覧取得（displayOrder昇順。0開始でMAX+1採番のため作成順=表示順の初期状態になる）
  getAlbums: async (userId: string) => {
    return await prisma.album.findMany({
      where: { userId },
      orderBy: { displayOrder: "asc" },
    });
  },

  /**
   * Album詳細取得（所属画像一覧込み）。
   *
   * usageCount（TodoImageの件数）は _count で1クエリに同梱して取得する（N+1回避）。
   *
   * 画像の並び順: Image.displayOrder は存在しない。Album.displayOrderはAlbum一覧の
   * 表示順、TodoImage.orderはTodo内での表示順であり、いずれもAlbum内画像の並びには
   * 転用できない。そのため現時点では createdAt asc を暫定基準とする。
   * Album内画像の並び替え（DnD）は現時点では対象外。
   */
  getAlbumDetail: async (id: string, userId: string): Promise<AlbumDetail> => {
    const album = await prisma.album.findFirst({
      where: { id, userId },
      include: {
        images: {
          orderBy: { createdAt: "asc" },
          include: {
            _count: { select: { todoImages: true } },
          },
        },
      },
    });

    if (!album) {
      throw new NotFoundError("Album not found or unauthorized");
    }

    const { images, ...rest } = album;

    // storageKey・albumId・updatedAt等をDTOに含めないよう、スプレッドではなく
    // 明示的なフィールド列挙でマッピングする（Prisma内部表現の漏洩防止）。
    return {
      ...rest,
      images: images.map((image) => ({
        id: image.id,
        originalFileName: image.originalFileName,
        mimeType: image.mimeType,
        fileSize: image.fileSize,
        createdAt: image.createdAt,
        usageCount: image._count.todoImages,
      })),
    };
  },

  // 作成
  // @@unique([userId, name]) のP2002をConflictError(409)へ変換する。
  // 事前のfindFirstによる存在確認は行わない（Race Conditionを避け、DB制約を唯一の真実とする）。
  createAlbum: async (data: CreateAlbumInput) => {
    const parsed = createAlbumSchema.safeParse({ name: data.name });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "入力内容に誤りがあります");
    }
    const name = parsed.data.name; // createAlbumSchemaが既にtrim済み

    try {
      return await prisma.$transaction(async (tx) => {
        // MAX(displayOrder)+1を採番。並び替えAPI導入後もそのまま使える設計。
        const maxOrder = await tx.album.aggregate({
          where: { userId: data.userId },
          _max: { displayOrder: true },
        });
        const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

        return await tx.album.create({
          data: {
            name,
            userId: data.userId,
            displayOrder,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("同名のアルバムが既に存在します");
      }
      throw error;
    }
  },

  // 更新（現時点ではnameのみ。displayOrderの変更は並び替えAPI導入時に別途追加）
  updateAlbum: async (data: UpdateAlbumInput, userId: string) => {
    const { id } = data;
    const parsed = updateAlbumSchema.safeParse({ name: data.name });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "入力内容に誤りがあります");
    }
    const name = parsed.data.name;

    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.album.findFirst({
          where: { id, userId },
        });

        if (!existing) {
          throw new NotFoundError("Album not found or unauthorized");
        }

        return await tx.album.update({
          where: { id },
          data: { name },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("同名のアルバムが既に存在します");
      }
      throw error;
    }
  },

/**
   * Album削除。
   *
   * Albumは画像管理機能そのものであるため、所属Imageが残っていても409で
   * 拒否するのではなく、所属Imageを全てdeleteImageInTransaction()で削除した上で
   * Albumを削除する（Image単体削除手段の追加に伴う仕様変更）。
   *
   * Image.albumIdはonDelete: Restrictのため、Imageを先に削除しない限り
   * Album削除はFK制約違反(P2003)になる。よってこの関数ではP2003ハンドリングは不要
   * （そもそも発生しない設計に変わった）。
   *
   * B2削除はWorkerがOutbox経由で非同期に実行する（Image単体削除と同じ経路、
   * Issue #6: Image削除のOutbox化）。deleteImageInTransaction() 1回につき
   * 1件のOutboxイベントが書き込まれるため、Album配下に複数Imageがあっても
   * idempotency_key（画像単位で一意）により重複の問題は発生しない。
   *
   * Transaction開始
   *   ↓
   * Album取得（所有権検証）
   *   ↓
   * Album配下Image取得
   *   ↓
   * deleteImageInTransaction() を各Imageに対してfor...ofで逐次実行
   *   （Image DB削除 + Outboxイベント書き込み）
   *   ↓
   * Album削除
   *   ↓
   * Commit
   */
  deleteAlbum: async (id: string, userId: string, context: { correlationId: string }) => {
    const album = await prisma.$transaction(async (tx) => {
      const existing = await tx.album.findFirst({
        where: { id, userId },
        include: { images: { select: { id: true } } },
      });

      if (!existing) {
        throw new NotFoundError("Album not found or unauthorized");
      }

      for (const image of existing.images) {
        await deleteImageInTransaction(tx, image.id, userId, context.correlationId);
      }

      const deleted = await tx.album.delete({ where: { id } });

      return deleted;
    });

    return album;
  },
};