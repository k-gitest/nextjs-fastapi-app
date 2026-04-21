"""
Todo Webhook処理サービス

Django版からの変更点:
- get_object_or_404 → ResourceNotFoundError を送出
- Todo/Userモデルのインポートなし（FastAPIはDBを持たない）
  → Next.jsのRoute Handlerがtodo情報をpayloadに含めて送信する
- Django の transaction.atomic なし（FastAPIはDBを持たない）
"""
import logging
from api.error_decorators import service_error_handler
from api.exceptions import ResourceNotFoundError
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
        todo_id: str,
        operation: str,
        # upsert時に必要なTodo情報（Next.jsがpayloadに含めて送信）
        todo_title: str = None,
        priority: str = None,
        progress: int = None,
        user_id: str = None,
        created_at: str = None,
    ) -> dict:
        """
        Todoのベクトルインデックス処理

        Args:
            todo_id: TodoのID
            operation: "upsert" | "delete"
            todo_title: Todoタイトル（upsert時必須）
            priority: 優先度（upsert時必須）
            progress: 進捗率（upsert時必須）
            user_id: ユーザーID（upsert時必須）
            created_at: 作成日時（upsert時必須）

        Returns:
            dict: 処理結果

        Raises:
            ResourceNotFoundError: upsert時に必要な情報が不足している場合
            VectorError: ベクトル処理エラー
        """
        vector_service = TodoVectorService()

        if operation == "delete":
            vector_service.delete_todo(todo_id)
            logger.info(f"Deleted todo {todo_id} from vector index")
            return {
                "message": "Vector deleted successfully",
                "todo_id": todo_id,
                "operation": "delete",
            }

        else:  # upsert
            # upsert時は全フィールドが必要
            if not all([todo_title, priority, progress is not None, user_id, created_at]):
                raise ResourceNotFoundError(resource="Todo情報")

            vector_service.add_todo(
                todo_id=todo_id,
                todo_title=todo_title,
                priority=priority,
                progress=progress,
                user_id=user_id,
                created_at=created_at,
            )
            logger.info(f"Upserted todo {todo_id} to vector index")
            return {
                "message": "Vector indexed successfully",
                "todo_id": todo_id,
                "operation": "upsert",
            }

    @staticmethod
    @service_error_handler
    def handle_bulk_vector_indexing(
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
        if not todos:
            logger.info(f"No todos found for user {user_id}")
            return {
                "message": "No todos to index",
                "user_id": user_id,
                "count": 0,
            }

        # user_idを各Todoに付与
        todos_with_user = [
            {**todo, "user_id": user_id}
            for todo in todos
        ]

        vector_service = TodoVectorService()
        vector_service.add_todos_batch(todos_with_user)

        logger.info(f"Bulk indexed {len(todos)} todos for user {user_id}")
        return {
            "message": "Bulk vector indexing completed",
            "user_id": user_id,
            "count": len(todos),
        }