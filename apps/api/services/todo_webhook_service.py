"""
Todo Webhook処理サービス

Django版からの変更点:
- get_object_or_404 → ResourceNotFoundError を送出
- Todo/Userモデルのインポートなし（FastAPIはDBを持たない）
  → Next.jsのRoute Handlerがtodo情報をpayloadに含めて送信する
- Django の transaction.atomic なし（FastAPIはDBを持たない）

設計方針:
- このクラスが「Webhook の門番」として冪等性チェックを担当する
- TodoEmbeddingService / TodoVectorService は純粋な機能提供に徹し、
  DBの状態（重複チェック）を知らない（単一責任の原則）
- BackgroundTasks から呼ばれるため同期関数として実装
"""
import logging

from api.error_decorators import service_error_handler
from api.infrastructure.idempotency import is_new_event
from api.exceptions import ResourceNotFoundError
from api.schemas.webhook import VectorIndexingPayload, VectorOperation
from api.services.todo_vector_service import TodoVectorService

logger = logging.getLogger(__name__)


class TodoWebhookService:
    """
    Todo Webhook処理サービス

    QStashから呼ばれるWebhook処理をカプセル化
    """

    @staticmethod
    @service_error_handler
    def handle_vector_indexing(
        idempotency_key: str,
        payload: VectorIndexingPayload,
    ) -> dict:
        """
        Todoのベクトルインデックス処理

        Args:
            idempotency_key: 重複排除キー
            payload:         ベクトル操作に必要なデータ

        Returns:
            dict: 処理結果

        Raises:
            ResourceNotFoundError: upsert時に必要な情報が不足している場合
            VectorError: ベクトル処理エラー
        """
        # 1. 冪等性チェック（ここが「門番」）
        #    INSERT ON CONFLICT DO NOTHING により、
        #    同時リクエストが2件来ても片方だけが処理される
        if not is_new_event(idempotency_key, "vector_indexing"):
            return
 
        # 2. 以降は初回のみ実行される
        vector_service = TodoVectorService()

        if payload.operation == VectorOperation.delete:
            vector_service.delete_todo(todo_id=payload.todo_id)
            logger.info("Vector deleted", extra={"todo_id": payload.todo_id})
 
        elif payload.operation == VectorOperation.upsert:
            if not all([payload.todo_title, payload.priority, payload.progress is not None]):
                raise ValueError(
                    f"upsert requires todo_title, priority, progress. "
                    f"Got: {payload.model_dump()}"
                )
            vector_service.add_todo(
                todo_id=payload.todo_id,
                todo_title=payload.todo_title,    # type: ignore[arg-type]
                priority=payload.priority,         # type: ignore[arg-type]
                progress=payload.progress,         # type: ignore[arg-type]
                user_id=payload.user_id,
                created_at=payload.created_at or "",
            )
            logger.info("Vector upserted", extra={"todo_id": payload.todo_id})

    @staticmethod
    @service_error_handler
    def handle_bulk_vector_indexing(
        idempotency_key: str,
        user_id: str,
        todos: list[dict],
    ) -> dict:
        """
        ユーザーの全Todoを一括インデックス

        Args:
            user_id: ユーザーID
            todos: Todoのリスト（Next.jsがpayloadに含めて送信）
                各要素: {id, todo_title, priority, progress, created_at}

        Returns:
            dict: 処理結果
        """
        if not is_new_event(idempotency_key, "bulk_vector_indexing"):
            return

        vector_service = TodoVectorService()
        vector_service.add_todos_batch(todos=todos)

        logger.info(
            "Bulk vector indexing completed",
            extra={"user_id": user_id, "count": len(todos)},
        )
        return {
            "message": "Bulk vector indexing completed",
            "user_id": user_id,
            "count": len(todos),
        }