"""
DLT Pipeline Service - PostgreSQL → MotherDuck 同期

Django版からの変更点:
- django.conf.settings → api.config.settings
- cache.add（Django Redis）→ Upstash Redis の SET NX EX
- threading.Lock は廃止（マルチワーカー・マルチコンテナで破綻するため）
- get_user_model() / Todo._meta.db_table → テーブル名を直接指定
- DB設定の取得: DATABASES['default'] → PIPELINE_DATABASE_URL をURLパース

罠の回避:
1. 排他制御: Upstash Redis の SET NX EX でプロセスをまたいだロックを実現
   → threading.Lock はシングルプロセス内でしか機能しない
2. ルーターでは def（非async）で受ける
   → async def で重い同期処理を実行するとイベントループがブロックする

ロック所有権の管理:
- acquire_lock() でUUIDを発行しRedisに保存
- release_lock() でLUAスクリプトによりアトミックにget+deleteを実行
- タイムアウト（例: 11分かかった）後に別プロセスのロックを誤削除しない
"""
import logging
from urllib.parse import urlparse

import dlt
from dlt.sources.sql_database import sql_database

from api.config import settings
from api.exceptions import AnalyticsError
from api.infrastructure.redis_client import RedisClient

logger = logging.getLogger(__name__)

SYNC_TABLES = ["User", "Todo"]


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
        pg_credentials = cls._build_pg_credentials()

        # Dry run モード（Redisロック不要）
        if dry_run:
            source_info = f"{pg_credentials.get('host')}/{pg_credentials.get('database')}"
            logger.info(f"Dry run - would sync tables: {SYNC_TABLES}")
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
            logger.warning("Pipeline already running, skipping this execution")
            raise AnalyticsError(
                internal_details=(
                    f"Pipeline already running "
                    f"(lock_key: {settings.DLT_LOCK_KEY})"
                )
            )

        try:
            logger.info(f"Starting dlt pipeline for tables: {SYNC_TABLES}")

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

            logger.info(f"Pipeline completed - synced tables: {user_tables}")

            return {
                "status": "success",
                "tables": user_tables,
                "info": str(info),
            }

        except AnalyticsError:
            raise

        except Exception as e:
            logger.exception("dlt pipeline execution failed")
            raise AnalyticsError(
                internal_details=f"Pipeline execution failed: {type(e).__name__}: {str(e)}"
            ) from e

        finally:
            # 自分が取得したロックのみ解放（LUAスクリプトでアトミックに実行）
            # タイムアウト後に別プロセスのロックを誤削除しない
            released = redis.release_lock(settings.DLT_LOCK_KEY, lock_id)
            if released:
                logger.debug(f"Released pipeline lock: {settings.DLT_LOCK_KEY}")

    @classmethod
    def _build_pg_credentials(cls) -> dict:
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