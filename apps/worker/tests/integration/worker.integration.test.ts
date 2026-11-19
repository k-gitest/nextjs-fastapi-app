import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@repo/db";
import { startWorkerLoop } from "../../src/worker";
import { PermanentError, TransientError } from "../../src/processor";
import { logger } from "../../src/utils/logger";

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
    createdAt?: Date;
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
      ...(options.createdAt ? { created_at: options.createdAt } : {}),
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

    const controller = new AbortController();

    mockedProcessEvent.mockImplementationOnce(async () => {
      setImmediate(() => controller.abort());
      throw new TransientError("QStash timeout");
    });

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

    const controller = new AbortController();

    mockedProcessEvent.mockImplementationOnce(async () => {
      setImmediate(() => controller.abort());
      throw new PermanentError("Unknown event type");
    });

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

  it("バッチ内のイベントは created_at の昇順で処理される", async () => {
    const base = Date.now();

    // 作成順と created_at の順をずらして、並べ替えが効いていることを確認する
    const newest = await createPendingEvent({
      createdAt: new Date(base - 1_000),
    });
    const oldest = await createPendingEvent({
      createdAt: new Date(base - 3_000),
    });
    const middle = await createPendingEvent({
      createdAt: new Date(base - 2_000),
    });

    const expected = [oldest.id, middle.id, newest.id];
    const ids = new Set(expected);
    const processed: string[] = [];
    const controller = new AbortController();

    mockedProcessEvent.mockImplementation(async (event) => {
      if (!ids.has(event.id)) return;

      processed.push(event.id);

      if (processed.length === expected.length) {
        setImmediate(() => controller.abort());
      }
    });

    await startWorkerLoop(prisma, controller.signal);

    expect(processed).toEqual(expected);
  }, 15_000);

  describe("所有権の確認（locked_at による CAS）", () => {
    beforeEach(() => {
      vi.mocked(logger.info).mockClear();
      vi.mocked(logger.warn).mockClear();
    });

    it("後続イベントの locked_at は、処理の直前に更新される", async () => {
      const first = await createPendingEvent();
      const second = await createPendingEvent();
      const controller = new AbortController();

      let claimedAt: Date | null = null;
      let beforeProcessing: Date | null = null;

      mockedProcessEvent.mockImplementation(async (event) => {
        if (event.id === first.id) {
          claimedAt = (
            await prisma.outbox_events.findUniqueOrThrow({
              where: { id: second.id },
            })
          ).locked_at;
          await new Promise((r) => setTimeout(r, 50));
        } else if (event.id === second.id) {
          beforeProcessing = (
            await prisma.outbox_events.findUniqueOrThrow({
              where: { id: second.id },
            })
          ).locked_at;
          setImmediate(() => controller.abort());
        }
      });

      await startWorkerLoop(prisma, controller.signal);

      const claimedAtValue = claimedAt as Date | null;
      const beforeProcessingValue = beforeProcessing as Date | null;

      if (claimedAtValue === null || beforeProcessingValue === null) {
        throw new Error("locked_at was not captured");
      }

      expect(beforeProcessingValue.getTime()).toBeGreaterThan(
        claimedAtValue.getTime(),
      );
    }, 15_000);

    it("claim 後に回収されたイベントは、処理されずにスキップされる", async () => {
      const first = await createPendingEvent();
      const second = await createPendingEvent();
      const controller = new AbortController();

      mockedProcessEvent.mockImplementation(async (event) => {
        if (event.id === first.id) {
          // 後続イベントが、別経路で回収されたことを再現する（次回の実行は1時間後）
          await prisma.outbox_events.update({
            where: { id: second.id },
            data: {
              status: "retrying",
              locked_at: null,
              next_retry_at: new Date(Date.now() + 60 * 60 * 1000),
            },
          });
        }
      });

      const loop = startWorkerLoop(prisma, controller.signal);

      await vi.waitFor(
        () =>
          expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining("ownership lost before processing"),
            expect.anything(),
          ),
        { timeout: 5_000 },
      );

      controller.abort();
      await loop;

      expect(mockedProcessEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: second.id }),
      );
      expect(mockedProcessEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: first.id }),
      );

      const row = await prisma.outbox_events.findUniqueOrThrow({
        where: { id: second.id },
      });
      expect(row.status).toBe("retrying");
    }, 15_000);

    it("所有権を失った後の完了更新は行われない", async () => {
      const event = await createPendingEvent();
      const controller = new AbortController();

      // 別の Worker が再 claim した状況。stale 回収の対象にならないよう未来の値にする
      const otherLock = new Date(Date.now() + 60_000);

      mockedProcessEvent.mockImplementation(async () => {
        await prisma.outbox_events.update({
          where: { id: event.id },
          data: { locked_at: otherLock },
        });
      });

      const loop = startWorkerLoop(prisma, controller.signal);

      await vi.waitFor(
        () =>
          expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("ownership lost"),
            expect.anything(),
          ),
        { timeout: 5_000 },
      );

      controller.abort();
      await loop;

      const row = await prisma.outbox_events.findUniqueOrThrow({
        where: { id: event.id },
      });

      expect(row.status).toBe("processing");
      expect(row.locked_at?.getTime()).toBe(otherLock.getTime());
      expect(row.processed_at).toBeNull();
    }, 15_000);

    it("所有権を失った後のTransientErrorでは、retryingへの更新は行われない", async () => {
      const event = await createPendingEvent();
      const controller = new AbortController();

      // 現在のロック値とは異なり、stale 回収の対象にもならない未来の値にする
      const otherLock = new Date(Date.now() + 5_000);

      mockedProcessEvent.mockImplementation(async () => {
        await prisma.outbox_events.update({
          where: { id: event.id },
          data: { locked_at: otherLock },
        });
        throw new TransientError("QStash timeout");
      });

      const loop = startWorkerLoop(prisma, controller.signal);

      await vi.waitFor(
        () =>
          expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("ownership lost"),
            expect.anything(),
          ),
        { timeout: 5_000 },
      );

      controller.abort();
      await loop;

      const row = await prisma.outbox_events.findUniqueOrThrow({
        where: { id: event.id },
      });

      expect(row.status).toBe("processing");
      expect(row.retry_count).toBe(0);
      expect(row.locked_at?.getTime()).toBe(otherLock.getTime());
    }, 15_000);

    it("所有権を失った後のPermanentErrorでは、failedへの更新は行われない", async () => {
      const event = await createPendingEvent();
      const controller = new AbortController();
      const otherLock = new Date(Date.now() + 5_000);

      mockedProcessEvent.mockImplementation(async () => {
        await prisma.outbox_events.update({
          where: { id: event.id },
          data: { locked_at: otherLock },
        });
        throw new PermanentError("Unknown event type");
      });

      const loop = startWorkerLoop(prisma, controller.signal);

      await vi.waitFor(
        () =>
          expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("ownership lost"),
            expect.anything(),
          ),
        { timeout: 5_000 },
      );

      controller.abort();
      await loop;

      const row = await prisma.outbox_events.findUniqueOrThrow({
        where: { id: event.id },
      });

      expect(row.status).toBe("processing");
      expect(row.last_error).toBeNull();
    }, 15_000);
  });

  describe("shutdown 時の未着手 claim の解放", () => {
    it("処理中のイベントは完了し、未着手の claim 分は元の状態に戻る", async () => {
      const base = Date.now();
      const first = await createPendingEvent({ createdAt: new Date(base - 3000) });
      const second = await createPendingEvent({ createdAt: new Date(base - 2000) });
      const third = await createPendingEvent({
        createdAt: new Date(base - 1000),
        retryCount: 2,
        status: "retrying",
      });
      const controller = new AbortController();

      mockedProcessEvent.mockImplementation(async (event) => {
        // 最初のイベントの処理中に停止要求を受ける
        if (event.id === first.id) controller.abort();
      });

      await startWorkerLoop(prisma, controller.signal);

      const rows = await prisma.outbox_events.findMany({
        where: { id: { in: [first.id, second.id, third.id] } },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));

      // 処理中だったイベントは完了している
      expect(byId.get(first.id)?.status).toBe("sent");
      // 未着手のイベントは processing のまま残らず、元の状態へ戻る
      expect(byId.get(second.id)?.status).toBe("pending");
      expect(byId.get(second.id)?.locked_at).toBeNull();
      expect(byId.get(third.id)?.status).toBe("retrying");
      expect(byId.get(third.id)?.locked_at).toBeNull();
      expect(mockedProcessEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: second.id }),
      );
    }, 15_000);

    it("所有権を失った未着手イベントは、解放で巻き戻されない", async () => {
      const base = Date.now();
      const first = await createPendingEvent({ createdAt: new Date(base - 2000) });
      const second = await createPendingEvent({ createdAt: new Date(base - 1000) });
      const controller = new AbortController();
      const otherLock = new Date(Date.now() + 5_000); // 別の Worker が再 claim した状況

      mockedProcessEvent.mockImplementation(async (event) => {
        if (event.id === first.id) {
          await prisma.outbox_events.update({
            where: { id: second.id },
            data: { locked_at: otherLock },
          });
          controller.abort();
        }
      });

      await startWorkerLoop(prisma, controller.signal);

      const row = await prisma.outbox_events.findUniqueOrThrow({ where: { id: second.id } });
      expect(row.status).toBe("processing");
      expect(row.locked_at?.getTime()).toBe(otherLock.getTime());
    }, 15_000);

    it("所有権の更新中に停止要求を受けた場合は、処理を始めずに解放する", async () => {
      const event = await createPendingEvent();

      // 1回目（while）・2回目（for の先頭）は false、3回目（更新後）から true
      let calls = 0;
      const signal = {
        get aborted() {
          return ++calls >= 3;
        },
      } as unknown as AbortSignal;

      await startWorkerLoop(prisma, signal);

      expect(mockedProcessEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: event.id }),
      );
      const row = await prisma.outbox_events.findUniqueOrThrow({ where: { id: event.id } });
      expect(row.status).toBe("pending");
      expect(row.locked_at).toBeNull();
    }, 15_000);
  });

  describe("稼働中の stale 回収", () => {
    beforeEach(() => {
      vi.mocked(logger.warn).mockClear();
    });

    async function createStaleProcessingEvent(retryCount: number) {
      return prisma.outbox_events.create({
        data: {
          aggregate_id: "test-agg-1",
          event_type: "todo.created",
          event_version: 1,
          payload: { id: "todo-1", title: "Stale", userId: "user-1" },
          idempotency_key: `test-key-${Date.now()}-${Math.random()}`,
          status: "processing",
          retry_count: retryCount,
          locked_at: new Date(Date.now() - 3 * 60 * 1000),
          // 回収後に、同じループが取得して処理しないよう、次回の実行を未来にする
          next_retry_at: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    }

    it("2分より前の processing は、稼働中のループが pending / retrying に戻す", async () => {
      const noRetry = await createStaleProcessingEvent(0);
      const withRetry = await createStaleProcessingEvent(2);
      const controller = new AbortController();

      const loop = startWorkerLoop(prisma, controller.signal);
      await vi.waitFor(
        () =>
          expect(logger.warn).toHaveBeenCalledWith(
            "Recovered stale locked events during polling",
            expect.anything(),
          ),
        { timeout: 5_000 },
      );
      controller.abort();
      await loop;

      const a = await prisma.outbox_events.findUniqueOrThrow({ where: { id: noRetry.id } });
      const b = await prisma.outbox_events.findUniqueOrThrow({ where: { id: withRetry.id } });
      expect(a.status).toBe("pending");
      expect(a.locked_at).toBeNull();
      expect(b.status).toBe("retrying");
      expect(b.retry_count).toBe(2); // 回収で変わらない
      expect(b.locked_at).toBeNull();
      expect(mockedProcessEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: noRetry.id }),
      );
    }, 15_000);
  });
});
