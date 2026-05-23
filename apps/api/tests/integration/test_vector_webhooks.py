"""
ベクトル関連Webhookエンドポイントの統合テスト
"""
import pytest
from unittest.mock import patch, MagicMock


def make_vector_indexing_envelope(data: dict, idempotency_key: str = "idem-vec-1") -> dict:
    """VectorIndexingEnvelope 形式のリクエストボディを生成するヘルパー"""
    return {
        "id": "evt-test-1",
        "type": "todo.created",
        "version": 1,
        "aggregate_id": f"todo:{data.get('todo_id', 'clx1234')}",
        "idempotency_key": idempotency_key,
        "data": data,
    }


def make_bulk_vector_indexing_envelope(data: dict, idempotency_key: str = "idem-bulk-1") -> dict:
    """BulkVectorIndexingEnvelope 形式のリクエストボディを生成するヘルパー"""
    return {
        "id": "evt-test-2",
        "type": "todo.bulk_indexing",
        "version": 1,
        "aggregate_id": f"user:{data.get('user_id', 'user123')}",
        "idempotency_key": idempotency_key,
        "data": data,
    }


UPSERT_DATA = {
    "todo_id": "clx1234",
    "operation": "upsert",
    "todo_title": "会議資料の作成",
    "priority": "HIGH",
    "progress": 50,
    "user_id": "user123",
    "created_at": "2024-01-01T00:00:00",
}

DELETE_DATA = {
    "todo_id": "clx1234",
    "operation": "delete",
}

BULK_DATA = {
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
                json=make_vector_indexing_envelope(UPSERT_DATA),
                headers={"upstash-signature": "valid-signature"},
            )

        assert response.status_code == 202
        assert response.json()["status"] == "accepted"

    def test_delete操作が202を返す(self, client, mock_qstash_receiver):
        with patch("api.services.todo_webhook_service.TodoVectorService") as mock_cls:
            mock_cls.return_value = MagicMock()
            response = client.post(
                "/webhooks/vector-indexing",
                json=make_vector_indexing_envelope(DELETE_DATA, idempotency_key="idem-del-1"),
                headers={"upstash-signature": "valid-signature"},
            )

        assert response.status_code == 202

    def test_署名なしは401を返す(self, client):
        response = client.post(
            "/webhooks/vector-indexing",
            json=make_vector_indexing_envelope(UPSERT_DATA),
        )
        assert response.status_code == 401

    def test_todo_idがない場合は422を返す(self, client, mock_qstash_receiver):
        data = {**UPSERT_DATA}
        del data["todo_id"]
        response = client.post(
            "/webhooks/vector-indexing",
            json=make_vector_indexing_envelope(data),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_operationがない場合は422を返す(self, client, mock_qstash_receiver):
        data = {**UPSERT_DATA}
        del data["operation"]
        response = client.post(
            "/webhooks/vector-indexing",
            json=make_vector_indexing_envelope(data),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422


class TestBulkVectorIndexingWebhook:
    def test_一括インデックスが202を返す(self, client, mock_qstash_receiver):
        with patch("api.services.todo_webhook_service.TodoVectorService") as mock_cls:
            mock_cls.return_value = MagicMock()
            response = client.post(
                "/webhooks/bulk-vector-indexing",
                json=make_bulk_vector_indexing_envelope(BULK_DATA),
                headers={"upstash-signature": "valid-signature"},
            )

        assert response.status_code == 202

    def test_署名なしは401を返す(self, client):
        response = client.post(
            "/webhooks/bulk-vector-indexing",
            json=make_bulk_vector_indexing_envelope(BULK_DATA),
        )
        assert response.status_code == 401

    def test_user_idがない場合は422を返す(self, client, mock_qstash_receiver):
        data = {**BULK_DATA}
        del data["user_id"]
        response = client.post(
            "/webhooks/bulk-vector-indexing",
            json=make_bulk_vector_indexing_envelope(data),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_todosがない場合は422を返す(self, client, mock_qstash_receiver):
        data = {**BULK_DATA}
        del data["todos"]
        response = client.post(
            "/webhooks/bulk-vector-indexing",
            json=make_bulk_vector_indexing_envelope(data),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422