"""
冪等性チェック基盤

設計方針:
- INSERT ... ON CONFLICT DO NOTHING を使ったアトミック操作
- SELECT → INSERT の2ステップは競合状態が発生するため使わない
- BackgroundTasks で非同期実行される場合も同じリクエストが2件来ると
  INSERT がほぼ同時になるが、UNIQUE制約により片方だけ処理される
- 保持期間は QStash の最大リトライ期間の 3 倍（デフォルト30日）で十分
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def is_new_event(db: Session, idempotency_key: str, handler_name: str) -> bool:
    """
    idempotency_key を processed_events テーブルに INSERT し、
    初回（新規）かどうかを返す。

    Args:
        db:               SQLAlchemy セッション
        idempotency_key:  イベントの一意キー（outbox_events.idempotency_key）
        handler_name:     どの Webhook ハンドラが処理したか（デバッグ用）

    Returns:
        True:  初回処理（INSERT 成功）
        False: 重複（既に処理済み）

    Notes:
        ON CONFLICT DO NOTHING により、同時リクエストでも片方だけが
        True を返すことが DB レベルで保証される。
    """
    result = db.execute(
        text("""
            INSERT INTO processed_events (idempotency_key, handler_name, processed_at)
            VALUES (:key, :handler, :now)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING idempotency_key
        """),
        {
            "key":     idempotency_key,
            "handler": handler_name,
            "now":     datetime.now(timezone.utc),
        },
    )
    db.commit()

    inserted = result.fetchone() is not None

    if not inserted:
        logger.info(
            "Duplicate event skipped",
            extra={"idempotency_key": idempotency_key, "handler": handler_name},
        )

    return inserted