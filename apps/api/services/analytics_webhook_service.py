import structlog
import sentry_sdk

from typing import Any

from api.error_decorators import service_error_handler
from api.exceptions import AnalyticsError

from api.services.base_analytics_service import BaseAnalyticsService
from api.infrastructure.idempotency import is_new_event

logger = structlog.get_logger(__name__)

class AnalyticsWebhookService(BaseAnalyticsService):
    """
    Webhook経由の分析イベント記録サービス
    """

    @classmethod
    @service_error_handler
    def handle_webhook_event(
        cls,
        idempotency_key: str,
        event_type: str,
        event_data: dict[str, Any],
        correlation_id: str | None = None,) -> None:
        """
        Webhookから受け取った分析イベントを処理
        Args:
            idempotency_key: 重複排除キー
            event_type:      イベント種別（"auth_event" | "todo_event"）
            event_data:      イベントデータ
            correlation_id:  分散トレース用ID（BackgroundTask経由のため明示的に受け取る）
        """
        log = logger.bind(
            component="analytics-webhook",
            idempotency_key=idempotency_key,
            event_type=event_type,
        )
        if correlation_id:
            log = log.bind(correlation_id=correlation_id)

        # 冪等性チェック（分析データの重複集計を防ぐ）
        if not is_new_event(idempotency_key, f"analytics_{event_type}"):
            return

        # Sentryタグに追加
        if correlation_id:
            sentry_sdk.set_tag("correlation_id", correlation_id)

        if event_type == "auth_event":
            cls._safe_insert("auth", event_data)
        elif event_type == "todo_event":
            cls._safe_insert("todo", event_data)
        else:
            log.error(
                "unsupported_event_type",
                event_data=event_data,
            )
            raise AnalyticsError(
                internal_details=f"Unsupported event_type: {event_type}"
            )