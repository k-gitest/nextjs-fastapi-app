import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@repo/db";
import {
  applyImageChange,
  cleanupDeletedStorageKeys,
  compensateFailedUpload,
} from "@/features/images/services/imageService";
import { deleteB2Object } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";
import type { AttachImageInput } from "@/features/images/schemas";

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
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const createMockTx = (): MockTx => ({
  image: {
    findUnique: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
});

const asTransactionClient = (tx: MockTx): TransactionClient =>
  tx as unknown as TransactionClient;

const sampleAttachImage: AttachImageInput = {
  storageKey: "uploads/2026/07/08/user1/new-uuid.png",
  originalFileName: "photo.png",
  mimeType: "image/png",
  fileSize: 2048,
};

const existingImageRecord = {
  id: "img-existing-1",
  todoId: "todo-1",
  storageKey: "uploads/2026/07/01/user1/old-uuid.jpg",
  originalFileName: "old.jpg",
  mimeType: "image/jpeg",
  fileSize: 1024,
};

const sampleCorrelationId = "corr-abc-123";

describe("imageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("applyImageChange", () => {
    // ↓ 変更なし（applyImageChangeはcontextを取らないため）
    it("image が undefined（変更なし）の場合は何もせず空配列を返す", async () => {
      const mockTx = createMockTx();

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        undefined,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.findUnique).not.toHaveBeenCalled();
      expect(mockTx.image.delete).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("既存画像がなく image が null（削除のみ）の場合は何もせず空配列を返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findUnique.mockResolvedValue(null);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        null,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.findUnique).toHaveBeenCalledWith({
        where: { todoId: "todo-1" },
      });
      expect(mockTx.image.delete).not.toHaveBeenCalled();
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("既存画像があり image が null（削除のみ）の場合は削除して旧storageKeyを返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findUnique.mockResolvedValue(existingImageRecord);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        null,
      );

      expect(result).toEqual([existingImageRecord.storageKey]);
      expect(mockTx.image.delete).toHaveBeenCalledWith({
        where: { id: existingImageRecord.id },
      });
      expect(mockTx.image.create).not.toHaveBeenCalled();
    });

    it("既存画像がなく image がオブジェクト（新規添付）の場合は作成のみ行い空配列を返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findUnique.mockResolvedValue(null);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        sampleAttachImage,
      );

      expect(result).toEqual([]);
      expect(mockTx.image.delete).not.toHaveBeenCalled();
      expect(mockTx.image.create).toHaveBeenCalledWith({
        data: {
          todoId: "todo-1",
          storageKey: sampleAttachImage.storageKey,
          originalFileName: sampleAttachImage.originalFileName,
          mimeType: sampleAttachImage.mimeType,
          fileSize: sampleAttachImage.fileSize,
        },
      });
    });

    it("既存画像があり image がオブジェクト（差し替え）の場合は削除・作成の両方を行い旧storageKeyを返す", async () => {
      const mockTx = createMockTx();
      mockTx.image.findUnique.mockResolvedValue(existingImageRecord);

      const result = await applyImageChange(
        asTransactionClient(mockTx),
        "todo-1",
        sampleAttachImage,
      );

      expect(result).toEqual([existingImageRecord.storageKey]);
      expect(mockTx.image.delete).toHaveBeenCalledWith({
        where: { id: existingImageRecord.id },
      });
      expect(mockTx.image.create).toHaveBeenCalledWith({
        data: {
          todoId: "todo-1",
          storageKey: sampleAttachImage.storageKey,
          originalFileName: sampleAttachImage.originalFileName,
          mimeType: sampleAttachImage.mimeType,
          fileSize: sampleAttachImage.fileSize,
        },
      });

      const deleteOrder = mockTx.image.delete.mock.invocationCallOrder[0];
      const createOrder = mockTx.image.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
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
    it("image が undefined（変更なし）の場合は何もしない", async () => {
      await compensateFailedUpload(undefined, { correlationId: sampleCorrelationId });
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("image が null（削除のみ）の場合は何もしない", async () => {
      await compensateFailedUpload(null, { correlationId: sampleCorrelationId });
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("image がオブジェクトの場合はそのstorageKeyを削除する", async () => {
      mockDeleteB2Object.mockResolvedValue(undefined);

      await compensateFailedUpload(sampleAttachImage, {
        correlationId: sampleCorrelationId,
      });

      expect(mockDeleteB2Object).toHaveBeenCalledWith(
        sampleAttachImage.storageKey,
      );
      expect(mockLogServiceError).not.toHaveBeenCalled();
    });

    it("削除に失敗してもthrowせず、logServiceErrorへ記録する（todo_idは含まれない）", async () => {
      const failure = new Error("b2 delete failed");
      mockDeleteB2Object.mockRejectedValue(failure);

      await expect(
        compensateFailedUpload(sampleAttachImage, {
          correlationId: sampleCorrelationId,
        }),
      ).resolves.toBeUndefined();

      expect(mockLogServiceError).toHaveBeenCalledWith(failure, {
        component: "image-cleanup",
        correlationId: sampleCorrelationId,
        context: { storage_key: sampleAttachImage.storageKey },
      });
    });
  });
});