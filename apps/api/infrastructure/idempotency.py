"""
冪等性チェック基盤

設計方針:
- INSERT ... ON CONFLICT DO NOTHING を使ったアトミック操作
- SELECT → INSERT の2ステップは競合状態が発生するため使わない
- BackgroundTasks で非同期実行される場合も同じリクエストが2件来ると
  INSERT がほぼ同時になるが、UNIQUE制約により片方だけ処理される
- 保持期間は QStash の最大リトライ期間の 3 倍（デフォルト30日）で十分

BackgroundTasks は同期コンテキストで実行されるため、
ここでは psycopg の同期接続（psycopg.connect）を使う。
サービス層が async def に移行した場合は is_new_event_async に切り替える。
"""
import logging
from datetime import datetime, timezone
 
import psycopg
 
from api.config import settings
 
logger = logging.getLogger(__name__)

def is_new_event(idempotency_key: str, handler_name: str) -> bool:
    """
    idempotency_key を processed_events テーブルに INSERT し、
    初回（新規）かどうかを返す。
 
    Args:
        idempotency_key: イベントの一意キー（outbox_events.idempotency_key）
        handler_name:    どの Webhook ハンドラが処理したか（デバッグ用）
 
    Returns:
        True:  初回処理（INSERT 成功）
        False: 重複（既に処理済み）
 
    Notes:
        ON CONFLICT DO NOTHING により、同時リクエストでも
        UNIQUE 制約レベルでアトミックに排他できる。
    """
    with psycopg.connect(settings.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO processed_events (idempotency_key, handler_name, processed_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (handler_name, idempotency_key) DO NOTHING
                RETURNING id
                """,
                (idempotency_key, handler_name, datetime.now(timezone.utc)),
            )
            inserted = cur.fetchone() is not None
        conn.commit()
 
    if not inserted:
        logger.info(
            "Duplicate event skipped",
            extra={"idempotency_key": idempotency_key, "handler": handler_name},
        )
 
    return inserted
 
 
async def is_new_event_async(idempotency_key: str, handler_name: str) -> bool:
    """
    非同期版。サービス層が async def になった場合に使用。
    db.py の get_db_conn() を使い接続プールから接続を取得する。
    """
    from api.infrastructure.db import get_db_conn
 
    async with get_db_conn() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO processed_events (idempotency_key, handler_name, processed_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (handler_name, idempotency_key) DO NOTHING
                RETURNING id
                """,
                (idempotency_key, handler_name, datetime.now(timezone.utc)),
            )
            inserted = cur.fetchone() is not None
        await conn.commit()
 
    if not inserted:
        logger.info(
            "Duplicate event skipped",
            extra={"idempotency_key": idempotency_key, "handler": handler_name},
        )
 
    return inserted