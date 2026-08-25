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
  "image.storage_delete_requested", // B2 DeleteObjectをWorkerが直接実行する
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// イベントタイプと送信先のマッピング
// QStash配送対象のイベントのみを持つ（image.storage_delete_requestedはQStashを
// 経由せずWorkerがB2を直接操作するため、意図的にエントリを持たない）。
export const EVENT_MAP: Partial<Record<EventType, string>> = {
  "todo.created": WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
  "todo.updated": WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
  "todo.deleted": WEBHOOK_ENDPOINTS.VECTOR_INDEXING,
  "user.registered": WEBHOOK_ENDPOINTS.WELCOME_EMAIL,
  "analytics.todo_event": WEBHOOK_ENDPOINTS.ANALYTICS,
};

// StorageCleanupTask（B2 PUT成功後にImage作成が失敗するType A、
// Image削除後にB2削除が失敗するType Bの2種類の孤立オブジェクト）のB2削除リトライ用。
export const B2_ENDPOINT = process.env.B2_ENDPOINT ?? "";
export const B2_REGION = process.env.B2_REGION ?? "us-west-004";
export const B2_BUCKET = process.env.B2_BUCKET ?? "";
export const B2_KEY_ID = process.env.B2_KEY_ID ?? "";
export const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY ?? "";

export const STORAGE_CLEANUP_MAX_RETRIES = Number(
  process.env.STORAGE_CLEANUP_MAX_RETRIES ?? 8,
);