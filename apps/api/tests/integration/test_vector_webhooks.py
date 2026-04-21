"""
ベクトル関連Webhookエンドポイントの統合テスト
"""
import pytest
from unittest.mock import patch, MagicMock

VALID_UPSERT_PAYLOAD = {
    "todo_id": "clx1234",
    "operation": "upsert",
    "todo_title": "会議資料の作成",
    "priority": "HIGH",
    "progress": 50,
    "user_id": "user123",
    "created_at": "2024-01-01T00:00:00",
}

VALID_DELETE_PAYLOAD = {
    "todo_id": "clx1234",
    "operation": "delete",
}

VALID_BULK_PAYLOAD = {
    "user_id": "user123",
    "todos": [
        {
            "id": "clx1234",
            "todo_title": "タスク1",
            "priority": "HIGH",
            "progress": 50,
            "created_at": "2024-01-01T00:00:00",
        }
    ],
}


class TestVectorIndexingWebhook:
    def test_upsert操作が202を返す(self, client, mock_qstash_receiver):
        with patch("api.services.todo_webhook_service.TodoVectorService") as mock_cls:
            mock_cls.return_value = MagicMock()
            response = client.post(
                "/webhooks/vector-indexing",
                json=VALID_UPSERT_PAYLOAD,
                headers={"upstash-signature": "valid-signature"},
            )

        assert response.status_code == 202
        assert response.json()["status"] == "accepted"

    def test_delete操作が202を返す(self, client, mock_qstash_receiver):
        with patch("api.services.todo_webhook_service.TodoVectorService") as mock_cls:
            mock_cls.return_value = MagicMock()
            response = client.post(
                "/webhooks/vector-indexing",
                json=VALID_DELETE_PAYLOAD,
                headers={"upstash-signature": "valid-signature"},
            )

        assert response.status_code == 202

    def test_署名なしは401を返す(self, client):
        response = client.post(
            "/webhooks/vector-indexing",
            json=VALID_UPSERT_PAYLOAD,
        )
        assert response.status_code == 401

    def test_todo_idがない場合は422を返す(self, client, mock_qstash_receiver):
        payload = {**VALID_UPSERT_PAYLOAD}
        del payload["todo_id"]

        response = client.post(
            "/webhooks/vector-indexing",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_operationがない場合は422を返す(self, client, mock_qstash_receiver):
        payload = {**VALID_UPSERT_PAYLOAD}
        del payload["operation"]

        response = client.post(
            "/webhooks/vector-indexing",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422


class TestBulkVectorIndexingWebhook:
    def test_一括インデックスが202を返す(self, client, mock_qstash_receiver):
        with patch("api.services.todo_webhook_service.TodoVectorService") as mock_cls:
            mock_cls.return_value = MagicMock()
            response = client.post(
                "/webhooks/bulk-vector-indexing",
                json=VALID_BULK_PAYLOAD,
                headers={"upstash-signature": "valid-signature"},
            )

        assert response.status_code == 202

    def test_署名なしは401を返す(self, client):
        response = client.post(
            "/webhooks/bulk-vector-indexing",
            json=VALID_BULK_PAYLOAD,
        )
        assert response.status_code == 401

    def test_user_idがない場合は422を返す(self, client, mock_qstash_receiver):
        payload = {**VALID_BULK_PAYLOAD}
        del payload["user_id"]

        response = client.post(
            "/webhooks/bulk-vector-indexing",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_todosがない場合は422を返す(self, client, mock_qstash_receiver):
        payload = {**VALID_BULK_PAYLOAD}
        del payload["todos"]

        response = client.post(
            "/webhooks/bulk-vector-indexing",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422