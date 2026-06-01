/**
 * monitor-outboxテスト用イベントのクリーンアップスクリプト
 *
 * event_type = "monitor.test" のレコードを全件削除する。
 *
 * 実行:
 *   docker compose exec worker npx tsx scripts/cleanupMonitorTestEvents.ts
 */
import { PrismaClient } from "@repo/db";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.outbox_events.deleteMany({
    where: { event_type: "monitor.test" },
  });
  console.log(`[OK] ${result.count}件のテストイベントを削除しました`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());