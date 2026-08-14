"""
Todo固有のベクトル検索サービス

現在のFastAPIはDBを持たないため、Todoのフィールド（user_id・created_at等）は
Next.js側からWebhook payloadとして受け取る想定で実装している。
"""
import structlog
from typing import Any
from api.services.base_vector_service import BaseVectorService
from api.services.todo_embedding_service import TodoEmbeddingService
from api.error_decorators import service_error_handler

logger = structlog.get_logger(__name__)


class TodoVectorService(BaseVectorService):
    """
    Todoのベクトル検索サービス

    BaseVectorServiceを継承し、Todo固有のロジックを提供
    """

    def __init__(self):
        super().__init__()

    @service_error_handler
    def add_todo(
        self,
        todo_id: str,
        todo_title: str,
        priority: str,
        progress: int,
        user_id: str,
        created_at: str,
    ) -> None:
        """
        Todoをベクトルインデックスに追加

        Args:
            todo_id: TodoのID（Prisma cuid）
            todo_title: Todoのタイトル
            priority: 優先度（HIGH/MEDIUM/LOW）
            progress: 進捗率（0-100）
            user_id: ユーザーID（Prisma cuid）
            created_at: 作成日時（ISO文字列）
        """
        text = TodoEmbeddingService.prepare_text(todo_title, priority, progress)
        embedding = TodoEmbeddingService.embed_text(text, task_type="retrieval_document")

        vectors = [(
            todo_id,
            embedding,
            {
                "title": todo_title,
                "user_id": user_id,
                "priority": priority,
                "progress": progress,
                "created_at": created_at,
            },
        )]

        self._safe_upsert(vectors, operation=f"add_todo_{todo_id}")
        logger.info("todo_vector_added", todo_id=todo_id)

    @service_error_handler
    def delete_todo(self, todo_id: str) -> None:
        """
        Todoをベクトルインデックスから削除

        Args:
            todo_id: TodoのID（Prisma cuid）
        """
        self._safe_delete([todo_id])
        logger.info("todo_vector_deleted", todo_id=todo_id)

    @service_error_handler
    def search_similar(
        self,
        query: str,
        user_id: str,
        top_k: int = 5,
        min_score: float = 0.5,
    ) -> list[dict[str, Any]]:
        """
        類似Todoをセマンティック検索

        Args:
            query: 検索クエリ（例: "明日の会議関連"）
            user_id: 検索対象ユーザーのID
            top_k: 返す結果の最大数
            min_score: 最小類似度スコア

        Returns:
            list[dict]: 検索結果
        """
        query_embedding = TodoEmbeddingService.embed_text(
            query,
            task_type="retrieval_query",
        )

        results = self._safe_query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True,
            filter=f"user_id = '{user_id}'",
        )

        return [
            {
                "id": r.id,
                "score": r.score,
                "title": r.metadata.get("title"),
                "priority": r.metadata.get("priority"),
                "progress": r.metadata.get("progress"),
            }
            for r in results
            if r.score >= min_score
        ]

    @service_error_handler
    def add_todos_batch(self, todos: list[dict[str, Any]]) -> None:
        """
        複数のTodoを一括追加

        Args:
            todos: Todoのリスト
                各要素: {id, todo_title, priority, progress, user_id, created_at}
        """
        texts = [
            TodoEmbeddingService.prepare_text(
                t["todo_title"], t["priority"], t["progress"]
            )
            for t in todos
        ]

        embeddings = TodoEmbeddingService.embed_batch(texts)

        vectors = [
            (
                todo["todo_id"],
                embedding,
                {
                    "title": todo["todo_title"],
                    "user_id": todo["user_id"],
                    "priority": todo["priority"],
                    "progress": todo["progress"],
                    "created_at": todo["created_at"],
                },
            )
            for todo, embedding in zip(todos, embeddings)
        ]

        self._safe_upsert(vectors, operation="batch_add")
        logger.info("todo_vector_batch_added", count=len(todos))
