import { prisma } from "@/lib/prisma";
import { Prisma } from "@repo/db";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";
import { ValidationError } from "@/errors/validation-error";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { createAlbumSchema, updateAlbumSchema } from "../schemas";
import type { Album, AlbumDetail, AlbumDetailInternal, CreateAlbumInput, UpdateAlbumInput } from "../types";
import { logServiceError } from "@/lib/server-logger";

export const albumService = {
  // 一覧取得（displayOrder昇順。0開始でMAX+1採番のため作成順=表示順の初期状態になる）
  //
  // 戻り値契約はREST/GraphQL両実装が共有するService契約であり、DBモデル
  // （Prismaの生の結果）そのものではない。Prismaの結果は構造的部分型付けにより
  // Album（狭い契約）を満たすため、実装側の変更は不要（README.md「Service契約と
  // Transport変換」参照）。
  getAlbums: async (userId: string): Promise<Album[]> => {
    return await prisma.album.findMany({
      where: { userId },
      orderBy: { displayOrder: "asc" },
    });
  },

  /**
   * Album詳細取得（所属画像一覧込み）。
   * 戻り値はAlbumDetail（Service契約）。以前はAlbumDetailInternal
   * （PrismaAlbum全フィールド込み）を返していたが、Service契約を実際の
   * 下流利用箇所が必要とする最小限へ絞り込んだ。
   */
  getAlbumDetail: async (id: string, userId: string): Promise<AlbumDetail> => {
    const album = await prisma.album.findFirst({
      where: { id, userId },
      include: {
        images: {
          orderBy: { albumDisplayOrder: "asc" },
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
    const detail: AlbumDetailInternal = {
      ...rest,
      images: images.map((image) => {
        if (image.albumDisplayOrder === null) {
          const error = new Error(
            "Album image is missing albumDisplayOrder despite non-null albumId",
          );
          logServiceError(error, {
            component: "albumService",
            context: { imageId: image.id, albumId: id },
          });
          throw error;
        }

        return {
          id: image.id,
          originalFileName: image.originalFileName,
          mimeType: image.mimeType,
          fileSize: image.fileSize,
          createdAt: image.createdAt,
          albumDisplayOrder: image.albumDisplayOrder,
          usageCount: image._count.todoImages,
        };
      }),
    };

    return detail;
  },

  // 作成
  createAlbum: async (data: CreateAlbumInput): Promise<Album> => {
    const parsed = createAlbumSchema.safeParse({ name: data.name });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "入力内容に誤りがあります");
    }
    const name = parsed.data.name;

    try {
      return await prisma.$transaction(async (tx) => {
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

  // 更新（現時点ではnameのみ）
  updateAlbum: async (data: UpdateAlbumInput, userId: string): Promise<Album> => {
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

  deleteAlbum: async (
    id: string,
    userId: string,
    context: { correlationId: string },
  ): Promise<Album> => {
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

  /**
   * Album内画像の並び替え。imageIdsはAlbumに現在所属する全画像を、新しい表示順で並べた配列。
   */
  reorderAlbumImages: async (
    albumId: string,
    imageIds: string[],
    userId: string,
  ): Promise<void> => {
    await prisma.$transaction(async (tx) => {
      const album = await tx.album.findFirst({ where: { id: albumId, userId } });
      if (!album) {
        throw new NotFoundError("Album not found or unauthorized");
      }

      const currentImages = await tx.image.findMany({
        where: { albumId, userId },
        select: { id: true },
      });
      const currentIds = new Set(currentImages.map((img) => img.id));
      const requestedIds = new Set(imageIds);

      if (
        currentIds.size !== requestedIds.size ||
        ![...currentIds].every((id) => requestedIds.has(id))
      ) {
        throw new ValidationError("指定された画像がアルバムの現在の内容と一致しません");
      }

      for (const [index, imageId] of imageIds.entries()) {
        await tx.image.update({
          where: { id: imageId },
          data: { albumDisplayOrder: index },
        });
      }
    });
  },
};