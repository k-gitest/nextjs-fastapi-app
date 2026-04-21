# --- 1. ビルドステージ ---
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /workspace/apps/api

# 依存関係のキャッシュを利用するために先にコピー
COPY apps/api/pyproject.toml apps/api/uv.lock* ./

# 仮想環境を構築せずにシステムにインストール（コンテナ内なので安全・高速）
RUN uv sync --frozen --no-cache

# --- 2. 最終ステージ (実行環境) ---
FROM python:3.12-slim AS final

WORKDIR /workspace/apps/api

# 実行ユーザーの追加（セキュリティ継承）
RUN useradd --no-create-home --shell /usr/sbin/nologin app_user
ENV PYTHONUNBUFFERED=1

# builderからインストール済みパッケージをコピー
COPY --from=builder /workspace/apps/api/.venv /workspace/apps/api/.venv
COPY . .

# パスを通す
ENV PATH="/workspace/apps/api/.venv/bin:$PATH"

USER app_user
EXPOSE 8000

# 開発時は docker-compose の command で上書き、本番はこれで起動
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]