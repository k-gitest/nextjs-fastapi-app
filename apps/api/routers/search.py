"""
セマンティック検索ルーター

Webhookルーター（/webhooks）とは別ルーターとして定義。
内部APIトークンで認証し、Next.js Route Handlerからのみ呼ばれる。
"""
import logging
from fastapi import APIRouter, Depends

from api.infrastructure.internal_auth import verify_internal_token
from api.schemas.search import SimilarTodosRequest, SimilarTodosResponse, SimilarTodoItem
from api.services.todo_vector_service import TodoVectorService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["search"])


@router.post(
    "/similar-todos",
    response_model=SimilarTodosResponse,
    dependencies=[Depends(verify_internal_token)],
)
async def search_similar_todos(payload: SimilarTodosRequest) -> SimilarTodosResponse:
    """
    類似Todoのセマンティック検索

    Next.jsのRoute Handlerからのみ呼ばれる内部エンドポイント。
    Gemini APIでクエリをベクトル化し、Upstash Vectorで類似検索を実行。

    Args:
        payload: 検索クエリ・ユーザーID・件数・スコア閾値

    Returns:
        SimilarTodosResponse: 検索結果リスト

    Raises:
        HTTPException 401: 内部トークンが不正
        HTTPException 503: ベクトル検索またはEmbeddingエラー（error_handlers.pyが処理）
    """
    logger.info(
        f"Semantic search: query='{payload.query[:50]}' user={payload.user_id}"
    )

    vector_service = TodoVectorService()
    results = vector_service.search_similar(
        query=payload.query,
        user_id=payload.user_id,
        top_k=payload.top_k,
        min_score=payload.min_score,
    )

    return SimilarTodosResponse(
        results=[
            SimilarTodoItem(
                id=r["id"],
                score=r["score"],
                title=r["title"] or "",
                priority=r.get("priority"),
                progress=r.get("progress"),
            )
            for r in results
        ],
        count=len(results),
        query=payload.query,
    )