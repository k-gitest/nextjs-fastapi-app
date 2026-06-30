import { runQstashDlqMonitor } from "./monitorQstashDlqService";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";

const INTERVAL_MINUTES = Number(
  process.env.QSTASH_DLQ_MONITOR_INTERVAL_MINUTES ?? 5,
);
const QSTASH_DLQ_MONITOR_INTERVAL_MS = INTERVAL_MINUTES * 60_000;
const SENTRY_MONITOR_SLUG = "monitor-qstash-job";

export function startQstashDlqMonitoring(signal: AbortSignal): void {
  logger.info("Starting QStash DLQ monitoring...", {
    interval_minutes: INTERVAL_MINUTES,
  });

  let running = false;

  const run = async (): Promise<void> => {
    if (running) {
      logger.warn("qstash_dlq_monitor_already_running");
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
      await runQstashDlqMonitor();
      Sentry.captureCheckIn({ checkInId, monitorSlug: SENTRY_MONITOR_SLUG, status: "ok" });
    } catch (err: unknown) {
      logger.error("qstash_dlq_monitor_execution_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      Sentry.captureCheckIn({ checkInId, monitorSlug: SENTRY_MONITOR_SLUG, status: "error" });
      Sentry.captureException(err);
    } finally {
      running = false;
    }
  };

  void run();
  const interval = setInterval(() => void run(), QSTASH_DLQ_MONITOR_INTERVAL_MS);
  signal.addEventListener("abort", () => {
    clearInterval(interval);
    logger.info("qstash_dlq_monitoring_stopped");
  });
}