"""
内部運用エンドポイント

外部公開しない運用保守系の API。
QStash Scheduled Cron からのみ呼ばれる想定。

認証: verify_qstash_signature を使う。
  - QStash cron は通常の Webhook 送信と同じ署名を付与するため、
    既存の verify_qstash_signature がそのまま使える。
  - 独自の internal token を使いたい場合は verify_internal_token に差し替える。

include_in_schema=False で OpenAPI ドキュメントから隠す。
"""
import logging

from fastapi import APIRouter, Depends

from api.infrastructure.security import verify_qstash_signature
from api.services.maintenance_service import MaintenanceService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    include_in_schema=False,  # Swagger UI に表示しない
)


@router.post(
    "/cleanup/processed-events",
    dependencies=[Depends(verify_qstash_signature)],
    status_code=200,
)
def cleanup_processed_events() -> dict:
    """
    古い冪等性ログを削除する定期メンテナンスエンドポイント。

    QStash Scheduled Cron 設定例:
        Cron:    0 18 * * *   （JST 03:00 = UTC 18:00）
        URL:     https://your-api.com/internal/cleanup/processed-events
        Method:  POST
        Headers: QStash 署名ヘッダー（自動付与）

    def（非 async）を使う理由:
        DB 操作はブロッキングだが処理時間は短い（バッチ削除）。
        FastAPI がスレッドプールで実行するため問題なし。
    """
    deleted = MaintenanceService.cleanup_processed_events()
    logger.info("Cleanup endpoint called", extra={"deleted": deleted})
    return {"status": "success", "deleted": deleted}