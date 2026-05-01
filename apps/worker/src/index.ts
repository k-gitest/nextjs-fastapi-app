import { PrismaClient } from "@repo/db";
import { startWorkerLoop } from "./worker";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  initialScope: {
    tags: { component: "outbox-worker" },
  },
});

const prisma = new PrismaClient();

async function main() {
  logger.info("Starting outbox worker...");

  // 起動時スイープ：クラッシュや強制終了で processing のまま残ったゾンビイベントをリセット
  // retry_count > 0 なら 'retrying'、それ以外は 'pending' に戻す
  // ※ worker.ts のポーリングでも同じ2分条件で再取得するが、
  //   起動時に明示的にリセットすることで即座に処理キューに戻る
  const recovered = await prisma.$executeRaw`
    UPDATE outbox_events
    SET locked_at = NULL,
        status = CASE
                   WHEN retry_count > 0 THEN 'retrying'::"OutboxStatus"
                   ELSE 'pending'::"OutboxStatus"
                 END
    WHERE status = 'processing'
      AND locked_at < NOW() - INTERVAL '2 minutes'
  `;
  logger.info(`Recovered ${recovered} stale events.`);

  const controller = new AbortController();
  const workerPromise = startWorkerLoop(prisma, controller.signal);

  // Prisma の接続をグレースフルに閉じる
  // worker.ts の SIGTERM ハンドラがループを止めた後にここが走る
  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down worker...");
    controller.abort();
    await workerPromise;
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  await workerPromise; // メインループ開始しループ終了を待機
}

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  logger.error("Worker failed to start", { error: message });
  process.exit(1);
});
