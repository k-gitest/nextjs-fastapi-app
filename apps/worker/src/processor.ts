import type { outbox_events } from "@repo/db";
import {
  EVENT_MAP,
  EVENT_TYPES,
  type EventType,
  QSTASH_TOKEN,
  QSTASH_URL,
} from "./config";
import { logger } from "./utils/logger";

/**
 * QStash へ送信するペイロードの型定義
 * FastAPI 側の EventEnvelope スキーマと対応させること
 */
interface QStashPayload {
  id: string;
  type: string;
  version: number;
  data: unknown; // FastAPI 側で各イベントタイプに合わせて検証される
  idempotency_key: string;
  aggregate_id: string;
}

/**
 * event_type が既知の EventType かどうかをランタイムで検証するガード関数
 * `as keyof typeof EVENT_MAP` によるキャストではなく、
 * 実際に EVENT_TYPES 配列に含まれるかを確認する
 */
function isKnownEventType(eventType: string): eventType is EventType {
  return (EVENT_TYPES as readonly string[]).includes(eventType);
}

export async function processEvent(event: outbox_events): Promise<void> {
  logger.info("Processing event started", {
    eventId: event.id,
    type: event.event_type,
  });

  // ランタイム検証：未知のイベントタイプは明示的にエラー
  // まずガード。ここで EventType に型が絞り込まれる
  // 未知のイベントタイプ → 設定ミスなので即DLQ
  if (!isKnownEventType(event.event_type)) {
    throw new PermanentError(
      `Unknown event type: "${event.event_type}". ` +
      `Supported types: ${EVENT_TYPES.join(", ")}`,
    );
  }

  // イベントタイプから送信先URLを特定
  // EVENT_MAP のキーとして event.event_type を型安全に扱う
  // ガード後に1回だけ取得。as キャスト不要、undefined にならないことも保証済み
  const targetUrl = EVENT_MAP[event.event_type];
  // idempotency_key の null ガード（スキーマ上 NOT NULL だが念のため）
  const idempotencyKey = event.idempotency_key ?? event.id;

  if (!targetUrl) {
    logger.warn("No target URL found for event type", {
      type: event.event_type,
    });
    // 処理できないイベントは設定ミスなので、明示的にエラーを投げて
    // ワーカー側で retry/failed に落とすのが安全です
    // URL未設定 → 設定ミスなので即DLQ
    throw new PermanentError(
      `Target URL missing for event type: ${event.event_type}`,
    );
  }

  // イベントの種類に応じて、QstashからFastAPIのどのエンドポイントに投げるか決める
  const payload: QStashPayload = {
    id: event.id,
    type: event.event_type,
    version: event.event_version,
    data: event.payload, // Todo の中身
    idempotency_key: idempotencyKey,
    aggregate_id: event.aggregate_id,
  } as const; // ここで payload の型を固定しておくと、後続の処理で型安全に扱えるようになる

  let response: Response;
  // QStashへ送信
  try {
    response = await fetch(`${QSTASH_URL}/${targetUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QSTASH_TOKEN}`,
        "Content-Type": "application/json",
        "Upstash-Idempotency-Key": idempotencyKey, // QStash 自体の重複排除 冪等性を確保
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000), // 10秒でfetch自体をタイムアウト
    });
  } catch (e) {
    // DNS・ECONNRESET・AbortError(timeout)など一時障害
    throw new TransientError(
      `Network failure: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // レスポンスボディ読み込み失敗も考慮
  let errorText = "";
  if (!response.ok) {
    try {
      errorText = await response.text();
    } catch {
      errorText = "(unable to read response body)";
    }
  }

  // QStash enqueue API のステータス分類
  if (response.status === 409) {
    // Idempotency-Key重複 = 既にエンキュー済み = 目的達成
    logger.warn("Duplicate enqueue detected, treating as success", {
      eventId: event.id,
      idempotencyKey,
    });
    return;
  }

  if (response.status === 429 || response.status >= 500) {
    // QStashレートリミット or Upstash側障害 → リトライで回復見込み
    throw new TransientError(
      `QStash transient error ${response.status}: ${errorText}`,
    );
  }

  if (!response.ok) {
    // 401 invalid token / 403 forbidden / 400 bad request → 設定ミス
    throw new PermanentError(
      `QStash permanent error ${response.status}: ${errorText}`,
    );
  }

  logger.info("Event enqueued to QStash", { eventId: event.id });
}

export class TransientError extends Error {
  readonly type = "TRANSIENT"; // timeout, 502, 503など
}

export class PermanentError extends Error {
  readonly type = "PERMANENT"; // 400, validation errorなど
}
