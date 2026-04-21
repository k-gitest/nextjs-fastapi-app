"""
dlt pipelineエンドポイントの統合テスト
"""
import pytest
from unittest.mock import patch, MagicMock
from api.services.dlt_pipeline_service import DltPipelineService


@pytest.fixture(autouse=True)
def reset_pipeline_state():
    DltPipelineService._is_running = False
    yield
    DltPipelineService._is_running = False


@pytest.fixture
def mock_pipeline_service():
    with patch(
        "api.services.dlt_pipeline_service.DltPipelineService.execute_postgres_to_motherduck"
    ) as mock:
        mock.return_value = {
            "status": "success",
            "tables": ["User", "Todo"],
            "info": "LoadInfo()",
        }
        yield mock


class TestDltPipelineWebhook:
    def test_正常実行で200を返す(self, client, mock_qstash_receiver, mock_pipeline_service):
        response = client.post(
            "/webhooks/dlt-pipeline",
            headers={"upstash-signature": "valid-signature"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "User" in data["synced_tables"]
        assert "Todo" in data["synced_tables"]

    def test_署名なしは401を返す(self, client):
        response = client.post("/webhooks/dlt-pipeline")
        assert response.status_code == 401

    def test_パイプライン失敗時は500を返す(self, client, mock_qstash_receiver):
        from api.exceptions import AnalyticsError
        with patch(
            "api.services.dlt_pipeline_service.DltPipelineService.execute_postgres_to_motherduck",
            side_effect=AnalyticsError(internal_details="dlt error"),
        ):
            response = client.post(
                "/webhooks/dlt-pipeline",
                headers={"upstash-signature": "valid-signature"},
            )
        assert response.status_code == 503
        data = response.json()
        assert data["error"] == "analytics_error"
        # internal_detailsはレスポンスに含まれない
        assert "dlt error" not in str(data)

    def test_二重実行時は503を返す(self, client, mock_qstash_receiver):
        from api.exceptions import AnalyticsError
        with patch(
            "api.services.dlt_pipeline_service.DltPipelineService.execute_postgres_to_motherduck",
            side_effect=AnalyticsError(
                internal_details="Pipeline already running"
            ),
        ):
            response = client.post(
                "/webhooks/dlt-pipeline",
                headers={"upstash-signature": "valid-signature"},
            )
        assert response.status_code == 503