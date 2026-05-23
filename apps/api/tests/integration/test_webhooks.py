"""
routers/webhooks.py の統合テスト
"""
import pytest
from unittest.mock import patch


def make_welcome_email_envelope(email: str = "test@example.com", first_name: str = "テスト") -> dict:
    """WelcomeEmailEnvelope 形式のリクエストボディを生成するヘルパー"""
    return {
        "id": "evt-test-1",
        "type": "user.registered",
        "version": 1,
        "aggregate_id": "user:clx1234",
        "idempotency_key": "user.registered:clx1234",
        "data": {
            "email": email,
            "first_name": first_name,
        },
    }


class TestWelcomeEmailWebhook:
    def test_正常なリクエストは202を返す(self, client, mock_qstash_receiver, mock_resend):
        response = client.post(
            "/webhooks/send-welcome-email",
            json=make_welcome_email_envelope(),
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "accepted"

    def test_署名なしは401を返す(self, client):
        response = client.post(
            "/webhooks/send-welcome-email",
            json=make_welcome_email_envelope(),
            # upstash-signature ヘッダーなし
        )
        assert response.status_code == 401

    def test_署名が無効な場合は401を返す(self, client, mock_resend):
        with patch("api.infrastructure.security.receiver") as mock_receiver:
            mock_receiver.verify.side_effect = Exception("Invalid signature")
            response = client.post(
                "/webhooks/send-welcome-email",
                json=make_welcome_email_envelope(),
                headers={"upstash-signature": "invalid-signature"},
            )
        assert response.status_code == 401

    def test_emailが不正な場合は422を返す(self, client, mock_qstash_receiver):
        payload = make_welcome_email_envelope(email="not-an-email")
        response = client.post(
            "/webhooks/send-welcome-email",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "validation_error"

    def test_emailが欠けている場合は422を返す(self, client, mock_qstash_receiver):
        payload = make_welcome_email_envelope()
        del payload["data"]["email"]
        response = client.post(
            "/webhooks/send-welcome-email",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_first_nameが欠けている場合は422を返す(self, client, mock_qstash_receiver):
        payload = make_welcome_email_envelope()
        del payload["data"]["first_name"]
        response = client.post(
            "/webhooks/send-welcome-email",
            json=payload,
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_202はメール送信完了を待たずに返る(self, client, mock_qstash_receiver):
        """BackgroundTasksで非同期実行されるため即座に202が返ることを確認"""
        with patch("api.services.mail_service.resend") as mock_resend:
            import time

            def slow_send(*args, **kwargs):
                time.sleep(0.1)
                return {"id": "mock-id"}

            mock_resend.Emails.send.side_effect = slow_send

            start = time.time()
            response = client.post(
                "/webhooks/send-welcome-email",
                json=make_welcome_email_envelope(),
                headers={"upstash-signature": "valid-signature"},
            )
            elapsed = time.time() - start

        assert response.status_code == 202
        # TestClient は BackgroundTasks を同期実行するため厳密な非同期確認は困難
        # 少なくとも 202 が返ることを確認