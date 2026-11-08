"""
pytest共通設定・フィクスチャ
"""
import os
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

# テストでは常にダミー値を使用する。
# ローカルやCI、.env に実際の認証情報が設定されていても使用しない。
# 実サービスの認証情報を使った動作確認は、このユニットテストの対象外。
os.environ["GEMINI_API_KEY"] = "test-dummy-gemini-api-key"
os.environ["UPSTASH_REDIS_REST_URL"] = "https://example.invalid"
os.environ["UPSTASH_REDIS_REST_TOKEN"] = "test-dummy-token"
os.environ["UPSTASH_VECTOR_REST_URL"] = "https://example.invalid"
os.environ["UPSTASH_VECTOR_REST_TOKEN"] = "test-dummy-token"

from api.tests.network_guard import guarded_send  # noqa: E402
from api.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def block_gemini_and_upstash(monkeypatch):
    """
    Gemini / Upstash 宛ての同期HTTP通信をテスト全体で遮断する。

    Resendなど、今回の対象外の外部サービスへの通信は遮断しない。
    """
    original_send = httpx.Client.send

    def send_with_guard(
        client: httpx.Client,
        request: httpx.Request,
        *args: object,
        **kwargs: object,
    ) -> httpx.Response:
        return guarded_send(
            original_send,
            client,
            request,
            *args,
            **kwargs,
        )

    monkeypatch.setattr(httpx.Client, "send", send_with_guard)


@pytest.fixture
def client():
    """FastAPI TestClient"""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_qstash_receiver():
    """QStash署名検証をモック（verify=Trueを返す）"""
    with patch("api.infrastructure.security.receiver") as mock:
        mock.verify.return_value = True
        yield mock


@pytest.fixture
def mock_resend():
    """Resend APIをモック"""
    with patch("api.services.mail_service.resend") as mock:
        mock.Emails.send.return_value = {"id": "mock-email-id"}
        yield mock


@pytest.fixture
def mock_analytics():
    """AnalyticsWebhookServiceをモック（MotherDuck接続不要）"""
    with patch("api.services.analytics_webhook_service.MotherDuckClient") as mock_cls:
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        yield mock_instance