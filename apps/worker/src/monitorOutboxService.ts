import { PrismaClient } from "@repo/db";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";

// 監視閾値（環境変数で上書き可能）
const FAILED_THRESHOLD = Number(process.env.MONITOR_FAILED_THRESHOLD ?? 5);
const RETRYING_THRESHOLD = Number(process.env.MONITOR_RETRYING_THRESHOLD ?? 10);
const STALE_PROCESSING_THRESHOLD = Number(process.env.MONITOR_STALE_PROCESSING_THRESHOLD ?? 5);
const STALE_PROCESSING_MS = Number(process.env.STALE_PROCESSING_MS ?? 60_000);
const STALE_RETRYING_MS = Number(process.env.STALE_RETRYING_MS ?? 15 * 60_000);
const WINDOW_MINUTES = Number(process.env.MONITOR_WINDOW_MINUTES ?? 5);

export async function runOutboxMonitor(prisma: PrismaClient): Promise<void> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const staleProcessingThreshold = new Date(Date.now() - STALE_PROCESSING_MS);
  const staleRetryingThreshold = new Date(Date.now() - STALE_RETRYING_MS);

  // ① failed件数（直近WINDOW_MINUTES分以内）
  const failedEvents = await prisma.outbox_events.findMany({
    where: {
      status: "failed",
      created_at: { gte: windowStart },
    },
    select: { id: true, last_error: true },
    take: 20,
  });

  // ② processing滞留（status=processing かつ locked_at が閾値超過）
  const staleProcessingEvents = await prisma.outbox_events.findMany({
    where: {
      status: "processing",
      locked_at: { lt: staleProcessingThreshold },
    },
    select: { id: true, last_error: true },
    take: 20,
  });

  // ③ retrying増加（全体件数）
  const retryingCount = await prisma.outbox_events.count({
    where: { status: "retrying" },
  });

  const retryingSamples =
    retryingCount >= RETRYING_THRESHOLD
      ? await prisma.outbox_events.findMany({
          where: { status: "retrying" },
          select: { id: true, last_error: true },
          take: 5,
        })
      : [];

  // ④ retrying滞留（updated_at が15分以上更新されていないもの）
  // recovery.ts や Worker の status更新時に updated_at = NOW() が設定されるため
  // updated_at < now() - 15min は「15分以上 retrying 継続」を正確に表す
  const staleRetryingEvents = await prisma.outbox_events.findMany({
    where: {
      status: "retrying",
      updated_at: { lt: staleRetryingThreshold },
    },
    select: { id: true, last_error: true },
    take: 20,
  });

  let hasAnomaly = false;

  // Critical: failed閾値超過
  if (failedEvents.length >= FAILED_THRESHOLD) {
    hasAnomaly = true;
    logger.error("outbox_failed_threshold_exceeded", {
      count: failedEvents.length,
      threshold: FAILED_THRESHOLD,
      window_minutes: WINDOW_MINUTES,
      sample_ids: failedEvents.slice(0, 5).map((e) => e.id),
      sample_errors: failedEvents.slice(0, 5).map((e) => e.last_error),
    });
    Sentry.withScope((scope) => {
      scope.setTag("component", "outbox-monitor");
      scope.setTag("monitor_type", "failed_threshold");
      scope.setLevel("error");
      scope.setContext("anomaly", {
        count: failedEvents.length,
        threshold: FAILED_THRESHOLD,
        window_minutes: WINDOW_MINUTES,
        sample_ids: failedEvents.slice(0, 5).map((e) => e.id),
      });
      Sentry.captureMessage(
        `[Critical] Outbox failed events: ${failedEvents.length} >= ${FAILED_THRESHOLD} / ${WINDOW_MINUTES}min`,
      );
    });
  }

  // Warning: processing滞留
  if (staleProcessingEvents.length >= STALE_PROCESSING_THRESHOLD) {
    hasAnomaly = true;
    logger.warn("outbox_stale_processing_detected", {
      count: staleProcessingEvents.length,
      threshold: STALE_PROCESSING_THRESHOLD,
      stale_seconds: STALE_PROCESSING_MS / 1000,
      sample_ids: staleProcessingEvents.slice(0, 5).map((e) => e.id),
    });
    Sentry.withScope((scope) => {
      scope.setTag("component", "outbox-monitor");
      scope.setTag("monitor_type", "stale_processing");
      scope.setLevel("warning");
      scope.setContext("anomaly", {
        count: staleProcessingEvents.length,
        threshold: STALE_PROCESSING_THRESHOLD,
        stale_seconds: STALE_PROCESSING_MS / 1000,
        sample_ids: staleProcessingEvents.slice(0, 5).map((e) => e.id),
      });
      Sentry.captureMessage(
        `[Warning] Outbox stale processing: ${staleProcessingEvents.length} events > ${STALE_PROCESSING_MS / 1000}s`,
      );
    });
  }

  // Warning: retrying増加
  if (retryingCount >= RETRYING_THRESHOLD) {
    hasAnomaly = true;
    logger.warn("outbox_retrying_threshold_exceeded", {
      count: retryingCount,
      threshold: RETRYING_THRESHOLD,
      sample_ids: retryingSamples.map((e) => e.id),
      sample_errors: retryingSamples.map((e) => e.last_error),
    });
    Sentry.withScope((scope) => {
      scope.setTag("component", "outbox-monitor");
      scope.setTag("monitor_type", "retrying_threshold");
      scope.setLevel("warning");
      scope.setContext("anomaly", {
        count: retryingCount,
        threshold: RETRYING_THRESHOLD,
        sample_ids: retryingSamples.map((e) => e.id),
      });
      Sentry.captureMessage(
        `[Warning] Outbox retrying count: ${retryingCount} >= ${RETRYING_THRESHOLD}`,
      );
    });
  }

  // Warning: retrying滞留（updated_at基準）
  if (staleRetryingEvents.length > 0) {
    hasAnomaly = true;
    logger.warn("outbox_stale_retrying_detected", {
      count: staleRetryingEvents.length,
      stale_minutes: STALE_RETRYING_MS / 60_000,
      sample_ids: staleRetryingEvents.slice(0, 5).map((e) => e.id),
      sample_errors: staleRetryingEvents.slice(0, 5).map((e) => e.last_error),
    });
    Sentry.withScope((scope) => {
      scope.setTag("component", "outbox-monitor");
      scope.setTag("monitor_type", "stale_retrying");
      scope.setLevel("warning");
      scope.setContext("anomaly", {
        count: staleRetryingEvents.length,
        stale_minutes: STALE_RETRYING_MS / 60_000,
        sample_ids: staleRetryingEvents.slice(0, 5).map((e) => e.id),
      });
      Sentry.captureMessage(
        `[Warning] Outbox stale retrying: ${staleRetryingEvents.length} events > ${STALE_RETRYING_MS / 60_000}min`,
      );
    });
  }

  if (!hasAnomaly) {
    logger.info("outbox_monitor_healthy");
  }
}