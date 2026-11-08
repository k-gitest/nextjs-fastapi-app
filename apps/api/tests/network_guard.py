"""
Gemini / Upstash 向けのテスト通信ガード

対象は同期 HTTPX クライアントのみ。
Resend その他の外部サービスはこのガードの対象外。
"""

from collections.abc import Callable

import httpx


def guarded_send(
    original_send: Callable[..., httpx.Response],
    client: httpx.Client,
    request: httpx.Request,
    *args: object,
    **kwargs: object,
) -> httpx.Response:
    """Gemini / Upstash 宛ての同期 HTTP リクエストを遮断する。"""
    host = request.url.host.lower().rstrip(".")

    is_gemini = host == "generativelanguage.googleapis.com"
    is_upstash = host == "upstash.io" or host.endswith(".upstash.io")

    if is_gemini or is_upstash:
        raise RuntimeError(
            f"Network access to {host} is blocked in API tests"
        )

    return original_send(client, request, *args, **kwargs)