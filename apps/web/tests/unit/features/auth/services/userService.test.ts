import { describe, it, expect, vi, beforeEach } from "vitest";

// tx モックを module スコープで保持し、テストから参照できるようにする
const mockTxUser = {
  create: vi.fn(),
  update: vi.fn(),
};
const mockTxOutboxEvents = {
  create: vi.fn(),
};
const mockTx = {
  user: mockTxUser,
  outbox_events: mockTxOutboxEvents,
};

// prisma モック
// $transaction の初期実装は beforeEach で設定する（vi.mock hoisting で mockTx を参照できないため）
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
    },
  },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      clientVersion: string;
      constructor(
        message: string,
        { code, clientVersion }: { code: string; clientVersion: string }
      ) {
        super(message);
        this.code = code;
        this.clientVersion = clientVersion;
      }
    },
  },
}));

import { syncUser, getUserBySub } from "@/features/auth/services/userService";
import { prisma } from "@/lib/prisma";

const mockUser = {
  id: "clx1234",
  auth0Id: "auth0|xxx",
  email: "test@example.com",
  name: "テストユーザー",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction のシムを毎回リセット後も維持する
  // PrismaClient の完全な型と mockTx の部分型が合わないため unknown 経由でキャスト
  vi.mocked(prisma.$transaction).mockImplementation(
    // テストモックのため PrismaClient 完全型との不一致を unknown 経由で吸収
    ((cb: (tx: typeof mockTx) => Promise<unknown>) =>
      cb(mockTx)) as unknown as typeof prisma.$transaction
  );
});

// ─── getUserBySub ────────────────────────────────────────────────────────────

describe("getUserBySub", () => {
  it("存在するユーザーを返す", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);

    const result = await getUserBySub("auth0|xxx");

    expect(result).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { auth0Id: "auth0|xxx" },
    });
  });

  it("存在しないユーザーはnullを返す", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    const result = await getUserBySub("auth0|nonexistent");

    expect(result).toBeNull();
  });
});

// ─── syncUser ────────────────────────────────────────────────────────────────

describe("syncUser", () => {
  it("新規ユーザーの場合: createが呼ばれ、outbox_eventsが書き込まれる", async () => {
    mockTxUser.create.mockResolvedValueOnce(mockUser);
    mockTxOutboxEvents.create.mockResolvedValueOnce({});

    await syncUser({
      sub: "auth0|xxx",
      email: "test@example.com",
      name: "テストユーザー",
    });

    expect(mockTxUser.create).toHaveBeenCalledWith({
      data: {
        auth0Id: "auth0|xxx",
        email: "test@example.com",
        name: "テストユーザー",
      },
    });
    expect(mockTxOutboxEvents.create).toHaveBeenCalledOnce();
  });

  it("新規ユーザーのoutbox_eventsにevent_type=user.registeredが設定される", async () => {
    mockTxUser.create.mockResolvedValueOnce(mockUser);
    mockTxOutboxEvents.create.mockResolvedValueOnce({});

    await syncUser({
      sub: "auth0|xxx",
      email: "test@example.com",
      name: "テストユーザー",
    });

    expect(mockTxOutboxEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: "user.registered",
          idempotency_key: `user.registered:${mockUser.id}`,
        }),
      })
    );
  });

  it("既存ユーザーの場合(P2002): updateが呼ばれ、outbox_eventsは書き込まれない", async () => {
    const { Prisma } = await import("@/lib/prisma");
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "5.0.0",
    });

    mockTxUser.create.mockRejectedValueOnce(p2002);
    mockTxUser.update.mockResolvedValueOnce(mockUser);

    await syncUser({
      sub: "auth0|xxx",
      email: "test@example.com",
      name: "テストユーザー",
    });

    expect(mockTxUser.update).toHaveBeenCalledWith({
      where: { auth0Id: "auth0|xxx" },
      data: {
        email: "test@example.com",
        name: "テストユーザー",
      },
    });
    // 既存ユーザーはoutbox不要
    expect(mockTxOutboxEvents.create).not.toHaveBeenCalled();
  });

  it("nameがnullの場合はnullとして保存される", async () => {
    mockTxUser.create.mockResolvedValueOnce({ ...mockUser, name: null });
    mockTxOutboxEvents.create.mockResolvedValueOnce({});

    await syncUser({ sub: "auth0|new", email: "new@example.com", name: null });

    expect(mockTxUser.create).toHaveBeenCalledWith({
      data: { auth0Id: "auth0|new", email: "new@example.com", name: null },
    });
  });

  it("nameが省略された場合はnullとして保存される", async () => {
    mockTxUser.create.mockResolvedValueOnce({ ...mockUser, name: null });
    mockTxOutboxEvents.create.mockResolvedValueOnce({});

    await syncUser({ sub: "auth0|new", email: "new@example.com" });

    expect(mockTxUser.create).toHaveBeenCalledWith({
      data: { auth0Id: "auth0|new", email: "new@example.com", name: null },
    });
  });

  it("P2002以外のエラーはそのままthrowされる", async () => {
    const unknownError = new Error("DB connection error");
    mockTxUser.create.mockRejectedValueOnce(unknownError);

    await expect(
      syncUser({ sub: "auth0|xxx", email: "test@example.com" })
    ).rejects.toThrow("DB connection error");
  });

  it("$transactionが呼ばれる", async () => {
    mockTxUser.create.mockResolvedValueOnce(mockUser);
    mockTxOutboxEvents.create.mockResolvedValueOnce({});

    await syncUser({ sub: "auth0|xxx", email: "test@example.com" });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});