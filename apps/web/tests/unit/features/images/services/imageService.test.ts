import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@repo/db";
import {
  applyImageChange,
  cleanupDeletedStorageKeys,
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

// albumId: null の場合は所有権検証自体がスキップされるため、
// Album機能に関係しないテストではこのデフォルトオプションを使い回す。
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

const existingImageRecord = {
  id: "img-existing-1",
  todoId: "todo-1",
  storageKey: "uploads/2026/07/01/user1/old-uuid.jpg",
  originalFileName: "old.jpg",
  mimeType: "image/jpeg",
  fileSize: 1024,
  order: 0,
};

const otherExistingImageRecord = {
  id: "img-existing-2",
  todoId: "todo-1",
  storageKey: "uploads/2026/07/02/user1/old-uuid-2.jpg",
  originalFileName: "old2.jpg",
  mimeType: "image/jpeg",
  fileSize: 1024,
  order: 1,
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
      expect(mockTx.image.findMany).not.toHaveBeenCalled();
      expect(mockTx.image.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.update).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("既存画像がなく images が空配列（全削除相当だが元々ない）の場合は何もせず空配列を返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([]);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        [],
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.findMany).toHaveBeenCalledWith({
        where: { todoId: "todo-1" },
      });
      expect(mockTx.image.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("既存画像があり images が空配列（全削除）の場合は全件deleteManyし旧storageKeyを全て返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([
        existingImageRecord,
        otherExistingImageRecord,
      ]);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        [],
        defaultAlbumOptions,
      );

      expect(result).toEqual([
        existingImageRecord.storageKey,
        otherExistingImageRecord.storageKey,
      ]);
      expect(mockTx.image.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [existingImageRecord.id, otherExistingImageRecord.id] } },
      });
      expect(mockTx.image.create).not.toHaveBeenCalled();
      expect(mockTx.image.update).not.toHaveBeenCalled();
    });

    it("既存画像がなく images が kind:new 1件（新規添付）の場合は作成のみ行いorder:0を付与し空配列を返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([]);

      const images: ImageListInput = [{ kind: "new", data: sampleAttachImage }];
      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        images,
        defaultAlbumOptions,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.create).toHaveBeenCalledWith({
        data: {
          todoId: "todo-1",
          order: 0,
          storageKey: sampleAttachImage.storageKey,
          originalFileName: sampleAttachImage.originalFileName,
          mimeType: sampleAttachImage.mimeType,
          fileSize: sampleAttachImage.fileSize,
          albumId: null,
        },
      });
    });

    it("既存画像があり images が kind:new 1件（差し替え）の場合は削除・作成の両方を行い旧storageKeyを返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord]);

      const images: ImageListInput = [{ kind: "new", data: sampleAttachImage }];
      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        images,
        defaultAlbumOptions,
      );

      expect(result).toEqual([existingImageRecord.storageKey]);
      expect(mockTx.image.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [existingImageRecord.id] } },
      });
      expect(mockTx.image.create).toHaveBeenCalledWith({
        data: {
          todoId: "todo-1",
          order: 0,
          storageKey: sampleAttachImage.storageKey,
          originalFileName: sampleAttachImage.originalFileName,
          mimeType: sampleAttachImage.mimeType,
          fileSize: sampleAttachImage.fileSize,
          albumId: null,
        },
      });

      // deleteManyはPromise.all（update/create）より先にawaitされる実装のため、呼び出し順を確認する
      const deleteOrder = mockTx.image.deleteMany.mock.invocationCallOrder[0];
      const createOrder = mockTx.image.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });

    it("既存を維持しつつ新規を追加する場合、既存はorder更新・新規はcreateされ、削除対象は空になる", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord]);

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
      expect(mockTx.image.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.update).toHaveBeenCalledWith({
        where: { id: existingImageRecord.id },
        data: { order: 0, albumId: null },
      });
      expect(mockTx.image.create).toHaveBeenCalledWith({
        data: {
          todoId: "todo-1",
          order: 1,
          storageKey: sampleAttachImage.storageKey,
          originalFileName: sampleAttachImage.originalFileName,
          mimeType: sampleAttachImage.mimeType,
          fileSize: sampleAttachImage.fileSize,
          albumId: null,
        },
      });
    });

    it("配列の並び順（index）がそのままorderとして各要素に反映される", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([
        existingImageRecord,
        otherExistingImageRecord,
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

      expect(mockTx.image.update).toHaveBeenCalledWith({
        where: { id: otherExistingImageRecord.id },
        data: { order: 0, albumId: null },
      });
      expect(mockTx.image.update).toHaveBeenCalledWith({
        where: { id: existingImageRecord.id },
        data: { order: 1, albumId: null },
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

      expect(mockTx.image.findMany).not.toHaveBeenCalled();
    });

    it("存在しない（他Todo/他ユーザーの）existing.idが含まれる場合はValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord]);

      const images: ImageListInput = [
        { kind: "existing", id: "img-not-belonging-to-this-todo" },
      ];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", images, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.image.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.update).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("同一のexisting.idが複数回指定された場合はValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord]);

      const images: ImageListInput = [
        { kind: "existing", id: existingImageRecord.id },
        { kind: "existing", id: existingImageRecord.id },
      ];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", images, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.image.update).not.toHaveBeenCalled();
    });

    it("既存分＋新規分の合計サイズがMAX_TOTAL_IMAGE_SIZE_BYTESを超える場合はValidationErrorを投げる", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord]);

      const oversizedNewImage: AttachImageInput = {
        ...sampleAttachImage,
        fileSize: MAX_TOTAL_IMAGE_SIZE_BYTES, // 既存分と合算すると必ず上限超過になる
      };
      const images: ImageListInput = [
        { kind: "existing", id: existingImageRecord.id },
        { kind: "new", data: oversizedNewImage },
      ];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", images, defaultAlbumOptions),
      ).rejects.toThrow(ValidationError);

      expect(mockTx.image.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.image.update).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("合計サイズ検証は existing 分の fileSize もDBの値から正しく合算する", async () => {
      const mockTx = createMockTx();
      mockTx.image.findMany.mockResolvedValue([existingImageRecord]); // fileSize: 1024

      // 既存(1024) + 新規(sampleAttachImage.fileSize=2048) は上限内のはず
      const images: ImageListInput = [
        { kind: "existing", id: existingImageRecord.id },
        { kind: "new", data: sampleAttachImage },
      ];

      await expect(
        applyImageChange(asTransactionClient(mockTx), "todo-1", images, defaultAlbumOptions),
      ).resolves.not.toThrow();
    });

    // Album所有権検証（Todo単位でのAlbum選択機能に伴い追加）
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
        // Album検証で弾かれるため、Image側の問い合わせ自体行われない
        expect(mockTx.image.findMany).not.toHaveBeenCalled();
        expect(mockTx.image.create).not.toHaveBeenCalled();
      });

      it("albumIdが指定され、所有権検証を通過した場合はcreate/updateの両方にalbumIdが設定される", async () => {
        const mockTx = createMockTx();
        mockTx.album.findFirst.mockResolvedValue({
          id: "album-1",
          userId: sampleUserId,
          name: "旅行",
          displayOrder: 0,
        });
        mockTx.image.findMany.mockResolvedValue([existingImageRecord]);

        const images: ImageListInput = [
          { kind: "existing", id: existingImageRecord.id },
          { kind: "new", data: sampleAttachImage },
        ];

        await applyImageChange(asTransactionClient(mockTx), "todo-1", images, {
          albumId: "album-1",
          userId: sampleUserId,
        });

        expect(mockTx.image.update).toHaveBeenCalledWith({
          where: { id: existingImageRecord.id },
          data: { order: 0, albumId: "album-1" },
        });
        expect(mockTx.image.create).toHaveBeenCalledWith({
          data: {
            todoId: "todo-1",
            order: 1,
            storageKey: sampleAttachImage.storageKey,
            originalFileName: sampleAttachImage.originalFileName,
            mimeType: sampleAttachImage.mimeType,
            fileSize: sampleAttachImage.fileSize,
            albumId: "album-1",
          },
        });
      });
    });
  });

  describe("cleanupDeletedStorageKeys", () => {
    it("空配列の場合は何も呼ばれない", async () => {
      await cleanupDeletedStorageKeys([], { correlationId: sampleCorrelationId });
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("複数のstorageKeyをすべて削除する", async () => {
      mockDeleteB2Object.mockResolvedValue(undefined);
      const keys = ["key1.jpg", "key2.png"];

      await cleanupDeletedStorageKeys(keys, { correlationId: sampleCorrelationId });

      expect(mockDeleteB2Object).toHaveBeenCalledTimes(2);
      expect(mockDeleteB2Object).toHaveBeenCalledWith("key1.jpg");
      expect(mockDeleteB2Object).toHaveBeenCalledWith("key2.png");
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("一部の削除が失敗してもthrowせず、logServiceErrorへ記録する（todoIdなし）", async () => {
      const failure = new Error("b2 delete failed");

      mockDeleteB2Object
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(failure);

      await expect(
        cleanupDeletedStorageKeys(["ok-key.jpg", "fail-key.jpg"], {
          correlationId: sampleCorrelationId,
        }),
      ).resolves.toBeUndefined();

      expect(mockLogServiceError).toHaveBeenCalledTimes(1);
      expect(mockLogServiceError).toHaveBeenCalledWith(failure, {
        component: "image-cleanup",
        correlationId: sampleCorrelationId,
        context: { storage_key: "fail-key.jpg" },
      });
    });

    it("todoIdが渡された場合はcontextにtodo_idを含める（delete時の想定）", async () => {
      const failure = new Error("b2 delete failed");
      mockDeleteB2Object.mockRejectedValue(failure);

      await cleanupDeletedStorageKeys(["fail-key.jpg"], {
        correlationId: sampleCorrelationId,
        todoId: "todo-1",
      });

      expect(mockLogServiceError).toHaveBeenCalledWith(failure, {
        component: "image-cleanup",
        correlationId: sampleCorrelationId,
        context: { storage_key: "fail-key.jpg", todo_id: "todo-1" },
      });
    });

    it("すべて失敗してもPromise.allが例外を伝播しない", async () => {
      mockDeleteB2Object.mockRejectedValue(new Error("always fails"));

      await expect(
        cleanupDeletedStorageKeys(["a.jpg", "b.jpg", "c.jpg"], {
          correlationId: sampleCorrelationId,
        }),
      ).resolves.toBeUndefined();

      expect(mockLogServiceError).toHaveBeenCalledTimes(3);
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