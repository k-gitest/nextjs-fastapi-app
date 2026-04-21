import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import webhooks, search
from api.config import settings
from api.error_handlers import register_exception_handlers

# Sentryの初期化
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        sample_rate=settings.SENTRY_SAMPLE_RATE,
        environment="development" if settings.DEBUG else "production",
    )

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
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

# 統一エラーハンドラーを登録
register_exception_handlers(app)

# ルーターを登録
app.include_router(webhooks.router)
app.include_router(search.router)


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