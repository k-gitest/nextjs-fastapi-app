import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@repo/db";
import {
  syncTodoImages,
  createImage,
  deleteImage,
  updateImageAlbum,
  getUnassignedImages,
} from "@/features/images/services/imageService";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/errors/validation-error";
import { NotFoundError } from "@/errors/not-found-error";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { cleanupDeletedStorageKeys } from "@/features/images/services/internal/storageCleanup";
import {
  MAX_IMAGES_PER_TODO,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  type CreateImageInput,
} from "@/features/images/schemas";
import { ConflictError } from "@/errors/conflict-error";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    image: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/features/images/services/internal/deleteImage", () => ({
  deleteImageInTransaction: vi.fn(),
}));

vi.mock("@/features/images/services/internal/storageCleanup", () => ({
  cleanupDeletedStorageKeys: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma);

type TransactionClient = Prisma.TransactionClient;

type MockTx = {
  image: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  album: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  todoImage: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const createMockTx = (): MockTx => ({
  image: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  album: {
    findFirst: vi.fn(),
  },
  todoImage: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
});

const asTransactionClient = (tx: MockTx): TransactionClient =>
  tx as unknown as TransactionClient;

const sampleUserId = "user-1";

const newImageRecord = { id: "new-image-id", fileSize: 2048 };
const existingImageRecord = { id: "img-existing-1", fileSize: 1024 };
const otherExistingImageRecord = { id: "img-existing-2", fileSize: 1024 };

const existingTodoImageRecord = {
  id: "ti-existing-1",
  todoId: "todo-1",
  imageId: existingImageRecord.id,
  order: 0,
};

const otherExistingTodoImageRecord = {
  id: "ti-existing-2",
  todoId: "todo-1",
  imageId: otherExistingImageRecord.id,
  order: 1,
};

describe("imageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncTodoImages", () => {
    it("imageIds が undefined（変更なし）の場合は何もせず空配列を返す", async () => {
      const mockTx = createMockTx();

      const result = await syncTodoImages(
        asTransactionClient(mockTx),
        "todo-1",
        undefined,
        sampleUserId,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
      expect(mockTx.todoImage.create).not.toHaveBeenCalled();
    });

    it("既存画像がなく imageIds が空配列（全削除相当だが元々ない）の場合はTodoImageに触れず空配列を返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([]);
      mockTx.todoImage.findMany.mockResolvedValue([]);

      const result = await syncTodoImages(
        asTransactionClient(mockTx),
        "todo-1",
        [],
        sampleUserId,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.findMany).toHaveBeenCalledWith({
        where: { id: { in: [] }, userId: sampleUserId },
      });
      expect(mockTx.todoImage.findMany).toHaveBeenCalledWith({ where: { todoId: "todo-1" } });
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
    });

    it("既存画像があり imageIds が空配列（全解除）の場合はTodoImageを全件deleteManyし、Image/B2には触れない", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([]);
      mockTx.todoImage.findMany.mockResolvedValue([
        existingTodoImageRecord,
        otherExistingTodoImageRecord,
      ]);

      const result = await syncTodoImages(
        asTransactionClient(mockTx),
        "todo-1",
        [],
        sampleUserId,
      );

      expect(result).toEqual([]);
      expect(mockTx.todoImage.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [existingTodoImageRecord.id, otherExistingTodoImageRecord.id] } },
      });
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
      expect(mockTx.todoImage.create).not.toHaveBeenCalled();
    });

    it("既存画像がなく imageIds が新規1件の場合はTodoImageのみ作成し、Image.userId所有権をfindManyで検証する", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([newImageRecord]);
      mockTx.todoImage.findMany.mockResolvedValue([]);

      const result = await syncTodoImages(
        asTransactionClient(mockTx),
        "todo-1",
        [newImageRecord.id],
        sampleUserId,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.findMany).toHaveBeenCalledWith({
        where: { id: { in: [newImageRecord.id] }, userId: sampleUserId },
      });
      expect(mockTx.image.create).not.toHaveBeenCalled();
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.create).toHaveBeenCalledWith({
        data: { todoId: "todo-1", imageId: newImageRecord.id, order: 0 },
      });
    });

    it("既存画像があり imageIds が新規1件のみ（差し替え）の場合はTodoImageのdetachとcreateの両方を行う", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([newImageRecord]);
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

      const result = await syncTodoImages(
        asTransactionClient(mockTx),
        "todo-1",
        [newImageRecord.id],
        sampleUserId,
      );

      expect(result).toEqual([]);
      expect(mockTx.todoImage.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [existingTodoImageRecord.id] } },
      });
      expect(mockTx.todoImage.create).toHaveBeenCalledWith({
        data: { todoId: "todo-1", imageId: newImageRecord.id, order: 0 },
      });

      const deleteOrder = mockTx.todoImage.deleteMany.mock.invocationCallOrder[0];
      const createOrder = mockTx.todoImage.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });

    it("既存を維持しつつ新規を追加する場合、既存はTodoImage.orderのみ更新・新規はTodoImage作成、削除対象は空になる", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord, newImageRecord]);
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

      const imageIds = [existingImageRecord.id, newImageRecord.id];
      const result = await syncTodoImages(
        asTransactionClient(mockTx),
        "todo-1",
        imageIds,
        sampleUserId,
      );

      expect(result).toEqual([]);
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).toHaveBeenCalledWith({
        where: { id: existingTodoImageRecord.id },
        data: { order: 0 },
      });
      expect(mockTx.todoImage.create).toHaveBeenCalledWith({
        data: { todoId: "todo-1", imageId: newImageRecord.id, order: 1 },
      });
    });

    it("配列の並び順（index）がそのままTodoImage.orderとして各要素に反映される", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord, otherExistingImageRecord]);
      mockTx.todoImage.findMany.mockResolvedValue([
        existingTodoImageRecord,
        otherExistingTodoImageRecord,
      ]);

      const imageIds = [otherExistingImageRecord.id, existingImageRecord.id];
      await syncTodoImages(asTransactionClient(mockTx), "todo-1", imageIds, sampleUserId);

      expect(mockTx.todoImage.update).toHaveBeenCalledWith({
        where: { id: otherExistingTodoImageRecord.id },
        data: { order: 0 },
      });
      expect(mockTx.todoImage.update).toHaveBeenCalledWith({
        where: { id: existingTodoImageRecord.id },
        data: { order: 1 },
      });
    });

    it("imageIds.length が MAX_IMAGES_PER_TODO を超える場合はValidationErrorを投げ、DBへ問い合わせない", async () => {
      const mockTx = createMockTx();
      const tooMany = Array.from(
        { length: MAX_IMAGES_PER_TODO + 1 },
        (_, i) => `img-${i}`,
      );

      await expect(
        syncTodoImages(asTransactionClient(mockTx), "todo-1", tooMany, sampleUserId),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.image.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
    });

    it("同一のimageIdが複数回指定された場合はValidationErrorを投げ、DBへ問い合わせない", async () => {
      const mockTx = createMockTx();

      const imageIds = [existingImageRecord.id, existingImageRecord.id];

      await expect(
        syncTodoImages(asTransactionClient(mockTx), "todo-1", imageIds, sampleUserId),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.image.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
    });

    it("存在しない（他Todo/他ユーザーの）imageIdが含まれる場合、image.findManyの件数不一致からValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([]);

      const imageIds = ["img-not-belonging-to-this-user"];

      await expect(
        syncTodoImages(asTransactionClient(mockTx), "todo-1", imageIds, sampleUserId),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
    });

    it("既存分＋新規分の合計サイズがMAX_TOTAL_IMAGE_SIZE_BYTESを超える場合はValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      const oversizedImage = { id: "oversized-image", fileSize: MAX_TOTAL_IMAGE_SIZE_BYTES };
      mockTx.image.findMany.mockResolvedValue([existingImageRecord, oversizedImage]);

      const imageIds = [existingImageRecord.id, oversizedImage.id];

      await expect(
        syncTodoImages(asTransactionClient(mockTx), "todo-1", imageIds, sampleUserId),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
    });

    it("合計サイズ検証は既存分の fileSize もDB（Image.fileSize）の値から正しく合算する", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord, newImageRecord]);
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

      const imageIds = [existingImageRecord.id, newImageRecord.id];

      await expect(
        syncTodoImages(asTransactionClient(mockTx), "todo-1", imageIds, sampleUserId),
      ).resolves.not.toThrow();
    });
  });

  describe("createImage", () => {
    it("albumId: null固定でImageを作成し、usageCount: 0のImageSummaryを返す", async () => {
      const createdAt = new Date("2026-07-08T00:00:00.000Z");
      const mockTx = createMockTx();
      mockTx.image.create.mockResolvedValue({
        id: "new-image-id",
        storageKey: "uploads/2026/07/08/user1/new-uuid.png",
        originalFileName: "photo.png",
        mimeType: "image/png",
        fileSize: 2048,
        albumId: null,
        userId: sampleUserId,
        createdAt,
        updatedAt: createdAt,
      });

      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn(asTransactionClient(mockTx)),
      );

      const input: CreateImageInput = {
        storageKey: "uploads/2026/07/08/user1/new-uuid.png",
        originalFileName: "photo.png",
        mimeType: "image/png",
        fileSize: 2048,
      };

      const result = await createImage(input, sampleUserId);

      expect(mockTx.image.create).toHaveBeenCalledWith({
        data: {
          storageKey: input.storageKey,
          originalFileName: input.originalFileName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          albumId: null,
          userId: sampleUserId,
        },
      });

      expect(result).toEqual({
        id: "new-image-id",
        originalFileName: "photo.png",
        mimeType: "image/png",
        fileSize: 2048,
        createdAt,
        usageCount: 0,
      });
    });

    it("createImageInTransactionがConflictErrorを投げた場合、握り潰さずそのままthrowすること", async () => {
      const mockTx = createMockTx();
      mockTx.image.create.mockRejectedValue(new ConflictError("この画像は既に登録されています"));

      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn(asTransactionClient(mockTx)),
      );

      const input: CreateImageInput = {
        storageKey: "uploads/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg",
        originalFileName: "photo.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
      };

      await expect(createImage(input, sampleUserId)).rejects.toThrow(ConflictError);
    });
  });

  describe("deleteImage", () => {
    it("deleteImageInTransactionでImageを削除し、Commit後にcleanupDeletedStorageKeysをstorageKey付きで呼ぶこと", async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn(asTransactionClient(mockTx)),
      );
      vi.mocked(deleteImageInTransaction).mockResolvedValue({
        storageKey: "uploads/deleted.jpg",
      });

      await deleteImage("img-1", sampleUserId, { correlationId: "corr-1" });

      expect(deleteImageInTransaction).toHaveBeenCalledWith(
        asTransactionClient(mockTx),
        "img-1",
        sampleUserId,
      );
      expect(cleanupDeletedStorageKeys).toHaveBeenCalledWith(
        ["uploads/deleted.jpg"],
        { correlationId: "corr-1" },
      );
    });

    it("Commit後にcleanupDeletedStorageKeysが呼ばれること（Transaction + External I/O Pattern）", async () => {
      const callOrder: string[] = [];
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(asTransactionClient(mockTx));
        callOrder.push("commit");
        return result;
      });
      vi.mocked(deleteImageInTransaction).mockResolvedValue({
        storageKey: "uploads/deleted.jpg",
      });
      vi.mocked(cleanupDeletedStorageKeys).mockImplementation(async () => {
        callOrder.push("cleanup");
      });

      await deleteImage("img-1", sampleUserId, { correlationId: "corr-1" });

      expect(callOrder).toEqual(["commit", "cleanup"]);
    });

    it("deleteImageInTransactionがNotFoundErrorを投げた場合、そのままthrowしcleanupは呼ばれないこと", async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn(asTransactionClient(mockTx)),
      );
      vi.mocked(deleteImageInTransaction).mockRejectedValue(
        new NotFoundError("Image not found or unauthorized"),
      );

      await expect(
        deleteImage("img-1", sampleUserId, { correlationId: "corr-1" }),
      ).rejects.toThrow(NotFoundError);

      expect(cleanupDeletedStorageKeys).not.toHaveBeenCalled();
    });
  });

  describe("updateImageAlbum", () => {
    const existingImage = { id: "img-1", userId: sampleUserId };
    const existingAlbum = { id: "album-1", userId: sampleUserId };
    const updatedImageRow = {
      id: "img-1",
      originalFileName: "photo.png",
      mimeType: "image/png",
      fileSize: 1000,
      createdAt: new Date("2026-07-01"),
      _count: { todoImages: 3 },
    };

    it("albumIdを指定して所属変更に成功し、usageCount付きImageSummaryを返すこと", async () => {
      const mockTx = createMockTx();
      mockTx.image.findFirst.mockResolvedValue(existingImage);
      mockTx.album.findFirst.mockResolvedValue(existingAlbum);
      mockTx.image.update.mockResolvedValue(updatedImageRow);
      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn(asTransactionClient(mockTx)),
      );

      const result = await updateImageAlbum("img-1", "album-1", sampleUserId);

      expect(mockTx.image.findFirst).toHaveBeenCalledWith({
        where: { id: "img-1", userId: sampleUserId },
      });
      expect(mockTx.album.findFirst).toHaveBeenCalledWith({
        where: { id: "album-1", userId: sampleUserId },
      });
      expect(mockTx.image.update).toHaveBeenCalledWith({
        where: { id: "img-1" },
        data: { albumId: "album-1" },
        include: { _count: { select: { todoImages: true } } },
      });
      expect(result).toEqual({
        id: "img-1",
        originalFileName: "photo.png",
        mimeType: "image/png",
        fileSize: 1000,
        createdAt: updatedImageRow.createdAt,
        usageCount: 3,
      });
    });

    it("albumId: nullで未所属へ戻せること（Album所有権チェックはスキップされる）", async () => {
      const mockTx = createMockTx();
      mockTx.image.findFirst.mockResolvedValue(existingImage);
      mockTx.image.update.mockResolvedValue({ ...updatedImageRow, _count: { todoImages: 0 } });
      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn(asTransactionClient(mockTx)),
      );

      const result = await updateImageAlbum("img-1", null, sampleUserId);

      expect(mockTx.album.findFirst).not.toHaveBeenCalled();
      expect(mockTx.image.update).toHaveBeenCalledWith({
        where: { id: "img-1" },
        data: { albumId: null },
        include: { _count: { select: { todoImages: true } } },
      });
      expect(result.usageCount).toBe(0);
    });

    it("対象Imageが存在しない、または他ユーザーのものの場合はNotFoundErrorを投げ、以降の処理をしないこと", async () => {
      const mockTx = createMockTx();
      mockTx.image.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn(asTransactionClient(mockTx)),
      );

      await expect(
        updateImageAlbum("img-1", "album-1", sampleUserId),
      ).rejects.toThrow(NotFoundError);

      expect(mockTx.album.findFirst).not.toHaveBeenCalled();
      expect(mockTx.image.update).not.toHaveBeenCalled();
    });

    it("指定albumIdが存在しない、または他ユーザーのものの場合はValidationErrorを投げること", async () => {
      const mockTx = createMockTx();
      mockTx.image.findFirst.mockResolvedValue(existingImage);
      mockTx.album.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn(asTransactionClient(mockTx)),
      );

      await expect(
        updateImageAlbum("img-1", "album-1", sampleUserId),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.image.update).not.toHaveBeenCalled();
    });
  });

  describe("getUnassignedImages", () => {
    it("albumId=nullかつuserId一致のImageをcreatedAt昇順で取得し、usageCount付きImageSummary[]へ変換すること", async () => {
      const rawImages = [
        {
          id: "img-1",
          originalFileName: "a.png",
          mimeType: "image/png",
          fileSize: 1000,
          createdAt: new Date("2026-07-01"),
          _count: { todoImages: 0 },
        },
        {
          id: "img-2",
          originalFileName: "b.png",
          mimeType: "image/png",
          fileSize: 2000,
          createdAt: new Date("2026-07-02"),
          _count: { todoImages: 1 },
        },
      ];
      vi.mocked(prisma.image.findMany).mockResolvedValue(rawImages as unknown as never);

      const result = await getUnassignedImages(sampleUserId);

      expect(mockPrisma.image.findMany).toHaveBeenCalledWith({
        where: { userId: sampleUserId, albumId: null },
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { todoImages: true } } },
      });

      expect(result).toEqual([
        {
          id: "img-1",
          originalFileName: "a.png",
          mimeType: "image/png",
          fileSize: 1000,
          createdAt: rawImages[0].createdAt,
          usageCount: 0,
        },
        {
          id: "img-2",
          originalFileName: "b.png",
          mimeType: "image/png",
          fileSize: 2000,
          createdAt: rawImages[1].createdAt,
          usageCount: 1,
        },
      ]);

      // 明示的フィールド列挙によるマッピングであることの回帰防止（storageKey等を含めない）
      expect(result[0]).not.toHaveProperty("storageKey");
    });

    it("対象0件の場合は空配列を返すこと", async () => {
      vi.mocked(prisma.image.findMany).mockResolvedValue([]);

      const result = await getUnassignedImages(sampleUserId);

      expect(result).toEqual([]);
    });
  });
});