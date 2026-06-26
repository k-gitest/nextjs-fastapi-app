"""
Access Log Middleware

uvicorn のデフォルト access log（プレーンテキスト）を無効化し、
structlog 経由で JSON として出力する。

出力フィールド:
- method, path, status_code
- response_time_ms
- client_host
- correlation_id（contextvars から自動取得）
- user_agent
"""
import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from collections.abc import Awaitable, Callable
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger(__name__)


class AccessLogMiddleware(BaseHTTPMiddleware):
    """
    HTTP リクエスト/レスポンスを structlog で JSON 出力するミドルウェア。

    correlation_id は structlog.contextvars.merge_contextvars により
    contextvars から自動で載る（middleware での bind_contextvars 済みであること）。
    """

    # ヘルスチェック等、access log を出力しないパス
    EXCLUDED_PATHS: frozenset[str] = frozenset(["/health", "/health/ready"])

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # 除外パスはスキップ
        path = request.scope["path"]  # クエリ文字列を含まない
        if path in self.EXCLUDED_PATHS:
            return await call_next(request)

        start = time.monotonic()
        status_code = 500  # デフォルトを500にしておく

        try:
            response: Response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            response_time_ms = round((time.monotonic() - start) * 1000, 2)
            logger.info(
                "http_request",
                method=request.method,
                path=path,
                status_code=status_code,
                response_time_ms=response_time_ms,
                client_host=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )