"""
analyticsエンドポイントの統合テスト
"""
import pytest
from unittest.mock import patch, MagicMock

VALID_AUTH_EVENT_PAYLOAD = {
    "event_type": "auth_event",
    "event_data": {
        "user_id": "user123",
        "email": "test@example.com",
        "event_type": "login",
        "timestamp": "2024-01-01T00:00:00Z",
        "ip_address": "127.0.0.1",
        "success": True,
    },
}

VALID_TODO_EVENT_PAYLOAD = {
    "event_type": "todo_event",
    "event_data": {
        "user_id": "user123",
        "todo_id": "clx1234",
        "event_type": "create",
        "todo_title": "会議資料の作成",
        "priority": "HIGH",
        "progress": 0,
    },
}


@pytest.fixture
def mock_analytics_service():
    with patch(
        "api.services.analytics_webhook_service.AnalyticsWebhookService.handle_webhook_event"
    ) as mock:
        yield mock


class TestAnalyticsEventWebhook:
    def test_auth_eventが202を返す(self, client, mock_qstash_receiver, mock_analytics_service):
        response = client.post(
            "/webhooks/analytics-event",
            json=VALID_AUTH_EVENT_PAYLOAD,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "accepted"

    def test_todo_eventが202を返す(self, client, mock_qstash_receiver, mock_analytics_service):
        response = client.post(
            "/webhooks/analytics-event",
            json=VALID_TODO_EVENT_PAYLOAD,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 202

    def test_署名なしは401を返す(self, client):
        response = client.post(
            "/webhooks/analytics-event",
            json=VALID_AUTH_EVENT_PAYLOAD,
        )
        assert response.status_code == 401

    def test_未サポートのevent_typeは422を返す(self, client, mock_qstash_receiver):
        response = client.post(
            "/webhooks/analytics-event",
            json={
                "event_type": "unknown_event",
                "event_data": {},
            },
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_event_typeがない場合は422を返す(self, client, mock_qstash_receiver):
        response = client.post(
            "/webhooks/analytics-event",
            json={"event_data": {"user_id": "user123"}},
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_event_dataがない場合は422を返す(self, client, mock_qstash_receiver):
        response = client.post(
            "/webhooks/analytics-event",
            json={"event_type": "auth_event"},
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_auth_eventでtimestampがない場合は422を返す(self, client, mock_qstash_receiver):
        payload = {
            "event_type": "auth_event",
            "event_data": {
                "user_id": "user123",
                "event_type": "login",
                # timestamp がない
            },
        }
        response = client.post(
            "/webhooks/analytics-event",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_todo_eventでtodo_idがない場合は422を返す(self, client, mock_qstash_receiver):
        payload = {
            "event_type": "todo_event",
            "event_data": {
                "user_id": "user123",
                "event_type": "create",
                # todo_id がない
            },
        }
        response = client.post(
            "/webhooks/analytics-event",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_バリデーションエラーレスポンスの形式が統一されている(self, client, mock_qstash_receiver):
        """error_handlers.pyの統一形式になっているか確認"""
        response = client.post(
            "/webhooks/analytics-event",
            json={"event_type": "unknown_event", "event_data": {}},
            headers={"upstash-signature": "valid-signature"},
        )
        data = response.json()
        assert "error" in data
        assert "detail" in data