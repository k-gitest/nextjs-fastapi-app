// 💡 Worker専用の環境変数から読み込む
export const FASTAPI_PUBLIC_URL = process.env.FASTAPI_PUBLIC_URL ?? "http://localhost:8000";
export const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
export const QSTASH_BASE_URL = process.env.QSTASH_URL ?? "https://qstash.upstash.io";
export const QSTASH_PUBLISH_URL = `${QSTASH_BASE_URL}/v2/publish`;
export const QSTASH_DLQ_URL = `${QSTASH_BASE_URL}/v2/dlq`;

export const WEBHOOK_ENDPOINTS = {
  VECTOR_INDEXING: `${FASTAPI_PUBLIC_URL}/webhooks/vector-indexing`,
  ANALYTICS: `${FASTAPI_PUBLIC_URL}/webhooks/analytics-event`,
  WELCOME_EMAIL: `${FASTAPI_PUBLIC_URL}/webhooks/send-welcome-email`,
} as const;

// EVENT_TYPES を as const 配列で定義することで EventType 型を導出
export const EVENT_TYPES = [
  "todo.created",
  "todo.updated",
  "todo.deleted",
  "user.registered",
  "analytics.todo_event",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// イベントタイプと送信先のマッピング
export const EVENT_MAP: Record<EventType, string> = {
  "todo.created":         WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
  "todo.updated":         WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
  "todo.deleted":         WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
  "user.registered":      WEBHOOK_ENDPOINTS.WELCOME_EMAIL,
  "analytics.todo_event": WEBHOOK_ENDPOINTS.ANALYTICS,
};