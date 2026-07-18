import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NotFoundError } from "@/errors/not-found-error";
import { ConflictError } from "@/errors/conflict-error";
import type { CreateAlbumInput, UpdateAlbumInput } from "../types";

export const albumService = {
  // 一覧取得（displayOrder昇順。0開始でMAX+1採番のため作成順=表示順の初期状態になる）
  getAlbums: async (userId: string) => {
    return await prisma.album.findMany({
      where: { userId },
      orderBy: { displayOrder: "asc" },
    });
  },

  // 作成
  // @@unique([userId, name]) のP2002をConflictError(409)へ変換する。
  // 事前のfindFirstによる存在確認は行わない（Race Conditionを避け、DB制約を唯一の真実とする）。
  createAlbum: async (data: CreateAlbumInput) => {
    const name = data.name.trim(); // Zod側でもtrim済みだが、Service単独呼び出し時の一貫性のため再度trim

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
    const name = data.name.trim();

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

  // 削除
  // Image.albumId は onDelete: Restrict のため、画像が1件でも残っていればFK制約違反（P2003）になる。
  // 事前のCOUNT(images)チェックは行わず、DB制約を唯一の真実として捕捉・変換する（Race Condition回避）。
  deleteAlbum: async (id: string, userId: string) => {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.album.findFirst({
          where: { id, userId },
        });

        if (!existing) {
          throw new NotFoundError("Album not found or unauthorized");
        }

        return await tx.album.delete({ where: { id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictError("画像が存在するアルバムは削除できません");
      }
      throw error;
    }
  },
};