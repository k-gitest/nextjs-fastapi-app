"""
DLT Pipeline Service - PostgreSQL → MotherDuck 同期

設計方針:
- マルチワーカー・マルチコンテナ環境での排他制御には
  Upstash RedisのSET NX EXを使用する
- ロック取得時にUUIDを発行して所有者を識別し、
  release_lock()ではLUAスクリプトで所有権を確認してから削除する
- Pipelineの同期処理はdefのルーターから実行し、
  asyncイベントループをブロックしない
- Pipeline用DB接続情報はPIPELINE_DATABASE_URLから取得する
- 構造化ログにはstructlogを使用する

実装上の注意:
- threading.Lockはプロセス内でのみ有効なため、
  分散環境の排他制御には使用しない
- ロックのタイムアウト後に別プロセスが取得したロックを
  誤って削除しないよう、ロック所有者を検証してから解放する
"""
import structlog
from typing import TypedDict

from urllib.parse import urlparse

import dlt
from dlt.sources.sql_database import sql_database

from api.config import settings
from api.exceptions import AnalyticsError
from api.infrastructure.redis_client import RedisClient
from api.error_reporting import ErrorMonitor

logger = structlog.get_logger(__name__)

SYNC_TABLES = ["User", "Todo"]

class PgCredentials(TypedDict):
    drivername: str
    host: str | None
    port: int
    database: str
    username: str | None
    password: str | None

class DltPipelineService:
    """PostgreSQL → MotherDuck 同期サービス"""

    @classmethod
    def execute_postgres_to_motherduck(cls, dry_run: bool = False) -> dict:
        """
        dltパイプラインを実行

        Args:
            dry_run: Trueの場合、実行せずに同期対象を返す

        Returns:
            dict:
                - status: "success" | "dry_run"
                - tables: 同期したテーブルのリスト
                - source: 接続先情報（dry_runの場合のみ）

        Raises:
            AnalyticsError: パイプライン実行エラー、または二重実行検知時
        """
        log = logger.bind(
            component="dlt-pipeline",
            lock_key=settings.DLT_LOCK_KEY,
        )

        pg_credentials = cls._build_pg_credentials()

        # Dry run モード（Redisロック不要）
        if dry_run:
            source_info = f"{pg_credentials.get('host')}/{pg_credentials.get('database')}"
            logger.info(
                "dlt_pipeline_dry_run",
                tables=SYNC_TABLES,
                source=f"{pg_credentials.get('host')}/{pg_credentials.get('database')}",
            )
            return {
                "status": "dry_run",
                "tables": SYNC_TABLES,
                "source": source_info,
            }

        # Upstash Redis でロック取得（UUIDで所有権を管理）
        redis = RedisClient()
        lock_id = redis.acquire_lock(
            key=settings.DLT_LOCK_KEY,
            ex=settings.DLT_LOCK_TIMEOUT,
        )

        if lock_id is None:
            log.warning("dlt_pipeline_already_running")
            raise AnalyticsError(
                internal_details=(
                    f"Pipeline already running "
                    f"(lock_key: {settings.DLT_LOCK_KEY})"
                )
            )

        try:
            log.info("dlt_pipeline_started", tables=SYNC_TABLES)

            source = sql_database(
                credentials=pg_credentials,
                schema="public",
                table_names=SYNC_TABLES,
            )

            pipeline = dlt.pipeline(
                pipeline_name=settings.DLT_PIPELINE_NAME,
                destination="motherduck",
                dataset_name=settings.DLT_DATASET_NAME,
            )

            info = pipeline.run(source, write_disposition="merge")

            # _dlt_* 内部テーブルを除外
            synced_tables = list(info.load_packages[0].schema.tables.keys())
            user_tables = [t for t in synced_tables if not t.startswith("_dlt_")]

            log.info("dlt_pipeline_completed", synced_tables=user_tables)

            return {
                "status": "success",
                "tables": user_tables,
                "info": str(info),
            }

        except AnalyticsError:
            raise

        except Exception as e:
            log.exception(
                "dlt_pipeline_failed",
                exception_type=e.__class__.__name__,
            )
            ErrorMonitor.log_error(
                exception=e,
                tags={
                    "event_type": "dlt_pipeline_failed",
                    "component": "dlt",
                },
            )
            raise AnalyticsError(
                internal_details="Pipeline execution failed"
            ) from e

        finally:
            # 自分が取得したロックのみ解放（LUAスクリプトでアトミックに実行）
            # タイムアウト後に別プロセスのロックを誤削除しない
            released = redis.release_lock(settings.DLT_LOCK_KEY, lock_id)
            if released:
                log.debug("dlt_pipeline_lock_released")

    @classmethod
    def _build_pg_credentials(cls) -> PgCredentials:
        """PIPELINE_DATABASE_URL から dlt用の接続情報を構築"""
        database_url = settings.PIPELINE_DATABASE_URL
        if not database_url:
            raise AnalyticsError(
                internal_details="PIPELINE_DATABASE_URL is not set"
            )

        parsed = urlparse(database_url)

        return {
            "drivername": "postgresql",
            "host": parsed.hostname,
            "port": parsed.port or 5432,
            "database": parsed.path.lstrip("/"),
            "username": parsed.username,
            "password": parsed.password,
        }
