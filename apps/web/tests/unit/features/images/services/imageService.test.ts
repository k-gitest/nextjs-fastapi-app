import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@repo/db";
import {
  applyImageChange,
  compensateFailedUpload,
} from "@/features/images/services/imageService";
import { deleteB2Object } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";
import { ValidationError } from "@/errors/validation-error";
import {
  MAX_IMAGES_PER_TODO,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  type AttachImageInput,
  type ImageListInput,
  type CreateImageListInput,
} from "@/features/images/schemas";

vi.mock("@/lib/b2", () => ({
  deleteB2Object: vi.fn(),
}));

vi.mock("@/lib/server-logger", () => ({
  logServiceError: vi.fn(),
}));

const mockDeleteB2Object = vi.mocked(deleteB2Object);
const mockLogServiceError = vi.mocked(logServiceError);

type TransactionClient = Prisma.TransactionClient;

type MockTx = {
  image: {
    update: ReturnType<typeof vi.fn>;
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
    update: vi.fn(),
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

const sampleAttachImage: AttachImageInput = {
  storageKey: "uploads/2026/07/08/user1/new-uuid.png",
  originalFileName: "photo.png",
  mimeType: "image/png",
  fileSize: 2048,
};

const secondAttachImage: AttachImageInput = {
  storageKey: "uploads/2026/07/08/user1/new-uuid-2.png",
  originalFileName: "photo2.png",
  mimeType: "image/png",
  fileSize: 4096,
};

// Phase3-3でImage.todoId/Image.orderを削除したため、Imageは
// storageKey/originalFileName/mimeType/fileSize/albumId のみを持つ。
// 表示順・Todoとの紐付けは全てTodoImage側（imageId/todoId/order）が正。
const existingImageRecord = {
  id: "img-existing-1",
  storageKey: "uploads/2026/07/01/user1/old-uuid.jpg",
  originalFileName: "old.jpg",
  mimeType: "image/jpeg",
  fileSize: 1024,
  albumId: null,
};

const otherExistingImageRecord = {
  id: "img-existing-2",
  storageKey: "uploads/2026/07/02/user1/old-uuid-2.jpg",
  originalFileName: "old2.jpg",
  mimeType: "image/jpeg",
  fileSize: 1024,
  albumId: null,
};

const existingTodoImageRecord = {
  id: "ti-existing-1",
  todoId: "todo-1",
  imageId: existingImageRecord.id,
  order: 0,
  image: existingImageRecord,
};

const otherExistingTodoImageRecord = {
  id: "ti-existing-2",
  todoId: "todo-1",
  imageId: otherExistingImageRecord.id,
  order: 1,
  image: otherExistingImageRecord,
};

const sampleCorrelationId = "corr-abc-123";

describe("imageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("applyImageChange", () => {
    it("images が undefined（変更なし）の場合は何もせず空配列を返す", async () => {
      const mockTx = createMockTx();

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        undefined,
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
      expect(mockTx.todoImage.create).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
      expect(mockTx.image.update).not.toHaveBeenCalled();
    });

    it("既存画像がなく images が空配列（全削除相当だが元々ない）の場合は何もせず空配列を返す", async () => {
      const mockTx = createMockTx();
      mockTx.todoImage.findMany.mockResolvedValue([]);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        [],
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.todoImage.findMany).toHaveBeenCalledWith({
        where: { todoId: "todo-1" },
        include: { image: true },
      });
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("既存画像があり images が空配列（全削除）の場合はTodoImageを全件deleteManyし、Image/B2には触れない", async () => {
      const mockTx = createMockTx();
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
      expect(mockTx.image.create).not.toHaveBeenCalled();
      expect(mockTx.image.update).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
      expect(mockTx.todoImage.create).not.toHaveBeenCalled();
    });

    it("既存画像がなく images が kind:new 1件（新規添付）の場合はImage+TodoImageの両方を作成し空配列を返す", async () => {
      const mockTx = createMockTx();
      mockTx.todoImage.findMany.mockResolvedValue([]);
      mockTx.image.create.mockResolvedValue({ id: "new-image-id" });

      const images: ImageListInput = [{ kind: "new", data: sampleAttachImage }];
      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        images,
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.create).toHaveBeenCalledWith({
        data: {
          storageKey: sampleAttachImage.storageKey,
          originalFileName: sampleAttachImage.originalFileName,
          mimeType: sampleAttachImage.mimeType,
          fileSize: sampleAttachImage.fileSize,
          albumId: null,
          userId: "user-1",
        },
      });
      expect(mockTx.todoImage.create).toHaveBeenCalledWith({
        data: { todoId: "todo-1", imageId: "new-image-id", order: 0 },
      });
    });

    it("既存画像があり images が kind:new 1件（差し替え）の場合はTodoImage削除とImage+TodoImage作成の両方を行い空配列を返す", async () => {
      const mockTx = createMockTx();
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);
      mockTx.image.create.mockResolvedValue({ id: "new-image-id" });

      const images: ImageListInput = [{ kind: "new", data: sampleAttachImage }];
      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        images,
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.todoImage.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [existingTodoImageRecord.id] } },
      });
      expect(mockTx.image.create).toHaveBeenCalledWith({
        data: {
          storageKey: sampleAttachImage.storageKey,
          originalFileName: sampleAttachImage.originalFileName,
          mimeType: sampleAttachImage.mimeType,
          fileSize: sampleAttachImage.fileSize,
          albumId: null,
          userId: "user-1",
        },
      });
      expect(mockTx.todoImage.create).toHaveBeenCalledWith({
        data: { todoId: "todo-1", imageId: "new-image-id", order: 0 },
      });

      // for...ofによる逐次処理のため、detach(delete)がcreateより先に完了する
      const deleteOrder = mockTx.todoImage.deleteMany.mock.invocationCallOrder[0];
      const createOrder = mockTx.image.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });

    it("既存を維持しつつ新規を追加する場合、既存はTodoImage.orderのみ更新・Image.albumIdも更新され、新規はImage+TodoImage作成、削除対象は空になる", async () => {
      const mockTx = createMockTx();
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);
      mockTx.image.create.mockResolvedValue({ id: "new-image-id" });

      const images: ImageListInput = [
        { kind: "existing", id: existingImageRecord.id },
        { kind: "new", data: sampleAttachImage },
      ];
      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        images,
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).toHaveBeenCalledWith({
        where: { id: existingTodoImageRecord.id },
        data: { order: 0 },
      });
      expect(mockTx.image.update).toHaveBeenCalledWith({
        where: { id: existingImageRecord.id },
        data: { albumId: null },
      });
      expect(mockTx.image.create).toHaveBeenCalledWith({
        data: {
          storageKey: sampleAttachImage.storageKey,
          originalFileName: sampleAttachImage.originalFileName,
          mimeType: sampleAttachImage.mimeType,
          fileSize: sampleAttachImage.fileSize,
          albumId: null,
          userId: "user-1",
        },
      });
      expect(mockTx.todoImage.create).toHaveBeenCalledWith({
        data: { todoId: "todo-1", imageId: "new-image-id", order: 1 },
      });
    });

    it("配列の並び順（index）がそのままTodoImage.orderとして各要素に反映される", async () => {
      const mockTx = createMockTx();
      mockTx.todoImage.findMany.mockResolvedValue([
        existingTodoImageRecord,
        otherExistingTodoImageRecord,
      ]);

      // 元の並び(existing1, existing2)を入れ替えて渡す
      const images: ImageListInput = [
        { kind: "existing", id: otherExistingImageRecord.id },
        { kind: "existing", id: existingImageRecord.id },
      ];
      await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        images,
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

    it("images.length が MAX_IMAGES_PER_TODO を超える場合はValidationErrorを投げ、DBへ問い合わせない", async () => {
      const mockTx = createMockTx();
      const tooMany: ImageListInput = Array.from(
        { length: MAX_IMAGES_PER_TODO + 1 },
        () => ({ kind: "new" as const, data: sampleAttachImage }),
      );

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", tooMany, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
    });

    it("存在しない（他Todo/他ユーザーの）existing.idが含まれる場合はValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

      const images: ImageListInput = [
        { kind: "existing", id: "img-not-belonging-to-this-todo" },
      ];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", images, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("同一のexisting.idが複数回指定された場合はValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

      const images: ImageListInput = [
        { kind: "existing", id: existingImageRecord.id },
        { kind: "existing", id: existingImageRecord.id },
      ];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", images, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
    });

    it("既存分＋新規分の合計サイズがMAX_TOTAL_IMAGE_SIZE_BYTESを超える場合はValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);

      const oversizedNewImage: AttachImageInput = {
        ...sampleAttachImage,
        fileSize: MAX_TOTAL_IMAGE_SIZE_BYTES,
      };
      const images: ImageListInput = [
        { kind: "existing", id: existingImageRecord.id },
        { kind: "new", data: oversizedNewImage },
      ];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", images, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.todoImage.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.todoImage.update).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("合計サイズ検証は existing 分の fileSize もDB（image.fileSize）の値から正しく合算する", async () => {
      const mockTx = createMockTx();
      mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]); // image.fileSize: 1024

      const images: ImageListInput = [
        { kind: "existing", id: existingImageRecord.id },
        { kind: "new", data: sampleAttachImage },
      ];

      mockTx.image.create.mockResolvedValue({ id: "new-image-id" });

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", images, defaultAlbumOptions),
      ).resolves.not.toThrow();
    });

    describe("Album所有権検証", () => {
      it("albumIdが指定され、該当ユーザーのAlbumが存在しない場合はValidationErrorを投げ、DBへ問い合わせない", async () => {
        const mockTx = createMockTx();
        mockTx.album.findFirst.mockResolvedValue(null);

        const images: ImageListInput = [{ kind: "new", data: sampleAttachImage }];

        await expect(
          applyImageChange(asTransactionClient(mockTx), "todo-1", images, {
            albumId: "album-not-owned",
            userId: sampleUserId,
          }),
        ).rejects.toThrow(ValidationError);

        expect(mockTx.album.findFirst).toHaveBeenCalledWith({
          where: { id: "album-not-owned", userId: sampleUserId },
        });
        expect(mockTx.todoImage.findMany).not.toHaveBeenCalled();
        expect(mockTx.image.create).not.toHaveBeenCalled();
      });

      it("albumIdが指定され、所有権検証を通過した場合は既存Imageのalbumid更新・新規Image.createの両方にalbumIdが設定される", async () => {
        const mockTx = createMockTx();
        mockTx.album.findFirst.mockResolvedValue({
          id: "album-1",
          userId: sampleUserId,
          name: "旅行",
          displayOrder: 0,
        });
        mockTx.todoImage.findMany.mockResolvedValue([existingTodoImageRecord]);
        mockTx.image.create.mockResolvedValue({ id: "new-image-id" });

        const images: ImageListInput = [
          { kind: "existing", id: existingImageRecord.id },
          { kind: "new", data: sampleAttachImage },
        ];

        await applyImageChange(asTransactionClient(mockTx), "todo-1", images, {
          albumId: "album-1",
          userId: sampleUserId,
        });

        expect(mockTx.todoImage.update).toHaveBeenCalledWith({
          where: { id: existingTodoImageRecord.id },
          data: { order: 0 },
        });
        expect(mockTx.image.update).toHaveBeenCalledWith({
          where: { id: existingImageRecord.id },
          data: { albumId: "album-1" },
        });
        expect(mockTx.image.create).toHaveBeenCalledWith({
          data: {
            storageKey: sampleAttachImage.storageKey,
            originalFileName: sampleAttachImage.originalFileName,
            mimeType: sampleAttachImage.mimeType,
            fileSize: sampleAttachImage.fileSize,
            albumId: "album-1",
            userId: "user-1",
          },
        });
      });
    });
  });

  describe("compensateFailedUpload", () => {
    it("images が undefined（変更なし）の場合は何もしない", async () => {
      await compensateFailedUpload(undefined, { correlationId: sampleCorrelationId });
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("images が空配列の場合は何もしない", async () => {
      const images: CreateImageListInput = [];
      await compensateFailedUpload(images, { correlationId: sampleCorrelationId });
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("images に1件あればそのstorageKeyを削除する", async () => {
      mockDeleteB2Object.mockResolvedValue(undefined);
      const images: CreateImageListInput = [{ kind: "new", data: sampleAttachImage }];

      await compensateFailedUpload(images, { correlationId: sampleCorrelationId });

      expect(mockDeleteB2Object).toHaveBeenCalledTimes(1);
      expect(mockDeleteB2Object).toHaveBeenCalledWith(sampleAttachImage.storageKey);
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("images に複数件あれば全てのstorageKeyを削除する", async () => {
      mockDeleteB2Object.mockResolvedValue(undefined);
      const images: CreateImageListInput = [
        { kind: "new", data: sampleAttachImage },
        { kind: "new", data: secondAttachImage },
      ];

      await compensateFailedUpload(images, { correlationId: sampleCorrelationId });

      expect(mockDeleteB2Object).toHaveBeenCalledTimes(2);
      expect(mockDeleteB2Object).toHaveBeenCalledWith(sampleAttachImage.storageKey);
      expect(mockDeleteB2Object).toHaveBeenCalledWith(secondAttachImage.storageKey);
    });

    it("削除に失敗してもthrowせず、logServiceErrorへ記録する（todo_idは含まれない）", async () => {
      const failure = new Error("b2 delete failed");
      mockDeleteB2Object.mockRejectedValue(failure);
      const images: CreateImageListInput = [{ kind: "new", data: sampleAttachImage }];

      await expect(
        compensateFailedUpload(images, { correlationId: sampleCorrelationId }),
      ).resolves.toBeUndefined();

      expect(mockLogServiceError).toHaveBeenCalledWith(failure, {
        component: "image-cleanup",
        correlationId: sampleCorrelationId,
        context: { storage_key: sampleAttachImage.storageKey },
      });
    });
  });
});