import http from "http";
import { PrismaClient } from "@repo/db";
import { startWorkerLoop } from "./worker";
import { recoverStaleEvents } from "./recovery";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";
import { startOutboxMonitoring } from "./monitor";
import { startQstashDlqMonitoring } from "./monitorQstashDlq";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  initialScope: {
    tags: { component: "outbox-worker", service: "worker" },
  },
});

const prisma = new PrismaClient();

async function main() {
  logger.info("Starting outbox worker...");

  // 起動時スイープ：クラッシュや強制終了で processing のまま残ったゾンビイベントをリセット
  // retry_count > 0 なら 'retrying'、それ以外は 'pending' に戻す
  // ※ worker.ts のポーリングでも同じ2分条件で再取得するが、
  //   起動時に明示的にリセットすることで即座に処理キューに戻る
  const recovered = await recoverStaleEvents(prisma);
  logger.info(`Recovered ${recovered} stale events.`);

  const controller = new AbortController();
  startOutboxMonitoring(prisma, controller.signal);
  startQstashDlqMonitoring(controller.signal);
  const workerPromise = startWorkerLoop(prisma, controller.signal);

  // Render Web Service 用ヘルスチェックサーバー。
  // 本来WorkerはHTTPサーバーを必要としないが、現行のRender構成では
  // Web Serviceとしてデプロイしているため起動している。
  // Background Workerへ移行した場合は不要となる。
  const PORT = process.env.PORT || 3000;
  const dummyServer = http.createServer((req, res) => {
    if (req.url === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Worker is healthy");
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  dummyServer.listen(PORT, () => {
    logger.info(`Health check server listening on port ${PORT}`);
  });

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down worker...");
    controller.abort();
    dummyServer.close();
    await workerPromise;
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  await workerPromise;
}

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  logger.error("Worker failed to start", { error: message });
  process.exit(1);
});