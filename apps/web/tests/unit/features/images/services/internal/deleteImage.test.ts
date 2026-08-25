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
  outbox_events: {
    create: ReturnType<typeof vi.fn>;
  };
};

const createMockTx = (): MockTx => ({
  image: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  outbox_events: {
    create: vi.fn(),
  },
});

const asTransactionClient = (tx: MockTx): TransactionClient =>
  tx as unknown as TransactionClient;

const sampleUserId = "user-1";
const sampleCorrelationId = "corr-1";

describe("deleteImageInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("所有者のImageを削除し、戻り値を持たないこと（Outbox化によりstorageKeyを呼び出し元へ返さない）", async () => {
    const mockTx = createMockTx();
    mockTx.image.findFirst.mockResolvedValue({ storageKey: "uploads/target.jpg" });
    mockTx.image.delete.mockResolvedValue({ id: "img-1" });

    const result = await deleteImageInTransaction(
      asTransactionClient(mockTx),
      "img-1",
      sampleUserId,
      sampleCorrelationId,
    );

    expect(mockTx.image.findFirst).toHaveBeenCalledWith({
      where: { id: "img-1", userId: sampleUserId },
      select: { storageKey: true },
    });
    expect(mockTx.image.delete).toHaveBeenCalledWith({ where: { id: "img-1" } });
    expect(result).toBeUndefined();
  });

  it("Image削除と同一トランザクション内でimage.storage_delete_requestedイベントをoutbox_eventsへ書き込むこと", async () => {
    const mockTx = createMockTx();
    mockTx.image.findFirst.mockResolvedValue({ storageKey: "uploads/target.jpg" });
    mockTx.image.delete.mockResolvedValue({ id: "img-1" });

    await deleteImageInTransaction(
      asTransactionClient(mockTx),
      "img-1",
      sampleUserId,
      sampleCorrelationId,
    );

    expect(mockTx.outbox_events.create).toHaveBeenCalledWith({
      data: {
        aggregate_id: "img-1",
        event_type: "image.storage_delete_requested",
        payload: {
          storage_key: "uploads/target.jpg",
          correlation_id: sampleCorrelationId,
        },
        idempotency_key: "image.storage_delete_requested:img-1",
      },
    });
  });

  it("Image削除がoutbox_events書き込みより先に実行されること", async () => {
    const callOrder: string[] = [];
    const mockTx = createMockTx();
    mockTx.image.findFirst.mockResolvedValue({ storageKey: "uploads/target.jpg" });
    mockTx.image.delete.mockImplementation(async () => {
      callOrder.push("image.delete");
      return { id: "img-1" };
    });
    mockTx.outbox_events.create.mockImplementation(async () => {
      callOrder.push("outbox_events.create");
    });

    await deleteImageInTransaction(
      asTransactionClient(mockTx),
      "img-1",
      sampleUserId,
      sampleCorrelationId,
    );

    expect(callOrder).toEqual(["image.delete", "outbox_events.create"]);
  });

  it("albumIdがnull（未所属）のImageでも、Image.userIdのみで所有権判定し削除できること", async () => {
    const mockTx = createMockTx();
    mockTx.image.findFirst.mockResolvedValue({ storageKey: "uploads/unassigned.jpg" });
    mockTx.image.delete.mockResolvedValue({ id: "img-2" });

    await deleteImageInTransaction(
      asTransactionClient(mockTx),
      "img-2",
      sampleUserId,
      sampleCorrelationId,
    );

    // findFirstの検索条件にalbumId等は一切含まれず、id/userIdのみで判定していることを確認
    expect(mockTx.image.findFirst).toHaveBeenCalledWith({
      where: { id: "img-2", userId: sampleUserId },
      select: { storageKey: true },
    });
  });

  it("対象Imageが存在しない、または他ユーザーのものの場合はNotFoundErrorを投げ、delete・outbox_events.createは呼ばれないこと", async () => {
    const mockTx = createMockTx();
    mockTx.image.findFirst.mockResolvedValue(null);

    await expect(
      deleteImageInTransaction(
        asTransactionClient(mockTx),
        "img-1",
        sampleUserId,
        sampleCorrelationId,
      ),
    ).rejects.toThrow(NotFoundError);

    expect(mockTx.image.delete).not.toHaveBeenCalled();
    expect(mockTx.outbox_events.create).not.toHaveBeenCalled();
  });

  it("TodoImageを明示的に削除しないこと（onDelete Cascadeに委譲するため、todoImage.deleteは一切呼ばれない）", async () => {
    const mockTx = createMockTx() as MockTx & { todoImage?: { delete: ReturnType<typeof vi.fn> } };
    mockTx.todoImage = { delete: vi.fn() };
    mockTx.image.findFirst.mockResolvedValue({ storageKey: "uploads/target.jpg" });
    mockTx.image.delete.mockResolvedValue({ id: "img-1" });

    await deleteImageInTransaction(
      asTransactionClient(mockTx),
      "img-1",
      sampleUserId,
      sampleCorrelationId,
    );

    expect(mockTx.todoImage.delete).not.toHaveBeenCalled();
  });
});