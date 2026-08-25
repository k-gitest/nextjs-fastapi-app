import type { outbox_events } from "@repo/db";
import {
  EVENT_MAP,
  EVENT_TYPES,
  type EventType,
  QSTASH_TOKEN,
  QSTASH_PUBLISH_URL,
} from "./config";
import { logger } from "./utils/logger";
import { deleteB2Object } from "./lib/b2";

interface QStashPayload {
  id: string;
  type: string;
  version: number;
  data: unknown;
  idempotency_key: string;
  aggregate_id: string;
}

function isKnownEventType(eventType: string): eventType is EventType {
  return (EVENT_TYPES as readonly string[]).includes(eventType);
}

export async function processEvent(
  event: outbox_events,
  signal?: AbortSignal,
): Promise<void> {
  logger.info("Processing event started", {
    eventId: event.id,
    type: event.event_type,
  });

  // ランタイム検証：未知のイベントタイプは明示的にエラー
  if (!isKnownEventType(event.event_type)) {
    throw new PermanentError(
      `Unknown event type: "${event.event_type}". ` +
      `Supported types: ${EVENT_TYPES.join(", ")}`,
    );
  }

  // isKnownEventType()はevent.event_type（プロパティアクセス式）をEventTypeへ
  // 絞り込むが、TSの制御フロー解析はevent自体（オブジェクト全体の型）までは
  // 絞り込まない。ここでランタイム検証済みの型として明示的に束縛し直す
  // （isKnownEventTypeによる実行時チェックの直後のみ許容する）。
  const typedEvent = event as outbox_events & { event_type: EventType };

  // Storage系イベントはQStashを経由しない別経路。
  // event_typeで最初に分岐し、以降のQStash専用ロジックとは完全に分離する。
  if (event.event_type === "image.storage_delete_requested") {
    return await processStorageDeleteEvent(typedEvent);
  }

  return await processQStashEvent(typedEvent, signal);
}

/**
 * Storage系イベント（B2 DeleteObjectの実行）。
 *
 * B2のDeleteObjectは実測により、存在しないKeyへの削除も例外を投げず
 * 成功（204）することを確認済み（verifyB2DeleteIdempotency.tsでの検証結果）。
 * そのため404相当を明示的に「成功扱い」へ正規化するコードは不要で、
 * 例外が発生しなければそのまま成功として扱ってよい。
 */
async function processStorageDeleteEvent(event: outbox_events): Promise<void> {
  const payload = event.payload as { storage_key?: unknown };
  const storageKey = payload?.storage_key;

  if (typeof storageKey !== "string" || storageKey.length === 0) {
    // payload不正は設定ミスの一種であり、リトライしても解決しない
    throw new PermanentError(
      `Invalid payload for image.storage_delete_requested: storage_key is missing or not a string (eventId: ${event.id})`,
    );
  }

  try {
    await deleteB2Object(storageKey);
  } catch (error) {
    throw classifyB2Error(error);
  }

  logger.info("Storage delete event completed", {
    eventId: event.id,
    aggregateId: event.aggregate_id,
  });
}

/**
 * AWS SDK v3（S3互換）のエラーを Permanent / Transient に分類する。
 *
 * 実測（verifyB2DeleteIdempotency.ts）により、存在しないKeyへのDeleteObjectは
 * 例外を投げないことを確認済み。そのためここに到達するのは、認証・設定・
 * ネットワーク等の「本当のエラー」のみである。
 *
 * HTTP statusコードが取得できる場合:
 *   - 429（レートリミット） → Transient（リトライで回復見込み）
 *   - 5xx（B2側の一時障害） → Transient
 *   - それ以外の4xx（401認証エラー・403権限不足・400設定不備等） → Permanent
 *     （リトライしても解決しない設定・権限の問題であるため）
 * HTTP statusコードが取得できない場合（ネットワーク断・タイムアウト等）:
 *   - Transient（不明なエラーで即DLQに落とすより、リトライで様子を見る方が安全）
 */
function classifyB2Error(error: unknown): PermanentError | TransientError {
  const httpStatusCode =
    error && typeof error === "object" && "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode
      : undefined;

  const message = error instanceof Error ? error.message : String(error);

  if (httpStatusCode !== undefined) {
    if (httpStatusCode === 429 || httpStatusCode >= 500) {
      return new TransientError(`B2 transient error ${httpStatusCode}: ${message}`);
    }
    if (httpStatusCode >= 400) {
      return new PermanentError(`B2 permanent error ${httpStatusCode}: ${message}`);
    }
  }

  // httpStatusCodeが取れない場合（ネットワーク断・タイムアウト等）はTransient扱い
  return new TransientError(`B2 delete failed: ${message}`);
}

async function processQStashEvent(
  event: outbox_events & { event_type: EventType },
  signal?: AbortSignal,
): Promise<void> {
  const targetUrl = EVENT_MAP[event.event_type];
  const idempotencyKey = event.idempotency_key ?? event.id;

  if (!targetUrl) {
    logger.warn("No target URL found for event type", {
      type: event.event_type,
    });
    throw new PermanentError(
      `Target URL missing for event type: ${event.event_type}`,
    );
  }

  const payload: QStashPayload = {
    id: event.id,
    type: event.event_type,
    version: event.event_version,
    data: event.payload,
    idempotency_key: idempotencyKey,
    aggregate_id: event.aggregate_id,
  };

  let response: Response;
  try {
    response = await fetch(`${QSTASH_PUBLISH_URL}/${targetUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QSTASH_TOKEN}`,
        "Content-Type": "application/json",
        "Upstash-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: signal ?? AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new TransientError(
      `Network failure: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  let errorText = "";
  if (!response.ok) {
    try {
      errorText = await response.text();
    } catch {
      errorText = "(unable to read response body)";
    }
  }

  if (response.status === 409) {
    logger.warn("Duplicate enqueue detected, treating as success", {
      eventId: event.id,
      idempotencyKey,
    });
    return;
  }

  if (response.status === 429 || response.status >= 500) {
    throw new TransientError(
      `QStash transient error ${response.status}: ${errorText}`,
    );
  }

  if (!response.ok) {
    throw new PermanentError(
      `QStash permanent error ${response.status}: ${errorText}`,
    );
  }

  logger.info("Event enqueued to QStash", { eventId: event.id });
}

export class TransientError extends Error {
  readonly type = "TRANSIENT";
}

export class PermanentError extends Error {
  readonly type = "PERMANENT";
}