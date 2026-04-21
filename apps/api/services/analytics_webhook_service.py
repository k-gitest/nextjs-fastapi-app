import logging
from api.services.base_analytics_service import BaseAnalyticsService
from api.error_decorators import service_error_handler
from api.exceptions import AnalyticsError

logger = logging.getLogger(__name__)

class AnalyticsWebhookService(BaseAnalyticsService):
    """
    Webhook経由の分析イベント記録サービス
    """

    @classmethod
    @service_error_handler
    def handle_webhook_event(cls, event_type: str, event_data: dict) -> None:
        """Webhookから受け取った分析イベントを処理"""
        if event_type == "auth_event":
            cls._safe_insert("auth", event_data)
        elif event_type == "todo_event":
            cls._safe_insert("todo", event_data)
        else:
            logger.error(
                f"Unsupported event_type: {event_type}",
                extra={'event_type': event_type, 'event_data': event_data}
            )
            raise AnalyticsError(
                internal_details=f"Unsupported event_type: {event_type}"
            )