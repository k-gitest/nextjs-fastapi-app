import duckdb
import structlog

from typing import Any

from api.config import settings

logger = structlog.get_logger(__name__)


class MotherDuckClient:
    """
    MotherDuck接続クライアント（シングルトン）

    シングルトンパターンで接続を再利用しますが、
    テスト時には reset_for_testing() で完全にリセット可能です。
    """

    _instance = None
    _conn = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._conn is None:
            try:
                token = settings.MOTHERDUCK_TOKEN
                if not token:
                    raise ValueError("MOTHERDUCK_TOKEN is not set")

                self._conn = duckdb.connect(f"md:?motherduck_token={token}")
                self._setup_schema()
                logger.info("motherduck_connection_established")
            except Exception as e:
                logger.error(
                    "motherduck_connection_failed",
                    exception_type=e.__class__.__name__,
                    error=str(e),
                )
                raise

    @classmethod
    def reset_for_testing(cls):
        """テスト用のリセットメソッド"""
        if cls._conn:
            try:
                cls._conn.close()
            except Exception:
                pass
        cls._instance = None
        cls._conn = None
        logger.debug("motherduck_client_reset")

    def _setup_schema(self):
        """初回起動時にデータベース・スキーマ・テーブル作成"""
        try:
            db_name = "fastapi_next_app"

            self._conn.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
            self._conn.execute(f"CREATE SCHEMA IF NOT EXISTS {db_name}.logs")

            # 認証イベントテーブル
            self._conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {db_name}.logs.auth_events (
                    id UUID DEFAULT uuid() PRIMARY KEY,
                    user_id VARCHAR,
                    email VARCHAR,
                    event_type VARCHAR,
                    ip_address VARCHAR,
                    user_agent VARCHAR,
                    success BOOLEAN,
                    error_message VARCHAR,
                    event_timestamp TIMESTAMP,
                    correlation_id VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    date DATE GENERATED ALWAYS AS (CAST(created_at AS DATE)),
                    hour INTEGER GENERATED ALWAYS AS (EXTRACT(HOUR FROM created_at))
                )
            """)

            # Todoイベントテーブル
            # event_type カラム: action の値（created/updated/deleted）が入る
            # event_timestamp: ユーザー操作発生時刻（created_at はMotherDuck保存時刻）
            # todo_title/is_completed/changed_fields/deletion_reason: 将来の監査用途で保持
            self._conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {db_name}.logs.todo_events (
                    id UUID DEFAULT uuid() PRIMARY KEY,
                    user_id VARCHAR NOT NULL,
                    todo_id VARCHAR NOT NULL,
                    event_type VARCHAR NOT NULL,
                    priority VARCHAR,
                    progress INTEGER,
                    event_timestamp TIMESTAMP,
                    correlation_id VARCHAR,
                    todo_title VARCHAR,
                    is_completed BOOLEAN,
                    changed_fields VARCHAR,
                    deletion_reason VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    date DATE GENERATED ALWAYS AS (CAST(created_at AS DATE)),
                    hour INTEGER GENERATED ALWAYS AS (EXTRACT(HOUR FROM created_at))
                )
            """)

            logger.info("motherduck_schema_initialized")
        except Exception as e:
            logger.error(
                "motherduck_schema_failed",
                exception_type=e.__class__.__name__,
                error=str(e),
            )
            raise

    def insert_auth_event(self, event_data: dict[str, Any]) -> None:
        """認証イベントをMotherDuckに挿入"""
        self._conn.execute("""
            INSERT INTO fastapi_next_app.logs.auth_events
            (user_id, email, event_type, ip_address, user_agent,
             success, error_message, event_timestamp, correlation_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            event_data.get("user_id"),
            event_data.get("email"),
            event_data.get("action"),        # action → event_type カラムへ保存
            event_data.get("ip_address"),
            event_data.get("user_agent", ""),
            event_data.get("success", True),
            event_data.get("error_message"),
            event_data.get("timestamp"),     # 発生時刻
            event_data.get("correlation_id"),
        ])

    def insert_todo_event(self, event_data: dict[str, Any]) -> None:
        """TodoイベントをMotherDuckに挿入"""
        self._conn.execute("""
            INSERT INTO fastapi_next_app.logs.todo_events
            (user_id, todo_id, event_type, priority, progress,
             event_timestamp, correlation_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            event_data.get("user_id"),
            event_data.get("todo_id"),
            event_data.get("action"),        # action → event_type カラムへ保存
            event_data.get("priority"),
            event_data.get("progress"),
            event_data.get("timestamp"),     # 発生時刻
            event_data.get("correlation_id"),
        ])

    def query(self, sql: str) -> list | None:
        """任意のSQLクエリを実行（テスト用）"""
        try:
            result = self._conn.execute(sql).fetchall()
            return result
        except Exception as e:
            logger.exception(
                "motherduck_query_failed",
                exception_type=e.__class__.__name__,
            )
            return None

    def close(self):
        """接続を閉じる（アプリ終了時）"""
        if self._conn:
            self._conn.close()
            self._conn = None
            logger.info("motherduck_connection_closed")