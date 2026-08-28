import { describe, it, expect, vi, beforeEach } from "vitest";
import type { outbox_events } from "@repo/db";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    outbox_events: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  
}));

// albumService.test.ts / createImage.test.ts と同様、実物の @repo/db には依存せず、
// vi.mock ファクトリ内で軽量なクラスとして提供する。
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

const mockOutboxEvent = {
  id: "outbox-1",
  aggregate_id: `user:${mockUser.id}`,
  event_type: "user.registered",
  event_version: 1,
  payload: {},
  status: "pending",
  retry_count: 0,
  last_error: null,
  idempotency_key: `user.registered:${mockUser.id}`,
  locked_at: null,
  next_retry_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
  processed_at: null,
} satisfies outbox_events;

beforeEach(() => {
  vi.clearAllMocks();
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
    vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser);
    vi.mocked(prisma.outbox_events.create).mockResolvedValueOnce(mockOutboxEvent);

    await syncUser({
      sub: "auth0|xxx",
      email: "test@example.com",
      name: "テストユーザー",
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        auth0Id: "auth0|xxx",
        email: "test@example.com",
        name: "テストユーザー",
      },
    });
    expect(prisma.outbox_events.create).toHaveBeenCalledOnce();
  });

  it("新規ユーザーのoutbox_eventsにevent_type=user.registeredが設定される", async () => {
    vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser);
    vi.mocked(prisma.outbox_events.create).mockResolvedValueOnce(mockOutboxEvent);

    await syncUser({
      sub: "auth0|xxx",
      email: "test@example.com",
      name: "テストユーザー",
    });

    expect(prisma.outbox_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: "user.registered",
          idempotency_key: `user.registered:${mockUser.id}`,
        }),
      }),
    );
  });

  it("既存ユーザーの場合(P2002): updateが呼ばれ、outbox_eventsは書き込まれない", async () => {
    const { Prisma } = await import("@repo/db");
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint",
      {
        code: "P2002",
        clientVersion: "5.0.0",
      },
    );

    vi.mocked(prisma.user.create).mockRejectedValueOnce(p2002);
    vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser);

    await syncUser({
      sub: "auth0|xxx",
      email: "test@example.com",
      name: "テストユーザー",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { auth0Id: "auth0|xxx" },
      data: {
        email: "test@example.com",
        name: "テストユーザー",
      },
    });
    expect(prisma.outbox_events.create).not.toHaveBeenCalled();
  });

  it("nameがnullの場合はnullとして保存される", async () => {
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ ...mockUser, name: null });
    vi.mocked(prisma.outbox_events.create).mockResolvedValueOnce(mockOutboxEvent);

    await syncUser({ sub: "auth0|new", email: "new@example.com", name: null });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { auth0Id: "auth0|new", email: "new@example.com", name: null },
    });
  });

  it("nameが省略された場合はnullとして保存される", async () => {
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ ...mockUser, name: null });
    vi.mocked(prisma.outbox_events.create).mockResolvedValueOnce(mockOutboxEvent);

    await syncUser({ sub: "auth0|new", email: "new@example.com" });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { auth0Id: "auth0|new", email: "new@example.com", name: null },
    });
  });

  it("P2002以外のエラーはそのままthrowされる", async () => {
    const unknownError = new Error("DB connection error");
    vi.mocked(prisma.user.create).mockRejectedValueOnce(unknownError);

    await expect(
      syncUser({ sub: "auth0|xxx", email: "test@example.com" }),
    ).rejects.toThrow("DB connection error");
  });

  it("$transactionは呼ばれない", async () => {
    vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser);
    vi.mocked(prisma.outbox_events.create).mockResolvedValueOnce(mockOutboxEvent);

    await syncUser({ sub: "auth0|xxx", email: "test@example.com" });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});