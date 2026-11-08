"""
セマンティック検索のユニットテスト
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.error_handlers import register_exception_handlers
from api.exceptions import EmbeddingError, VectorError
from api.routers.search import router


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


@pytest.fixture(autouse=True)
def mock_search_ratelimit():
    """検索テストではUpstash Redisへ接続しない。"""
    with patch("api.routers.search.search_ratelimit") as mock:
        mock.limit.return_value = SimpleNamespace(
            allowed=True,
            limit=10,
            remaining=9,
            reset=1_700_000_000_000,
        )
        yield mock


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
        response = search_client.post(
            "/search/similar-todos",
            json=VALID_PAYLOAD,
        )
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

    def test_正しいトークンは通過する(
        self,
        search_client,
        valid_headers,
        mock_search_ratelimit,
    ):
        with patch("api.routers.search.TodoVectorService") as mock_cls:
            mock_cls.return_value.search_similar.return_value = []
            response = search_client.post(
                "/search/similar-todos",
                json=VALID_PAYLOAD,
                headers=valid_headers,
            )

        assert response.status_code == 200


class TestSearchSimilarTodos:
    def test_検索結果が正しく返される(
        self,
        search_client,
        valid_headers,
    ):
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

    def test_結果なしは空リストを返す(
        self,
        search_client,
        valid_headers,
    ):
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

    def test_queryが空の場合は422(
        self,
        search_client,
        valid_headers,
    ):
        response = search_client.post(
            "/search/similar-todos",
            json={**VALID_PAYLOAD, "query": ""},
            headers=valid_headers,
        )

        assert response.status_code == 422

    def test_top_kが範囲外の場合は422(
        self,
        search_client,
        valid_headers,
    ):
        response = search_client.post(
            "/search/similar-todos",
            json={**VALID_PAYLOAD, "top_k": 0},
            headers=valid_headers,
        )

        assert response.status_code == 422

    def test_VectorError時は503を返す(
        self,
        search_client,
        valid_headers,
    ):
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
        assert "Upstash error" not in str(data)

    def test_EmbeddingError時は503を返す(
        self,
        search_client,
        valid_headers,
    ):
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

    def test_user_idでフィルタされる(
        self,
        search_client,
        valid_headers,
        mock_search_ratelimit,
    ):
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
        mock_search_ratelimit.limit.assert_called_once_with("specific-user")

    def test_レート制限超過時は429とヘッダーを返す(
        self,
        search_client,
        valid_headers,
        mock_search_ratelimit,
    ):
        # 固定の過去時刻を指定し、Retry-Afterの時刻依存を排除する。
        reset = 1_700_000_000_000

        mock_search_ratelimit.limit.return_value = SimpleNamespace(
            allowed=False,
            limit=10,
            remaining=0,
            reset=reset,
        )

        with patch("api.routers.search.TodoVectorService") as mock_cls:
            response = search_client.post(
                "/search/similar-todos",
                json=VALID_PAYLOAD,
                headers=valid_headers,
            )

        assert response.status_code == 429
        assert response.headers["X-RateLimit-Limit"] == "10"
        assert response.headers["X-RateLimit-Remaining"] == "0"
        assert response.headers["X-RateLimit-Reset"] == str(reset)
        assert response.headers["Retry-After"] == "0"

        # レート制限超過時はVector検索へ進まない。
        mock_cls.assert_not_called()
        mock_search_ratelimit.limit.assert_called_once_with("user123")