"""
共通デコレーター

Django版からの変更点:
- DjangoIntegrityError → sqlalchemy.exc.IntegrityError（将来DB使用時）
  現在はFastAPIのWebhook処理のみなのでDB操作なし
- log_webhook_call は FastAPIのRequest型に対応
"""
import functools
import logging
import asyncio

from .exceptions import BaseAppError
from .error_reporting import ErrorMonitor

logger = logging.getLogger(__name__)


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
            service_name = args[0].__class__.__name__
        else:
            service_name = "ServiceFunction"

        operation = func.__name__

        try:
            return func(*args, **kwargs)

        except BaseAppError as exc:
            # 独自例外はログ出力して再送出
            if hasattr(exc, "internal_info") and exc.internal_info:
                logger.warning(
                    f"{service_name}.{operation}: {exc.internal_info}",
                    extra={"service": service_name, "operation": operation},
                )
            raise

        except Exception as e:
            # 予期しないエラーはSentryに送信して再送出
            logger.exception(
                f"{service_name}.{operation}: Unexpected error",
                extra={"service": service_name, "operation": operation},
            )
            ErrorMonitor.log_error(
                exception=e,
                context={
                    "service": service_name,
                    "operation": operation,
                    "error_type": "unexpected",
                },
                tags={
                    "component": "service",
                    "error_category": "unexpected",
                    "severity": "critical",
                    "service": service_name,
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
                from fastapi import Request
                request = kwargs.get("request") or next(
                    (a for a in args if isinstance(a, Request)), None
                )
                client_host = (
                    request.client.host if request and request.client else "unknown"
                )
                logger.info(
                    f"Webhook START: {webhook_name}",
                    extra={"webhook": webhook_name, "remote_addr": client_host},
                )
                try:
                    response = await func(*args, **kwargs)
                    logger.info(f"Webhook END: {webhook_name}")
                    return response
                except Exception as e:
                    logger.error(f"Webhook FAILED: {webhook_name} Error: {str(e)}")
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
                from fastapi import Request
                request = kwargs.get("request") or next(
                    (a for a in args if isinstance(a, Request)), None
                )
                client_host = (
                    request.client.host if request and request.client else "unknown"
                )
                logger.info(
                    f"Webhook START: {webhook_name}",
                    extra={"webhook": webhook_name, "remote_addr": client_host},
                )
                try:
                    response = func(*args, **kwargs)
                    logger.info(f"Webhook END: {webhook_name}")
                    return response
                except Exception as e:
                    logger.error(f"Webhook FAILED: {webhook_name} Error: {str(e)}")
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