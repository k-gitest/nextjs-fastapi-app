"""
運用保守サービス

設計方針:
- dlt（ETL）とクリーンアップ（運用保守）は責務が異なるため分離
- SQLAlchemy は使わず psycopg3 直接（db.py の設計方針と統一）
- バッチ削除で DB ロック競合と vacuum 膨張を回避
"""
import logging

import psycopg

from api.config import settings

logger = logging.getLogger(__name__)

_BATCH_SIZE    = 5_000
_RETENTION_DAYS = 30


class MaintenanceService:

    @staticmethod
    def cleanup_processed_events(
        retention_days: int = _RETENTION_DAYS,
        batch_size: int = _BATCH_SIZE,
    ) -> int:
        """
        古い冪等性ログをバッチ削除する。

        一括 DELETE は長時間ロック・vacuum 膨張・I/O スパイクを引き起こすため、
        LIMIT 付きサブクエリで少量ずつ削除し、各バッチごとにコミットする。

        Args:
            retention_days: 保持日数（デフォルト 30 日）
            batch_size:     1 バッチあたりの削除件数（デフォルト 5,000）

        Returns:
            int: 合計削除件数
        """
        total_deleted = 0

        with psycopg.connect(settings.DATABASE_URL) as conn:
            with conn.cursor() as cur:
                while True:
                    cur.execute(
                        """
                        DELETE FROM processed_events
                        WHERE id IN (
                            SELECT id
                            FROM processed_events
                            WHERE processed_at < NOW() - INTERVAL '%s days'
                            LIMIT %s
                        )
                        """,
                        (retention_days, batch_size),
                    )
                    deleted = cur.rowcount
                    conn.commit()  # バッチごとにコミット（長時間ロック回避）

                    total_deleted += deleted
                    logger.debug(f"Cleanup batch: deleted {deleted} rows")

                    if deleted < batch_size:
                        # 削除対象が batch_size 未満 = 残りなし
                        break

        logger.info(
            "Cleanup completed",
            extra={"total_deleted": total_deleted, "retention_days": retention_days},
        )
        return total_deleted