"""
analyticsエンドポイントの統合テスト
"""
import pytest
from unittest.mock import patch


def make_analytics_envelope(event_type: str, event_data: dict, idempotency_key: str = "idem-analytics-1") -> dict:
    """AnalyticsEventEnvelope 形式のリクエストボディを生成するヘルパー"""
    return {
        "id": "evt-test-1",
        "type": f"analytics.{event_type}",
        "version": 1,
        "aggregate_id": f"analytics:{event_data.get('user_id', 'unknown')}",
        "idempotency_key": idempotency_key,
        "data": {
            "event_type": event_type,
            "event_data": event_data,
        },
    }


AUTH_EVENT_DATA = {
    "user_id": "user123",
    "email": "test@example.com",
    "action": "login",
    "timestamp": "2024-01-01T00:00:00Z",
    "ip_address": "127.0.0.1",
    "success": True,
}

TODO_EVENT_DATA = {
    "user_id": "user123",
    "todo_id": "clx1234",
    "action": "create",
    "timestamp": "2024-01-01T00:00:00Z",
    "todo_title": "会議資料の作成",
    "priority": "HIGH",
    "progress": 0,
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
            json=make_analytics_envelope("auth_event", AUTH_EVENT_DATA),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "accepted"

    def test_todo_eventが202を返す(self, client, mock_qstash_receiver, mock_analytics_service):
        response = client.post(
            "/webhooks/analytics-event",
            json=make_analytics_envelope("todo_event", TODO_EVENT_DATA, idempotency_key="idem-analytics-2"),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 202

    def test_署名なしは401を返す(self, client):
        response = client.post(
            "/webhooks/analytics-event",
            json=make_analytics_envelope("auth_event", AUTH_EVENT_DATA),
        )
        assert response.status_code == 401

    def test_未サポートのevent_typeは422を返す(self, client, mock_qstash_receiver):
        # AnalyticsEventType enum に存在しない値は Pydantic が 422 で弾く
        response = client.post(
            "/webhooks/analytics-event",
            json=make_analytics_envelope("unknown_event", {}),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_event_typeがない場合は422を返す(self, client, mock_qstash_receiver):
        payload = make_analytics_envelope("auth_event", AUTH_EVENT_DATA)
        del payload["data"]["event_type"]
        response = client.post(
            "/webhooks/analytics-event",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_event_dataがない場合は422を返す(self, client, mock_qstash_receiver):
        payload = make_analytics_envelope("auth_event", AUTH_EVENT_DATA)
        del payload["data"]["event_data"]
        response = client.post(
            "/webhooks/analytics-event",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_auth_eventでtimestampがない場合は422を返す(self, client, mock_qstash_receiver):
        event_data = {**AUTH_EVENT_DATA}
        del event_data["timestamp"]
        response = client.post(
            "/webhooks/analytics-event",
            json=make_analytics_envelope("auth_event", event_data),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_todo_eventでtodo_idがない場合は422を返す(self, client, mock_qstash_receiver):
        event_data = {**TODO_EVENT_DATA}
        del event_data["todo_id"]
        response = client.post(
            "/webhooks/analytics-event",
            json=make_analytics_envelope("todo_event", event_data),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_バリデーションエラーレスポンスの形式が統一されている(self, client, mock_qstash_receiver):
        """error_handlers.py の統一形式になっているか確認"""
        response = client.post(
            "/webhooks/analytics-event",
            json=make_analytics_envelope("unknown_event", {}),
            headers={"upstash-signature": "valid-signature"},
        )
        data = response.json()
        assert "error" in data
        assert "detail" in data