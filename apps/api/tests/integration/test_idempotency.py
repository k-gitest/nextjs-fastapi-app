"""
infrastructure/idempotency.py のユニットテスト

実DB（ローカル環境は各自、CI は services: postgres）を使用する。
テスト対象テーブル: processed_events

設計方針:
- is_new_event の基本動作・重複検知・永続化を検証する
- 競合ケース（同時INSERT）は threading で再現し、UNIQUE制約の実効性を確認する
- is_new_event_async は現時点で本番未使用のため対象外
"""
import threading
from datetime import datetime, timezone

import psycopg
import pytest

from api.config import settings
from api.infrastructure.idempotency import is_new_event


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

_TEST_PREFIX = "test::idempotency::"


def _cleanup() -> None:
    with psycopg.connect(settings.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM processed_events WHERE idempotency_key LIKE %s",
                (f"{_TEST_PREFIX}%",),
            )
        conn.commit()


def _fetch_record(idempotency_key: str, handler_name: str) -> tuple | None:
    with psycopg.connect(settings.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT idempotency_key, handler_name, processed_at
                FROM processed_events
                WHERE idempotency_key = %s AND handler_name = %s
                """,
                (idempotency_key, handler_name),
            )
            return cur.fetchone()


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def cleanup_test_data():
    """各テスト前後にテストデータを削除する"""
    _cleanup()
    yield
    _cleanup()


# ---------------------------------------------------------------------------
# テスト
# ---------------------------------------------------------------------------

class TestIsNewEvent:

    def test_初回イベントはTrueを返す(self):
        result = is_new_event(f"{_TEST_PREFIX}new-event", "handler_a")

        assert result is True

    def test_同一キーの2回目はFalseを返す(self):
        key = f"{_TEST_PREFIX}dup-event"
        handler = "handler_b"

        first = is_new_event(key, handler)
        second = is_new_event(key, handler)

        assert first is True
        assert second is False

    def test_同一キーでもハンドラが異なれば両方Trueを返す(self):
        """UNIQUE制約は (handler_name, idempotency_key) の複合キーのため
        ハンドラが異なれば別レコードとして扱われる"""
        key = f"{_TEST_PREFIX}multi-handler"

        result_a = is_new_event(key, "handler_alpha")
        result_b = is_new_event(key, "handler_beta")

        assert result_a is True
        assert result_b is True

    def test_異なるキーはそれぞれTrueを返す(self):
        result_1 = is_new_event(f"{_TEST_PREFIX}distinct-key-1", "handler_c")
        result_2 = is_new_event(f"{_TEST_PREFIX}distinct-key-2", "handler_c")

        assert result_1 is True
        assert result_2 is True

    def test_DBにレコードが正しく保存される(self):
        key = f"{_TEST_PREFIX}persist"
        handler = "handler_d"

        is_new_event(key, handler)

        row = _fetch_record(key, handler)
        assert row is not None
        assert row[0] == key
        assert row[1] == handler
        assert row[2] is not None  # processed_at が記録されている

    def test_processed_atはUTCで保存される(self):
        key = f"{_TEST_PREFIX}timezone"
        handler = "handler_e"
        before = datetime.now(timezone.utc)

        is_new_event(key, handler)

        row = _fetch_record(key, handler)
        assert row is not None
        processed_at = row[2]
        # タイムゾーン情報を持つ場合はUTCに変換して比較
        if processed_at.tzinfo is None:
            from datetime import timezone as tz
            processed_at = processed_at.replace(tzinfo=tz.utc)
        assert processed_at >= before

    def test_同時リクエストで片方だけ処理される(self):
        """threading で2スレッドが同一キーを同時にINSERTする競合ケース。
        UNIQUE制約により True が返るのは必ず1件のみ。"""
        key = f"{_TEST_PREFIX}concurrent"
        handler = "handler_concurrent"
        results = []
        lock = threading.Lock()

        def call_is_new_event():
            result = is_new_event(key, handler)
            with lock:
                results.append(result)

        threads = [threading.Thread(target=call_is_new_event) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(results) == 2
        assert results.count(True) == 1
        assert results.count(False) == 1

    def test_同時リクエストでDBレコードは1件のみ作成される(self):
        """競合後もテーブルに重複レコードが存在しないことを確認する"""
        key = f"{_TEST_PREFIX}concurrent-count"
        handler = "handler_concurrent_count"

        threads = [threading.Thread(target=is_new_event, args=(key, handler)) for _ in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        with psycopg.connect(settings.DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*) FROM processed_events
                    WHERE idempotency_key = %s AND handler_name = %s
                    """,
                    (key, handler),
                )
                count = cur.fetchone()[0]

        assert count == 1