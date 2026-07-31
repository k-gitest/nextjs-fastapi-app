import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupDeletedStorageKeys } from "@/features/images/services/internal/storageCleanup";
import { deleteB2Object } from "@/lib/b2";
import { logServiceError } from "@/lib/server-logger";

vi.mock("@/lib/b2", () => ({
  deleteB2Object: vi.fn(),
}));

vi.mock("@/lib/server-logger", () => ({
  logServiceError: vi.fn(),
}));

const mockDeleteB2Object = vi.mocked(deleteB2Object);
const mockLogServiceError = vi.mocked(logServiceError);

const sampleCorrelationId = "corr-abc-123";

describe("cleanupDeletedStorageKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      context: { b2_object_path: "fail-key.jpg" },
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
      context: { b2_object_path: "fail-key.jpg", todo_id: "todo-1" },
    });
  });

  it("albumIdが渡された場合はcontextにalbum_idを含める（Album削除時の想定）", async () => {
    const failure = new Error("b2 delete failed");
    mockDeleteB2Object.mockRejectedValue(failure);

    await cleanupDeletedStorageKeys(["fail-key.jpg"], {
      correlationId: sampleCorrelationId,
      albumId: "album-1",
    });

    expect(mockLogServiceError).toHaveBeenCalledWith(failure, {
      component: "image-cleanup",
      correlationId: sampleCorrelationId,
      context: { b2_object_path: "fail-key.jpg", album_id: "album-1" },
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