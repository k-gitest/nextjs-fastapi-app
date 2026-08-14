"""
ベクトル操作の共通基盤

Upstash Vectorへのベクトル登録・検索・削除を共通化する。
"""
import structlog
from typing import Any
from api.infrastructure.vector_client import VectorClient
from api.exceptions import VectorError
from api.error_reporting import ErrorMonitor

logger = structlog.get_logger(__name__)


class BaseVectorService:
    """
    ベクトル操作の共通基盤
    VectorClientの例外をVectorErrorに翻訳する
    """

    @classmethod
    def get_client(cls) -> VectorClient:
        return VectorClient()

    @classmethod
    def _safe_upsert(cls, vectors: list, operation: str = "upsert") -> None:
        """
        安全なベクトル挿入/更新

        Raises:
            VectorError: 操作失敗時
        """
        try:
            client = cls.get_client()
            client.upsert(vectors)
            logger.info(
                "vector_upsert_succeeded",
                operation=operation,
                vector_count=len(vectors),
            )
        except VectorError:
            raise
        except Exception as e:
            logger.exception(
                "vector_upsert_failed",
                operation=operation,
                exception_type=e.__class__.__name__,
            )
            ErrorMonitor.log_error(
                exception=e,
                tags={
                    "event_type": "vector_upsert_failed",
                    "component": "vector",
                },
            )
            raise VectorError(internal_details=str(e)) from e

    @classmethod
    def _safe_delete(cls, ids: list[str]) -> None:
        """
        安全なベクトル削除

        Raises:
            VectorError: 削除失敗時
        """
        try:
            client = cls.get_client()
            client.delete(ids)
            logger.info(
                "vector_delete_succeeded",
                id_count=len(ids),
            )
        except VectorError:
            raise
        except Exception as e:
            logger.exception(
                "vector_delete_failed",
                exception_type=e.__class__.__name__,
            )
            raise VectorError(internal_details=str(e)) from e

    @classmethod
    def _safe_query(
        cls,
        vector: list[float],
        top_k: int = 5,
        include_metadata: bool = True,
        filter: str | None = None,
    ) -> Any:
        """
        安全なベクトル検索

        Raises:
            VectorError: 検索失敗時
        """
        try:
            client = cls.get_client()
            return client.query(
                vector=vector,
                top_k=top_k,
                include_metadata=include_metadata,
                filter=filter,
            )
        except VectorError:
            raise
        except Exception as e:
            logger.exception(
                "vector_query_failed",
                exception_type=e.__class__.__name__,
            )
            raise VectorError(internal_details=str(e)) from e
