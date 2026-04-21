"""
services/todo_vector_service.py のユニットテスト
"""
import pytest
from unittest.mock import patch, MagicMock, call
from api.services.todo_vector_service import TodoVectorService
from api.exceptions import VectorError, EmbeddingError

MOCK_TODO = {
    "todo_id": "clx1234",
    "todo_title": "会議資料の作成",
    "priority": "HIGH",
    "progress": 50,
    "user_id": "user123",
    "created_at": "2024-01-01T00:00:00",
}

MOCK_EMBEDDING = [0.1] * 768


@pytest.fixture
def vector_service():
    return TodoVectorService()


@pytest.fixture
def mock_embedding():
    with patch(
        "api.services.todo_vector_service.TodoEmbeddingService.embed_text",
        return_value=MOCK_EMBEDDING,
    ):
        yield


@pytest.fixture
def mock_batch_embedding():
    with patch(
        "api.services.todo_vector_service.TodoEmbeddingService.embed_batch",
        return_value=[MOCK_EMBEDDING, MOCK_EMBEDDING],
    ):
        yield


@pytest.fixture
def mock_vector_client():
    with patch("api.services.base_vector_service.VectorClient") as mock_cls:
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        yield mock_instance


class TestTodoVectorServiceAddTodo:
    def test_正常にベクトル追加できる(self, vector_service, mock_embedding, mock_vector_client):
        vector_service.add_todo(**MOCK_TODO)

        mock_vector_client.upsert.assert_called_once()
        vectors = mock_vector_client.upsert.call_args[0][0]
        assert vectors[0][0] == "clx1234"
        assert vectors[0][1] == MOCK_EMBEDDING
        assert vectors[0][2]["title"] == "会議資料の作成"
        assert vectors[0][2]["user_id"] == "user123"

    def test_メタデータに全フィールドが含まれる(self, vector_service, mock_embedding, mock_vector_client):
        vector_service.add_todo(**MOCK_TODO)

        vectors = mock_vector_client.upsert.call_args[0][0]
        metadata = vectors[0][2]
        assert "title" in metadata
        assert "user_id" in metadata
        assert "priority" in metadata
        assert "progress" in metadata
        assert "created_at" in metadata

    def test_Embedding失敗時はEmbeddingErrorを送出(self, vector_service, mock_vector_client):
        with patch(
            "api.services.todo_vector_service.TodoEmbeddingService.embed_text",
            side_effect=EmbeddingError(internal_details="Gemini error"),
        ):
            with pytest.raises(EmbeddingError):
                vector_service.add_todo(**MOCK_TODO)

        mock_vector_client.upsert.assert_not_called()

    def test_Vector操作失敗時はVectorErrorを送出(self, vector_service, mock_embedding, mock_vector_client):
        mock_vector_client.upsert.side_effect = Exception("Upstash error")

        with pytest.raises(VectorError) as exc_info:
            vector_service.add_todo(**MOCK_TODO)

        assert "Upstash error" in exc_info.value.internal_info


class TestTodoVectorServiceDeleteTodo:
    def test_正常にベクトル削除できる(self, vector_service, mock_vector_client):
        vector_service.delete_todo("clx1234")

        mock_vector_client.delete.assert_called_once_with(["clx1234"])

    def test_削除失敗時はVectorErrorを送出(self, vector_service, mock_vector_client):
        mock_vector_client.delete.side_effect = Exception("Delete error")

        with pytest.raises(VectorError):
            vector_service.delete_todo("clx1234")


class TestTodoVectorServiceSearchSimilar:
    def test_正常に検索できる(self, vector_service, mock_vector_client):
        mock_result = MagicMock()
        mock_result.id = "clx1234"
        mock_result.score = 0.9
        mock_result.metadata = {
            "title": "会議資料",
            "priority": "HIGH",
            "progress": 50,
        }
        mock_vector_client.query.return_value = [mock_result]

        with patch(
            "api.services.todo_vector_service.TodoEmbeddingService.embed_text",
            return_value=MOCK_EMBEDDING,
        ):
            results = vector_service.search_similar(
                query="会議",
                user_id="user123",
                top_k=5,
                min_score=0.5,
            )

        assert len(results) == 1
        assert results[0]["id"] == "clx1234"
        assert results[0]["score"] == 0.9

    def test_min_score以下の結果はフィルタされる(self, vector_service, mock_vector_client):
        mock_result = MagicMock()
        mock_result.score = 0.3  # min_score=0.5 以下
        mock_result.metadata = {}
        mock_vector_client.query.return_value = [mock_result]

        with patch(
            "api.services.todo_vector_service.TodoEmbeddingService.embed_text",
            return_value=MOCK_EMBEDDING,
        ):
            results = vector_service.search_similar(
                query="テスト",
                user_id="user123",
                min_score=0.5,
            )

        assert len(results) == 0

    def test_user_idフィルタが正しく渡される(self, vector_service, mock_vector_client):
        mock_vector_client.query.return_value = []

        with patch(
            "api.services.todo_vector_service.TodoEmbeddingService.embed_text",
            return_value=MOCK_EMBEDDING,
        ):
            vector_service.search_similar(
                query="テスト",
                user_id="user123",
            )

        call_kwargs = mock_vector_client.query.call_args[1]
        assert "user123" in call_kwargs["filter"]


class TestTodoVectorServiceAddTodosBatch:
    def test_複数Todoを一括追加できる(self, vector_service, mock_batch_embedding, mock_vector_client):
        todos = [MOCK_TODO, {**MOCK_TODO, "todo_id": "clx5678", "todo_title": "別のタスク"}]
        vector_service.add_todos_batch(todos)

        mock_vector_client.upsert.assert_called_once()
        vectors = mock_vector_client.upsert.call_args[0][0]
        assert len(vectors) == 2

    def test_空リストでもエラーにならない(self, vector_service, mock_vector_client):
        with patch(
            "api.services.todo_vector_service.TodoEmbeddingService.embed_batch",
            return_value=[],
        ):
            vector_service.add_todos_batch([])

        mock_vector_client.upsert.assert_called_once()