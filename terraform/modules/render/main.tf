# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Render モジュール - リソース定義
# web (Next.js) / api (FastAPI) / worker (Node.js Background Worker)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

terraform {
  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.8"
    }
  }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Next.js Web Service
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

resource "render_web_service" "web" {
  name   = "${var.app_name}-web"
  plan   = "free"
  region = var.region

  # start_command = "npm run db:migrate:deploy && npm run start"

  runtime_source = {
    docker = {
      auto_deploy         = true
      auto_deploy_trigger = "checksPass"
      branch              = var.branch
      repo_url            = var.github_repo_url
      docker_context      = "apps/web"
      dockerfile_path     = "apps/web/Dockerfile"
      build_filter = {
        paths = ["apps/web/**", "packages/**"]
        # ignored_paths = []
      }
    }
  }

  env_vars = merge(
    {
      # Prisma / DB
      "DATABASE_URL" = { value = var.database_url }

      # Auth0
      "AUTH0_SECRET"          = { value = var.auth0_secret }
      "AUTH0_BASE_URL"        = { value = "https://${var.app_name}-web.onrender.com" }
      "AUTH0_ISSUER_BASE_URL" = { value = var.auth0_issuer_base_url }
      "AUTH0_CLIENT_ID"       = { value = var.auth0_client_id }
      "AUTH0_CLIENT_SECRET"   = { value = var.auth0_client_secret }
      "AUTH0_DOMAIN"          = { value = var.auth0_domain }

      # FastAPI内部通信（Docker内部ではなくRender間通信）
      "BACKEND_API_URL" = { value = "https://${var.app_name}-api.onrender.com" }
      "APP_BASE_URL"    = { value = "https://${var.app_name}-web.onrender.com" }

      # 内部認証トークン（セマンティック検索用）
      "INTERNAL_API_SECRET" = { value = var.internal_api_secret }

      # Upstash
      "UPSTASH_REDIS_REST_URL"   = { value = var.upstash_redis_rest_url }
      "UPSTASH_REDIS_REST_TOKEN" = { value = var.upstash_redis_rest_token }

      # Backblaze B2
      /*
      "AWS_ACCESS_KEY_ID"       = { value = var.b2_application_key_id }
      "AWS_SECRET_ACCESS_KEY"   = { value = var.b2_application_key }
      "AWS_STORAGE_BUCKET_NAME" = { value = var.s3_bucket_name }
      "AWS_S3_ENDPOINT_URL"     = { value = var.s3_endpoint }
      */

      "SENTRY_DSN" = { value = var.sentry_dsn_web }

      "NODE_ENV" = { value = "production" }
    },
    { for k, v in var.web_env_vars : k => { value = v } }
  )
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FastAPI Web Service
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

resource "render_web_service" "api" {
  name   = "${var.app_name}-api"
  plan   = "free"
  region = var.region

  runtime_source = {
    docker = {
      auto_deploy         = true
      auto_deploy_trigger = "checksPass"
      branch              = var.branch
      repo_url            = var.github_repo_url
      docker_context      = "."
      dockerfile_path     = "apps/api/Dockerfile"
      build_filter = {
        paths = ["apps/api/**"]
        # ignored_paths = []
      }
    }
  }

  env_vars = merge(
    {
      # アプリ共通の暗号化キー
      "SECRET_KEY" = { value = var.secret_key }

      # neon / DB
      "DATABASE_URL" = { value = var.database_url }

      # DB (config.pyの期待する変数名にマッピング)
      "PIPELINE_DATABASE_URL" = { value = var.database_url }

      # Upstash Redis（レートリミット用）
      "UPSTASH_REDIS_REST_URL"   = { value = var.upstash_redis_rest_url }
      "UPSTASH_REDIS_REST_TOKEN" = { value = var.upstash_redis_rest_token }

      # Upstash Vector（セマンティック検索用）
      "UPSTASH_VECTOR_REST_URL"   = { value = var.upstash_vector_endpoint }
      "UPSTASH_VECTOR_REST_TOKEN" = { value = var.upstash_vector_token }

      # QStash 署名検証（Webhook受信用）
      "QSTASH_CURRENT_SIGNING_KEY" = { value = var.qstash_current_signing_key }
      "QSTASH_NEXT_SIGNING_KEY"    = { value = var.qstash_next_signing_key }
      "QSTASH_URL"                 = { value = var.qstash_url }
      "QSTASH_TOKEN"               = { value = var.qstash_token }

      # Gemini（埋め込み生成用）
      "GEMINI_API_KEY" = { value = var.gemini_api_key }

      # MotherDuck（分析DB）
      "MOTHERDUCK_TOKEN" = { value = var.motherduck_token }

      # Resend
      "RESEND_API_KEY" = { value = var.resend_api_key }

      # 内部認証トークン（セマンティック検索用）
      "INTERNAL_API_SECRET" = { value = var.internal_api_secret }

      "SENTRY_DSN" = { value = var.sentry_dsn_api }

      "PYTHONUNBUFFERED" = { value = "1" }
      "ENVIRONMENT"      = { value = var.environment }
    },
    { for k, v in var.api_env_vars : k => { value = v } }
  )
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Node.js Worker (Background Worker)
# Outbox パターンのポーリングプロセス
# Starterプラン以上で有効化
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/*
resource "render_background_worker" "worker" {
  name   = "${var.app_name}-worker"
  plan   = "free" # freeプランはないので変更
  region = var.region

  runtime_source = {
    docker = {
      auto_deploy     = true
      branch          = var.branch
      repo_url        = var.github_repo_url
      docker_context  = "apps/worker"
      dockerfile_path = "apps/worker/Dockerfile"
      build_filter = {
        paths         = ["apps/worker/**", "packages/**"]
        ignored_paths = []
      }
    }
  }

  env_vars = merge(
    {
      # Prisma / DB（outbox_events ポーリング用）
      "DATABASE_URL" = { value = var.database_url }

      # QStash（FastAPIへのメッセージ送信用）
      "QSTASH_TOKEN"       = { value = var.qstash_token }
      "QSTASH_URL"         = { value = var.qstash_url }
      "INTERNAL_API_SECRET"= { value = var.internal_api_secret }
      "FASTAPI_PUBLIC_URL" = { value = "https://${var.app_name}-api.onrender.com" }

      "SENTRY_DSN" = { value = var.sentry_dsn_worker }

      "NODE_ENV" = { value = "production" }
    },
    { for k, v in var.worker_env_vars : k => { value = v } }
  )
}
*/

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Node.js Worker (Web Service / Staging用)
# Render Free Plan対応 - ダミーヘルスチェックサーバー付き
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

resource "render_web_service" "worker" {
  name   = "${var.app_name}-worker"
  plan   = "free"
  region = var.region

  runtime_source = {
    docker = {
      auto_deploy         = true
      auto_deploy_trigger = "checksPass"
      branch              = var.branch
      repo_url            = var.github_repo_url
      docker_context      = "apps/worker"
      dockerfile_path     = "apps/worker/Dockerfile"
      build_filter = {
        paths = ["apps/worker/**", "packages/**"]
        # ignored_paths = []
      }
    }
  }

  # start_command = "npm run start:staging"

  env_vars = merge(
    {
      "DATABASE_URL"        = { value = var.database_url }
      "QSTASH_TOKEN"        = { value = var.qstash_token }
      "QSTASH_URL"          = { value = var.qstash_url }
      "INTERNAL_API_SECRET" = { value = var.internal_api_secret }
      "FASTAPI_PUBLIC_URL"  = { value = "https://${var.app_name}-api.onrender.com" }
      "SENTRY_DSN"          = { value = var.sentry_dsn_worker }
      "NODE_ENV"            = { value = "production" }
    },
    { for k, v in var.worker_env_vars : k => { value = v } }
  )
}