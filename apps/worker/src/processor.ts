import type { outbox_events } from '@prisma/client';
import { EVENT_MAP, QSTASH_TOKEN, QSTASH_URL } from './config';
import { logger } from './utils/logger';

export async function processEvent(event: outbox_events): Promise<void> {
  logger.info('Processing event started', { eventId: event.id, type: event.event_type });

  // 1. イベントタイプから送信先URLを特定
  // EVENT_MAP のキーとして event.event_type を型安全に扱う
  const targetUrl = EVENT_MAP[event.event_type as keyof typeof EVENT_MAP];

  if (!targetUrl) {
    logger.warn('No target URL found for event type', { type: event.event_type });
    // 処理できないイベントは設定ミスなので、明示的にエラーを投げて
    // ワーカー側で retry/failed に落とすのが安全です
    throw new Error(`Target URL missing for event type: ${event.event_type}`);
  }

  // 1. イベントの種類に応じて、FastAPI のどのエンドポイントに投げるか決める
  const payload = {
    id: event.id,
    type: event.event_type,
    version: event.event_version,
    data: event.payload, // Todo の中身
    idempotency_key: event.idempotency_key,
    aggregate_id: event.aggregate_id,
  };

  // 2. QStash (または直接 FastAPI) へ送信
  // ここでは QStash を使って FastAPI の Webhook を叩く例
  const response = await fetch(`${QSTASH_URL}/${targetUrl}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${QSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      'Upstash-Idempotency-Key': event.idempotency_key ?? event.id, // QStash 自体の重複排除 冪等性を確保
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`External API responded with ${response.status}: ${errorText}`);
  }

  logger.info('Event delivered to QStash/FastAPI', { eventId: event.id });
}