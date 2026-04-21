"""
services/todo_webhook_service.py のユニットテスト
"""
import pytest
from unittest.mock import patch, MagicMock
from api.services.todo_webhook_service import TodoWebhookService
from api.exceptions import ResourceNotFoundError, VectorError

MOCK_TODO_PAYLOAD = {
    "todo_id": "clx1234",
    "operation": "upsert",
    "todo_title": "会議資料の作成",
    "priority": "HIGH",
    "progress": 50,
    "user_id": "user123",
    "created_at": "2024-01-01T00:00:00",
}


class TestHandleVectorIndexing:
    def test_upsert操作が成功する(self):
        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            result = TodoWebhookService.handle_vector_indexing(**MOCK_TODO_PAYLOAD)

        mock_service.add_todo.assert_called_once()
        assert result["operation"] == "upsert"
        assert result["todo_id"] == "clx1234"

    def test_delete操作が成功する(self):
        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            result = TodoWebhookService.handle_vector_indexing(
                todo_id="clx1234",
                operation="delete",
            )

        mock_service.delete_todo.assert_called_once_with("clx1234")
        assert result["operation"] == "delete"

    def test_upsert時にtodo_titleがない場合はResourceNotFoundError(self):
        with pytest.raises(ResourceNotFoundError):
            TodoWebhookService.handle_vector_indexing(
                todo_id="clx1234",
                operation="upsert",
                # todo_title がない
                priority="HIGH",
                progress=50,
                user_id="user123",
                created_at="2024-01-01T00:00:00",
            )

    def test_upsert時にuser_idがない場合はResourceNotFoundError(self):
        with pytest.raises(ResourceNotFoundError):
            TodoWebhookService.handle_vector_indexing(
                todo_id="clx1234",
                operation="upsert",
                todo_title="タスク",
                priority="HIGH",
                progress=50,
                # user_id がない
                created_at="2024-01-01T00:00:00",
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
                TodoWebhookService.handle_vector_indexing(**MOCK_TODO_PAYLOAD)

    def test_delete時はtodo情報不要(self):
        """delete操作はtodo_idのみで動作する"""
        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            # todo_title等がなくてもエラーにならない
            result = TodoWebhookService.handle_vector_indexing(
                todo_id="clx1234",
                operation="delete",
            )

        assert result["operation"] == "delete"


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

            result = TodoWebhookService.handle_bulk_vector_indexing(
                user_id="user123",
                todos=todos,
            )

        mock_service.add_todos_batch.assert_called_once()
        assert result["count"] == 1
        assert result["user_id"] == "user123"

    def test_空リストの場合は0件を返す(self):
        result = TodoWebhookService.handle_bulk_vector_indexing(
            user_id="user123",
            todos=[],
        )
        assert result["count"] == 0
        assert result["message"] == "No todos to index"

    def test_user_idが各Todoに付与される(self):
        todos = [{"id": "clx1234", "todo_title": "タスク", "priority": "LOW", "progress": 0, "created_at": "2024-01-01"}]

        with patch(
            "api.services.todo_webhook_service.TodoVectorService"
        ) as mock_cls:
            mock_service = MagicMock()
            mock_cls.return_value = mock_service

            TodoWebhookService.handle_bulk_vector_indexing(
                user_id="user123",
                todos=todos,
            )

        call_args = mock_service.add_todos_batch.call_args[0][0]
        assert call_args[0]["user_id"] == "user123"