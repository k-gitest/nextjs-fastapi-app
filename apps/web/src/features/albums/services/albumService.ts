import { prisma } from "@/lib/prisma";
import { Prisma } from "@repo/db";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";
import { ValidationError } from "@/errors/validation-error";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { createAlbumSchema, updateAlbumSchema } from "../schemas";
import type { AlbumDetailInternal, CreateAlbumInput, UpdateAlbumInput } from "../types";

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
   * 戻り値はAlbumDetailInternal（Service/GraphQL用内部型）。
   * REST公開時はalbumMapper.tsのtoAlbumDetailDTOでAlbumDetail（公開DTO）に変換する。
   */
  getAlbumDetail: async (id: string, userId: string): Promise<AlbumDetailInternal> => {
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
  createAlbum: async (data: CreateAlbumInput) => {
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