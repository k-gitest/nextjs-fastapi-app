"""
services/dlt_pipeline_service.py のユニットテスト（ロック所有権対応版）
"""
import pytest
from unittest.mock import patch, MagicMock
from api.services.dlt_pipeline_service import DltPipelineService
from api.exceptions import AnalyticsError


@pytest.fixture
def mock_settings():
    with patch("api.services.dlt_pipeline_service.settings") as mock:
        mock.PIPELINE_DATABASE_URL = (
            "postgresql://user:pass@ep-xxx.neon.tech/dbname"
        )
        mock.DLT_PIPELINE_NAME = "postgres_to_motherduck"
        mock.DLT_DATASET_NAME = "nextjs_fastapi_app_dwh"
        mock.DLT_LOCK_KEY = "dlt_pipeline:lock"
        mock.DLT_LOCK_TIMEOUT = 600
        yield mock


@pytest.fixture
def mock_redis_acquired():
    """ロック取得成功のモック"""
    with patch("api.services.dlt_pipeline_service.RedisClient") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.acquire_lock.return_value = "test-lock-uuid-1234"
        mock_instance.release_lock.return_value = True
        mock_cls.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_redis_locked():
    """ロック取得失敗（既に実行中）のモック"""
    with patch("api.services.dlt_pipeline_service.RedisClient") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.acquire_lock.return_value = None  # 取得失敗
        mock_cls.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_redis_timeout():
    """タイムアウト後に別プロセスがロックを取得したシナリオ"""
    with patch("api.services.dlt_pipeline_service.RedisClient") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.acquire_lock.return_value = "test-lock-uuid-1234"
        mock_instance.release_lock.return_value = False  # タイムアウトで既に消えていた
        mock_cls.return_value = mock_instance
        yield mock_instance


class TestBuildPgCredentials:
    def test_URLから接続情報を正しく構築する(self, mock_settings):
        credentials = DltPipelineService._build_pg_credentials()
        assert credentials["host"] == "ep-xxx.neon.tech"
        assert credentials["database"] == "dbname"
        assert credentials["username"] == "user"
        assert credentials["password"] == "pass"
        assert credentials["drivername"] == "postgresql"

    def test_デフォルトポートは5432(self, mock_settings):
        credentials = DltPipelineService._build_pg_credentials()
        assert credentials["port"] == 5432

    def test_DATABASE_URLが未設定の場合はAnalyticsError(self):
        with patch("api.services.dlt_pipeline_service.settings") as mock:
            mock.PIPELINE_DATABASE_URL = ""
            with pytest.raises(AnalyticsError) as exc_info:
                DltPipelineService._build_pg_credentials()
        assert "PIPELINE_DATABASE_URL" in exc_info.value.internal_info


class TestExecutePostgresToMotherDuck:
    def test_dry_runモードは実行せずに対象テーブルを返す(self, mock_settings):
        result = DltPipelineService.execute_postgres_to_motherduck(dry_run=True)
        assert result["status"] == "dry_run"
        assert isinstance(result["tables"], list)
        assert len(result["tables"]) > 0
        assert "source" in result

    def test_dry_runはdltもRedisも呼ばない(self, mock_settings):
        with patch("api.services.dlt_pipeline_service.dlt") as mock_dlt, \
             patch("api.services.dlt_pipeline_service.RedisClient") as mock_redis:
            DltPipelineService.execute_postgres_to_motherduck(dry_run=True)
        mock_dlt.pipeline.assert_not_called()
        mock_redis.assert_not_called()

    def test_パイプライン実行成功(self, mock_settings, mock_redis_acquired):
        mock_info = MagicMock()
        mock_table = MagicMock()
        mock_table.keys.return_value = [
            "User", "Todo", "_dlt_loads", "_dlt_pipeline_state"
        ]
        mock_info.load_packages = [
            MagicMock(schema=MagicMock(tables=mock_table))
        ]

        with patch("api.services.dlt_pipeline_service.sql_database"), \
             patch("api.services.dlt_pipeline_service.dlt") as mock_dlt:
            mock_pipeline = MagicMock()
            mock_pipeline.run.return_value = mock_info
            mock_dlt.pipeline.return_value = mock_pipeline

            result = DltPipelineService.execute_postgres_to_motherduck()

        assert result["status"] == "success"
        assert "_dlt_loads" not in result["tables"]
        assert "User" in result["tables"]
        assert "Todo" in result["tables"]

    def test_acquire_lockにlock_idが渡される(self, mock_settings, mock_redis_acquired):
        mock_info = MagicMock()
        mock_table = MagicMock()
        mock_table.keys.return_value = ["User"]
        mock_info.load_packages = [MagicMock(schema=MagicMock(tables=mock_table))]

        with patch("api.services.dlt_pipeline_service.sql_database"), \
             patch("api.services.dlt_pipeline_service.dlt") as mock_dlt:
            mock_dlt.pipeline.return_value.run.return_value = mock_info
            DltPipelineService.execute_postgres_to_motherduck()

        mock_redis_acquired.acquire_lock.assert_called_once_with(
            key="dlt_pipeline:lock",
            ex=600,
        )

    def test_二重実行時はAnalyticsErrorを送出(self, mock_settings, mock_redis_locked):
        with pytest.raises(AnalyticsError) as exc_info:
            DltPipelineService.execute_postgres_to_motherduck()
        assert "already running" in exc_info.value.internal_info

    def test_二重実行時はdltを呼ばない(self, mock_settings, mock_redis_locked):
        with patch("api.services.dlt_pipeline_service.dlt") as mock_dlt:
            with pytest.raises(AnalyticsError):
                DltPipelineService.execute_postgres_to_motherduck()
        mock_dlt.pipeline.assert_not_called()

    def test_成功後にrelease_lockに正しいlock_idが渡される(
        self, mock_settings, mock_redis_acquired
    ):
        mock_info = MagicMock()
        mock_table = MagicMock()
        mock_table.keys.return_value = ["User"]
        mock_info.load_packages = [MagicMock(schema=MagicMock(tables=mock_table))]

        with patch("api.services.dlt_pipeline_service.sql_database"), \
             patch("api.services.dlt_pipeline_service.dlt") as mock_dlt:
            mock_dlt.pipeline.return_value.run.return_value = mock_info
            DltPipelineService.execute_postgres_to_motherduck()

        # release_lockに正しいlock_idが渡されることを確認
        mock_redis_acquired.release_lock.assert_called_once_with(
            "dlt_pipeline:lock",
            "test-lock-uuid-1234",
        )

    def test_失敗時もrelease_lockが呼ばれる(self, mock_settings, mock_redis_acquired):
        with patch("api.services.dlt_pipeline_service.sql_database"), \
             patch("api.services.dlt_pipeline_service.dlt") as mock_dlt:
            mock_dlt.pipeline.return_value.run.side_effect = Exception("dlt error")
            with pytest.raises(AnalyticsError):
                DltPipelineService.execute_postgres_to_motherduck()

        mock_redis_acquired.release_lock.assert_called_once_with(
            "dlt_pipeline:lock",
            "test-lock-uuid-1234",
        )

    def test_タイムアウト後の誤削除が発生しない(
        self, mock_settings, mock_redis_timeout
    ):
        """
        処理がタイムアウト（DLT_LOCK_TIMEOUT超過）した場合、
        release_lockがFalseを返してもエラーにならないことを確認。
        別プロセスのロックを誤削除しない。
        """
        mock_info = MagicMock()
        mock_table = MagicMock()
        mock_table.keys.return_value = ["User"]
        mock_info.load_packages = [MagicMock(schema=MagicMock(tables=mock_table))]

        with patch("api.services.dlt_pipeline_service.sql_database"), \
             patch("api.services.dlt_pipeline_service.dlt") as mock_dlt:
            mock_dlt.pipeline.return_value.run.return_value = mock_info
            # タイムアウトシナリオでもエラーにならない
            result = DltPipelineService.execute_postgres_to_motherduck()

        assert result["status"] == "success"
        # release_lockは呼ばれるがFalseが返っても処理は続く
        mock_redis_timeout.release_lock.assert_called_once()

    def test_dlt実行失敗時はAnalyticsErrorを送出(self, mock_settings, mock_redis_acquired):
        with patch("api.services.dlt_pipeline_service.sql_database"), \
             patch("api.services.dlt_pipeline_service.dlt") as mock_dlt:
            mock_dlt.pipeline.return_value.run.side_effect = Exception("Connection refused")
            with pytest.raises(AnalyticsError) as exc_info:
                DltPipelineService.execute_postgres_to_motherduck()

        assert "Connection refused" in exc_info.value.internal_info