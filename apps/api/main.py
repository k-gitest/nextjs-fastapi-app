import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import sentry_sdk
import structlog
from api.config import settings
from api.error_handlers import register_exception_handlers
from api.infrastructure.access_log_middleware import AccessLogMiddleware
from api.infrastructure.db import close_db_pool, get_db_conn, init_db_pool
from api.infrastructure.logging import configure_structlog
from api.routers import internal, search, webhooks
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from structlog.contextvars import bind_contextvars, clear_contextvars

configure_structlog()

logger = structlog.get_logger(__name__)

# Sentryの初期化
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        sample_rate=settings.SENTRY_SAMPLE_RATE,
        environment="development" if settings.DEBUG else "production",
    )

"""
lifespan で DB プールの初期化・終了を管理する。
BackgroundTasks から呼ばれるサービスは同期接続を使うため、
プールはオプション（非同期エンドポイントが増えた場合に活きる）。
"""


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # 起動時
    await init_db_pool()
    yield
    # 終了時
    await close_db_pool()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# CORSの設定
# BACKEND_CORS_ORIGINS はpydanticのAnyHttpUrl型のリストなので文字列に変換
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=[
        "*",
        "sentry-trace",
        "baggage",
        "newrelic",
        "traceparent",
        "upstash-signature",  # QStash署名検証用
    ],
)

# accesslogの設定
app.add_middleware(AccessLogMiddleware)


# structlogの設定
@app.middleware("http")
async def structlog_middleware(request: Request, call_next):
    clear_contextvars()

    correlation_id = request.headers.get("x-correlation-id") or str(uuid.uuid4())

    bind_contextvars(
        service="api",
        correlation_id=correlation_id,
        method=request.method,
        route=request.scope["path"],
    )

    try:
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response
    finally:
        clear_contextvars()


# 統一エラーハンドラーを登録
register_exception_handlers(app)

# ルーターを登録
app.include_router(webhooks.router)
app.include_router(search.router)
app.include_router(internal.router)


@app.get("/")
def read_root():
    return {
        "status": "ok",
        "debug_mode": settings.DEBUG,
        "message": "FastAPI is ready",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/health/ready")
async def health_ready():
    """
    readiness gate（sequential deploymentで後続サービスを開始する前に、
    DB schemaが利用可能な状態であることを確認する）。

    processed_eventsへの到達確認により、DB接続とmigration完了の両方を
    1クエリで検証する。FastAPIがDB pool経由で参照・書き込みを行う対象は
    現状processed_eventsのみであるため、ここへの到達確認が
    schema readinessの判定として十分である。

    MotherDuck・Upstash等の外部分析基盤への疎通確認はスコープ外とする
    （分析基盤の障害でsequential deploy自体を止めないため）。
    """
    try:
        async with get_db_conn() as conn:
            await conn.execute("SELECT 1 FROM processed_events LIMIT 1")
    except Exception as exc:
        logger.exception(
            "health_ready_check_failed",
            error_type=type(exc).__name__,
        )
        return JSONResponse(status_code=503, content={"status": "not_ready"})

    return {"status": "ready"}
