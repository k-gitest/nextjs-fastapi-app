"""
セマンティック検索のスキーマ定義
"""
from pydantic import BaseModel, Field
from typing import Optional


class SimilarTodosRequest(BaseModel):
    """類似Todo検索リクエスト"""
    query: str = Field(..., min_length=1, max_length=500)
    user_id: str
    top_k: int = Field(default=5, ge=1, le=20)
    min_score: float = Field(default=0.5, ge=0.0, le=1.0)


class SimilarTodoItem(BaseModel):
    """検索結果の1件"""
    id: str
    score: float
    title: str
    priority: Optional[str] = None
    progress: Optional[int] = None


class SimilarTodosResponse(BaseModel):
    """類似Todo検索レスポンス"""
    results: list[SimilarTodoItem]
    count: int
    query: str