"""
Webhook スキーマ定義
 
設計方針:
- Worker が送信する JSON の外側の「封筒（Envelope）」と
  各イベント固有の「中身（Payload）」を分離する
- EventEnvelope[T] のジェネリクスにより、
  Router 側で型安全に data フィールドにアクセスできる
"""
from __future__ import annotations
 
from datetime import datetime
from pydantic import BaseModel, EmailStr, model_validator, Field 
from typing import Dict, Optional, Any, Literal, TypeVar, Generic
from enum import Enum

# ── 共通エンベロープ ─────────────────────────────────────────────
DataT = TypeVar("DataT", bound=BaseModel)
 
 
class EventEnvelope(BaseModel, Generic[DataT]):
    """
    Worker → QStash → FastAPI で共通して使うイベント封筒
 
    Fields:
        id:              outbox_events.id（UUID）
        type:            イベント種別（例: "todo.created"）
        version:         スキーマバージョン（互換性管理用）
        data:            イベント固有のペイロード
        idempotency_key: outbox_events.idempotency_key（重複排除キー）
        aggregate_id:    集約 ID（例: "todo:clxxx..."）
    """
    id:              str
    type:            str
    version:         int              = Field(ge=1)
    data:            DataT
    idempotency_key: str
    aggregate_id:    str


# ===== メール送信 =====

class WelcomeEmailPayload(BaseModel):
    """ウェルカムメール送信Webhookのリクエストボディ"""
    email: EmailStr
    first_name: str


# ===== ベクトルインデックス =====
class VectorOperation(str, Enum):
    upsert = "upsert"
    delete = "delete"

class VectorIndexingPayload(BaseModel):
    """
    Todoベクトルインデックス処理のリクエストボディ

    operation="upsert" の場合は todo_title 等が必須
    operation="delete" の場合は todo_id のみ必要
    """
    todo_id: str
    operation: VectorOperation  # "upsert" | "delete"

    # upsert時に必要なフィールド
    todo_title: Optional[str] = None
    priority: Optional[str] = None   # "HIGH" | "MEDIUM" | "LOW"
    progress: Optional[int] = None
    user_id: Optional[str] = None
    created_at: Optional[str] = None  # ISO8601文字列


class BulkVectorIndexingPayload(BaseModel):
    """
    Todo一括ベクトルインデックス処理のリクエストボディ

    Next.jsがtodos一覧をpayloadに含めて送信する
    """
    user_id: str
    todos: list[dict]  # [{id, todo_title, priority, progress, created_at}]


# ===== アナリティクス =====

class AnalyticsEventType(str, Enum):
    """許可されるイベントタイプの定義"""
    auth_event = "auth_event"
    todo_event = "todo_event"  # service.pyの分岐に合わせて追加しておくのがベターです

class AnalyticsEventWebhookPayload(BaseModel):
    """
    分析イベントWebhookのペイロードバリデーション
    QStashから呼ばれるWebhook用のバリデーター
    """
    event_type: AnalyticsEventType
    event_data: Dict[str, Any]

    @model_validator(mode='after')
    def validate_event_data_fields(self) -> 'AnalyticsEventWebhookPayload':
        """
        event_dataの詳細バリデーション
        auth_eventの場合、必須フィールドをチェック
        """
        if self.event_type == AnalyticsEventType.auth_event:
            required_fields = ['user_id', 'event_type', 'timestamp']
            missing_fields = [field for field in required_fields if field not in self.event_data]
            
            if missing_fields:
                # FastAPIではValueErrorを投げると、自動的に422 Unprocessable Entity(バリデーションエラー)になります
                # もしカスタムエラーハンドラ(error_handlers.py)で処理したい場合は、専用のExceptionを投げてください
                raise ValueError(
                    f"event_data is missing required fields: {', '.join(missing_fields)}"
                )

        elif self.event_type == AnalyticsEventType.todo_event:
            required_fields = ['user_id', 'todo_id', 'event_type']
            missing_fields = [f for f in required_fields if f not in self.event_data]
            if missing_fields:
                raise ValueError(
                    f"event_data is missing required fields: {', '.join(missing_fields)}"
                )
        
        return self


# ── エンベロープ付き型エイリアス ────────────────────────────────
# これにより Router(payload: WelcomeEmailEnvelope) と書くだけで
# payload.idempotency_key と payload.data.email の両方にアクセスできます。

WelcomeEmailEnvelope = EventEnvelope[WelcomeEmailPayload]
VectorIndexingEnvelope = EventEnvelope[VectorIndexingPayload]
BulkVectorIndexingEnvelope = EventEnvelope[BulkVectorIndexingPayload]
AnalyticsEventEnvelope = EventEnvelope[AnalyticsEventWebhookPayload]