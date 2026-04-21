"""
pytest共通設定・フィクスチャ
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from api.main import app


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