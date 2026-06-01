/**
 * monitor-outbox の failed閾値テスト用スクリプト
 *
 * 直近5分以内に作成された failed イベントを5件作成する。
 * runOutboxMonitor() が outbox_failed_threshold_exceeded を検知することを確認するために使用。
 *
 * 使用後は手動で削除するか、event_type = "monitor.test" で絞り込んで削除すること。
 *
 * 実行:
 *   docker compose exec worker npx tsx scripts/testMonitorFailed.ts
 */
import { PrismaClient } from "@repo/db";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const count = 5;

  await prisma.outbox_events.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      aggregate_id: `monitor-test-failed-${i}`,
      event_type: "monitor.test",
      payload: { test: true },
      idempotency_key: crypto.randomUUID(),
      status: "failed",
      last_error: "monitor test: intentional failed event",
    })),
  });

  console.log(`[OK] ${count}件のfailedイベントを作成しました`);
  console.log("monitor-outboxが次回実行時に outbox_failed_threshold_exceeded を検知するはずです");
  console.log("確認後は以下で削除してください:");
  console.log('  DELETE FROM outbox_events WHERE event_type = \'monitor.test\';');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());