export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "localhost"
export const SENTRY_DSN = process.env.SENTRY_DSN;
export const SENTRY_RELEASE = process.env.SENTRY_RELEASE || 'unknown';

// バックエンド（FastAPI）用のURL設定を追加
export const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:8000";

// Webhookエンドポイントのフルパス
export const WEBHOOK_ENDPOINTS = {
  WELCOME_EMAIL: `${BACKEND_API_URL}/webhooks/send-welcome-email`,
  VECTOR_INDEXING: `${BACKEND_API_URL}/webhooks/vector-indexing`,
  BULK_VECTOR_INDEXING: `${BACKEND_API_URL}/webhooks/bulk-vector-indexing`,
  ANALYTICS: `${BACKEND_API_URL}/webhooks/analytics-event`,
} as const;

export const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // ブラウザ: 相対URLでOK
  return process.env.APP_BASE_URL ?? "http://localhost:3000"; // サーバー: 絶対URL必要
};

// QStashのトークン（サーバーサイド専用）
export const QSTASH_TOKEN = process.env.QSTASH_TOKEN;

// もしトークンがない場合に早期にエラーを投げたいなら、ここでバリデーションも可能です
if (!QSTASH_TOKEN && process.env.NODE_ENV !== 'test') {
  console.warn("Warning: QSTASH_TOKEN is not defined.");
}