"""
MaintenanceService のユニット・統合テスト

実DB（Neon）を使用する。
テスト対象テーブル: processed_events
"""
from datetime import datetime, timedelta, timezone

import psycopg
import pytest

from api.config import settings
from api.services.maintenance_service import MaintenanceService


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

_TEST_PREFIX = "test::maintenance::"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _insert_processed_event(
    idempotency_key: str,
    handler_name: str,
    processed_at: datetime,
) -> None:
    with psycopg.connect(settings.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO processed_events (idempotency_key, handler_name, processed_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (handler_name, idempotency_key) DO NOTHING
                """,
                (idempotency_key, handler_name, processed_at),
            )
        conn.commit()


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def cleanup_test_data():
    """各テスト前後にテストデータを削除する"""
    _cleanup()
    yield
    _cleanup()


def _cleanup() -> None:
    with psycopg.connect(settings.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM processed_events WHERE idempotency_key LIKE %s",
                (f"{_TEST_PREFIX}%",),
            )
        conn.commit()


# ---------------------------------------------------------------------------
# テスト
# ---------------------------------------------------------------------------

class TestCleanupProcessedEvents:

    def test_保持期間を超えたレコードが削除される(self):
        old_date = _now() - timedelta(days=31)
        _insert_processed_event(f"{_TEST_PREFIX}old-key-1", "handler_a", old_date)
        _insert_processed_event(f"{_TEST_PREFIX}old-key-2", "handler_a", old_date)

        deleted = MaintenanceService.cleanup_processed_events(retention_days=30)

        assert deleted >= 2

    def test_保持期間内のレコードは削除されない(self):
        recent_date = _now() - timedelta(days=10)
        _insert_processed_event(f"{_TEST_PREFIX}recent-key", "handler_b", recent_date)

        deleted = MaintenanceService.cleanup_processed_events(retention_days=30)

        assert deleted == 0

        with psycopg.connect(settings.DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM processed_events WHERE idempotency_key = %s",
                    (f"{_TEST_PREFIX}recent-key",),
                )
                count = cur.fetchone()[0]
        assert count == 1

    def test_削除対象がゼロ件の場合は0を返す(self):
        deleted = MaintenanceService.cleanup_processed_events(retention_days=30)

        assert deleted == 0

    def test_合計削除件数を正しく返す(self):
        old_date = _now() - timedelta(days=31)
        for i in range(3):
            _insert_processed_event(f"{_TEST_PREFIX}count-key-{i}", "handler_c", old_date)

        deleted = MaintenanceService.cleanup_processed_events(retention_days=30)

        assert deleted >= 3

    def test_バッチサイズより多いレコードを複数バッチで削除する(self):
        """batch_size=2 で 5 件を削除し、ループが複数回まわることを確認する"""
        old_date = _now() - timedelta(days=31)
        for i in range(5):
            _insert_processed_event(f"{_TEST_PREFIX}batch-key-{i}", "handler_d", old_date)

        deleted = MaintenanceService.cleanup_processed_events(
            retention_days=30,
            batch_size=2,
        )

        assert deleted >= 5

    def test_保持期間の境界値_ちょうど30日前は削除されない(self):
        """
        境界値のテスト。
        サービス側の threshold 計算（now - 30days）よりも、
        わずかに新しい（未来の）時刻でデータを投入することで、
        実行タイミングのズレによる誤削除を防ぎつつ、境界判定を確認する。
        """
        # 30日前から「1秒だけ未来」にする。これで threshold より確実に新しくなる。
        boundary_date = _now() - timedelta(days=30) + timedelta(seconds=1)

        _insert_processed_event(f"{_TEST_PREFIX}boundary-key", "handler_e", boundary_date)

        deleted = MaintenanceService.cleanup_processed_events(retention_days=30)

        # 基準より新しいので削除されない（0件）ことを期待
        assert deleted == 0

    def test_retention_daysを変えると削除対象が変わる(self):
        old_16 = _now() - timedelta(days=16)
        _insert_processed_event(f"{_TEST_PREFIX}retention-key", "handler_f", old_16)

        # 30日保持では削除されない
        deleted = MaintenanceService.cleanup_processed_events(retention_days=30)
        assert deleted == 0

        # 15日保持では削除される
        deleted = MaintenanceService.cleanup_processed_events(retention_days=15)
        assert deleted >= 1