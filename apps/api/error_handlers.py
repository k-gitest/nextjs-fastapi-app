"""
FastAPI統一エラーハンドラー
フロントエンド errorHandler と連携

Django版からの変更点:
- DRFのexception_handler → FastAPIのexception_handler
- Ratelimited, AuthenticationFailed → FastAPIのHTTPException(429), HTTPException(401)
- main.py の app に register_exception_handlers(app) で登録する

フロントエンドへのレスポンス形式（Django版と同一）:
{
    "error": "エラーコード",       # ApiError での判定用
    "detail": "エラーメッセージ",   # ApiError.serverMessage
    "data": {...}                   # ApiError.data（オプション）
}
"""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .exceptions import (
    AuthenticationError,
    BaseAppError,
    InvalidTokenError,
    TokenExpiredError,
)
from .error_reporting import ErrorMonitor

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """
    FastAPIアプリケーションに例外ハンドラーを登録する

    main.py で呼び出す:
        from api.error_handlers import register_exception_handlers
        register_exception_handlers(app)
    """

    @app.exception_handler(BaseAppError)
    async def app_error_handler(request: Request, exc: BaseAppError) -> JSONResponse:
        """
        独自例外（BaseAppError系）の統一ハンドラー
        internal_info はログ・Sentryのみ、フロントエンドには返さない
        """
        # internal_info をログに出力
        if hasattr(exc, "internal_info") and exc.internal_info:
            logger.error(
                f"Application error [{exc.code}]: {exc.internal_info}",
                extra={"error_code": exc.code, "status_code": exc.status_code},
            )

        # 500系はSentryに送信
        if exc.status_code >= 500:
            ErrorMonitor.log_error(
                exception=exc,
                context={
                    "error_code": exc.code,
                    "path": str(request.url),
                    "method": request.method,
                    "internal_info": exc.internal_info,
                },
                tags={
                    "component": "api",
                    "error_category": "application",
                    "severity": "high",
                    "error_type": exc.code,
                },
            )

        response_data: dict = {
            "error": exc.code,
            "detail": exc.message,
        }
        if exc.data:
            response_data["data"] = exc.data  # internal_info は含まない

        return JSONResponse(
            status_code=exc.status_code,
            content=response_data,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """
        Pydanticバリデーションエラーの統一ハンドラー
        DRFのフィールドエラー形式に合わせる
        """
        errors = exc.errors()
        logger.warning(f"Validation error: {errors}")

        # 最初のエラーメッセージを取得
        first_error = errors[0] if errors else {}
        field = ".".join(str(loc) for loc in first_error.get("loc", [])[1:])  # bodyを除く
        message = first_error.get("msg", "入力内容に誤りがあります")

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "error": "validation_error",
                "detail": message,
                "data": {
                    "fields": {
                        ".".join(str(loc) for loc in e["loc"][1:]): e["msg"]
                        for e in errors
                    }
                },
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """
        未ハンドリング例外（500）の統一ハンドラー
        必ずSentryに送信する
        """
        logger.critical(
            f"Unhandled exception: {exc}",
            exc_info=True,
            extra={
                "path": str(request.url),
                "method": request.method,
                "exception_type": exc.__class__.__name__,
            },
        )

        ErrorMonitor.log_error(
            exception=exc,
            context={
                "path": str(request.url),
                "method": request.method,
            },
            tags={
                "component": "api",
                "error_category": "unexpected",
                "severity": "critical",
                "unhandled": "true",
            },
            fingerprint=None,
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "detail": "サーバー内部で予期しないエラーが発生しました。",
            },
        )