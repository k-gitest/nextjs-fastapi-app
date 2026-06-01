/**
 * monitor-outbox の stale retryingテスト用スクリプト
 *
 * updated_at が15分以上前のretryingイベントを1件作成する。
 * runOutboxMonitor() が outbox_stale_retrying_detected を検知することを確認するために使用。
 *
 * 実行:
 *   docker compose exec worker npx tsx scripts/testMonitorStaleRetrying.ts
 */
import { PrismaClient } from "@repo/db";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  // updated_at を20分前に設定（15分閾値を確実に超えるため）
  const staleTime = new Date(Date.now() - 20 * 60 * 1000);

  // $executeRaw で updated_at を直接指定（Prisma の @updatedAt を回避）
  await prisma.$executeRaw`
    INSERT INTO outbox_events (
      aggregate_id,
      event_type,
      payload,
      idempotency_key,
      status,
      retry_count,
      last_error,
      next_retry_at,
      updated_at
    ) VALUES (
      'monitor-test-stale-retrying',
      'monitor.test',
      '{"test": true}'::jsonb,
      ${crypto.randomUUID()},
      'retrying'::"OutboxStatus",
      3,
      'monitor test: intentional stale retrying event',
      ${new Date(Date.now() - 16 * 60 * 1000)},
      ${staleTime}
    )
  `;

  console.log(`[OK] stale retryingイベントを作成しました（updated_at: ${staleTime.toISOString()}）`);
  console.log("monitor-outboxが次回実行時に outbox_stale_retrying_detected を検知するはずです");
  console.log("確認後は以下で削除してください:");
  console.log('  DELETE FROM outbox_events WHERE event_type = \'monitor.test\';');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());