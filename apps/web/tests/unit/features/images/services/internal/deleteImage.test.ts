import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@repo/db";
import { deleteImageInTransaction } from "@/features/images/services/internal/deleteImage";
import { NotFoundError } from "@/errors/not-found-error";

type TransactionClient = Prisma.TransactionClient;

type MockTx = {
  image: {
    findFirst: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const createMockTx = (): MockTx => ({
  image: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
});

const asTransactionClient = (tx: MockTx): TransactionClient =>
  tx as unknown as TransactionClient;

const sampleUserId = "user-1";

describe("deleteImageInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("所有者のImageを削除し、storageKeyを返すこと", async () => {
    const mockTx = createMockTx();
    mockTx.image.findFirst.mockResolvedValue({ storageKey: "uploads/target.jpg" });
    mockTx.image.delete.mockResolvedValue({ id: "img-1" });

    const result = await deleteImageInTransaction(
      asTransactionClient(mockTx),
      "img-1",
      sampleUserId,
    );

    expect(mockTx.image.findFirst).toHaveBeenCalledWith({
      where: { id: "img-1", userId: sampleUserId },
      select: { storageKey: true },
    });
    expect(mockTx.image.delete).toHaveBeenCalledWith({ where: { id: "img-1" } });
    expect(result).toEqual({ storageKey: "uploads/target.jpg" });
  });

  it("albumIdがnull（未所属）のImageでも、Image.userIdのみで所有権判定し削除できること", async () => {
    const mockTx = createMockTx();
    mockTx.image.findFirst.mockResolvedValue({ storageKey: "uploads/unassigned.jpg" });
    mockTx.image.delete.mockResolvedValue({ id: "img-2" });

    await deleteImageInTransaction(asTransactionClient(mockTx), "img-2", sampleUserId);

    // findFirstの検索条件にalbumId等は一切含まれず、id/userIdのみで判定していることを確認
    expect(mockTx.image.findFirst).toHaveBeenCalledWith({
      where: { id: "img-2", userId: sampleUserId },
      select: { storageKey: true },
    });
  });

  it("対象Imageが存在しない、または他ユーザーのものの場合はNotFoundErrorを投げ、deleteは呼ばれないこと", async () => {
    const mockTx = createMockTx();
    mockTx.image.findFirst.mockResolvedValue(null);

    await expect(
      deleteImageInTransaction(asTransactionClient(mockTx), "img-1", sampleUserId),
    ).rejects.toThrow(NotFoundError);

    expect(mockTx.image.delete).not.toHaveBeenCalled();
  });

  it("TodoImageを明示的に削除しないこと（onDelete Cascadeに委譲するため、todoImage.deleteは一切呼ばれない）", async () => {
    const mockTx = createMockTx() as MockTx & { todoImage?: { delete: ReturnType<typeof vi.fn> } };
    mockTx.todoImage = { delete: vi.fn() };
    mockTx.image.findFirst.mockResolvedValue({ storageKey: "uploads/target.jpg" });
    mockTx.image.delete.mockResolvedValue({ id: "img-1" });

    await deleteImageInTransaction(asTransactionClient(mockTx), "img-1", sampleUserId);

    expect(mockTx.todoImage.delete).not.toHaveBeenCalled();
  });
});