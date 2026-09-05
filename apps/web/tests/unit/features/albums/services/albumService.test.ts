import { describe, it, expect, vi, beforeEach } from "vitest";
import { albumService } from "@/features/albums/services/albumService";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@repo/db";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { ValidationError } from "@/errors/validation-error";

// ── tx モックを module スコープで保持 ──────────────────────────────────────────
const mockTxAlbum = {
  aggregate: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const mockTxImage = {
  findMany: vi.fn(),
  update: vi.fn(),
};
const mockTx = { album: mockTxAlbum, image: mockTxImage };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    album: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

// createImage.test.ts と同じ方針: 実物の@repo/dbには依存せず、
// vi.mock ファクトリ内で軽量なクラスとして提供する。
vi.mock("@repo/db", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      clientVersion: string;
      constructor(
        message: string,
        { code, clientVersion }: { code: string; clientVersion: string },
      ) {
        super(message);
        this.code = code;
        this.clientVersion = clientVersion;
      }
    },
  },
}));

// deleteAlbum内から呼ばれる内部サービス。Image単体の実装詳細（B2削除等）は
// deleteImage.test.ts / storageCleanup.test.ts側の責務のため、ここではモック化して
// 「正しい引数で・正しい順序で呼ばれるか」のみを検証する。
vi.mock("@/features/images/services/internal/deleteImage", () => ({
  deleteImageInTransaction: vi.fn(),
}));

vi.mock("@/lib/server-logger", () => ({
  logServiceError: vi.fn(),
}));

const makeP2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

describe("albumService", () => {
  const userId = "user1";
  const now = new Date();

  const baseAlbum = {
    id: "album1",
    name: "旅行",
    userId,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(
      ((cb: (tx: typeof mockTx) => Promise<unknown>) =>
        cb(mockTx)) as unknown as typeof prisma.$transaction,
    );
  });

  // ── getAlbums ────────────────────────────────────────────────────────────────

  describe("getAlbums", () => {
    it("userIdでdisplayOrder昇順に一覧取得すること", async () => {
      vi.mocked(prisma.album.findMany).mockResolvedValueOnce([baseAlbum] as unknown as never);

      const result = await albumService.getAlbums(userId);

      expect(prisma.album.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { displayOrder: "asc" },
      });
      expect(result).toEqual([baseAlbum]);
    });
  });

  // ── getAlbumDetail ────────────────────────────────────────────────────────────

  describe("getAlbumDetail", () => {
    it("所属画像をusageCount付きDTOへ変換し、storageKey等の内部表現を含めないこと", async () => {
      const rawAlbum = {
        ...baseAlbum,
        images: [
          {
            id: "img1",
            storageKey: "uploads/x.jpg",
            originalFileName: "x.jpg",
            mimeType: "image/jpeg",
            fileSize: 1024,
            albumId: baseAlbum.id,
            albumDisplayOrder: 0,
            createdAt: now,
            updatedAt: now,
            _count: { todoImages: 2 },
          },
        ],
      };
      vi.mocked(prisma.album.findFirst).mockResolvedValueOnce(rawAlbum as unknown as never);

      const result = await albumService.getAlbumDetail("album1", userId);

      expect(prisma.album.findFirst).toHaveBeenCalledWith({
        where: { id: "album1", userId },
        include: {
          images: {
            orderBy: { albumDisplayOrder: "asc" },
            include: { _count: { select: { todoImages: true } } },
          },
        },
      });

      expect(result).toEqual({
        id: baseAlbum.id,
        name: baseAlbum.name,
        userId: baseAlbum.userId,
        displayOrder: baseAlbum.displayOrder,
        createdAt: baseAlbum.createdAt,
        updatedAt: baseAlbum.updatedAt,
        images: [
          {
            id: "img1",
            originalFileName: "x.jpg",
            mimeType: "image/jpeg",
            fileSize: 1024,
            albumDisplayOrder: 0,
            createdAt: now,
            usageCount: 2,
          },
        ],
      });

      // 明示的フィールド列挙によるマッピングであることの回帰防止
      expect(result.images[0]).not.toHaveProperty("storageKey");
      expect(result.images[0]).not.toHaveProperty("albumId");
    });

    it("存在しない、または他ユーザーのAlbumはNotFoundErrorをthrowすること", async () => {
      vi.mocked(prisma.album.findFirst).mockResolvedValueOnce(null);

      await expect(albumService.getAlbumDetail("album1", userId)).rejects.toThrow(
        "Album not found or unauthorized",
      );
    });

    it("albumDisplayOrderがnull（不変条件違反）の場合、ErrorをthrowしlogServiceErrorへ記録すること", async () => {
      const rawAlbum = {
        ...baseAlbum,
        images: [
          {
            id: "img1",
            storageKey: "uploads/x.jpg",
            originalFileName: "x.jpg",
            mimeType: "image/jpeg",
            fileSize: 1024,
            albumId: baseAlbum.id,
            albumDisplayOrder: null,
            createdAt: now,
            updatedAt: now,
            _count: { todoImages: 0 },
          },
        ],
      };
      vi.mocked(prisma.album.findFirst).mockResolvedValueOnce(rawAlbum as unknown as never);

      await expect(albumService.getAlbumDetail("album1", userId)).rejects.toThrow(
        "Album image is missing albumDisplayOrder despite non-null albumId",
      );
    });
  });

  // ── createAlbum ────────────────────────────────────────────────────────────

  describe("createAlbum", () => {
    it("MAX(displayOrder)+1を採番して作成すること", async () => {
      mockTxAlbum.aggregate.mockResolvedValueOnce({ _max: { displayOrder: 2 } });
      mockTxAlbum.create.mockResolvedValueOnce({ ...baseAlbum, displayOrder: 3 });

      await albumService.createAlbum({ name: "旅行", userId });

      expect(mockTxAlbum.aggregate).toHaveBeenCalledWith({
        where: { userId },
        _max: { displayOrder: true },
      });
      expect(mockTxAlbum.create).toHaveBeenCalledWith({
        data: { name: "旅行", userId, displayOrder: 3 },
      });
    });

    it("既存Albumが0件の場合、displayOrderは0から採番されること", async () => {
      mockTxAlbum.aggregate.mockResolvedValueOnce({ _max: { displayOrder: null } });
      mockTxAlbum.create.mockResolvedValueOnce({ ...baseAlbum, displayOrder: 0 });

      await albumService.createAlbum({ name: "旅行", userId });

      expect(mockTxAlbum.create).toHaveBeenCalledWith({
        data: { name: "旅行", userId, displayOrder: 0 },
      });
    });

    it("nameの前後空白をtrimすること", async () => {
      mockTxAlbum.aggregate.mockResolvedValueOnce({ _max: { displayOrder: null } });
      mockTxAlbum.create.mockResolvedValueOnce(baseAlbum);

      await albumService.createAlbum({ name: "  旅行  ", userId });

      expect(mockTxAlbum.create).toHaveBeenCalledWith({
        data: { name: "旅行", userId, displayOrder: 0 },
      });
    });

    it("P2002はConflictErrorへ変換されること", async () => {
      mockTxAlbum.aggregate.mockResolvedValueOnce({ _max: { displayOrder: null } });
      mockTxAlbum.create.mockRejectedValueOnce(makeP2002());

      await expect(albumService.createAlbum({ name: "旅行", userId })).rejects.toThrow(
        "同名のアルバムが既に存在します",
      );
    });

    it("P2002以外のエラーはそのままthrowされること", async () => {
      mockTxAlbum.aggregate.mockResolvedValueOnce({ _max: { displayOrder: null } });
      mockTxAlbum.create.mockRejectedValueOnce(new Error("unexpected"));

      await expect(albumService.createAlbum({ name: "旅行", userId })).rejects.toThrow(
        "unexpected",
      );
    });

    it("nameが空文字の場合、ValidationErrorをthrowし$transactionは呼ばれないこと", async () => {
      await expect(albumService.createAlbum({ name: "", userId })).rejects.toThrow(
        ValidationError,
      );
      await expect(albumService.createAlbum({ name: "", userId })).rejects.toThrow(
        "アルバム名を入力してください",
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("nameが51文字以上の場合、ValidationErrorをthrowすること", async () => {
      const longName = "a".repeat(51);

      await expect(albumService.createAlbum({ name: longName, userId })).rejects.toThrow(
        ValidationError,
      );
      await expect(albumService.createAlbum({ name: longName, userId })).rejects.toThrow(
        "アルバム名は50文字以内で入力してください",
      );
    });

    it("空白のみのnameの場合、trim後min(1)にひっかかりValidationErrorをthrowすること", async () => {
      await expect(albumService.createAlbum({ name: "   ", userId })).rejects.toThrow(
        ValidationError,
      );
    });
  });

  // ── updateAlbum ────────────────────────────────────────────────────────────

  describe("updateAlbum", () => {
    it("所有者のAlbumのnameを更新すること", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(baseAlbum);
      mockTxAlbum.update.mockResolvedValueOnce({ ...baseAlbum, name: "新しい名前" });

      await albumService.updateAlbum({ id: "album1", name: "新しい名前" }, userId);

      expect(mockTxAlbum.findFirst).toHaveBeenCalledWith({
        where: { id: "album1", userId },
      });
      expect(mockTxAlbum.update).toHaveBeenCalledWith({
        where: { id: "album1" },
        data: { name: "新しい名前" },
      });
    });

    it("nameの前後空白をtrimすること", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(baseAlbum);
      mockTxAlbum.update.mockResolvedValueOnce(baseAlbum);

      await albumService.updateAlbum({ id: "album1", name: "  新しい名前  " }, userId);

      expect(mockTxAlbum.update).toHaveBeenCalledWith({
        where: { id: "album1" },
        data: { name: "新しい名前" },
      });
    });

    it("所有者でないAlbumはNotFoundErrorをthrowし、updateは呼ばれないこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(null);

      await expect(
        albumService.updateAlbum({ id: "album1", name: "新しい名前" }, userId),
      ).rejects.toThrow("Album not found or unauthorized");

      expect(mockTxAlbum.update).not.toHaveBeenCalled();
    });

    it("P2002はConflictErrorへ変換されること", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(baseAlbum);
      mockTxAlbum.update.mockRejectedValueOnce(makeP2002());

      await expect(
        albumService.updateAlbum({ id: "album1", name: "重複名" }, userId),
      ).rejects.toThrow("同名のアルバムが既に存在します");
    });

    it("nameが空文字の場合、ValidationErrorをthrowしownership checkは呼ばれないこと", async () => {
      await expect(
        albumService.updateAlbum({ id: "album1", name: "" }, userId),
      ).rejects.toThrow(ValidationError);
      expect(mockTxAlbum.findFirst).not.toHaveBeenCalled();
    });

    it("nameが51文字以上の場合、ValidationErrorをthrowすること", async () => {
      const longName = "a".repeat(51);

      await expect(
        albumService.updateAlbum({ id: "album1", name: longName }, userId),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ── deleteAlbum ────────────────────────────────────────────────────────────

  describe("deleteAlbum", () => {
    it("所属Imageが0件の場合、deleteImageInTransactionは呼ばれずAlbum削除のみ行うこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce({ ...baseAlbum, images: [] });
      mockTxAlbum.delete.mockResolvedValueOnce(baseAlbum);

      const result = await albumService.deleteAlbum("album1", userId, { correlationId: "corr-1" });

      expect(mockTxAlbum.delete).toHaveBeenCalledWith({ where: { id: "album1" } });
      expect(deleteImageInTransaction).not.toHaveBeenCalled();
      expect(result).toEqual(baseAlbum);
    });

    it("所属ImageをdeleteImageInTransactionでfor...of逐次削除し、correlationIdを渡すこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce({
        ...baseAlbum,
        images: [{ id: "img1" }, { id: "img2" }],
      });
      vi.mocked(deleteImageInTransaction).mockResolvedValue(undefined);
      mockTxAlbum.delete.mockResolvedValueOnce(baseAlbum);

      await albumService.deleteAlbum("album1", userId, { correlationId: "corr-1" });

      expect(deleteImageInTransaction).toHaveBeenCalledTimes(2);
      expect(deleteImageInTransaction).toHaveBeenNthCalledWith(1, mockTx, "img1", userId, "corr-1");
      expect(deleteImageInTransaction).toHaveBeenNthCalledWith(2, mockTx, "img2", userId, "corr-1");
    });

    it("所有者でないAlbumはNotFoundErrorをthrowし、deleteImageInTransactionは呼ばれないこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(null);

      await expect(
        albumService.deleteAlbum("album1", userId, { correlationId: "corr-1" }),
      ).rejects.toThrow("Album not found or unauthorized");

      expect(deleteImageInTransaction).not.toHaveBeenCalled();
    });

    it("Image削除中にエラーが発生した場合、Album削除は実行されないこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce({
        ...baseAlbum,
        images: [{ id: "img1" }, { id: "img2" }],
      });

      vi.mocked(deleteImageInTransaction)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("image delete failed"));

      await expect(
        albumService.deleteAlbum("album1", userId, { correlationId: "corr-1" }),
      ).rejects.toThrow("image delete failed");

      expect(mockTxAlbum.delete).not.toHaveBeenCalled();
    });
  });

  // ── reorderAlbumImages ────────────────────────────────────────────────────

  describe("reorderAlbumImages", () => {
    it("Albumの現在の画像集合と完全一致するimageIdsを渡すと、配列順でalbumDisplayOrderが振り直されること", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(baseAlbum);
      mockTxImage.findMany.mockResolvedValueOnce([
        { id: "img-a" },
        { id: "img-b" },
        { id: "img-c" },
      ]);

      await albumService.reorderAlbumImages(
        "album1",
        ["img-c", "img-a", "img-b"],
        userId,
      );

      expect(mockTxAlbum.findFirst).toHaveBeenCalledWith({
        where: { id: "album1", userId },
      });
      expect(mockTxImage.findMany).toHaveBeenCalledWith({
        where: { albumId: "album1", userId },
        select: { id: true },
      });
      expect(mockTxImage.update).toHaveBeenCalledTimes(3);
      expect(mockTxImage.update).toHaveBeenNthCalledWith(1, {
        where: { id: "img-c" },
        data: { albumDisplayOrder: 0 },
      });
      expect(mockTxImage.update).toHaveBeenNthCalledWith(2, {
        where: { id: "img-a" },
        data: { albumDisplayOrder: 1 },
      });
      expect(mockTxImage.update).toHaveBeenNthCalledWith(3, {
        where: { id: "img-b" },
        data: { albumDisplayOrder: 2 },
      });
    });

    it("所有者でないAlbumはNotFoundErrorをthrowし、以降の処理をしないこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(null);

      await expect(
        albumService.reorderAlbumImages("album1", ["img-a"], userId),
      ).rejects.toThrow("Album not found or unauthorized");

      expect(mockTxImage.findMany).not.toHaveBeenCalled();
      expect(mockTxImage.update).not.toHaveBeenCalled();
    });

    it("imageIdsがAlbumの現在の画像より少ない（部分集合）場合、ValidationErrorをthrowし更新しないこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(baseAlbum);
      mockTxImage.findMany.mockResolvedValueOnce([
        { id: "img-a" },
        { id: "img-b" },
        { id: "img-c" },
      ]);

      await expect(
        albumService.reorderAlbumImages("album1", ["img-a", "img-b"], userId),
      ).rejects.toThrow(ValidationError);

      expect(mockTxImage.update).not.toHaveBeenCalled();
    });

    it("imageIdsにAlbum外・存在しない画像IDが含まれる場合、ValidationErrorをthrowし更新しないこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(baseAlbum);
      mockTxImage.findMany.mockResolvedValueOnce([
        { id: "img-a" },
        { id: "img-b" },
      ]);

      await expect(
        albumService.reorderAlbumImages(
          "album1",
          ["img-a", "img-b", "img-x"],
          userId,
        ),
      ).rejects.toThrow(ValidationError);

      expect(mockTxImage.update).not.toHaveBeenCalled();
    });

    it("件数が一致していても中身が異なる（入れ替わり）imageIdsの場合、ValidationErrorをthrowすること", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(baseAlbum);
      mockTxImage.findMany.mockResolvedValueOnce([
        { id: "img-a" },
        { id: "img-b" },
      ]);

      await expect(
        albumService.reorderAlbumImages("album1", ["img-a", "img-x"], userId),
      ).rejects.toThrow(ValidationError);

      expect(mockTxImage.update).not.toHaveBeenCalled();
    });

    it("画像所有権はImage.userIdで検証され、他ユーザーのImageはAlbumの現在集合に含まれないこと", async () => {
      // tx.image.findManyの呼び出し引数自体にuserIdフィルタが含まれることで、
      // 他ユーザーのImageがそもそも「現在の画像集合」に混入しない設計になっている
      // （Album所有権とは独立してImage.userIdを明示確認する）ことを検証する。
      mockTxAlbum.findFirst.mockResolvedValueOnce(baseAlbum);
      mockTxImage.findMany.mockResolvedValueOnce([{ id: "img-a" }]);

      await albumService.reorderAlbumImages("album1", ["img-a"], userId);

      expect(mockTxImage.findMany).toHaveBeenCalledWith({
        where: { albumId: "album1", userId },
        select: { id: true },
      });
    });
  });
});