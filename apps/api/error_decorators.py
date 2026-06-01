"""
共通デコレーター

Django版からの変更点:
- DjangoIntegrityError → sqlalchemy.exc.IntegrityError（将来DB使用時）
  現在はFastAPIのWebhook処理のみなのでDB操作なし
- log_webhook_call は FastAPIのRequest型に対応
- logging.getLogger → structlog.get_logger に移行

設計方針:
- service_error_handler: サービス層の業務例外(Warning)と予期せぬ例外(Critical)を分類
- log_webhook_call: Webhook呼び出しの開始・終了・失敗を固定イベント名で構造化ログ出力
- structlog を使用し、例外発生時はスタックトレースを確実に保持
"""
import asyncio
import functools
from fastapi import Request

import structlog

from .error_reporting import ErrorMonitor
from .exceptions import BaseAppError

logger = structlog.get_logger(__name__)


def service_error_handler(func):
    """
    Service層のエラーハンドリングデコレーター

    - 独自例外はログ出力して再送出
    - 予期しないエラーはSentryに送信して再送出

    使用例:
        class MailService:
            @staticmethod
            @service_error_handler
            def send_welcome_email(email: str, first_name: str):
                ...
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
    	# サービス名を取得
        if args and hasattr(args[0], "__class__") and not isinstance(args[0], (str, dict, list)):
            class_name = args[0].__class__.__name__
        else:
            class_name = "ServiceFunction"

        operation = func.__name__

        try:
            return func(*args, **kwargs)

        except BaseAppError as exc:
            # 独自例外はログ出力して再送出
            # NOTE: internal_info にはAPIトークン、SQLクエリ、個人情報(PII)などの秘密情報を含めないこと
            if hasattr(exc, "internal_info") and exc.internal_info:
                logger.warning(
                    "service_error",
                    service="api",
                    component=class_name,
                    operation=operation,
                    internal_info=exc.internal_info,
                )
            raise

        except Exception as e:
        	# 予期しないエラーはSentryに送信して再送出
            # logger.error + str(e) をやめ、スタックトレースを保持する logger.exception に変更
            logger.exception(
                "service_unexpected_error",
                service="api",
                component=class_name,
                operation=operation,
            )
            # Sentry連携(ErrorMonitor)のために例外オブジェクト e は必要なので維持
            ErrorMonitor.log_error(
                exception=e,
                context={
                    "operation": operation,
                    "error_type": "unexpected",
                },
                tags={
                    "component": class_name,
                    "error_category": "unexpected",
                    "severity": "critical",
                },
                fingerprint=None,
            )
            raise

    return wrapper


def log_webhook_call(webhook_name: str):
    """
    Webhook呼び出しのロギングデコレーター

    async def / def の両方に対応。
    FastAPIは def エンドポイントをスレッドプールで実行するため、
    async wrapper を被せると def と認識されなくなる。
    そのため asyncio.iscoroutinefunction() で分岐する。
    """
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                request = kwargs.get("request") or next(
                    (a for a in args if isinstance(a, Request)), None
                )
                client_host = (
                    request.client.host if request and request.client else "unknown"
                )
                logger.info(
                    "webhook_started",
                    webhook=webhook_name,
                    client_host=client_host,
                )
                try:
                    response = await func(*args, **kwargs)
                    logger.info("webhook_completed", webhook=webhook_name)
                    return response
                except Exception as e:
                    # 1. スタックトレースをJSONに構造化して埋め込むため logger.exception に変更
                    logger.exception(
                        "webhook_failed",
                        webhook=webhook_name,
                        client_host=client_host,
                    )
                    ErrorMonitor.log_error(
                        exception=e,
                        context={"webhook": webhook_name, "remote_addr": client_host},
                        tags={
                            "component": "webhook",
                            "error_category": "external",
                            "severity": "high",
                            "webhook_name": webhook_name,
                        },
                        fingerprint=["WebhookHandler", webhook_name, "webhook"],
                    )
                    raise
            return async_wrapper

        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                request = kwargs.get("request") or next(
                    (a for a in args if isinstance(a, Request)), None
                )
                client_host = (
                    request.client.host if request and request.client else "unknown"
                )
                logger.info(
                    "webhook_started",
                    webhook=webhook_name,
                    client_host=client_host,
                )
                try:
                    response = func(*args, **kwargs)
                    logger.info("webhook_completed", webhook=webhook_name)
                    return response
                except Exception as e:
                    # 1. 同様に logger.exception に変更
                    logger.exception(
                        "webhook_failed",
                        webhook=webhook_name,
                        client_host=client_host,
                    )
                    ErrorMonitor.log_error(
                        exception=e,
                        context={"webhook": webhook_name, "remote_addr": client_host},
                        tags={
                            "component": "webhook",
                            "error_category": "external",
                            "severity": "high",
                            "webhook_name": webhook_name,
                        },
                        fingerprint=["WebhookHandler", webhook_name, "webhook"],
                    )
                    raise
            return sync_wrapper

    return decorator