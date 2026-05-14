import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@repo/db";
import { startWorkerLoop } from "../../src/worker";

// processEvent をモック
// 統合テストの目的は「worker.ts の状態遷移ロジック」であり、
// QStash への実際の送信は processor.test.ts でカバー済み
vi.mock("../../src/processor", () => ({
  processEvent: vi.fn(),
  PermanentError: class PermanentError extends Error {
    readonly type = "PERMANENT";
  },
  TransientError: class TransientError extends Error {
    readonly type = "TRANSIENT";
  },
}));

// logger はコンソール出力を抑制するためモック
vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Sentry はテスト環境では不要
vi.mock("@sentry/node", () => ({
  withScope: vi.fn((cb) => cb({ setTag: vi.fn() })),
  captureException: vi.fn(),
}));

const prisma = new PrismaClient();

// テスト用イベントを DB に挿入するヘルパー
async function createPendingEvent(overrides: {
  idempotencyKey?: string;
  retryCount?: number;
  status?: "pending" | "retrying";
} = {}) {
  const idempotencyKey =
    overrides.idempotencyKey ?? `test-key-${Date.now()}-${Math.random()}`;

  return prisma.outbox_events.create({
    data: {
      aggregate_id: "test-agg-1",
      event_type: "todo.created",
      event_version: 1,
      payload: { id: "todo-1", title: "Test Todo", userId: "user-1" },
      idempotency_key: idempotencyKey,
      status: overrides.status ?? "pending",
      retry_count: overrides.retryCount ?? 0,
    },
  });
}

// Worker を1回だけポーリングさせて停止するヘルパー
// processEvent の完了を待ってから abort することで
// ループが1周するのを保証する
async function runWorkerOnce(prisma: PrismaClient): Promise<void> {
  const controller = new AbortController();

  // processEvent の mock が呼ばれたら即 abort
  const { processEvent } = await import("../../src/processor");
  const mockedProcessEvent = vi.mocked(processEvent);

  const originalImpl = mockedProcessEvent.getMockImplementation();
  mockedProcessEvent.mockImplementationOnce(async (...args) => {
    const result = originalImpl ? await originalImpl(...args) : undefined;
    controller.abort();
    return result;
  });

  await startWorkerLoop(prisma, controller.signal);
}

describe("worker.ts 統合テスト（実DB使用）", () => {
  beforeEach(async () => {
    // テスト前にテスト用イベントをクリア
    await prisma.outbox_events.deleteMany({
      where: { aggregate_id: "test-agg-1" },
    });

    const { processEvent } = await import("../../src/processor");
    vi.mocked(processEvent).mockReset();
  });

  afterEach(async () => {
    await prisma.outbox_events.deleteMany({
      where: { aggregate_id: "test-agg-1" },
    });
  });

  it("success flow: pending → sent", async () => {
    // Arrange
    const { processEvent } = await import("../../src/processor");
    vi.mocked(processEvent).mockResolvedValueOnce(undefined);

    const event = await createPendingEvent();

    // Act
    await runWorkerOnce(prisma);

    // Assert
    const updated = await prisma.outbox_events.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(updated.status).toBe("sent");
    expect(updated.processed_at).not.toBeNull();
    expect(updated.locked_at).toBeNull();
  });

  it("transient retry: TransientError → retrying（retry_count increment）", async () => {
    // Arrange
    const { processEvent, TransientError } = await import("../../src/processor");
    vi.mocked(processEvent).mockRejectedValueOnce(
      new TransientError("QStash timeout"),
    );

    const event = await createPendingEvent();

    // Act
    await runWorkerOnce(prisma);

    // Assert
    const updated = await prisma.outbox_events.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(updated.status).toBe("retrying");
    expect(updated.retry_count).toBe(1);
    expect(updated.next_retry_at).not.toBeNull();
    expect(updated.last_error).toContain("QStash timeout");
    expect(updated.locked_at).toBeNull();
  });

  it("permanent failure: PermanentError → failed（retry_countに関わらず即DLQ）", async () => {
    // Arrange
    const { processEvent, PermanentError } = await import("../../src/processor");
    vi.mocked(processEvent).mockRejectedValueOnce(
      new PermanentError("Unknown event type"),
    );

    const event = await createPendingEvent();

    // Act
    await runWorkerOnce(prisma);

    // Assert
    const updated = await prisma.outbox_events.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(updated.status).toBe("failed");
    expect(updated.last_error).toContain("Unknown event type");
    expect(updated.locked_at).toBeNull();
    // PermanentError は retry_count を increment しない
    expect(updated.retry_count).toBe(0);
  });
});