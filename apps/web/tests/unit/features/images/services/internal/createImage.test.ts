import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@repo/db";
import { createImageInTransaction } from "@/features/images/services/internal/createImage";
import { ConflictError } from "@/errors/conflict-error";
import type { CreateImageInput } from "@/features/images/schemas";

type TransactionClient = Prisma.TransactionClient;

// albumService.test.ts / userService.test.ts と同様、実物の@repo/dbには依存せず、
// vi.mock ファクトリ内で PrismaClientKnownRequestError を軽量なクラスとして提供する。
// createImage.ts はPrisma.PrismaClientKnownRequestErrorのみを実行時参照するため、
// モックもその部分のみを提供すればよい。
vi.mock("@repo/db", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      clientVersion: string;
      constructor(
        message: string,
        { code, clientVersion }: { code: string; clientVersion: string },
      ) {
        super(message);
        this.code = code;
        this.clientVersion = clientVersion;
      }
    },
  },
}));

const makeP2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

type MockTx = {
  image: {
    create: ReturnType<typeof vi.fn>;
  };
};

const createMockTx = (): MockTx => ({
  image: {
    create: vi.fn(),
  },
});

const asTransactionClient = (tx: MockTx): TransactionClient =>
  tx as unknown as TransactionClient;

const sampleUserId = "user-1";

const sampleInput: CreateImageInput = {
  storageKey: "uploads/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg",
  originalFileName: "photo.jpg",
  mimeType: "image/jpeg",
  fileSize: 1024,
};

describe("createImageInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: tx.image.createが成功した場合、作成されたImageをそのまま返すこと", async () => {
    const mockTx = createMockTx();
    const createdImage = {
      id: "new-image-id",
      storageKey: sampleInput.storageKey,
      originalFileName: sampleInput.originalFileName,
      mimeType: sampleInput.mimeType,
      fileSize: sampleInput.fileSize,
      albumId: null,
      userId: sampleUserId,
      createdAt: new Date("2026-08-01"),
      updatedAt: new Date("2026-08-01"),
    };
    mockTx.image.create.mockResolvedValue(createdImage);

    const result = await createImageInTransaction(
      asTransactionClient(mockTx),
      sampleInput,
      sampleUserId,
      null,
    );

    expect(mockTx.image.create).toHaveBeenCalledWith({
      data: {
        storageKey: sampleInput.storageKey,
        originalFileName: sampleInput.originalFileName,
        mimeType: sampleInput.mimeType,
        fileSize: sampleInput.fileSize,
        albumId: null,
        userId: sampleUserId,
      },
    });
    expect(result).toEqual(createdImage);
  });

  it("P2002（storageKey重複）の場合、ConflictErrorに変換してthrowすること", async () => {
    const mockTx = createMockTx();
    mockTx.image.create.mockRejectedValue(makeP2002());

    await expect(
      createImageInTransaction(asTransactionClient(mockTx), sampleInput, sampleUserId, null),
    ).rejects.toThrow(ConflictError);
  });

  it("P2002以外のPrismaエラーの場合、変換せずそのまま再throwすること", async () => {
    const mockTx = createMockTx();
    const otherError = new Prisma.PrismaClientKnownRequestError("FK violation", {
      code: "P2003",
      clientVersion: "test",
    });
    mockTx.image.create.mockRejectedValue(otherError);

    await expect(
      createImageInTransaction(asTransactionClient(mockTx), sampleInput, sampleUserId, null),
    ).rejects.toThrow("FK violation");
  });

  it("Prisma以外の予期しないエラーの場合も、変換せずそのまま再throwすること", async () => {
    const mockTx = createMockTx();
    const unexpectedError = new Error("unexpected failure");
    mockTx.image.create.mockRejectedValue(unexpectedError);

    await expect(
      createImageInTransaction(asTransactionClient(mockTx), sampleInput, sampleUserId, null),
    ).rejects.toThrow("unexpected failure");
  });
});