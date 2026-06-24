import structlog
from typing import Any, Literal

from api.infrastructure.motherduck_client import MotherDuckClient
from api.exceptions import AnalyticsError
from api.error_reporting import ErrorMonitor

logger = structlog.get_logger(__name__)

EventType = Literal["auth", "todo"]


class BaseAnalyticsService:
    """
    分析ログ記録の共通基盤
    MotherDuckClient の例外を AnalyticsError に翻訳する
    """

    @classmethod
    def get_client(cls):
        """クライアントを取得"""
        return MotherDuckClient()

    @classmethod
    def reset_for_testing(cls):
        """テスト用のリセットメソッド"""
        MotherDuckClient.reset_for_testing()

    @classmethod
    def _safe_insert(
        cls,
        event_type: EventType,
        event_data: dict[str, Any],
    ):
        """イベント挿入の共通ラッパー"""
        try:
            client = cls.get_client()

            if event_type == "auth":
                client.insert_auth_event(event_data)
            elif event_type == "todo":
                client.insert_todo_event(event_data)
            else:
                raise ValueError(f"Unknown event_type: {event_type}")

            logger.debug(
                "analytics_event_logged",
                event_type=event_type,
                action=event_data.get("action"),  # event_type → action に修正
            )

        except AnalyticsError:
            raise
        except Exception as e:
            logger.warning(
                "motherduck_insert_failed",
                event_type=event_type,
                exception_type=e.__class__.__name__,
            )
            ErrorMonitor.log_error(
                exception=e,
                tags={
                    "event_type": "motherduck_insert_failed",
                    "component": "analytics",
                },
            )
            raise AnalyticsError(
                internal_details=str(e)
            ) from e