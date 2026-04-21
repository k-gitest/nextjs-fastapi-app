"""
エラー報告・モニタリング統合

Django版からの変更点:
- django.conf.settings → api.config.settings
- Django固有のHttp404, Ratelimited除去
- before_send はSentry初期化時に main.py で設定
"""
import logging
import sentry_sdk

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple, Type, Union

from .exceptions import BaseAppError, DatabaseError

logger = logging.getLogger(__name__)


def _apply_scope_data(
    scope: sentry_sdk.Scope,
    level: str,
    extra: Optional[Dict[str, Any]] = None,
    tags: Optional[Dict[str, str]] = None,
    user_info: Optional[Dict[str, Any]] = None,
    fingerprint: Optional[list] = None,
):
    scope.level = level
    if extra:
        for key, value in extra.items():
            scope.set_extra(key, value)
    if tags:
        for key, value in tags.items():
            scope.set_tag(key, value)
    if user_info:
        scope.set_user(user_info)
    if fingerprint:
        scope.fingerprint = fingerprint


def _capture_exception_internal(
    exception: Exception,
    level: str = "error",
    extra: Optional[Dict[str, Any]] = None,
    tags: Optional[Dict[str, str]] = None,
    user_info: Optional[Dict[str, Any]] = None,
    fingerprint: Optional[list] = None,
):
    with sentry_sdk.isolation_scope() as scope:
        _apply_scope_data(scope, level, extra, tags, user_info, fingerprint)
        sentry_sdk.capture_exception(exception)


def _capture_message_internal(
    message: str,
    level: str = "info",
    extra: Optional[Dict[str, Any]] = None,
    tags: Optional[Dict[str, str]] = None,
    fingerprint: Optional[list] = None,
):
    with sentry_sdk.push_scope() as scope:
        scope.level = level
        if extra:
            for key, value in extra.items():
                scope.set_extra(key, value)
        if tags:
            for key, value in tags.items():
                scope.set_tag(key, value)
        if fingerprint:
            scope.fingerprint = fingerprint
        sentry_sdk.capture_message(message)


@dataclass
class ErrorProfile:
    """エラー報告のプロファイル（プリセット）"""
    error_category: str
    severity: str
    user_impact: str
    business_critical: str
    use_fingerprint: bool = False


class ErrorProfiles:
    """よく使うエラープロファイルのプリセット"""

    INFRASTRUCTURE_MEDIUM = ErrorProfile(
        error_category="infrastructure",
        severity="medium",
        user_impact="low",
        business_critical="false",
        use_fingerprint=True,
    )

    INFRASTRUCTURE_HIGH = ErrorProfile(
        error_category="infrastructure",
        severity="high",
        user_impact="medium",
        business_critical="false",
        use_fingerprint=True,
    )

    MONITORING_LOW = ErrorProfile(
        error_category="monitoring",
        severity="low",
        user_impact="none",
        business_critical="false",
        use_fingerprint=True,
    )

    EXTERNAL_SERVICE_HIGH = ErrorProfile(
        error_category="external_service",
        severity="high",
        user_impact="high",
        business_critical="true",
        use_fingerprint=False,
    )


class ErrorMonitor:
    """エラーモニタリング統合（Sentry）"""

    @staticmethod
    def log_error(
        exception: Exception,
        context: Optional[Dict[str, Any]] = None,
        tags: Optional[Dict[str, str]] = None,
        user=None,
        fingerprint: Optional[list] = None,
    ):
        final_level = "error"

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

        if "severity" in final_tags:
            level_map = {
                "critical": "fatal",
                "high": "error",
                "medium": "warning",
                "low": "info",
            }
            final_level = level_map.get(final_tags["severity"], final_level)

        if isinstance(exception, BaseAppError):
            final_tags["error_code"] = exception.code

        final_context = (context or {}).copy()

        if isinstance(exception, BaseAppError) and hasattr(exception, "internal_info"):
            if exception.internal_info:
                final_context["internal_info"] = exception.internal_info

        user_info = None
        if user and hasattr(user, "id"):
            user_info = {"id": user.id, "email": getattr(user, "email", None)}

        _capture_exception_internal(
            exception=exception,
            level=final_level,
            extra=final_context,
            tags=final_tags,
            user_info=user_info,
            fingerprint=fingerprint,
        )

    @staticmethod
    def log_warning(
        message: str,
        context: Optional[Dict[str, Any]] = None,
        tags: Optional[Dict[str, str]] = None,
        fingerprint: Optional[list] = None,
    ):
        _capture_message_internal(
            message=message, level="warning", extra=context,
            tags=tags, fingerprint=fingerprint,
        )

    @staticmethod
    def log_info(
        message: str,
        context: Optional[Dict[str, Any]] = None,
        tags: Optional[Dict[str, str]] = None,
        fingerprint: Optional[list] = None,
    ):
        _capture_message_internal(
            message=message, level="info", extra=context,
            tags=tags, fingerprint=fingerprint,
        )

    @staticmethod
    @contextmanager
    def capture_and_continue(
        component: str,
        operation: str,
        service: str,
        expected_errors: Union[Type[Exception], Tuple[Type[Exception], ...]] = (),
        user=None,
        context: Optional[Dict[str, Any]] = None,
        profile: Optional[ErrorProfile] = None,
        error_category: Optional[str] = None,
        severity: Optional[str] = None,
        user_impact: Optional[str] = None,
        business_critical: Optional[str] = None,
        use_fingerprint: Optional[bool] = None,
    ):
        """
        特定の処理ブロックで例外が発生しても、報告だけして続行する

        使用例:
            with ErrorMonitor.capture_and_continue(
                component='email',
                operation='send_welcome_email',
                service='MailService',
                expected_errors=EmailDeliveryError,
                profile=ErrorProfiles.INFRASTRUCTURE_MEDIUM,
            ):
                MailService.send_welcome_email(...)
        """
        # expected_errors の正規化
        if expected_errors:
            if isinstance(expected_errors, type) and issubclass(expected_errors, Exception):
                normalized_errors = (expected_errors,)
            elif isinstance(expected_errors, tuple):
                normalized_errors = expected_errors
            else:
                logger.warning(f"Invalid expected_errors type: {type(expected_errors)}")
                normalized_errors = ()
        else:
            normalized_errors = ()

        # プロファイルからデフォルト値を取得
        if profile:
            _error_category = error_category or profile.error_category
            _severity = severity or profile.severity
            _user_impact = user_impact or profile.user_impact
            _business_critical = business_critical or profile.business_critical
            _use_fingerprint = use_fingerprint if use_fingerprint is not None else profile.use_fingerprint
        else:
            _error_category = error_category or "infrastructure"
            _severity = severity or "medium"
            _user_impact = user_impact or "low"
            _business_critical = business_critical or "false"
            _use_fingerprint = use_fingerprint if use_fingerprint is not None else False

        fingerprint = [service, operation, component] if _use_fingerprint else None

        try:
            yield
        except normalized_errors as e:
            logger.warning(
                f"Expected error in {component}.{operation}: {e}",
                extra={"component": component, "operation": operation},
            )
            ErrorMonitor.log_error(
                exception=e,
                context={"service": service, "operation": operation, **(context or {})},
                tags={
                    "component": component,
                    "error_category": _error_category,
                    "severity": _severity,
                    "user_impact": _user_impact,
                    "business_critical": _business_critical,
                    "captured_via": "capture_and_continue",
                },
                user=user,
                fingerprint=fingerprint,
            )
        except Exception as e:
            logger.error(
                f"Unexpected error in {component}.{operation}: {e}",
                extra={"component": component, "operation": operation},
            )
            ErrorMonitor.log_error(
                exception=e,
                context={"service": service, "operation": operation, **(context or {})},
                tags={
                    "component": component,
                    "error_category": "unexpected",
                    "severity": "high",
                    "user_impact": _user_impact,
                    "business_critical": _business_critical,
                    "captured_via": "capture_and_continue",
                },
                user=user,
                fingerprint=None,
            )