/**
 * runOutboxMonitor を1回だけ実行するスクリプト
 *
 * Worker停止状態でmonitor④（stale retrying検知）を単独検証する際に使用。
 * Worker起動時の非同期競合でWorkerが先にレコードを取得した場合のフォールバック手順。
 *
 * 実行:
 *   docker compose run --rm worker npx tsx scripts/runMonitorOnce.ts
 */
import { PrismaClient } from "@repo/db";
import { runOutboxMonitor } from "../src/monitorOutboxService";
import { logger } from "../src/utils/logger";
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  initialScope: {
    tags: { component: "outbox-monitor", service: "worker" },
  },
});

const prisma = new PrismaClient();

async function main() {
  logger.info("run_monitor_once_started");
  await runOutboxMonitor(prisma);
  await Sentry.flush(2000); // 短命コンテナのため明示的にフラッシュ
  console.log("SENTRY_DSN:", process.env.SENTRY_DSN ? "set" : "not set");
  logger.info("run_monitor_once_completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());