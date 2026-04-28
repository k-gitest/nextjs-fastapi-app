"""
DB接続管理

設計判断：SQLAlchemy を使わず psycopg3 を直接使う理由
─────────────────────────────────────────────────────
FastAPI 側が DB に書き込む処理は現時点で以下のみ:
  - processed_events への INSERT ON CONFLICT DO NOTHING（冪等性チェック）

この1操作のためだけに SQLAlchemy（ORM + セッション管理）を導入すると
依存が増え、接続プールの設定も二重管理になる。

psycopg3 を直接使うことで:
  - 依存がシンプル（psycopg[binary] のみ）
  - async/await ネイティブ対応（asyncpg と同等）
  - Raw SQL をそのまま書けて Prisma が作ったテーブルを直接扱える

将来 FastAPI 側で複雑なクエリが増えた場合は SQLAlchemy に切り替える。
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from api.config import settings

# ── 接続プール ─────────────────────────────────────────────────
# min_size=1: コールドスタート回避
# max_size=10: FastAPI の worker 数に合わせて調整
_pool: AsyncConnectionPool | None = None


async def init_db_pool() -> None:
    """
    アプリ起動時に一度だけ呼ぶ（main.py の lifespan で使用）
    """
    global _pool
    _pool = AsyncConnectionPool(
        conninfo=settings.DATABASE_URL,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row},
        open=False,  # 非推奨警告の解消
    )
    
    await _pool.open()  # 明示的にopenする

    # 接続確認
    async with _pool.connection() as conn:
        await conn.execute("SELECT 1")


async def close_db_pool() -> None:
    """
    アプリ終了時に一度だけ呼ぶ（main.py の lifespan で使用）
    """
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_db_conn() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """
    コンテキストマネージャとして接続を払い出す。

    Usage（サービス層での使用例）:
        async with get_db_conn() as conn:
            await conn.execute(...)

    BackgroundTasks から呼ばれる同期関数の場合は
    psycopg.connect（同期版）を使うか、run_in_threadpool でラップする。
    """
    if _pool is None:
        raise RuntimeError("DB pool is not initialized. Call init_db_pool() first.")
    async with _pool.connection() as conn:
        yield conn