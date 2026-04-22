"""
Upstash Ratelimit クライアント

/search/similar-todos エンドポイントのレート制限に使用
QStash Webhookエンドポイントはレート制限不要（QStash自体が制御）
"""
import logging
from upstash_ratelimit import Ratelimit, SlidingWindow
from upstash_redis import Redis
from api.config import settings

logger = logging.getLogger(__name__)

# Upstash Redis クライアント（Ratelimit専用）
_redis = Redis(
    url=settings.UPSTASH_REDIS_REST_URL,
    token=settings.UPSTASH_REDIS_REST_TOKEN,
)

# セマンティック検索用レート制限
# 10回/分 per ユーザー（Gemini API呼び出しコスト考慮）
search_ratelimit = Ratelimit(
    redis=_redis,
    limiter=SlidingWindow(max_requests=10, window="1 m"),
    prefix="ratelimit:search",
)