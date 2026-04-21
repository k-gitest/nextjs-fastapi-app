from typing import Optional
from pydantic import AnyHttpUrl, BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    # --- Core ---
    PROJECT_NAME: str = "FastAPI Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "dev-secret-key"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # --- Database ---
    DATABASE_URL: str = ""
    REDIS_URL: str = "redis://db:6379/1"

    # --- CORS ---
    BACKEND_CORS_ORIGINS: Annotated[
        list[AnyHttpUrl] | str,
        BeforeValidator(lambda v: v.split(",") if isinstance(v, str) else v),
    ] = []

    # --- Auth (JWT & Auth0) ---
    AUTH0_DOMAIN: str = ""
    AUTH0_AUDIENCE: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 5
    REFRESH_TOKEN_EXPIRE_DAYS: int = 1

    # --- S3 / Backblaze ---
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_STORAGE_BUCKET_NAME: Optional[str] = None
    AWS_S3_ENDPOINT_URL: Optional[str] = None
    AWS_S3_REGION_NAME: str = "us-west-004"

    # --- Monitoring ---
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENABLED: bool = False
    SENTRY_SAMPLE_RATE: float = 1.0  # 追加: main.pyで参照していた
    NEW_RELIC_LICENSE_KEY: str = ""
    NEW_RELIC_APP_NAME: str = "fastapi-app"

    # --- QStash ---
    QSTASH_TOKEN: Optional[str] = None
    QSTASH_CURRENT_SIGNING_KEY: str = ""  # 追加: security.pyで参照していた
    QSTASH_NEXT_SIGNING_KEY: str = ""     # 追加: security.pyで参照していた

    # --- External Services ---
    GOOGLE_API_KEY: str = ""
    UPSTASH_VECTOR_REST_URL: str = ""
    UPSTASH_VECTOR_REST_TOKEN: str = ""
    MOTHERDUCK_TOKEN: str = ""
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "onboarding@resend.dev"  # 送信元メールアドレス

    # --- App ---
    FRONTEND_URL: str = "http://localhost:3000"

    # --- Upstash Redis ---
    UPSTASH_REDIS_REST_URL: str = ""
    UPSTASH_REDIS_REST_TOKEN: str = ""
    
    # --- Pipeline ---
    PIPELINE_DATABASE_URL: str = ""
    DLT_DATASET_NAME: str = "nextjs_fastapi_app_dwh"
    DLT_PIPELINE_NAME: str = "postgres_to_motherduck"
    
    # dltパイプラインのロックキーとタイムアウト（秒）
    DLT_LOCK_KEY: str = "dlt_pipeline:lock"
    DLT_LOCK_TIMEOUT: int = 600  # 10分

    # --- 内部API認証 ---
    # Next.js → FastAPI のサーバー間通信用シークレット
    # openssl rand -hex 32 で生成
    INTERNAL_API_SECRET: str = ""


settings = Settings()