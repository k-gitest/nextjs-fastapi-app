import { prisma } from "@/lib/prisma";
import { Prisma } from "@repo/db";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";
import { ValidationError } from "@/errors/validation-error";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { createAlbumSchema, updateAlbumSchema } from "../schemas";
import type { Album, AlbumDetail, AlbumDetailInternal, CreateAlbumInput, UpdateAlbumInput } from "../types";

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
    const detail: AlbumDetailInternal = {
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
};