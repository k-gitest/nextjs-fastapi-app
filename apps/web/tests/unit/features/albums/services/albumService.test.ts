import { describe, it, expect, vi, beforeEach } from "vitest";
import { albumService } from "@/features/albums/services/albumService";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { cleanupDeletedStorageKeys } from "@/features/images/services/internal/storageCleanup";
import { ValidationError } from "@/errors/validation-error";

// ── tx モックを module スコープで保持 ──────────────────────────────────────────
const mockTxAlbum = {
  aggregate: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const mockTx = { album: mockTxAlbum };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    album: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

// userService.test.ts と同じ方針: 実物の @prisma/client には依存せず、
// vi.mock ファクトリ内で軽量なクラスとして提供する。
vi.mock("@prisma/client", () => ({
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

vi.mock("@/features/images/services/internal/storageCleanup", () => ({
  cleanupDeletedStorageKeys: vi.fn(),
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
            orderBy: { createdAt: "asc" },
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
    it("所属Imageが0件の場合、Album削除のみでcleanupDeletedStorageKeysは空配列で呼ばれること", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce({ ...baseAlbum, images: [] });
      mockTxAlbum.delete.mockResolvedValueOnce(baseAlbum);

      await albumService.deleteAlbum("album1", userId, { correlationId: "corr-1" });

      expect(mockTxAlbum.delete).toHaveBeenCalledWith({ where: { id: "album1" } });
      expect(deleteImageInTransaction).not.toHaveBeenCalled();
      expect(cleanupDeletedStorageKeys).toHaveBeenCalledWith([], {
        correlationId: "corr-1",
        albumId: "album1",
      });
    });

    it("所属ImageをdeleteImageInTransactionでfor...of逐次削除し、storageKeyを収集すること", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce({
        ...baseAlbum,
        images: [{ id: "img1" }, { id: "img2" }],
      });
      vi.mocked(deleteImageInTransaction)
        .mockResolvedValueOnce({ storageKey: "uploads/1.jpg" })
        .mockResolvedValueOnce({ storageKey: "uploads/2.jpg" });
      mockTxAlbum.delete.mockResolvedValueOnce(baseAlbum);

      await albumService.deleteAlbum("album1", userId, { correlationId: "corr-1" });

      expect(deleteImageInTransaction).toHaveBeenCalledTimes(2);
      expect(deleteImageInTransaction).toHaveBeenNthCalledWith(1, mockTx, "img1", userId);
      expect(deleteImageInTransaction).toHaveBeenNthCalledWith(2, mockTx, "img2", userId);
      expect(cleanupDeletedStorageKeys).toHaveBeenCalledWith(
        ["uploads/1.jpg", "uploads/2.jpg"],
        { correlationId: "corr-1", albumId: "album1" },
      );
    });

    it("所有者でないAlbumはNotFoundErrorをthrowし、cleanupDeletedStorageKeysは呼ばれないこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce(null);

      await expect(
        albumService.deleteAlbum("album1", userId, { correlationId: "corr-1" }),
      ).rejects.toThrow("Album not found or unauthorized");

      expect(cleanupDeletedStorageKeys).not.toHaveBeenCalled();
    });

    it("Commit後にcleanupDeletedStorageKeysが呼ばれること（Transaction + External I/O Pattern）", async () => {
      const callOrder: string[] = [];
      mockTxAlbum.findFirst.mockResolvedValueOnce({ ...baseAlbum, images: [] });
      mockTxAlbum.delete.mockImplementationOnce(async () => {
        callOrder.push("delete");
        return baseAlbum;
      });
      vi.mocked(cleanupDeletedStorageKeys).mockImplementationOnce(async () => {
        callOrder.push("cleanup");
      });

      await albumService.deleteAlbum("album1", userId, { correlationId: "corr-1" });

      expect(callOrder).toEqual(["delete", "cleanup"]);
    });

    it("Image削除中にエラーが発生した場合、Album削除とcleanupは実行されないこと", async () => {
      mockTxAlbum.findFirst.mockResolvedValueOnce({
        ...baseAlbum,
        images: [{ id: "img1" }, { id: "img2" }],
      });

      vi.mocked(deleteImageInTransaction)
        .mockResolvedValueOnce({ storageKey: "uploads/1.jpg" })
        .mockRejectedValueOnce(new Error("image delete failed"));

      await expect(
        albumService.deleteAlbum("album1", userId, { correlationId: "corr-1" }),
      ).rejects.toThrow("image delete failed");

      expect(mockTxAlbum.delete).not.toHaveBeenCalled();
      expect(cleanupDeletedStorageKeys).not.toHaveBeenCalled();
    });
  });
});