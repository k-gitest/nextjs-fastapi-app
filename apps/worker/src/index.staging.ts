/**
 * 現在は staging / production ともにこのファイルをエントリーポイントとして使用している。
 * Render Background Worker から Web Service（UI手動管理）運用への移行に伴うもので、
 * ファイル名はstaging専用だった頃の歴史的経緯による。index.ts は当初のBackground Worker
 * 構想時のエントリーポイントで現在は未使用。将来的にリネームを検討する
 * （例: index.staging.ts → index.ts、旧index.ts → index.background.ts）。
 */

import http from "http";
import { PrismaClient } from "@repo/db";
import { startWorkerLoop } from "./worker";
import { recoverStaleEvents } from "./recovery";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";
import { startOutboxMonitoring } from "./monitor";
import { startQstashDlqMonitoring } from "./monitorQstashDlq";
import { startStorageCleanupWorker } from "./storageCleanupWorker";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  initialScope: {
    tags: { component: "outbox-worker", service: "worker" },
  },
});

const prisma = new PrismaClient();

async function main() {
  logger.info("Starting outbox worker (staging)...");

  const recovered = await recoverStaleEvents(prisma);
  logger.info(`Recovered ${recovered} stale events.`);

  const controller = new AbortController();
  startOutboxMonitoring(prisma, controller.signal);
  startQstashDlqMonitoring(controller.signal);
  startStorageCleanupWorker(prisma, controller.signal);
  const workerPromise = startWorkerLoop(prisma, controller.signal);

  // Render Free Plan用ダミーサーバー
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