"""configure_structlog() の例外ログ出力に関する回帰テスト。

dict_tracebacks（show_locals=True がデフォルト）が原因で、スタックフレームの
ローカル変数（Authorization ヘッダー等）がログに出力された問題の再発を防ぐ。
"""

import json
import logging

import pytest
import structlog

from api.config import settings
from api.infrastructure.logging import configure_structlog

SECRET = "Bearer test-secret-token-do-not-log"


@pytest.fixture
def json_logging(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture):
    """本番・staging と同じ JSON 分岐で structlog を設定する。"""
    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")
    structlog.reset_defaults()
    structlog.contextvars.clear_contextvars()
    configure_structlog()
    caplog.set_level(logging.INFO)
    yield caplog
    structlog.reset_defaults()
    structlog.contextvars.clear_contextvars()


def _raise_with_secret_local() -> None:
    # ローカル変数に秘密文字列を持った状態で例外を発生させる
    headers = {"Authorization": SECRET}  # noqa: F841
    token = SECRET  # noqa: F841
    raise ValueError("boom")


def _log_exception_output(caplog: pytest.LogCaptureFixture) -> str:
    logger = structlog.get_logger("test_logging")
    try:
        _raise_with_secret_local()
    except ValueError:
        logger.exception("unhandled_exception", route="/test")

    records = [r for r in caplog.records if r.name == "test_logging"]
    assert records, "ログが捕捉できていない（設定または捕捉方法を確認）"
    return records[-1].getMessage()


class TestExceptionLogDoesNotLeakLocals:
    def test_locals_and_secret_are_not_in_output(self, json_logging):
        output = _log_exception_output(json_logging)

        assert SECRET not in output
        assert "test-secret-token" not in output
        assert '"locals"' not in output

    def test_stack_trace_is_preserved(self, json_logging):
        output = _log_exception_output(json_logging)
        payload = json.loads(output)

        exceptions = payload["exception"]
        assert exceptions[0]["exc_type"] == "ValueError"
        assert exceptions[0]["exc_value"] == "boom"

        frames = exceptions[0]["frames"]
        assert any(f["name"] == "_raise_with_secret_local" for f in frames)
        assert all("filename" in f and "lineno" in f for f in frames)

    def test_existing_log_fields_are_kept(self, json_logging):
        output = _log_exception_output(json_logging)
        payload = json.loads(output)

        assert payload["event"] == "unhandled_exception"
        assert payload["route"] == "/test"
        assert payload["level"] == "error"
        assert payload["logger"] == "test_logging"
        assert "timestamp" in payload