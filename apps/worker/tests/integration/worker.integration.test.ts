import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@repo/db";
import { startWorkerLoop } from "../../src/worker";
import { PermanentError, TransientError } from "../../src/processor";

// processEvent をモック
// 統合テストの目的は「worker.ts の状態遷移ロジック」であり、
// QStash への実際の送信は processor.test.ts でカバー済み
vi.mock("../../src/processor", () => {
  class PermanentError extends Error {
    readonly type = "PERMANENT";
  }
  class TransientError extends Error {
    readonly type = "TRANSIENT";
  }
  return {
    processEvent: vi.fn(),
    PermanentError,
    TransientError,
  };
});

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
  withScope: vi.fn((cb: (scope: { setTag: () => void }) => void) =>
    cb({ setTag: vi.fn() }),
  ),
  captureException: vi.fn(),
  init: vi.fn(),
}));

import { processEvent } from "../../src/processor";
const mockedProcessEvent = vi.mocked(processEvent);

const prisma = new PrismaClient();

// テスト用イベントを DB に挿入するヘルパー
async function createPendingEvent(
  options: {
    retryCount?: number;
    status?: "pending" | "retrying";
  } = {},
) {
  return prisma.outbox_events.create({
    data: {
      aggregate_id: "test-agg-1",
      event_type: "todo.created",
      event_version: 1,
      payload: { id: "todo-1", title: "Test Todo", userId: "user-1" },
      idempotency_key: `test-key-${Date.now()}-${Math.random()}`,
      status: options.status ?? "pending",
      retry_count: options.retryCount ?? 0,
    },
  });
}

// Worker を1イベント処理したら停止するヘルパー
// processEvent の mock 実行後に abort することで1周を保証する
async function runWorkerOnce(): Promise<void> {
  const controller = new AbortController();

  mockedProcessEvent.mockImplementationOnce(async () => {
    // 処理完了直後に abort → ループが次のイテレーションに入る前に停止
    setImmediate(() => controller.abort());
  });

  await startWorkerLoop(prisma, controller.signal);
}

describe("worker.ts 統合テスト（実DB使用）", () => {
  beforeEach(async () => {
    mockedProcessEvent.mockReset();
    await prisma.outbox_events.deleteMany({
      where: { aggregate_id: "test-agg-1" },
    });
  });

  afterEach(async () => {
    await prisma.outbox_events.deleteMany({
      where: { aggregate_id: "test-agg-1" },
    });
  });

  it("success flow: pending → sent", async () => {
    const event = await createPendingEvent();

    await runWorkerOnce();

    const updated = await prisma.outbox_events.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(updated.status).toBe("sent");
    expect(updated.processed_at).not.toBeNull();
    expect(updated.locked_at).toBeNull();
  }, 15_000);

  it("transient retry: TransientError → retrying（retry_count increment）", async () => {
    const event = await createPendingEvent();

    mockedProcessEvent.mockImplementationOnce(async () => {
      setImmediate(() => controller.abort());
      throw new TransientError("QStash timeout");
    });

    const controller = new AbortController();
    await startWorkerLoop(prisma, controller.signal);

    const updated = await prisma.outbox_events.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(updated.status).toBe("retrying");
    expect(updated.retry_count).toBe(1);
    expect(updated.next_retry_at).not.toBeNull();
    expect(updated.last_error).toContain("QStash timeout");
    expect(updated.locked_at).toBeNull();
  }, 15_000);

  it("permanent failure: PermanentError → failed（即DLQ）", async () => {
    const event = await createPendingEvent();

    mockedProcessEvent.mockImplementationOnce(async () => {
      setImmediate(() => controller.abort());
      throw new PermanentError("Unknown event type");
    });

    const controller = new AbortController();
    await startWorkerLoop(prisma, controller.signal);

    const updated = await prisma.outbox_events.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(updated.status).toBe("failed");
    expect(updated.last_error).toContain("Unknown event type");
    expect(updated.locked_at).toBeNull();
    expect(updated.retry_count).toBe(0);
  }, 15_000);

  it("replay: 複数のpendingイベントが全件sentになる", async () => {
    // 3件のpendingイベントを作成
    const events = await Promise.all([
      createPendingEvent(),
      createPendingEvent(),
      createPendingEvent(),
    ]);

    // 各イベントの処理後にabortするため、3回分のmockを設定
    const controller = new AbortController();
    let processedCount = 0;

    mockedProcessEvent.mockImplementation(async () => {
      processedCount++;
      if (processedCount >= events.length) {
        setImmediate(() => controller.abort());
      }
    });

    await startWorkerLoop(prisma, controller.signal);

    // 全件sentになっているか確認
    const updated = await prisma.outbox_events.findMany({
      where: { id: { in: events.map((e) => e.id) } },
    });

    expect(updated).toHaveLength(3);
    updated.forEach((event) => {
      expect(event.status).toBe("sent");
      expect(event.processed_at).not.toBeNull();
      expect(event.locked_at).toBeNull();
    });
  }, 15_000);
});
