"""
services/mail_service.py のユニットテスト
"""
import pytest
from unittest.mock import patch, MagicMock

from api.services.mail_service import MailService
from api.exceptions import EmailDeliveryError


class TestMailServiceSendWelcomeEmail:
    def test_メール送信成功(self, mock_resend):
        """Resend APIが正常に呼ばれることを確認"""
        MailService.send_welcome_email(
            email="test@example.com",
            first_name="テスト",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["to"] == ["test@example.com"]
        assert "テスト" in call_args["html"]

    def test_送信先メールアドレスが正しい(self, mock_resend):
        MailService.send_welcome_email(
            email="user@example.com",
            first_name="ユーザー",
        )
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert "user@example.com" in call_args["to"]

    def test_first_nameがhtmlに含まれる(self, mock_resend):
        MailService.send_welcome_email(
            email="test@example.com",
            first_name="山田太郎",
        )
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert "山田太郎" in call_args["html"]

    def test_Resend失敗時はEmailDeliveryErrorを送出する(self, mock_resend):
        """Resend APIが失敗した場合はEmailDeliveryErrorに変換される"""
        mock_resend.Emails.send.side_effect = Exception("Resend API Error")

        with pytest.raises(EmailDeliveryError) as exc_info:
            MailService.send_welcome_email(
                email="test@example.com",
                first_name="テスト",
            )

        assert exc_info.value.code == "email_delivery_error"
        assert exc_info.value.status_code == 503
        # internal_details がinternal_infoに格納される
        assert "Resend API Error" in exc_info.value.internal_info

    def test_EmailDeliveryErrorのinternal_infoはメッセージに含まれない(self, mock_resend):
        """内部詳細がフロントエンドに漏れないことを確認"""
        mock_resend.Emails.send.side_effect = Exception("DB connection string: postgresql://...")

        with pytest.raises(EmailDeliveryError) as exc_info:
            MailService.send_welcome_email(
                email="test@example.com",
                first_name="テスト",
            )

        # messageには内部詳細が含まれない
        assert "postgresql://" not in exc_info.value.message
        # internal_infoには含まれる（ログ・Sentry用）
        assert "postgresql://" in exc_info.value.internal_info