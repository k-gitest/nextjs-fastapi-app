"""
Gemini Embedding APIの共通基盤

"""
import logging
from google import genai
from google.genai import types
from api.config import settings
from api.exceptions import EmbeddingError

logger = logging.getLogger(__name__)

# Gemini APIキーを設定
client = genai.Client(api_key=settings.GOOGLE_API_KEY)

# 使用するモデル
EMBEDDING_MODEL = "gemini-embedding-001"
OUTPUT_DIMENSIONS = 1536  # Upstash無料プランの上限

class BaseEmbeddingService:
    """
    Gemini Embedding APIの共通基盤

    テキストをベクトル化する機能を提供
    """

    @staticmethod
    def embed_text(text: str, task_type: str = "retrieval_document") -> list[float]:
        """
        テキストをベクトル化

        Args:
            text: ベクトル化するテキスト
            task_type: タスクタイプ
                - "retrieval_document": ドキュメント追加時
                - "retrieval_query": 検索クエリ時

        Returns:
            list[float]: 768次元のベクトル

        Raises:
            EmbeddingError: ベクトル化失敗時
        """
        try:
            result = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=text,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=OUTPUT_DIMENSIONS,
                ),
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error(f"Embedding failed for text '{text[:50]}...': {e}")
            raise EmbeddingError(internal_details=str(e)) from e

    @staticmethod
    def embed_batch(texts: list[str], task_type: str = "retrieval_document") -> list[list[float]]:
        """
        複数テキストを一括ベクトル化

        Args:
            texts: ベクトル化するテキストリスト
            task_type: タスクタイプ

        Returns:
            list[list[float]]: ベクトルのリスト

        Raises:
            EmbeddingError: ベクトル化失敗時
        """
        try:
            result = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=texts,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=OUTPUT_DIMENSIONS,
                ),
            )
            return [e.values for e in result.embeddings]
        except Exception as e:
            logger.error(f"Batch embedding failed for {len(texts)} texts: {e}")
            raise EmbeddingError(internal_details=str(e)) from e