import logging
from fastapi import Request, HTTPException
from qstash import Receiver

from api.config import settings

logger = logging.getLogger(__name__)

# QStashレシーバーのインスタンス化
receiver = Receiver(
    current_signing_key=settings.QSTASH_CURRENT_SIGNING_KEY,
    next_signing_key=settings.QSTASH_NEXT_SIGNING_KEY,
)


async def verify_qstash_signature(request: Request) -> None:
    """
    QStashからのWebhookリクエストの署名を検証するDependency

    webhooks.pyで Depends(verify_qstash_signature) として使用する

    """
    signature = request.headers.get("upstash-signature")
    if not signature:
        raise HTTPException(status_code=401, detail="Missing QStash signature")

    body = await request.body()

    try:
        decoded_body = body.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid request encoding")

    forwarded_proto = request.headers.get("x-forwarded-proto", "https")
    forwarded_host = request.headers.get("x-forwarded-host", request.headers.get("host"))
    path = request.url.path
    actual_url = f"{forwarded_proto}://{forwarded_host}{path}"

    try:
        # verify は成功時None、失敗時に例外を投げる
        receiver.verify(
            signature=signature,
            body=decoded_body,
            url=actual_url,
        )
    except Exception as e:
        logger.warning(f"QStash signature verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid QStash signature")