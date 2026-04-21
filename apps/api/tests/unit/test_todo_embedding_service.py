"""
services/todo_embedding_service.py のユニットテスト
"""
import pytest
from unittest.mock import patch, MagicMock
from api.services.todo_embedding_service import TodoEmbeddingService
from api.exceptions import EmbeddingError


class TestTodoEmbeddingServicePrepareText:
    def test_タイトルと優先度と進捗が結合される(self):
        text = TodoEmbeddingService.prepare_text(
            todo_title="会議資料の作成",
            priority="HIGH",
            progress=50,
        )
        assert "会議資料の作成" in text
        assert "高" in text  # HIGHの表示名
        assert "50%" in text

    def test_優先度MediumはMEDIUMが中に変換される(self):
        text = TodoEmbeddingService.prepare_text(
            todo_title="テスト",
            priority="MEDIUM",
            progress=0,
        )
        assert "中" in text

    def test_優先度LowはLOWが低に変換される(self):
        text = TodoEmbeddingService.prepare_text(
            todo_title="テスト",
            priority="LOW",
            progress=100,
        )
        assert "低" in text

    def test_余分な空白が正規化される(self):
        text = TodoEmbeddingService.prepare_text(
            todo_title="  タスク  ",
            priority="HIGH",
            progress=0,
        )
        assert "  " not in text

    def test_不明な優先度はそのまま使用される(self):
        text = TodoEmbeddingService.prepare_text(
            todo_title="テスト",
            priority="UNKNOWN",
            progress=0,
        )
        assert "UNKNOWN" in text


class TestTodoEmbeddingServiceEmbedText:
    def test_テキストのベクトル化成功(self):
        mock_embedding = [0.1] * 768

        mock_response = MagicMock()
        mock_response.embeddings = [MagicMock(values=mock_embedding)]

        with patch("api.services.base_embedding_service.client") as mock_client:
            mock_client.models.embed_content.return_value = mock_response

            result = TodoEmbeddingService.embed_text("テスト", task_type="retrieval_document")

        assert result == mock_embedding
        assert len(result) == 768
        # 呼び出し時の引数チェック（contentsになっているか等）
        mock_client.models.embed_content.assert_called_once()

    def test_Gemini失敗時はEmbeddingErrorを送出(self):
        with patch("api.services.base_embedding_service.client") as mock_client:
            mock_client.models.embed_content.side_effect = Exception("Gemini API Error")

            with pytest.raises(EmbeddingError) as exc_info:
                TodoEmbeddingService.embed_text("テスト")

        assert exc_info.value.code == "embedding_error"
        assert "Gemini API Error" in exc_info.value.internal_info

    def test_EmbeddingErrorのinternal_infoはメッセージに含まれない(self):
        with patch("api.services.base_embedding_service.client") as mock_client:
            mock_client.models.embed_content.side_effect = Exception("secret key: sk-xxx")

            with pytest.raises(EmbeddingError) as exc_info:
                TodoEmbeddingService.embed_text("テスト")

        assert "secret key" not in exc_info.value.message
        assert "secret key" in exc_info.value.internal_info

    def test_バッチベクトル化成功(self):
        mock_embeddings = [[0.1] * 768, [0.2] * 768]

        mock_response = MagicMock()
        mock_response.embeddings = [
        MagicMock(values=mock_embeddings[0]),
        MagicMock(values=mock_embeddings[1])
    ]

        with patch("api.services.base_embedding_service.client") as mock_client:
            mock_client.models.embed_content.return_value = mock_response

            result = TodoEmbeddingService.embed_batch(["テスト1", "テスト2"])

        assert len(result) == 2