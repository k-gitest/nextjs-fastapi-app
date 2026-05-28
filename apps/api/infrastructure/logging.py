"""
structlog 設定

設計方針:
- Phase 1: 自アプリログのみ構造化（uvicorn ログの完全統一は後回し）
- 本番環境: JSON 形式
- 開発環境: コンソール形式
- contextvars で request スコープのコンテキストを自動伝播
- stdlib.LoggerFactory で Sentry / pytest caplog と統合可能にする
"""
import logging

import structlog

from api.config import settings


def configure_structlog() -> None:
    """アプリ起動時に一度だけ呼ぶ。Sentry 初期化より前に呼ぶこと。"""

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    is_development = settings.ENVIRONMENT == "development"

    if is_development:
        processors: list[structlog.types.Processor] = [
            *shared_processors,
            structlog.dev.ConsoleRenderer(),
        ]
    else:
        processors = [
            *shared_processors,
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # 自アプリログの基本設定のみ。uvicorn ログの完全統一は Phase 2 以降
    logging.basicConfig(level=logging.INFO)