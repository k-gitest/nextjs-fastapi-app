"""
内部API認証

Next.js → FastAPI のサーバー間通信を保護する。
X-Internal-Token ヘッダーで共有シークレットを検証する。

QStash署名検証（verify_qstash_signature）とは別の認証経路。
Webhookはリトライ・非同期用、内部APIは同期レスポンス用。
"""
import secrets
import logging
from fastapi import Request, HTTPException
from api.config import settings

logger = logging.getLogger(__name__)


async def verify_internal_token(request: Request) -> None:
    """
    内部APIトークン検証のDependency

    Args:
        request: FastAPIリクエスト

    Raises:
        HTTPException 401: トークンが存在しないまたは不一致
    """
    token = request.headers.get("X-Internal-Token")

    if not token:
        logger.warning(
            "Internal API request missing X-Internal-Token header",
            extra={"path": str(request.url)},
        )
        raise HTTPException(
            status_code=401,
            detail="Missing internal token",
        )

    # タイミング攻撃を防ぐためsecrets.compare_digestを使用
    if not secrets.compare_digest(token, settings.INTERNAL_API_SECRET):
        logger.warning(
            "Internal API request with invalid token",
            extra={"path": str(request.url)},
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid internal token",
        )