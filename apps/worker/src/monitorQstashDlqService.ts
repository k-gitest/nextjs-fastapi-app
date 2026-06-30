import { logger } from "./utils/logger";
import { QSTASH_TOKEN, QSTASH_DLQ_URL } from "./config";
import * as Sentry from "@sentry/node";

const FETCH_LIMIT = 100;

interface DlqMessage {
  messageId: string;
  url: string;
  maxRetries: number;
  createdAt: number; // unix timestamp(ms)
  responseStatus?: number;
  dlqId: string;
}

interface DlqListResponse {
  messages: DlqMessage[];
}

export async function runQstashDlqMonitor(): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${QSTASH_DLQ_URL}?count=${FETCH_LIMIT}`, {
      headers: { Authorization: `Bearer ${QSTASH_TOKEN}` },
    });
  } catch (e) {
    logger.error("qstash_dlq_check_network_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    Sentry.captureException(e);
    return;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(unreadable)");
    logger.error("qstash_dlq_check_failed", {
      status: response.status,
      error: errorText,
    });
    Sentry.withScope((scope) => {
      scope.setTag("component", "qstash-dlq-monitor");
      scope.setLevel("error");
      Sentry.captureMessage(`[Error] QStash DLQ API call failed: ${response.status}`);
    });
    return;
  }

  const data = (await response.json()) as DlqListResponse;
  const sampleCount = data.messages?.length ?? 0;
  // QStash /v2/dlq は count パラメータで取得件数を制限するのみで、
  // DLQ全体の総件数は返さない。sample_countは「取得した件数」であり
  // fetch_limitに達している場合は実際の総件数がそれ以上の可能性がある。

  if (sampleCount > 0) {
    const oldest = data.messages.reduce((min, m) =>
      m.createdAt < min.createdAt ? m : min,
    );
    const oldestAgeMinutes = Math.floor((Date.now() - oldest.createdAt) / 60_000);
    const possiblyTruncated = sampleCount >= FETCH_LIMIT;

    logger.warn("qstash_dlq_detected", {
      sample_count: sampleCount,
      fetch_limit: FETCH_LIMIT,
      possibly_truncated: possiblyTruncated,
      oldest_message_age_minutes: oldestAgeMinutes,
      oldest_url: oldest.url,
      sample: data.messages.slice(0, 5).map((m) => ({
        dlqId: m.dlqId,
        url: m.url,
        status: m.responseStatus,
      })),
    });

    Sentry.withScope((scope) => {
      scope.setTag("component", "qstash-dlq-monitor");
      scope.setTag("monitor_type", "qstash_dlq");
      scope.setLevel("error");
      scope.setContext("anomaly", {
        sample_count: sampleCount,
        possibly_truncated: possiblyTruncated,
        oldest_message_age_minutes: oldestAgeMinutes,
        oldest_url: oldest.url,
      });
      Sentry.captureMessage(
        `[Critical] QStash DLQ: ${sampleCount}${possiblyTruncated ? "+" : ""} message(s) stuck, oldest ${oldestAgeMinutes}min`,
      );
    });
  } else {
    logger.info("qstash_dlq_monitor_healthy");
  }
}