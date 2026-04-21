"""
セマンティック検索のユニットテスト
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI, Depends

from api.infrastructure.internal_auth import verify_internal_token
from api.routers.search import router
from api.exceptions import VectorError, EmbeddingError
from api.error_handlers import register_exception_handlers

# テスト用アプリ
test_app = FastAPI()
register_exception_handlers(test_app)
test_app.include_router(router)


@pytest.fixture
def search_client():
    return TestClient(test_app)


@pytest.fixture
def valid_headers():
    with patch("api.infrastructure.internal_auth.settings") as mock:
        mock.INTERNAL_API_SECRET = "test-secret"
        yield {"X-Internal-Token": "test-secret"}


VALID_PAYLOAD = {
    "query": "会議関連のタスク",
    "user_id": "user123",
    "top_k": 5,
    "min_score": 0.5,
}

MOCK_RESULTS = [
    {
        "id": "clx1234",
        "score": 0.9,
        "title": "会議資料の作成",
        "priority": "HIGH",
        "progress": 50,
    },
    {
        "id": "clx5678",
        "score": 0.7,
        "title": "会議室の予約",
        "priority": "MEDIUM",
        "progress": 0,
    },
]


class TestVerifyInternalToken:
    def test_トークンなしは401(self, search_client):
        response = search_client.post("/search/similar-todos", json=VALID_PAYLOAD)
        assert response.status_code == 401

    def test_不正なトークンは401(self, search_client):
        with patch("api.infrastructure.internal_auth.settings") as mock:
            mock.INTERNAL_API_SECRET = "correct-secret"
            response = search_client.post(
                "/search/similar-todos",
                json=VALID_PAYLOAD,
                headers={"X-Internal-Token": "wrong-secret"},
            )
        assert response.status_code == 401

    def test_正しいトークンは通過する(self, search_client, valid_headers):
        with patch("api.routers.search.TodoVectorService") as mock_cls:
            mock_cls.return_value.search_similar.return_value = []
            response = search_client.post(
                "/search/similar-todos",
                json=VALID_PAYLOAD,
                headers=valid_headers,
            )
        assert response.status_code == 200


class TestSearchSimilarTodos:
    def test_検索結果が正しく返される(self, search_client, valid_headers):
        with patch("api.routers.search.TodoVectorService") as mock_cls:
            mock_cls.return_value.search_similar.return_value = MOCK_RESULTS
            response = search_client.post(
                "/search/similar-todos",
                json=VALID_PAYLOAD,
                headers=valid_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2
        assert data["query"] == "会議関連のタスク"
        assert len(data["results"]) == 2
        assert data["results"][0]["id"] == "clx1234"
        assert data["results"][0]["score"] == 0.9

    def test_結果なしは空リストを返す(self, search_client, valid_headers):
        with patch("api.routers.search.TodoVectorService") as mock_cls:
            mock_cls.return_value.search_similar.return_value = []
            response = search_client.post(
                "/search/similar-todos",
                json=VALID_PAYLOAD,
                headers=valid_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert data["results"] == []

    def test_queryが空の場合は422(self, search_client, valid_headers):
        response = search_client.post(
            "/search/similar-todos",
            json={**VALID_PAYLOAD, "query": ""},
            headers=valid_headers,
        )
        assert response.status_code == 422

    def test_top_kが範囲外の場合は422(self, search_client, valid_headers):
        response = search_client.post(
            "/search/similar-todos",
            json={**VALID_PAYLOAD, "top_k": 0},
            headers=valid_headers,
        )
        assert response.status_code == 422

    def test_VectorError時は503を返す(self, search_client, valid_headers):
        with patch("api.routers.search.TodoVectorService") as mock_cls:
            mock_cls.return_value.search_similar.side_effect = VectorError(
                internal_details="Upstash error"
            )
            response = search_client.post(
                "/search/similar-todos",
                json=VALID_PAYLOAD,
                headers=valid_headers,
            )

        assert response.status_code == 503
        data = response.json()
        assert data["error"] == "vector_error"
        # internal_detailsはレスポンスに含まれない
        assert "Upstash error" not in str(data)

    def test_EmbeddingError時は503を返す(self, search_client, valid_headers):
        with patch("api.routers.search.TodoVectorService") as mock_cls:
            mock_cls.return_value.search_similar.side_effect = EmbeddingError(
                internal_details="Gemini error"
            )
            response = search_client.post(
                "/search/similar-todos",
                json=VALID_PAYLOAD,
                headers=valid_headers,
            )

        assert response.status_code == 503
        assert response.json()["error"] == "embedding_error"

    def test_user_idでフィルタされる(self, search_client, valid_headers):
        with patch("api.routers.search.TodoVectorService") as mock_cls:
            mock_instance = mock_cls.return_value
            mock_instance.search_similar.return_value = []

            search_client.post(
                "/search/similar-todos",
                json={**VALID_PAYLOAD, "user_id": "specific-user"},
                headers=valid_headers,
            )

        mock_instance.search_similar.assert_called_once_with(
            query="会議関連のタスク",
            user_id="specific-user",
            top_k=5,
            min_score=0.5,
        )