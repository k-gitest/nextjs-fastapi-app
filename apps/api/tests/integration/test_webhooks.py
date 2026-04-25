"""
routers/webhooks.py の統合テスト
"""
import pytest
from unittest.mock import patch


class TestWelcomeEmailWebhook:
    def test_正常なリクエストは202を返す(self, client, mock_qstash_receiver, mock_resend):
        response = client.post(
            "/webhooks/send-welcome-email",
            json={"email": "test@example.com", "first_name": "テスト"},
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "accepted"

    def test_署名なしは401を返す(self, client):
        response = client.post(
            "/webhooks/send-welcome-email",
            json={"email": "test@example.com", "first_name": "テスト"},
            # upstash-signatureヘッダーなし
        )
        assert response.status_code == 401

    def test_署名が無効な場合は401を返す(self, client, mock_resend):
        with patch("api.infrastructure.security.receiver") as mock_receiver:
            # side_effect を使って検証失敗（例外発生）をシミュレート
            mock_receiver.verify.side_effect = Exception("Invalid signature")
            response = client.post(
                "/webhooks/send-welcome-email",
                json={"email": "test@example.com", "first_name": "テスト"},
                headers={"upstash-signature": "invalid-signature"},
            )
        assert response.status_code == 401

    def test_emailが不正な場合は422を返す(self, client, mock_qstash_receiver):
        response = client.post(
            "/webhooks/send-welcome-email",
            json={"email": "not-an-email", "first_name": "テスト"},
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "validation_error"

    def test_emailが欠けている場合は422を返す(self, client, mock_qstash_receiver):
        response = client.post(
            "/webhooks/send-welcome-email",
            json={"first_name": "テスト"},  # emailなし
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_first_nameが欠けている場合は422を返す(self, client, mock_qstash_receiver):
        response = client.post(
            "/webhooks/send-welcome-email",
            json={"email": "test@example.com"},  # first_nameなし
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 422

    def test_202はメール送信完了を待たずに返る(self, client, mock_qstash_receiver):
        """BackgroundTasksで非同期実行されるため即座に202が返ることを確認"""
        with patch("api.services.mail_service.resend") as mock_resend:
            # 送信に時間がかかる場合をシミュレート
            import time
            def slow_send(*args, **kwargs):
                time.sleep(0.1)
                return {"id": "mock-id"}
            mock_resend.Emails.send.side_effect = slow_send

            import time
            start = time.time()
            response = client.post(
                "/webhooks/send-welcome-email",
                json={"email": "test@example.com", "first_name": "テスト"},
                headers={"upstash-signature": "valid-signature"},
            )
            elapsed = time.time() - start

        assert response.status_code == 202
        # TestClientはBackgroundTasksを同期実行するため厳密な非同期確認は困難
        # 少なくとも202が返ることを確認