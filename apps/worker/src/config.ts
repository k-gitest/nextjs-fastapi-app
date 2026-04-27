// 💡 Worker専用の環境変数から読み込む
export const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:8000";
export const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
export const QSTASH_URL = "https://qstash.upstash.io/v2/publish"; // 固定URL

export const WEBHOOK_ENDPOINTS = {
  VECTOR_INDEXING: `${BACKEND_API_URL}/webhooks/vector-indexing`,
  ANALYTICS: `${BACKEND_API_URL}/webhooks/analytics-event`,
  // 今後増える予定のもの
  WELCOME_EMAIL: `${BACKEND_API_URL}/webhooks/send-welcome-email`,
} as const;

// EVENT_TYPES を as const 配列で定義することで EventType 型を導出
export const EVENT_TYPES = [
  "todo.created",
  "todo.updated",
  "todo.deleted",
  "user.registered",
  "stats.updated",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// イベントタイプと送信先のマッピング
export const EVENT_MAP: Record<EventType, string> = {
  "todo.created": WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
  "todo.updated": WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
  "todo.deleted": WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
  "user.registered": WEBHOOK_ENDPOINTS.WELCOME_EMAIL,
  "stats.updated": WEBHOOK_ENDPOINTS.ANALYTICS,
};