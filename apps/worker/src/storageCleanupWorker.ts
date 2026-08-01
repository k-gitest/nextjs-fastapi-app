import { PrismaClient } from "@repo/db";
import { runStorageCleanupOnce } from "./storageCleanupWorkerService";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";

const INTERVAL_MINUTES = Number(
  process.env.STORAGE_CLEANUP_INTERVAL_MINUTES ?? 1,
);
const STORAGE_CLEANUP_INTERVAL_MS = INTERVAL_MINUTES * 60_000;
const SENTRY_MONITOR_SLUG = "storage-cleanup-job";

export function startStorageCleanupWorker(prisma: PrismaClient, signal: AbortSignal): void {
  logger.info("Starting StorageCleanup worker...", {
    interval_minutes: INTERVAL_MINUTES,
  });

  let running = false;

  const run = async (): Promise<void> => {
    if (running) {
      logger.warn("storage_cleanup_already_running");
      return;
    }
    running = true;

    const checkInId = Sentry.captureCheckIn(
      { monitorSlug: SENTRY_MONITOR_SLUG, status: "in_progress" },
      {
        schedule: { type: "interval", value: INTERVAL_MINUTES, unit: "minute" },
        checkinMargin: 2,
        maxRuntime: 2,
        timezone: "UTC",
      },
    );

    try {
      await runStorageCleanupOnce(prisma);
      Sentry.captureCheckIn({ checkInId, monitorSlug: SENTRY_MONITOR_SLUG, status: "ok" });
    } catch (err: unknown) {
      logger.error("storage_cleanup_execution_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      Sentry.captureCheckIn({ checkInId, monitorSlug: SENTRY_MONITOR_SLUG, status: "error" });
      Sentry.captureException(err);
    } finally {
      running = false;
    }
  };

  void run();
  const interval = setInterval(() => void run(), STORAGE_CLEANUP_INTERVAL_MS);
  signal.addEventListener("abort", () => {
    clearInterval(interval);
    logger.info("storage_cleanup_worker_stopped");
  });
}