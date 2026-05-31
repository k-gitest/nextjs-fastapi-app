import { PrismaClient } from "@repo/db";
import { runOutboxMonitor } from "./monitorOutboxService";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";

const MONITOR_INTERVAL_MS = Number(
  process.env.MONITOR_INTERVAL_MS ?? 5 * 60 * 1000,
);
const SENTRY_MONITOR_SLUG = "monitor-outbox-job";

export function startOutboxMonitoring(
  prisma: PrismaClient,
  signal: AbortSignal,
): void {
  logger.info("Starting outbox monitoring...", {
    interval_ms: MONITOR_INTERVAL_MS,
  });

  let running = false;

  const run = async (): Promise<void> => {
    if (running) {
      logger.warn("outbox_monitor_already_running");
      return;
    }
    running = true;

    const checkInId = Sentry.captureCheckIn(
      {
        monitorSlug: SENTRY_MONITOR_SLUG,
        status: "in_progress",
      },
      {
        schedule: {
          type: "interval",
          value: 5,
          unit: "minute",
        },
        checkinMargin: 2,
        maxRuntime: 2,
        timezone: "UTC",
      },
    );

    try {
      await runOutboxMonitor(prisma);
      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: SENTRY_MONITOR_SLUG,
        status: "ok",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("outbox_monitor_execution_failed", { error: message });
      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: SENTRY_MONITOR_SLUG,
        status: "error",
      });
      Sentry.captureException(err);
    } finally {
      running = false;
    }
  };

  // 起動時に即1回実行
  void run();

  const interval = setInterval(() => void run(), MONITOR_INTERVAL_MS);

  // グレースフルシャットダウン対応
  signal.addEventListener("abort", () => {
    clearInterval(interval);
    logger.info("outbox_monitoring_stopped");
  });
}