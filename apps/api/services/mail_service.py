import logging
import resend

from api.config import settings
from api.infrastructure.mail_client import resend  # APIキー設定を確実に読み込む
from api.exceptions import EmailDeliveryError
from api.error_decorators import service_error_handler

logger = logging.getLogger(__name__)


class MailService:
    """
    メール送信サービス

    Resend APIを使ってメールを送信する
    BackgroundTasksから呼ばれるため同期関数として実装
    エラーは EmailDeliveryError に変換してSentryに報告
    """

    @staticmethod
    @service_error_handler
    def send_welcome_email(email: str, first_name: str) -> None:
        """
        ウェルカムメールを送信する

        Args:
            email: 送信先メールアドレス
            first_name: ユーザーの名前

        Raises:
            Exception: Resend APIエラー時（上位でSentryに記録される）
        """
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
            logger.info(f"Welcome email sent to {email}")
        except Exception as e:
            logger.error(f"Failed to send welcome email to {email}: {e}")
            raise EmailDeliveryError(internal_details=str(e))