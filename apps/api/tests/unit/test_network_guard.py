"""
Gemini / Upstash 通信ガードのユニットテスト
"""

from unittest.mock import Mock

import httpx
import pytest

from api.tests.network_guard import guarded_send


@pytest.fixture
def original_send():
    return Mock(return_value=httpx.Response(200))


@pytest.fixture
def client():
    with httpx.Client() as http_client:
        yield http_client


@pytest.mark.parametrize(
    "url",
    [
        "https://generativelanguage.googleapis.com/v1/models",
        "https://upstash.io/",
        "https://xxx.upstash.io/",
        "https://XXX.Upstash.IO/",
        "https://xxx.upstash.io:443/command",
        "https://xxx.upstash.io./command",
    ],
)
def test_対象ホストへの通信は遮断される(
    url,
    original_send,
    client,
):
    request = httpx.Request("POST", url)

    with pytest.raises(RuntimeError) as exc_info:
        guarded_send(original_send, client, request)

    host = request.url.host.lower().rstrip(".")
    assert host in str(exc_info.value).lower()
    original_send.assert_not_called()


@pytest.mark.parametrize(
    "url",
    [
        "https://evil-upstash.io/",
        "https://upstash.io.example.com/",
        "http://testserver/",
        "https://example.invalid/",
    ],
)
def test_対象外ホストへの通信は許可される(
    url,
    original_send,
    client,
):
    request = httpx.Request("POST", url)
    args = ("positional-argument",)
    kwargs = {"follow_redirects": True}

    response = guarded_send(
        original_send,
        client,
        request,
        *args,
        **kwargs,
    )

    assert response.status_code == 200
    original_send.assert_called_once_with(
        client,
        request,
        *args,
        **kwargs,
    )


def test_遮断例外にクエリやヘッダーを含めない(
    original_send,
    client,
):
    request = httpx.Request(
        "POST",
        "https://xxx.upstash.io/command?secret=query-secret",
        headers={"Authorization": "Bearer header-secret"},
    )

    with pytest.raises(RuntimeError) as exc_info:
        guarded_send(original_send, client, request)

    message = str(exc_info.value)

    assert "xxx.upstash.io" in message
    assert "query-secret" not in message
    assert "header-secret" not in message
    original_send.assert_not_called()