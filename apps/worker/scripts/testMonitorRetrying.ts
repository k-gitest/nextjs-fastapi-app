/**
 * monitor-outbox の retrying件数閾値テスト用スクリプト
 *
 * retrying状態のイベントを10件作成する。
 * runOutboxMonitor() が outbox_retrying_threshold_exceeded を検知することを確認するために使用。
 *
 * 実行:
 *   docker compose exec worker npx tsx scripts/testMonitorRetrying.ts
 */
import { PrismaClient } from "@repo/db";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const count = 10;

  await prisma.outbox_events.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      aggregate_id: `monitor-test-retrying-${i}`,
      event_type: "monitor.test",
      payload: { test: true },
      idempotency_key: crypto.randomUUID(),
      status: "failed",
      retry_count: 1,
      last_error: "monitor test: intentional retrying event",
      next_retry_at: new Date(Date.now() + 60_000),
    })),
  });

  console.log(`[OK] ${count}件のretryingイベントを作成しました`);
  console.log("monitor-outboxが次回実行時に outbox_retrying_threshold_exceeded を検知するはずです");
  console.log("確認後は以下で削除してください:");
  console.log('  DELETE FROM outbox_events WHERE event_type = \'monitor.test\';');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());