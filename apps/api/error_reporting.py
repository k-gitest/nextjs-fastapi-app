
"""
エラー報告・モニタリング統合

Sentryへのエラー報告とモニタリング関連の処理を提供する。
"""

from typing import Any, Literal, Optional

import sentry_sdk

from .exceptions import BaseAppError, DatabaseError


def _apply_scope_data(
    scope: sentry_sdk.Scope,
    level: Literal["fatal", "critical", "error", "warning", "info", "debug"],
    extra: Optional[dict[str, Any]] = None,
    tags: Optional[dict[str, str]] = None,
    fingerprint: Optional[list[str]] = None,
):
    scope.set_level(level)
    if extra:
        for key, value in extra.items():
            scope.set_extra(key, value)
    if tags:
        for key, value in tags.items():
            scope.set_tag(key, value)
    if fingerprint:
        scope.fingerprint = fingerprint


def _capture_exception_internal(
    exception: Exception,
    level: Literal["fatal", "critical", "error", "warning", "info", "debug"] = "error",
    extra: Optional[dict[str, Any]] = None,
    tags: Optional[dict[str, str]] = None,
    fingerprint: Optional[list[str]] = None,
):
    with sentry_sdk.isolation_scope() as scope:
        _apply_scope_data(
            scope=scope,
            level=level,
            extra=extra,
            tags=tags,
            fingerprint=fingerprint,
        )
        sentry_sdk.capture_exception(exception)


def _capture_message_internal(
    message: str,
    level: Literal["fatal", "critical", "error", "warning", "info", "debug"] = "info",
    extra: Optional[dict[str, Any]] = None,
    tags: Optional[dict[str, str]] = None,
    fingerprint: Optional[list[str]] = None,
):
    with sentry_sdk.isolation_scope() as scope:
        _apply_scope_data(
            scope=scope,
            level=level,
            extra=extra,
            tags=tags,
            fingerprint=fingerprint,
        )
        sentry_sdk.capture_message(message)


class ErrorMonitor:
    """エラーモニタリング統合（Sentry）"""

    @staticmethod
    def log_error(
        exception: Exception,
        context: Optional[dict[str, Any]] = None,
        tags: Optional[dict[str, str]] = None,
        fingerprint: Optional[list[str]] = None,
    ):
        final_level: Literal[
            "fatal", "critical", "error", "warning", "info", "debug"
        ] = "error"

        if isinstance(exception, BaseAppError):
            if exception.status_code < 400:
                final_level = "info"
            elif exception.status_code < 500:
                final_level = "warning"
            else:
                final_level = "error"
            if isinstance(exception, DatabaseError):
                final_level = "fatal"

        final_tags = (tags or {}).copy()
        final_tags.setdefault("service", "api")

        if "severity" in final_tags:
            level_map: dict[
                str, Literal["fatal", "critical", "error", "warning", "info", "debug"]
            ] = {
                "critical": "fatal",
                "high": "error",
                "medium": "warning",
                "low": "info",
            }
            final_level = level_map.get(final_tags["severity"], final_level)

        if isinstance(exception, BaseAppError):
            final_tags["error_code"] = exception.code

        # safe_contextをベースにcontextで上書き
        final_context: dict[str, Any] = {}

        # safe_contextをlog_error側でmerge（呼び出し側での忘れを防ぐ）
        if isinstance(exception, BaseAppError):
            final_context.update(exception.safe_context or {})
        final_context.update(context or {})

        _capture_exception_internal(
            exception=exception,
            level=final_level,
            extra=final_context,
            tags=final_tags,
            fingerprint=fingerprint,
        )

    @staticmethod
    def log_warning(
        message: str,
        context: Optional[dict[str, Any]] = None,
        tags: Optional[dict[str, str]] = None,
        fingerprint: Optional[list[str]] = None,
    ):
        _capture_message_internal(
            message=message,
            level="warning",
            extra=context,
            tags=tags,
            fingerprint=fingerprint,
        )

    @staticmethod
    def log_info(
        message: str,
        context: Optional[dict[str, Any]] = None,
        tags: Optional[dict[str, str]] = None,
        fingerprint: Optional[list[str]] = None,
    ):
        _capture_message_internal(
            message=message,
            level="info",
            extra=context,
            tags=tags,
            fingerprint=fingerprint,
        )
