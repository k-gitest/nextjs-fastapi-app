import { qstashClient } from "@/lib/qstash";
import { WEBHOOK_ENDPOINTS } from "@/lib/constants"

const FASTAPI_PUBLIC_URL = process.env.FASTAPI_PUBLIC_URL!;

// バックエンドの event_type に合わせた型定義
type EventType = "todo_event" | "auth_event";

interface TodoEventData {
  event_type: "create" | "update" | "delete";
  todo_id: string;
  user_id: string;
  priority?: string;
  progress?: number;
}

interface AuthEventData {
  action: "login" | "register" | "logout";
  user_id: string;
}

type EventDataMap = {
  todo_event: TodoEventData;
  auth_event: AuthEventData;
};

/**
 * アナリティクスイベントをQStash経由でバックエンドに送信する
 */
export async function triggerAnalyticsEvent<T extends EventType>(
  eventType: T,
  eventData: EventDataMap[T]
) {
  try {
    await qstashClient.publishJSON({
      url: `${FASTAPI_PUBLIC_URL}/webhooks/analytics-event`,
      body: {
        event_type: eventType,
        event_data: eventData,
      },
      // オプション: 失敗時のリトライ回数などを設定可能
      // retries: 3, 
    });
  } catch (error) {
    // ログ記録のみ行い、フロントエンドのメイン処理はブロックしない
    console.error(`Failed to publish analytics event [${eventType}]:`, error);
  }
}