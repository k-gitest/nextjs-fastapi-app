import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncUser, getUserBySub } from "@/features/auth/services/userService";

// prismaをモック
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// qstashClientをモック
vi.mock("@/lib/qstash", () => ({
  qstashClient: {
    publishJSON: vi.fn(),
  },
}));

// モックの参照を取得
import { prisma } from "@/lib/prisma";
import { qstashClient } from "@/lib/qstash";

const mockPrismaUser = {
  id: "clx1234",
  auth0Id: "auth0|xxx",
  email: "test@example.com",
  name: "テストユーザー",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getUserBySub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("存在するユーザーを返す", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockPrismaUser);

    const result = await getUserBySub("auth0|xxx");

    expect(result).toEqual(mockPrismaUser);
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

describe("syncUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("既存ユーザーの場合はupsertのみ実行しQStashを呼ばない", async () => {
    // 既存ユーザーが存在する
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockPrismaUser);
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce(mockPrismaUser);

    await syncUser({
      sub: "auth0|xxx",
      email: "test@example.com",
      name: "テストユーザー",
    });

    expect(prisma.user.upsert).toHaveBeenCalledOnce();
    // 既存ユーザーはウェルカムメールを送らない
    expect(qstashClient.publishJSON).not.toHaveBeenCalled();
  });

  it("新規ユーザーの場合はupsertとQStash publishを実行する", async () => {
    // 既存ユーザーが存在しない（新規登録）
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce(mockPrismaUser);
    vi.mocked(qstashClient.publishJSON).mockResolvedValueOnce(undefined as never);

    await syncUser({
      sub: "auth0|new",
      email: "new@example.com",
      name: "新規ユーザー",
    });

    expect(prisma.user.upsert).toHaveBeenCalledOnce();
    // 新規ユーザーはウェルカムメールを送る
    expect(qstashClient.publishJSON).toHaveBeenCalledOnce();
  });

  it("QStashのpublishJSONに正しいpayloadが渡される", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce(mockPrismaUser);
    vi.mocked(qstashClient.publishJSON).mockResolvedValueOnce(undefined as never);

    await syncUser({
      sub: "auth0|new",
      email: "new@example.com",
      name: "新規ユーザー",
    });

    expect(qstashClient.publishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "test@example.com",
          first_name: "テストユーザー",
        }),
      })
    );
  });

  it("nameがnullの場合はfirst_nameに'User'が使われる", async () => {
    const userWithoutName = { ...mockPrismaUser, name: null };
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce(userWithoutName);
    vi.mocked(qstashClient.publishJSON).mockResolvedValueOnce(undefined as never);

    await syncUser({
      sub: "auth0|new",
      email: "new@example.com",
      name: null,
    });

    expect(qstashClient.publishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          first_name: "User",
        }),
      })
    );
  });

  it("QStash失敗時もsyncUser自体はエラーを投げない", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce(mockPrismaUser);
    vi.mocked(qstashClient.publishJSON).mockRejectedValueOnce(
      new Error("QStash Error")
    );

    // QStashが失敗してもsyncUserは正常に完了する
    await expect(
      syncUser({
        sub: "auth0|new",
        email: "new@example.com",
        name: "テスト",
      })
    ).resolves.not.toThrow();
  });

  it("upsertに正しい引数が渡される", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockPrismaUser);
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce(mockPrismaUser);

    await syncUser({
      sub: "auth0|xxx",
      email: "test@example.com",
      name: "テスト",
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { auth0Id: "auth0|xxx" },
      update: { email: "test@example.com", name: "テスト" },
      create: { auth0Id: "auth0|xxx", email: "test@example.com", name: "テスト" },
    });
  });

  it("nameがundefinedの場合はnullとして保存される", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockPrismaUser);
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce(mockPrismaUser);

    await syncUser({
      sub: "auth0|xxx",
      email: "test@example.com",
      // name を渡さない
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ name: null }),
        create: expect.objectContaining({ name: null }),
      })
    );
  });
});