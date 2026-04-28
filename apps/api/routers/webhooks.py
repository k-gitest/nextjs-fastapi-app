from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from api.infrastructure.db import get_db_conn
from api.infrastructure.security import verify_qstash_signature
#from api.schemas.webhook import WelcomeEmailPayload,VectorIndexingPayload,BulkVectorIndexingPayload,AnalyticsEventWebhookPayload
from api.schemas.webhook import (
    AnalyticsEventEnvelope,
    BulkVectorIndexingEnvelope,
    VectorIndexingEnvelope,
    WelcomeEmailEnvelope,
)
from api.services.mail_service import MailService
from api.services.todo_webhook_service import TodoWebhookService
from api.services.analytics_webhook_service import AnalyticsWebhookService
from api.services.dlt_pipeline_service import DltPipelineService

from api.error_decorators import log_webhook_call

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# ===== ウェルカムメール =====

@router.post(
    "/send-welcome-email",
    dependencies=[Depends(verify_qstash_signature)],
    status_code=202,
)
async def handle_welcome_email_webhook(
    envelope: WelcomeEmailEnvelope,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_conn),
):
    """
    ウェルカムメール送信Webhook

    QStashから呼ばれる内部エンドポイント。
    メール送信をBackgroundTasksで非同期実行し即座に202を返す。

    冪等性: MailService 内で idempotency_key をチェックし、
    処理済みの場合はメール送信をスキップする。

    Args:
        payload: メール送信に必要な情報（email, first_name）
        background_tasks: FastAPI標準の非同期タスクキュー
    """
    background_tasks.add_task(
        MailService.send_welcome_email,
        db=db,
        idempotency_key=envelope.idempotency_key,
        email=envelope.data.email,
        first_name=envelope.data.first_name,
    )
    return {"status": "accepted", "message": "Welcome email queued"}

# ===== ベクトルインデックス =====
 
@router.post(
    "/vector-indexing",
    dependencies=[Depends(verify_qstash_signature)],
    status_code=202,
)
async def handle_vector_indexing_webhook(
    envelope: VectorIndexingEnvelope,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_conn),
):
    """
    Todoベクトルインデックス処理Webhook
 
    Todo作成・更新・削除時にNext.jsからQStash経由で呼ばれる
 
    operation="upsert": ベクトルインデックスに追加/更新
    operation="delete": ベクトルインデックスから削除
    """
    background_tasks.add_task(
        TodoWebhookService.handle_vector_indexing,
        db=db,
        idempotency_key=envelope.idempotency_key,
        payload=envelope.data,
    )
    return {"status": "accepted", "message": "Vector indexing queued"}
 
 
@router.post(
    "/bulk-vector-indexing",
    dependencies=[Depends(verify_qstash_signature)],
    status_code=202,
)
async def handle_bulk_vector_indexing_webhook(
    envelope: BulkVectorIndexingEnvelope,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_conn),
):
    """
    Todo一括ベクトルインデックス処理Webhook
 
    初期データ投入やリインデックス時にNext.jsから呼ばれる
    """
    background_tasks.add_task(
        TodoWebhookService.handle_bulk_vector_indexing,
        db=db,
        idempotency_key=envelope.idempotency_key,
        user_id=envelope.data.user_id,
        todos=envelope.data.todos,
    )
    return {"status": "accepted", "message": "Bulk vector indexing queued"}


# ===== アナリティクス =====

@router.post(
    "/analytics-event",
    dependencies=[Depends(verify_qstash_signature)],
    status_code=202,
)
async def handle_analytics_event_webhook(
    envelope: AnalyticsEventEnvelope,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_conn),
):
    """
    分析イベント記録Webhook
    QStashから呼ばれる内部エンドポイント
    """
    background_tasks.add_task(
        AnalyticsWebhookService.handle_webhook_event,
        db=db,
        idempotency_key=envelope.idempotency_key,
        event_type=envelope.data.event_type.value,
        event_data=envelope.data.event_data,
    )
    return {"status": "accepted", "message": "Analytics event queued"}


@router.post(
    "/dlt-pipeline",
    dependencies=[Depends(verify_qstash_signature)],
    include_in_schema=False,
    status_code=200,
)
@log_webhook_call(webhook_name="dlt_pipeline")
def handle_dlt_pipeline_webhook():
    """
    dltパイプライン実行Webhook
 
    QStashから定期的に呼ばれる内部エンドポイント。
    PostgreSQL（Neon）→ MotherDuck の同期を実行する。
 
    【async defではなくdefを使う理由】
    dltは数分かかる同期ブロッキング処理。
    async defで受けるとイベントループがブロックされ、
    他のリクエストを処理できなくなる。
    defで受けることでFastAPIが自動的にスレッドプールで実行する。
 
    【BackgroundTasksを使わない理由】
    dltの実行時間（数分）がある。BackgroundTasksだと202を即座に返すため
    QStashは成功と判断し次のトリガーを投げてしまう可能性がある。
    同期的に実行して結果を返すことでQStashのリトライ制御が正しく動作する。

    冪等性: DltPipelineService 内の Redis ロックで排他制御済み。
    processed_events は使用しない（Redis ロックの方が適切）。
 
    Notes:
        QStash側のタイムアウト設定: 5〜10分を推奨
    """
    result = DltPipelineService.execute_postgres_to_motherduck()
 
    return {
        "status": "success",
        "message": "Pipeline executed successfully",
        "synced_tables": result["tables"],
    }