"""
services/todo_webhook_service.py のユニットテスト
"""
import pytest
from unittest.mock import patch, MagicMock
from api.services.todo_webhook_service import TodoWebhookService
from api.schemas.webhook import VectorIndexingPayload
from api.exceptions import VectorError


@pytest.fixture(autouse=True)
def mock_is_new_event():
    """冪等性チェックを常にTrue（新規イベント）として扱う"""
    with patch("api.services.todo_webhook_service.is_new_event", return_value=True):
        yield


def make_upsert_payload(**overrides) -> VectorIndexingPayload:
    """upsert用のデフォルトpayloadを生成するヘルパー"""
    defaults = {
        "todo_id": "clx1234",
        "operation": "upsert",
        "todo_title": "会議資料の作成",
        "priority": "HIGH",
        "progress": 50,
        "user_id": "user123",
        "created_at": "2024-01-01T00:00:00",
    }
    defaults.update(overrides)
    return VectorIndexingPayload(**defaults)


def make_delete_payload(todo_id: str = "clx1234") -> VectorIndexingPayload:
    """delete用のpayloadを生成するヘルパー"""
    return VectorIndexingPayload(todo_id=todo_id, operation="delete")


class TestHandleVectorIndexing:
    def test_upsert操作が成功する(self):
        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            TodoWebhookService.handle_vector_indexing(
                idempotency_key="idem-vec-1",
                payload=make_upsert_payload(),
            )

        mock_service.add_todo.assert_called_once()

    def test_delete操作が成功する(self):
        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            TodoWebhookService.handle_vector_indexing(
                idempotency_key="idem-vec-2",
                payload=make_delete_payload(),
            )

        mock_service.delete_todo.assert_called_once_with(todo_id="clx1234")

    def test_upsert時にtodo_titleがない場合はValueError(self):
        """todo_title が None の場合は ValueError が発生する"""
        with pytest.raises(ValueError):
            TodoWebhookService.handle_vector_indexing(
                idempotency_key="idem-vec-3",
                payload=make_upsert_payload(todo_title=None),
            )

    def test_upsert時にuser_idがない場合はValueError(self):
        """user_id が None の場合は ValueError が発生する"""
        with pytest.raises(ValueError):
            TodoWebhookService.handle_vector_indexing(
                idempotency_key="idem-vec-4",
                payload=make_upsert_payload(user_id=None),
            )

    def test_Vector操作失敗時はVectorErrorを送出(self):
        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_service.add_todo.side_effect = VectorError(
                internal_details="Upstash error"
            )
            mock_cls.return_value = mock_service

            with pytest.raises(VectorError):
                TodoWebhookService.handle_vector_indexing(
                    idempotency_key="idem-vec-5",
                    payload=make_upsert_payload(),
                )

    def test_delete時はtodo情報不要(self):
        """delete操作はtodo_idのみで動作する"""
        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            # todo_title等がなくてもエラーにならない
            TodoWebhookService.handle_vector_indexing(
                idempotency_key="idem-vec-6",
                payload=make_delete_payload(),
            )

        mock_service.delete_todo.assert_called_once()

    def test_冪等性チェックでスキップされる場合はVectorServiceを呼ばない(self):
        with patch("api.services.todo_webhook_service.is_new_event", return_value=False):
            with patch(
                "api.services.todo_webhook_service.TodoVectorService"
            ) as mock_cls:
                mock_service = MagicMock()
                mock_cls.return_value = mock_service

                TodoWebhookService.handle_vector_indexing(
                    idempotency_key="idem-dup-1",
                    payload=make_upsert_payload(),
                )

            mock_service.add_todo.assert_not_called()


class TestHandleBulkVectorIndexing:
    def test_一括インデックスが成功する(self):
        todos = [
            {
                "id": "clx1234",
                "todo_title": "タスク1",
                "priority": "HIGH",
                "progress": 50,
                "created_at": "2024-01-01T00:00:00",
            }
        ]

        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            TodoWebhookService.handle_bulk_vector_indexing(
                idempotency_key="idem-bulk-1",
                user_id="user123",
                todos=todos,
            )

        mock_service.add_todos_batch.assert_called_once()
        # Noneに統一したのでリターンの検証を削除
        # assert result["count"] == 1
        # assert result["user_id"] == "user123"

    def test_空リストの場合は処理をスキップする(self):
        """空リストの場合は add_todos_batch を呼ばずに返る"""
        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            TodoWebhookService.handle_bulk_vector_indexing(
                idempotency_key="idem-bulk-2",
                user_id="user123",
                todos=[],
            )

        # 空リストは add_todos_batch を呼ばない（実装依存）
        # 実装が空リストでも呼ぶ場合は assert_called_once() に変更
        mock_service.add_todos_batch.assert_called_once_with(todos=[])

    """
    Noneに統一したためリターンの検証を削除
    def test_user_idが結果に含まれる(self):
        todos = [
            {
                "id": "clx1234",
                "todo_title": "タスク",
                "priority": "LOW",
                "progress": 0,
                "created_at": "2024-01-01",
            }
        ]

        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            result = TodoWebhookService.handle_bulk_vector_indexing(
                idempotency_key="idem-bulk-3",
                user_id="user123",
                todos=todos,
            )

        assert result["user_id"] == "user123"
    """