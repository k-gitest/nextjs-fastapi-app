import structlog
import sentry_sdk

from api.config import settings
from api.infrastructure.idempotency import is_new_event
from api.infrastructure.mail_client import resend  # APIキー設定を確実に読み込む
from api.exceptions import EmailDeliveryError
from api.error_decorators import service_error_handler

logger = structlog.get_logger(__name__)


class MailService:
    """
    メール送信サービス

    Resend APIを使ってメールを送信する
    BackgroundTasksから呼ばれるため同期関数として実装
    エラーは EmailDeliveryError に変換してSentryに報告
    """

    @staticmethod
    @service_error_handler
    def send_welcome_email(
        idempotency_key: str,
        email: str,
        first_name: str,
        correlation_id: str | None = None,) -> None:
        """
        ウェルカムメールを送信する

        冪等性: 同じ idempotency_key のメールは一度しか送信しない。
        QStash のリトライや Worker の再送があっても2通にならない。
 
        Args:
            idempotency_key: 重複排除キー
            email:           送信先メールアドレス
            first_name:      ユーザーの名前
            correlation_id:  分散トレース用ID（BackgroundTask経由のため明示的に受け取る）

        Raises:
            Exception: Resend APIエラー時
        """
        log = logger.bind(
            component="mail-service",
            idempotency_key=idempotency_key,
            email_domain=email.split("@")[-1],
        )
        if correlation_id:
            log = log.bind(correlation_id=correlation_id)


        # 冪等性チェック（メール送信は副作用が大きいため最優先）
        if not is_new_event(idempotency_key, "send_welcome_email"):
            return

        # Sentryタグに追加
        if correlation_id:
            sentry_sdk.set_tag("correlation_id", correlation_id)

        try:
            resend.Emails.send({
                "from": settings.RESEND_FROM_EMAIL,
                "to": [email],
                "subject": "ようこそ！",
                "html": f"""
                    <h1>ようこそ、{first_name}さん！</h1>
                    <p>アカウントの登録が完了しました。</p>
                    <p>
                        <a href="{settings.FRONTEND_URL}/dashboard">
                            ダッシュボードへ
                        </a>
                    </p>
                """,
            })
            log.info("welcome_email_sent")
        except Exception as e:
            log.exception("welcome_email_failed")
            raise EmailDeliveryError(internal_details=str(e))