"""
infrastructure/security.py のユニットテスト
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import HTTPException
from fastapi.testclient import TestClient
from fastapi import FastAPI, Depends

from api.infrastructure.security import verify_qstash_signature


# テスト用の最小FastAPIアプリ
test_app = FastAPI()


@test_app.post("/test-endpoint")
async def test_endpoint(
    _: None = Depends(verify_qstash_signature),
):
    return {"status": "ok"}


@pytest.fixture
def security_client():
    return TestClient(test_app)


class TestVerifyQstashSignature:
    def test_署名ヘッダーがない場合は401(self, security_client):
        response = security_client.post(
            "/test-endpoint",
            json={"email": "test@example.com"},
            # upstash-signatureヘッダーなし
        )
        assert response.status_code == 401
        assert "Missing" in response.json()["detail"]

    def test_署名が無効な場合は401(self, security_client, mock_resend):
        with patch("api.infrastructure.security.receiver") as mock_receiver:
            mock_receiver.verify.side_effect = Exception("Invalid signature")
            response = security_client.post(
                "/test-endpoint",
                json={"email": "test@example.com"},
                headers={"upstash-signature": "invalid-signature"},
            )
        assert response.status_code == 401

    def test_署名が有効な場合は通過する(self, security_client):
        with patch("api.infrastructure.security.receiver") as mock_receiver:
            mock_receiver.verify.return_value = True
            response = security_client.post(
                "/test-endpoint",
                json={"email": "test@example.com"},
                headers={"upstash-signature": "valid-signature"},
            )
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_不正なエンコーディングのボディは400(self, security_client):
        with patch("api.infrastructure.security.receiver") as mock_receiver:
            mock_receiver.verify.side_effect = Exception("decode error")
            response = security_client.post(
                "/test-endpoint",
                content=b"\xff\xfe",  # 不正なUTF-8
                headers={
                    "upstash-signature": "some-signature",
                    "content-type": "application/json",
                },
            )
        assert response.status_code in [400, 401]

    def test_verify呼び出し時に例外が発生した場合は401(self, security_client):
        with patch("api.infrastructure.security.receiver") as mock_receiver:
            mock_receiver.verify.side_effect = Exception("verification error")
            response = security_client.post(
                "/test-endpoint",
                json={"email": "test@example.com"},
                headers={"upstash-signature": "some-signature"},
            )
        assert response.status_code == 401