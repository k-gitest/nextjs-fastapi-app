// apps/web/tests/unit/features/images/services/imageService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@repo/db";
import {
  applyImageChange,
  cleanupDeletedStorageKeys,
  compensateFailedUpload,
} from "@/features/images/services/imageService";
import { deleteB2Object } from "@/lib/b2";
import type { AttachImageInput } from "@/features/images/schemas";

vi.mock("@/lib/b2", () => ({
  deleteB2Object: vi.fn(),
}));

const mockDeleteB2Object = vi.mocked(deleteB2Object);

type TransactionClient = Prisma.TransactionClient;

// テストで使う範囲のみを持つモックtx。
// TransactionClient全体を実装すると過剰なので、unknown経由でキャストする。
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

describe("imageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("applyImageChange", () => {
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

      // 削除→作成の順序であることも確認する
      const deleteOrder = mockTx.image.delete.mock.invocationCallOrder[0];
      const createOrder = mockTx.image.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });
  });

  describe("cleanupDeletedStorageKeys", () => {
    it("空配列の場合は何も呼ばれない", async () => {
      await cleanupDeletedStorageKeys([]);
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
    });

    it("複数のstorageKeyをすべて削除する", async () => {
      mockDeleteB2Object.mockResolvedValue(undefined);
      const keys = ["key1.jpg", "key2.png"];

      await cleanupDeletedStorageKeys(keys);

      expect(mockDeleteB2Object).toHaveBeenCalledTimes(2);
      expect(mockDeleteB2Object).toHaveBeenCalledWith("key1.jpg");
      expect(mockDeleteB2Object).toHaveBeenCalledWith("key2.png");
    });

    it("一部の削除が失敗してもthrowせず、ログのみ出力する", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const failure = new Error("b2 delete failed");

      mockDeleteB2Object
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(failure);

      await expect(
        cleanupDeletedStorageKeys(["ok-key.jpg", "fail-key.jpg"]),
      ).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith("b2_object_delete_failed", {
        storageKey: "fail-key.jpg",
        error: failure,
      });

      consoleErrorSpy.mockRestore();
    });

    it("すべて失敗してもPromise.allが例外を伝播しない", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockDeleteB2Object.mockRejectedValue(new Error("always fails"));

      await expect(
        cleanupDeletedStorageKeys(["a.jpg", "b.jpg", "c.jpg"]),
      ).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("compensateFailedUpload", () => {
    it("image が undefined（変更なし）の場合は何もしない", async () => {
      await compensateFailedUpload(undefined);
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
    });

    it("image が null（削除のみ）の場合は何もしない", async () => {
      await compensateFailedUpload(null);
      expect(mockDeleteB2Object).not.toHaveBeenCalled();
    });

    it("image がオブジェクトの場合はそのstorageKeyを削除する", async () => {
      mockDeleteB2Object.mockResolvedValue(undefined);

      await compensateFailedUpload(sampleAttachImage);

      expect(mockDeleteB2Object).toHaveBeenCalledWith(
        sampleAttachImage.storageKey,
      );
    });

    it("削除に失敗してもthrowせず、ログのみ出力する", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const failure = new Error("b2 delete failed");

      mockDeleteB2Object.mockRejectedValue(failure);

      await expect(
        compensateFailedUpload(sampleAttachImage),
      ).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "compensating_b2_delete_failed",
        { storageKey: sampleAttachImage.storageKey, error: failure },
      );

      consoleErrorSpy.mockRestore();
    });
  });
});