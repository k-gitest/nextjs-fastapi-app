import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@repo/db";
import {
  applyImageChange,
  compensateFailedUpload,
  createImage,
} from "@/features/images/services/imageService";
import { deleteB2Object } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/errors/validation-error";
import {
  MAX_IMAGES_PER_TODO,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  type CreateImageInput,
} from "@/features/images/schemas";

vi.mock("@/lib/b2", () => ({
  deleteB2Object: vi.fn(),
}));

vi.mock("@/lib/server-logger", () => ({
  logServiceError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

const mockDeleteB2Object = vi.mocked(deleteB2Object);
const mockLogServiceError = vi.mocked(logServiceError);
const mockPrisma = vi.mocked(prisma);

type TransactionClient = Prisma.TransactionClient;

type MockTx = {
  image: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  todoImage: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  album: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const createMockTx = (): MockTx => ({
  image: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  todoImage: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  album: {
    findFirst: vi.fn(),
  },
});

const asTransactionClient = (tx: MockTx): TransactionClient =>
  tx as unknown as TransactionClient;

const sampleUserId = "user-1";
const defaultAlbumOptions = { albumId: null, userId: sampleUserId };

// PR3以降、Image作成はPOST /api/imagesでTodo保存より前に完了しているため、
// applyImageChangeへはimageIdの配列のみが渡る。Image.findManyによる所有権検証の
// モック戻り値として、id/fileSizeのみ持つ最小限のレコードを用意する。
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

const sampleCorrelationId = "corr-abc-123";

describe("imageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("applyImageChange", () => {
    it("imageIds が undefined（変更なし）の場合は何もせず空配列を返す", async () => {
      const mockTx = createMockTx();

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        undefined,
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
      expect(mockTx.todoImage.create).not.toHaveBeenCalled();
      expect(mockTx.image.updateMany).not.toHaveBeenCalled();
    });

    it("既存画像がなく imageIds が空配列（全削除相当だが元々ない）の場合はTodoImageに触れず空配列を返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([]);
      mockTx.todoImage.findMany.mockResolvedValue([]);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        [],
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.findMany).toHaveBeenCalledWith({
        where: { id: { in: [] }, userId: sampleUserId },
      });
      expect(mockTx.todoImage.findMany).toHaveBeenCalledWith({ where: { todoId: "todo-1" } });
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.updateMany).not.toHaveBeenCalled();
    });

    it("既存画像があり imageIds が空配列（全解除）の場合はTodoImageを全件deleteManyし、Image/B2には触れない", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([]);
      mockTx.todoImage.findMany.mockResolvedValue([
        existingTodoImageRecord,
        otherExistingTodoImageRecord,
      ]);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        [],
        defaultAlbumOptions,
      );

      // detachはImage/B2に影響しないため、常に空配列を返す
      expect(result).toEqual([]);
      expect(mockTx.todoImage.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [existingTodoImageRecord.id, otherExistingTodoImageRecord.id] } },
      });
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
      expect(mockTx.todoImage.create).not.toHaveBeenCalled();
      expect(mockTx.image.updateMany).not.toHaveBeenCalled();
    });

    it("既存画像がなく imageIds が新規1件の場合はTodoImageのみ作成し、Image.userId所有権をfindManyで検証する", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([newImageRecord]);
      mockTx.todoImage.findMany.mockResolvedValue([]);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        [newImageRecord.id],
        defaultAlbumOptions,
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
      expect(mockTx.image.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [newImageRecord.id] } },
        data: { albumId: null },
      });
    });

    it("既存画像があり imageIds が新規1件のみ（差し替え）の場合はTodoImageのdetachとcreateの両方を行う", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([newImageRecord]);
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        [newImageRecord.id],
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.todoImage.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [existingTodoImageRecord.id] } },
      });
      expect(mockTx.todoImage.create).toHaveBeenCalledWith({
        data: { todoId: "todo-1", imageId: newImageRecord.id, order: 0 },
      });

      // for...ofによる逐次処理のため、detach(delete)がcreateより先に完了する
      const deleteOrder = mockTx.todoImage.deleteMany.mock.invocationCallOrder[0];
      const createOrder = mockTx.todoImage.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });

    it("既存を維持しつつ新規を追加する場合、既存はTodoImage.orderのみ更新・新規はTodoImage作成、削除対象は空になり、両方にAlbum一括適用される", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord, newImageRecord]);
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

      const imageIds = [existingImageRecord.id, newImageRecord.id];
      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        imageIds,
        defaultAlbumOptions,
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
      expect(mockTx.image.updateMany).toHaveBeenCalledWith({
        where: { id: { in: imageIds } },
        data: { albumId: null },
      });
    });

    it("配列の並び順（index）がそのままTodoImage.orderとして各要素に反映される", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord, otherExistingImageRecord]);
      mockTx.todoImage.findMany.mockResolvedValue([
        existingTodoImageRecord,
        otherExistingTodoImageRecord,
      ]);

      // 元の並び(existing1, existing2)を入れ替えて渡す
      const imageIds = [otherExistingImageRecord.id, existingImageRecord.id];
      await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        imageIds,
        defaultAlbumOptions,
      );

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
        applyImageChange(asTransactionClient(mockTx), "todo-1", tooMany, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.image.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
    });

    it("同一のimageIdが複数回指定された場合はValidationErrorを投げ、DBへ問い合わせない", async () => {
      const mockTx = createMockTx();

      const imageIds = [existingImageRecord.id, existingImageRecord.id];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", imageIds, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.image.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
    });

    it("存在しない（他Todo/他ユーザーの）imageIdが含まれる場合、image.findManyの件数不一致からValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      // 所有権検証で該当なし（0件）を返す想定
      mockTx.image.findMany.mockResolvedValue([]);

      const imageIds = ["img-not-belonging-to-this-user"];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", imageIds, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.updateMany).not.toHaveBeenCalled();
    });

    it("既存分＋新規分の合計サイズがMAX_TOTAL_IMAGE_SIZE_BYTESを超える場合はValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      const oversizedImage = { id: "oversized-image", fileSize: MAX_TOTAL_IMAGE_SIZE_BYTES };
      mockTx.image.findMany.mockResolvedValue([existingImageRecord, oversizedImage]);

      const imageIds = [existingImageRecord.id, oversizedImage.id];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", imageIds, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.updateMany).not.toHaveBeenCalled();
    });

    it("合計サイズ検証は既存分の fileSize もDB（Image.fileSize）の値から正しく合算する", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord, newImageRecord]); // 1024 + 2048
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

      const imageIds = [existingImageRecord.id, newImageRecord.id];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", imageIds, defaultAlbumOptions),
      ).resolves.not.toThrow();
    });

    describe("Album所有権検証", () => {
      it("albumIdが指定され、該当ユーザーのAlbumが存在しない場合はValidationErrorを投げ、DBへ問い合わせない", async () => {
        const mockTx = createMockTx();
        mockTx.album.findFirst.mockResolvedValue(null);

        const imageIds = [newImageRecord.id];

        await expect(
          applyImageChange(asTransactionClient(mockTx), "todo-1", imageIds, {
            albumId: "album-not-owned",
            userId: sampleUserId,
          }),
        ).rejects.toThrow(ValidationError);

        expect(mockTx.album.findFirst).toHaveBeenCalledWith({
          where: { id: "album-not-owned", userId: sampleUserId },
        });
        expect(mockTx.image.findMany).not.toHaveBeenCalled();
        expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
      });

      it("albumIdが指定され、所有権検証を通過した場合はimageIds全件に対しimage.updateManyでalbumIdが一括設定される", async () => {
        const mockTx = createMockTx();
        mockTx.album.findFirst.mockResolvedValue({
          id: "album-1",
          userId: sampleUserId,
          name: "旅行",
          displayOrder: 0,
        });
        mockTx.image.findMany.mockResolvedValue([existingImageRecord, newImageRecord]);
        mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

        const imageIds = [existingImageRecord.id, newImageRecord.id];

        await applyImageChange(asTransactionClient(mockTx), "todo-1", imageIds, {
          albumId: "album-1",
          userId: sampleUserId,
        });

        expect(mockTx.todoImage.update).toHaveBeenCalledWith({
          where: { id: existingTodoImageRecord.id },
          data: { order: 0 },
        });
        expect(mockTx.todoImage.create).toHaveBeenCalledWith({
          data: { todoId: "todo-1", imageId: newImageRecord.id, order: 1 },
        });
        expect(mockTx.image.updateMany).toHaveBeenCalledWith({
          where: { id: { in: imageIds } },
          data: { albumId: "album-1" },
        });
      });
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
  });

  describe("compensateFailedUpload", () => {
    // PR3以降、Image作成はTodo保存トランザクションの外側（POST /api/images）に
    // 移ったため、todoService.ts からの呼び出しは削除済み（呼び出し元がなくなった）。
    // 関数本体はPR4での削除対象として当面残っており、既存の単体テストとして
    // 関数自体の挙動（storageKey削除・失敗時ログ記録）は引き続き検証する。
    const sampleStorageKey = "uploads/2026/07/08/user1/new-uuid.png";
    const secondStorageKey = "uploads/2026/07/08/user1/new-uuid-2.png";

    it("images が undefined（変更なし）の場合は何もしない", async () => {
      await compensateFailedUpload(undefined, { correlationId: sampleCorrelationId });
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("images が空配列の場合は何もしない", async () => {
      await compensateFailedUpload([], { correlationId: sampleCorrelationId });
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("images に1件あればそのstorageKeyを削除する", async () => {
      mockDeleteB2Object.mockResolvedValue(undefined);

      await compensateFailedUpload(
        [{ kind: "new", data: { storageKey: sampleStorageKey } }],
        { correlationId: sampleCorrelationId },
      );

      expect(mockDeleteB2Object).toHaveBeenCalledTimes(1);
      expect(mockDeleteB2Object).toHaveBeenCalledWith(sampleStorageKey);
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("images に複数件あれば全てのstorageKeyを削除する", async () => {
      mockDeleteB2Object.mockResolvedValue(undefined);

      await compensateFailedUpload(
        [
          { kind: "new", data: { storageKey: sampleStorageKey } },
          { kind: "new", data: { storageKey: secondStorageKey } },
        ],
        { correlationId: sampleCorrelationId },
      );

      expect(mockDeleteB2Object).toHaveBeenCalledTimes(2);
      expect(mockDeleteB2Object).toHaveBeenCalledWith(sampleStorageKey);
      expect(mockDeleteB2Object).toHaveBeenCalledWith(secondStorageKey);
    });

    it("削除に失敗してもthrowせず、logServiceErrorへ記録する", async () => {
      const failure = new Error("b2 delete failed");
      mockDeleteB2Object.mockRejectedValue(failure);

      await expect(
        compensateFailedUpload(
          [{ kind: "new", data: { storageKey: sampleStorageKey } }],
          { correlationId: sampleCorrelationId },
        ),
      ).resolves.toBeUndefined();

      expect(mockLogServiceError).toHaveBeenCalledWith(failure, {
        component: "image-cleanup",
        correlationId: sampleCorrelationId,
        context: { storage_key: sampleStorageKey },
      });
    });
  });
});