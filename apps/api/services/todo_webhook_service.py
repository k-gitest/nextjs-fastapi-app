"""
Todo Webhook処理サービス

Django版からの変更点:
- get_object_or_404 → ResourceNotFoundError を送出
- Todo/Userモデルのインポートなし（FastAPIはDBを持たない）
  → Next.jsのRoute Handlerがtodo情報をpayloadに含めて送信する
- Django の transaction.atomic なし（FastAPIはDBを持たない）
- logging.getLogger → structlog.get_logger に移行

設計方針:
- このクラスが「Webhook の門番」として冪等性チェックを担当する
- TodoEmbeddingService / TodoVectorService は純粋な機能提供に徹し、
  DBの状態（重複チェック）を知らない（単一責任の原則）
- BackgroundTasks から呼ばれるため同期関数として実装
- BackgroundTask は contextvars が引き継がれないため
  logger.bind() で明示的にコンテキストを渡す
"""
import structlog
import sentry_sdk

from api.error_decorators import service_error_handler
from api.infrastructure.idempotency import is_new_event
from api.schemas.webhook import VectorIndexingPayload, VectorOperation
from api.services.todo_vector_service import TodoVectorService

logger = structlog.get_logger(__name__)


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
        correlation_id: str | None = None,
    ) -> None:
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
        # BackgroundTask は contextvars が引き継がれないため明示的にbind
        log = logger.bind(
            component="todo-webhook",
            idempotency_key=idempotency_key,
            todo_id=payload.todo_id,
            operation=payload.operation,
        )
        if correlation_id:
            log = log.bind(correlation_id=correlation_id)

        # 1. 冪等性チェック（ここが「門番」）
        #    INSERT ON CONFLICT DO NOTHING により、
        #    同時リクエストが2件来ても片方だけが処理される
        if not is_new_event(idempotency_key, "vector_indexing"):
            return

        # Sentryタグに追加
        if correlation_id:
            sentry_sdk.set_tag("correlation_id", correlation_id)
 
        # 2. 以降は初回のみ実行される
        vector_service = TodoVectorService()

        if payload.operation == VectorOperation.delete:
            vector_service.delete_todo(todo_id=payload.todo_id)
            log.info("vector_deleted")
 
        elif payload.operation == VectorOperation.upsert:
            if (
                payload.todo_title is None
                or payload.user_id is None
                or payload.priority is None
                or payload.progress is None
            ):
                raise ValueError(
                    f"upsert requires todo_title, user_id, priority, progress. "
                    f"Got: {payload.model_dump()}"
                )
            vector_service.add_todo(
                todo_id=payload.todo_id,
                todo_title=payload.todo_title,
                priority=payload.priority,
                progress=payload.progress,
                user_id=payload.user_id,
                created_at=payload.created_at or "",
            )
            log.info("vector_upserted")

    @staticmethod
    @service_error_handler
    def handle_bulk_vector_indexing(
        idempotency_key: str,
        user_id: str,
        todos: list[dict],
    ) -> None:
        """
        ユーザーの全Todoを一括インデックス

        Args:
            user_id: ユーザーID
            todos: Todoのリスト（Next.jsがpayloadに含めて送信）
                各要素: {id, todo_title, priority, progress, created_at}

        Returns:
            dict: 処理結果
        """
        # BackgroundTask は contextvars が引き継がれないため明示的にbind
        log = logger.bind(
            component="todo-webhook",
            idempotency_key=idempotency_key,
            user_id=user_id,
            todo_count=len(todos),
        )

        if not is_new_event(idempotency_key, "bulk_vector_indexing"):
            return

        vector_service = TodoVectorService()
        vector_service.add_todos_batch(todos=todos)

        log.info("bulk_vector_indexing_completed")