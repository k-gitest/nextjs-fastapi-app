import { PrismaClient } from "@repo/db";
import { startWorkerLoop } from "./worker";
import { recoverStaleEvents } from "./recovery";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";
import { startOutboxMonitoring } from "./monitor";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  initialScope: {
    tags: { component: "outbox-worker", service: "worker" },
  },
});

const prisma = new PrismaClient();

async function main() {
  logger.info("Starting outbox worker...", {
    service: "worker",
    component: "outbox-worker",
  });

  // 起動時スイープ：クラッシュや強制終了で processing のまま残ったゾンビイベントをリセット
  // retry_count > 0 なら 'retrying'、それ以外は 'pending' に戻す
  // ※ worker.ts のポーリングでも同じ2分条件で再取得するが、
  //   起動時に明示的にリセットすることで即座に処理キューに戻る
  const recovered = await recoverStaleEvents(prisma);
  logger.info(`Recovered ${recovered} stale events.`);

  const controller = new AbortController();
  // Outbox監視をWorkerループと独立して起動
  startOutboxMonitoring(prisma, controller.signal);
  
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
