import type { outbox_events } from '@prisma/client';
import { EVENT_MAP, EVENT_TYPES, type EventType, QSTASH_TOKEN, QSTASH_URL } from './config';
import { logger } from './utils/logger';

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
  logger.info('Processing event started', { eventId: event.id, type: event.event_type });

  // ランタイム検証：未知のイベントタイプは明示的にエラー
  // まずガード。ここで EventType に型が絞り込まれる
  if (!isKnownEventType(event.event_type)) {
    throw new Error(
      `Unknown event type: "${event.event_type}". ` +
      `Supported types: ${EVENT_TYPES.join(', ')}`
    );
  }

  // イベントタイプから送信先URLを特定
  // EVENT_MAP のキーとして event.event_type を型安全に扱う
  // ガード後に1回だけ取得。as キャスト不要、undefined にならないことも保証済み
  const targetUrl = EVENT_MAP[event.event_type];
  // idempotency_key の null ガード（スキーマ上 NOT NULL だが念のため）
  const idempotencyKey = event.idempotency_key ?? event.id;

  if (!targetUrl) {
    logger.warn('No target URL found for event type', { type: event.event_type });
    // 処理できないイベントは設定ミスなので、明示的にエラーを投げて
    // ワーカー側で retry/failed に落とすのが安全です
    throw new Error(`Target URL missing for event type: ${event.event_type}`);
  }

  // 1. イベントの種類に応じて、FastAPI のどのエンドポイントに投げるか決める
  const payload: QStashPayload = {
    id: event.id,
    type: event.event_type,
    version: event.event_version,
    data: event.payload, // Todo の中身
    idempotency_key: idempotencyKey,
    aggregate_id: event.aggregate_id,
  } as const; // ここで payload の型を固定しておくと、後続の処理で型安全に扱えるようになる

  // 2. QStash (または直接 FastAPI) へ送信
  // ここでは QStash を使って FastAPI の Webhook を叩く例
  const response = await fetch(`${QSTASH_URL}/${targetUrl}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${QSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      'Upstash-Idempotency-Key': idempotencyKey, // QStash 自体の重複排除 冪等性を確保
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`External API responded with ${response.status}: ${errorText}`);
  }

  logger.info('Event delivered to QStash/FastAPI', { eventId: event.id });
}