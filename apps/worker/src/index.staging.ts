/**
  * 【現在未使用】このファイルは実際には staging / production いずれのエントリーポイントとしても
  * 使われていない。package.json の dev スクリプト・Render の start command は
  * apps/worker/src/index.ts（Web Serviceダミーサーバー込み）を参照している。
  *
  * ファイル名が index.staging.ts であること自体が誤解を招く（stagingで使われている
  * わけではない）。過去、Web Service運用への移行に伴う一時的な構成として作られたが、
  * 現在は index.ts に一本化されている。
  *
  * 起動系ファイルを変更する際は、このコメントを鵜呑みにせず package.json の scripts /
  * Render の start command / Terraform の command 設定という一次情報を必ず確認すること。
  *
  * 削除または用途の再定義を検討する（未着手）。
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