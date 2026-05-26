import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@repo/db";
import { recoverStaleEvents } from "../../src/recovery";

const prisma = new PrismaClient();

// テスト用のprocessingイベントを作るヘルパー
async function createProcessingEvent(options: {
  retryCount?: number;
  lockedMinutesAgo?: number;
} = {}) {
  const lockedAt = new Date(
    Date.now() - (options.lockedMinutesAgo ?? 3) * 60 * 1000
  );

  return prisma.outbox_events.create({
    data: {
      aggregate_id: "recovery-test-agg",
      event_type: "todo.created",
      event_version: 1,
      payload: { id: "todo-1", title: "Recovery Test", userId: "user-1" },
      idempotency_key: `recovery-key-${Date.now()}-${Math.random()}`,
      status: "processing",
      retry_count: options.retryCount ?? 0,
      locked_at: lockedAt,
    },
  });
}

describe("recoverStaleEvents 統合テスト（実DB使用）", () => {
  beforeEach(async () => {
    await prisma.outbox_events.deleteMany({
      where: { aggregate_id: "recovery-test-agg" },
    });
  });

  afterEach(async () => {
    await prisma.outbox_events.deleteMany({
      where: { aggregate_id: "recovery-test-agg" },
    });
  });

  it("retry_count=0のprocessingイベントをpendingに戻す", async () => {
    const event = await createProcessingEvent({ retryCount: 0 });

    const recovered = await recoverStaleEvents(prisma);

    expect(recovered).toBe(1);

    const updated = await prisma.outbox_events.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(updated.status).toBe("pending");
    expect(updated.locked_at).toBeNull();
  }, 15_000);

  it("retry_count>0のprocessingイベントをretryingに戻す", async () => {
    const event = await createProcessingEvent({ retryCount: 2 });

    const recovered = await recoverStaleEvents(prisma);

    expect(recovered).toBe(1);

    const updated = await prisma.outbox_events.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(updated.status).toBe("retrying");
    expect(updated.locked_at).toBeNull();
  }, 15_000);

  it("locked_atが2分以内のイベントは回収しない", async () => {
    await createProcessingEvent({ lockedMinutesAgo: 1 }); // 1分前

    const recovered = await recoverStaleEvents(prisma);

    expect(recovered).toBe(0);
  }, 15_000);
});