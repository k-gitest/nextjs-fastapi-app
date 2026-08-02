import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerStorageCleanupTask } from "@/features/images/services/internal/storageCleanupTask";
import { logServiceError } from "@/lib/server-logger";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/server-logger", () => ({
  logServiceError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storageCleanupTask: {
      upsert: vi.fn(),
    },
  },
}));

const mockLogServiceError = vi.mocked(logServiceError);
const mockUpsert = vi.mocked(prisma.storageCleanupTask.upsert);

const sampleCorrelationId = "corr-abc-123";

describe("registerStorageCleanupTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Errorインスタンスを渡した場合、messageをlastErrorとしてupsertする", async () => {
    mockUpsert.mockResolvedValue({} as never);
    const error = new Error("b2 delete failed");

    await registerStorageCleanupTask({
      storageKey: "uploads/abc.jpg",
      reason: "b2_delete_failed",
      error,
      correlationId: sampleCorrelationId,
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { storageKey: "uploads/abc.jpg" },
      create: {
        storageKey: "uploads/abc.jpg",
        reason: "b2_delete_failed",
        status: "pending",
        lastError: "b2 delete failed",
        lastAttemptAt: expect.any(Date),
      },
      update: {
        status: "pending",
        retryCount: { increment: 1 },
        lastError: "b2 delete failed",
        lastAttemptAt: expect.any(Date),
      },
    });
    expect(mockLogServiceError).not.toHaveBeenCalled();
  });

  it("Errorインスタンスでない値を渡した場合、String化してlastErrorとする", async () => {
    mockUpsert.mockResolvedValue({} as never);

    await registerStorageCleanupTask({
      storageKey: "uploads/xyz.jpg",
      reason: "image_create_failed",
      error: "plain string error",
      correlationId: sampleCorrelationId,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          reason: "image_create_failed",
          lastError: "plain string error",
        }),
      }),
    );
  });

  it("upsertの既存レコード更新時にstatusをpendingへ戻すこと", async () => {
    mockUpsert.mockResolvedValue({} as never);
    const error = new Error("retry failure");

    await registerStorageCleanupTask({
      storageKey: "uploads/repeat.jpg",
      reason: "b2_delete_failed",
      error,
      correlationId: sampleCorrelationId,
    });

    const callArg = mockUpsert.mock.calls[0][0];
    expect(callArg.update).toEqual({
      status: "pending",
      retryCount: { increment: 1 },
      lastError: "retry failure",
      lastAttemptAt: expect.any(Date),
    });
  });

  it("reasonがimage_create_failedの場合も正しくupsertされる（Type A）", async () => {
    mockUpsert.mockResolvedValue({} as never);
    const error = new Error("image create failed");

    await registerStorageCleanupTask({
      storageKey: "uploads/type-a.jpg",
      reason: "image_create_failed",
      error,
      correlationId: sampleCorrelationId,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storageKey: "uploads/type-a.jpg" },
        create: expect.objectContaining({ reason: "image_create_failed" }),
      }),
    );
  });

  it("upsert自体が失敗した場合、throwせずlogServiceErrorで記録する", async () => {
    const upsertError = new Error("db connection lost");
    mockUpsert.mockRejectedValue(upsertError);

    await expect(
      registerStorageCleanupTask({
        storageKey: "uploads/fail.jpg",
        reason: "b2_delete_failed",
        error: new Error("original failure"),
        correlationId: sampleCorrelationId,
      }),
    ).resolves.toBeUndefined();

    expect(mockLogServiceError).toHaveBeenCalledTimes(1);
    expect(mockLogServiceError).toHaveBeenCalledWith(upsertError, {
      component: "storage-cleanup-task-upsert",
      correlationId: sampleCorrelationId,
      context: { b2_object_path: "uploads/fail.jpg", reason: "b2_delete_failed" },
    });
  });

  it("upsert失敗時のエラーがErrorインスタンスでない場合もString化してlogServiceErrorに渡す", async () => {
    mockUpsert.mockRejectedValue("raw string rejection");

    await registerStorageCleanupTask({
      storageKey: "uploads/fail2.jpg",
      reason: "image_create_failed",
      error: new Error("original failure"),
      correlationId: sampleCorrelationId,
    });

    expect(mockLogServiceError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ component: "storage-cleanup-task-upsert" }),
    );
    // String化されたエラーがErrorオブジェクトにラップされていることを確認
    const loggedError = mockLogServiceError.mock.calls[0][0];
    expect(loggedError.message).toBe("raw string rejection");
  });
});