"""
services/analytics_webhook_service.py のユニットテスト
"""
import pytest
from unittest.mock import patch, MagicMock
from api.services.analytics_webhook_service import AnalyticsWebhookService
from api.exceptions import AnalyticsError

AUTH_EVENT_DATA = {
    "user_id": "user123",
    "email": "test@example.com",
    "event_type": "login",
    "timestamp": "2024-01-01T00:00:00Z",
    "ip_address": "127.0.0.1",
    "user_agent": "Mozilla/5.0",
    "success": True,
}

TODO_EVENT_DATA = {
    "user_id": "user123",
    "todo_id": "clx1234",
    "event_type": "create",
    "todo_title": "会議資料の作成",
    "priority": "HIGH",
    "progress": 0,
    "is_completed": False,
}


@pytest.fixture
def mock_motherduck():
    with patch("api.services.base_analytics_service.MotherDuckClient") as mock_cls:
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        yield mock_instance


@pytest.fixture(autouse=True)
def mock_is_new_event():
    """冪等性チェックを常にTrue（新規イベント）として扱う"""
    with patch("api.services.analytics_webhook_service.is_new_event", return_value=True):
        yield


class TestHandleWebhookEvent:
    def test_auth_eventが正常に処理される(self, mock_motherduck):
        AnalyticsWebhookService.handle_webhook_event(
            idempotency_key="idem-auth-1",
            event_type="auth_event",
            event_data=AUTH_EVENT_DATA,
        )
        mock_motherduck.insert_auth_event.assert_called_once_with(AUTH_EVENT_DATA)

    def test_todo_eventが正常に処理される(self, mock_motherduck):
        AnalyticsWebhookService.handle_webhook_event(
            idempotency_key="idem-todo-1",
            event_type="todo_event",
            event_data=TODO_EVENT_DATA,
        )
        mock_motherduck.insert_todo_event.assert_called_once_with(TODO_EVENT_DATA)

    def test_未サポートのevent_typeはAnalyticsErrorを送出(self, mock_motherduck):
        with pytest.raises(AnalyticsError) as exc_info:
            AnalyticsWebhookService.handle_webhook_event(
                idempotency_key="idem-unknown-1",
                event_type="unknown_event",
                event_data={},
            )
        assert "unknown_event" in exc_info.value.internal_info
        mock_motherduck.insert_auth_event.assert_not_called()
        mock_motherduck.insert_todo_event.assert_not_called()

    def test_MotherDuck挿入失敗時はAnalyticsErrorを送出(self, mock_motherduck):
        mock_motherduck.insert_auth_event.side_effect = Exception("DuckDB connection error")

        with pytest.raises(AnalyticsError) as exc_info:
            AnalyticsWebhookService.handle_webhook_event(
                idempotency_key="idem-auth-2",
                event_type="auth_event",
                event_data=AUTH_EVENT_DATA,
            )
        assert "DuckDB connection error" in exc_info.value.internal_info

    def test_AnalyticsErrorのinternal_infoはメッセージに含まれない(self, mock_motherduck):
        mock_motherduck.insert_todo_event.side_effect = Exception("secret token: xxx")

        with pytest.raises(AnalyticsError) as exc_info:
            AnalyticsWebhookService.handle_webhook_event(
                idempotency_key="idem-todo-2",
                event_type="todo_event",
                event_data=TODO_EVENT_DATA,
            )
        assert "secret token" not in exc_info.value.message
        assert "secret token" in exc_info.value.internal_info

    def test_冪等性チェックでスキップされる場合はMotherDuckを呼ばない(self, mock_motherduck):
        with patch(
            "api.services.analytics_webhook_service.is_new_event", return_value=False
        ):
            AnalyticsWebhookService.handle_webhook_event(
                idempotency_key="idem-dup-1",
                event_type="auth_event",
                event_data=AUTH_EVENT_DATA,
            )
        mock_motherduck.insert_auth_event.assert_not_called()